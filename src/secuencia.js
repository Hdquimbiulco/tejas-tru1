// =============================================================================
// SECUENCIA DE FOTOGRAMAS (el "video" de la portada y de policarbonato)
// -----------------------------------------------------------------------------
// Secuencia de fotogramas dibujada en un <canvas> según el avance del scroll.
// Los fotogramas se guardan comprimidos y sólo una ventana alrededor del actual
// queda decodificada, fuera del hilo principal. Dibujar nunca espera una
// decodificación: si el fotograma exacto no está listo, se usa el más cercano.
//
// En palabras simples: el video se cortó en fotos (public/frames/<carpeta>/
// f001.webp, f002.webp, ...). Al bajar, se dibuja la foto que toca. Para no
// llenar la memoria, sólo se preparan las fotos cercanas a la actual.
//
// Lo usa main.js, sección 1.
// =============================================================================

// Fotogramas decodificados hacia cada lado del actual. En celular (menos de
// 768 px) son pocos: cada uno ocupa varios MB de memoria ya descomprimido.
const VENTANA = innerWidth < 768 ? 6 : 24;
const SIMULTANEOS = 6; // cuántos fotogramas se preparan a la vez como máximo

/** Descarga los fotogramas; `alCargar` avisa cada uno terminado. */
// carpeta: nombre en public/frames/ (viene de data-frames del HTML)
// total:   cantidad de fotogramas (data-total)
// paso:    1 = todos; 2 = uno de cada dos (en celular)
export function cargarFotogramas(carpeta, total, paso, alCargar) {
  const pedidos = [];
  for (let i = 1; i <= total; i += paso) {
    // padStart(3, '0') convierte 7 en "007" → frames/portada/f007.webp
    const url = `${import.meta.env.BASE_URL}frames/${carpeta}/f${String(i).padStart(3, '0')}.webp`;
    // fetch descarga el archivo; blob() lo guarda comprimido en memoria.
    pedidos.push(fetch(url).then((r) => r.blob()).then((b) => { alCargar(); return b; }));
  }
  return Promise.all(pedidos);
}

/** Dibuja los fotogramas en el canvas como object-fit: cover. */
export async function crearSecuencia(canvas, blobs) {
  const ctx = canvas.getContext('2d', { alpha: false });   // "pincel" 2D del canvas
  const listos = new Map();     // fotogramas ya preparados para dibujar (número → imagen)
  const enCurso = new Set();    // fotogramas que se están preparando
  let objetivo = 0;             // fotograma que corresponde al scroll actual
  let dibujado = -1;            // fotograma que está en pantalla

  // Busca el fotograma listo más cercano a k (k, k-1, k+1, k-2, ...).
  function cercano(k) {
    for (let d = 0; d <= VENTANA; d += 1) {
      if (listos.has(k - d)) return k - d;
      if (listos.has(k + d)) return k + d;
    }
    return -1;
  }

  // Dibuja el fotograma cubriendo todo el canvas sin deformarse (como
  // object-fit: cover en CSS): escala para cubrir y centra lo que sobra.
  function dibujar() {
    const k = cercano(objetivo);
    if (k < 0 || k === dibujado) return;
    dibujado = k;
    const img = listos.get(k);
    const escala = Math.max(canvas.width / img.width, canvas.height / img.height);
    const w = img.width * escala;
    const h = img.height * escala;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
  }

  // Borra de la memoria los fotogramas lejanos al actual.
  function liberarLejanos() {
    listos.forEach((img, i) => {
      if (Math.abs(i - objetivo) > VENTANA * 1.5) {
        img.close();
        listos.delete(i);
      }
    });
  }

  // Prepara (descomprime) el fotograma i para poder dibujarlo rápido.
  function decodificar(i) {
    enCurso.add(i);
    return createImageBitmap(blobs[i]).then((img) => {
      enCurso.delete(i);
      listos.set(i, img);
      dibujar();
      adelantar();
    });
  }

  // Del fotograma actual hacia afuera: primero lo que se va a ver antes
  function adelantar() {
    for (let d = 0; d <= VENTANA && enCurso.size < SIMULTANEOS; d += 1) {
      for (const i of [objetivo + d, objetivo - d]) {
        if (i >= 0 && i < blobs.length && !listos.has(i) && !enCurso.has(i) && enCurso.size < SIMULTANEOS) {
          decodificar(i);
        }
      }
    }
  }

  // Ajusta la resolución del canvas al tamaño en pantalla. devicePixelRatio
  // es la densidad de la pantalla (2 en pantallas "retina"); se limita a 1.5
  // para no gastar de más.
  // En celular, la barra del navegador que aparece y se esconde también avisa
  // "resize": si el canvas no cambió de tamaño, no se toca (cambiar width o
  // height borra el dibujo y obliga a redibujar).
  function ajustarTamano() {
    const dpr = Math.min(devicePixelRatio, 1.5);
    const ancho = Math.round(canvas.clientWidth * dpr);
    const alto = Math.round(canvas.clientHeight * dpr);
    if (ancho === canvas.width && alto === canvas.height) return;
    canvas.width = ancho;
    canvas.height = alto;
    ctx.imageSmoothingQuality = 'high';
    dibujado = -1;
    dibujar();
  }
  addEventListener('resize', ajustarTamano);   // al cambiar el tamaño de la ventana

  await decodificar(0);   // el primer fotograma, para que no se vea negro
  ajustarTamano();

  // Lo que main.js puede usar de este dibujante:
  return {
    // p va de 0 (inicio del recorrido) a 1 (final): elige el fotograma.
    mostrar(p) {
      objetivo = Math.round(p * (blobs.length - 1));
      liberarLejanos();
      adelantar();
      dibujar();
    },
    // Al salir de la sección se conserva sólo el fotograma en pantalla
    liberar() {
      listos.forEach((img, i) => {
        if (i !== dibujado) {
          img.close();
          listos.delete(i);
        }
      });
    },
  };
}
