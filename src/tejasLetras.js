// =============================================================================
// TEJAS QUE SE PEGAN A LA PALABRA "TRUVEC" (pie de página, variante B)
// -----------------------------------------------------------------------------
// Sobre una pared plomo con la palabra TRUVEC marcada en gris, al llegar al
// final de la página las tejas van cubriendo las letras de a poco, de
// izquierda a derecha y de abajo hacia arriba. Es un dibujo plano (2D, sin
// sombras proyectadas): cada teja baja un poco, aparece y se pega en su
// lugar. Cada vez que el pie vuelve a entrar en pantalla, se repite.
//
// La teja imita la de la foto cumbrera.jpg: teja grande, terracota y
// brillosa, con la onda redondeada de cada fila, el borde de abajo con un
// filo de luz, la sombra pintada bajo la fila de arriba, reflejos y un grano
// fino que deja ver la textura. Las columnas van alineadas, como en una
// plancha de techo, y las tejas se recortan con la forma de las letras.
//
// Usa sólo el canvas 2D del navegador (sin Three.js).
// HTML: <div class="pie-techo"> con <canvas id="techoTejas">.
// Lo carga main.js (sección 9) cuando el pie está por entrar en pantalla.
// =============================================================================
const PALABRA = 'TRUVEC';
const LLEGADA = 0.7;       // segundos que tarda una teja en pegarse
const LLUVIA = 3.6;        // segundos entre la primera y la última teja que llega
const FONDO = '#0f1316';   // color del sitio (var(--fondo) en CSS)

// Tonos de la teja (sacados de cumbrera.jpg): para cambiarlos, cambiar estos códigos.
const TONOS = ['#d4642a', '#dc6e31', '#cc5c25', '#e07636'];

// Aclara u oscurece un color "#rrggbb" (k de 0 a 1)
function mezclar(hex, destino, k) {
  const n = parseInt(hex.slice(1), 16);
  const canal = (v) => Math.round(v + (destino - v) * k);
  return `rgb(${canal(n >> 16)}, ${canal((n >> 8) & 255)}, ${canal(n & 255)})`;
}
const aclarar = (hex, k) => mezclar(hex, 255, k);
const oscurecer = (hex, k) => mezclar(hex, 0, k);

// Dibuja una teja de ancho a y alto b en su propio canvas. Se hace una vez por
// tono y después se copia, así la animación es liviana.
function dibujarTeja(tono, a, b) {
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.ceil(a);
  lienzo.height = Math.ceil(b);
  const c = lienzo.getContext('2d');
  const r = a / 2;        // radio de la onda de abajo (horizontal)
  const rv = a * 0.2;     // radio de la onda de abajo (vertical)
  const borde = b - rv;   // altura donde empieza la onda

  // Forma: rectángulo con el borde de abajo redondeado (la onda de la teja)
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(a, 0);
  c.lineTo(a, borde);
  c.ellipse(r, borde, r, rv, 0, 0, Math.PI);
  c.closePath();
  c.save();
  c.clip();

  // Volumen de la onda: canal oscuro a los costados, lomo claro cerca del centro
  const lomo = c.createLinearGradient(0, 0, a, 0);
  lomo.addColorStop(0, oscurecer(tono, 0.42));
  lomo.addColorStop(0.14, oscurecer(tono, 0.12));
  lomo.addColorStop(0.38, aclarar(tono, 0.16));
  lomo.addColorStop(0.6, tono);
  lomo.addColorStop(0.86, oscurecer(tono, 0.14));
  lomo.addColorStop(1, oscurecer(tono, 0.42));
  c.fillStyle = lomo;
  c.fillRect(0, 0, a, b);

  // Sombra pintada arriba, debajo del borde de la fila de arriba
  const arriba = c.createLinearGradient(0, 0, 0, b);
  arriba.addColorStop(0, 'rgba(45, 12, 0, .7)');
  arriba.addColorStop(0.16, 'rgba(45, 12, 0, .15)');
  arriba.addColorStop(0.3, 'rgba(45, 12, 0, 0)');
  c.fillStyle = arriba;
  c.fillRect(0, 0, a, b);

  // Brillo: una franja angosta y fuerte, y otra ancha y suave
  const franja = (x0, x1, alfa) => {
    const g = c.createLinearGradient(a * x0, 0, a * x1, 0);
    g.addColorStop(0, 'rgba(255, 238, 220, 0)');
    g.addColorStop(0.5, `rgba(255, 238, 220, ${alfa})`);
    g.addColorStop(1, 'rgba(255, 238, 220, 0)');
    c.fillStyle = g;
    c.fillRect(0, b * 0.12, a, b);
  };
  franja(0.18, 0.56, 0.28);
  franja(0.3, 0.42, 0.6);

  // Grano fino: pequeñas variaciones de luz en cada punto (textura de la teja)
  const datos = c.getImageData(0, 0, lienzo.width, lienzo.height);
  const d = datos.data;
  for (let i = 0; i < d.length; i += 4) {
    const ruido = (Math.random() - 0.5) * 14;
    d[i] += ruido;
    d[i + 1] += ruido * 0.8;
    d[i + 2] += ruido * 0.6;
  }
  c.putImageData(datos, 0, 0);
  c.restore();

  // Borde de abajo: filo de luz encima y línea oscura afuera
  c.lineWidth = Math.max(1, a * 0.035);
  c.strokeStyle = 'rgba(255, 226, 200, .75)';
  c.beginPath();
  c.ellipse(r, borde - c.lineWidth * 1.4, r - c.lineWidth * 2, rv - c.lineWidth * 1.6, 0, 0.25, Math.PI - 0.25);
  c.stroke();
  c.strokeStyle = oscurecer(tono, 0.6);
  c.beginPath();
  c.ellipse(r, borde, r - c.lineWidth / 2, rv - c.lineWidth / 2, 0, 0, Math.PI);
  c.stroke();
  return lienzo;
}

export async function crearLetras(canvas) {
  // La palabra usa la letra de los títulos: se espera a que esté descargada.
  await document.fonts.load('800 100px "Bricolage Grotesque"');
  const c = canvas.getContext('2d');
  const fuente = (t) => `800 ${t}px "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif`;

  let pared;        // pared plomo con la palabra marcada (se dibuja una vez)
  let capa;         // lienzo aparte donde se dibujan las tejas
  let palabra;      // tamaño y posición de la palabra
  let piezas = [];  // tejas: lugar final, tono y cuándo llega
  let caida = 0;    // cuánto baja una teja al llegar (píxeles)
  let inicio = 0;
  let corriendo = false;

  // Arma todo según el tamaño del recuadro en pantalla.
  function preparar() {
    const escala = Math.min(devicePixelRatio, 2);
    const W = Math.round(canvas.clientWidth * escala);
    const H = Math.round(canvas.clientHeight * escala);
    canvas.width = W;
    canvas.height = H;

    // Palabra: ocupa el 90 % del ancho
    c.font = fuente(100);
    const tam = Math.min((100 * W * 0.9) / c.measureText(PALABRA).width, H);
    c.font = fuente(tam);
    const medida = c.measureText(PALABRA);
    palabra = { tam, x: (W - medida.width) / 2, y: (H + medida.actualBoundingBoxAscent) / 2 };

    // Pared plomo: clara en el centro y oscura hacia los bordes, con la palabra en gris
    pared = document.createElement('canvas').getContext('2d');
    pared.canvas.width = W;
    pared.canvas.height = H;
    const luz = pared.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
    luz.addColorStop(0, '#4a5056');
    luz.addColorStop(0.55, '#2b3035');
    luz.addColorStop(1, FONDO);
    pared.fillStyle = luz;
    pared.fillRect(0, 0, W, H);
    pared.font = fuente(tam);
    pared.fillStyle = 'rgba(15, 19, 22, .55)';
    pared.fillText(PALABRA, palabra.x, palabra.y);

    capa = document.createElement('canvas').getContext('2d');
    capa.canvas.width = W;
    capa.canvas.height = H;

    // Tamaño de la teja: grande (en celular, más chica para que se lea la palabra)
    const a = (canvas.clientWidth < 700 ? 18 : 46) * escala;
    const b = a * 1.35;
    const fila = b * 0.8;   // cada fila monta sobre la de abajo
    caida = b * 0.45;
    const tejas = TONOS.map((tono) => dibujarTeja(tono, a, b));

    // Dónde hay letra: se escribe la palabra en un lienzo aparte y se lee
    const marca = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    marca.canvas.width = W;
    marca.canvas.height = H;
    marca.font = fuente(tam);
    marca.fillText(PALABRA, palabra.x, palabra.y);
    const letra = marca.getImageData(0, 0, W, H).data;
    // Va una teja si alguno de cinco puntos suyos cae en una letra
    const puntos = [[0.5, 0.45], [0.15, 0.3], [0.85, 0.3], [0.15, 0.75], [0.85, 0.75]];
    const tocaLetra = (x, y) => puntos.some(([dx, dy]) => {
      const px = Math.round(x + dx * a);
      const py = Math.round(y + dy * b);
      return px >= 0 && py >= 0 && px < W && py < H && letra[(py * W + px) * 4 + 3] > 0;
    });

    // Lugares: filas de abajo hacia arriba (así cada fila queda encima de la de
    // abajo, como en un techo), con las columnas alineadas.
    const arriba = palabra.y - medida.actualBoundingBoxAscent - b;
    const abajo = palabra.y + medida.actualBoundingBoxDescent;
    const izquierda = palabra.x - a / 2;
    const derecha = palabra.x + medida.width + a / 2;
    const filas = Math.ceil((abajo - arriba) / fila);
    piezas = [];
    let n = 0;
    for (let f = 0; f < filas; f += 1) {
      const y = abajo - b * 0.5 - f * fila;
      for (let x = izquierda; x < derecha; x += a) {
        n += 1;
        if (!tocaLetra(x, y)) continue;
        piezas.push({
          x, y,
          teja: tejas[(n * 5 + f) % tejas.length],
          // Van cubriendo de izquierda a derecha y, en cada lugar, de abajo hacia arriba
          sale: ((x - izquierda) / (derecha - izquierda)) * LLUVIA * 0.8 + (f / filas) * LLUVIA * 0.2,
        });
      }
    }
  }

  // Curva de llegada: rápida al principio, se pasa apenas y se asienta
  const pegar = (k) => 1 + 2.2 * (k - 1) ** 3 + 1.2 * (k - 1) ** 2;

  // Dibuja un cuadro. t = segundos desde el inicio; null = todas pegadas.
  // Devuelve cuántas tejas faltan por pegarse.
  function dibujar(t) {
    const W = canvas.width;
    const H = canvas.height;
    capa.globalCompositeOperation = 'source-over';
    capa.clearRect(0, 0, W, H);
    let pendientes = 0;
    for (const p of piezas) {
      const k = t === null ? 1 : Math.min(Math.max((t - p.sale) / LLEGADA, 0), 1);
      if (k < 1) pendientes += 1;
      if (k === 0) continue;
      // Baja desde un poco más arriba, algo más grande, y se pega en su lugar
      const e = pegar(k);
      const tam = 1 + (1 - e) * 0.25;
      const w = p.teja.width * tam;
      const h = p.teja.height * tam;
      capa.globalAlpha = Math.min(1, k * 3);
      capa.drawImage(p.teja, p.x + (p.teja.width - w) / 2, p.y - (1 - e) * caida + (p.teja.height - h) / 2, w, h);
    }
    // Las tejas sólo quedan dentro de las letras
    capa.globalAlpha = 1;
    capa.globalCompositeOperation = 'destination-in';
    capa.font = fuente(palabra.tam);
    capa.fillText(PALABRA, palabra.x, palabra.y);
    c.drawImage(pared.canvas, 0, 0);
    c.drawImage(capa.canvas, 0, 0);
    return pendientes;
  }

  function cuadro(ahora) {
    if (dibujar((ahora - inicio) / 1000) > 0) requestAnimationFrame(cuadro);
    else corriendo = false;
  }
  function empezar() {
    if (corriendo) return;
    corriendo = true;
    inicio = performance.now();
    requestAnimationFrame(cuadro);
  }

  // Si cambia el ancho del recuadro, se arma todo de nuevo y se muestra
  // terminado. Si sólo cambió el alto (la barra del celular), no hace nada.
  let anchoPrevio = canvas.clientWidth;
  addEventListener('resize', () => {
    if (canvas.clientWidth === anchoPrevio) return;
    anchoPrevio = canvas.clientWidth;
    preparar();
    if (!corriendo) dibujar(null);
  });

  preparar();
  // Con "reducir movimiento" la palabra aparece ya cubierta, sin animación.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    dibujar(null);
    return;
  }
  dibujar(0);   // posición inicial: sólo la pared con la palabra marcada

  // Empieza cuando el recuadro se ve casi entero (al llegar al final de la
  // página); cuando sale de la pantalla, se prepara para repetir.
  new IntersectionObserver(([e]) => {
    if (e.intersectionRatio >= 0.85) empezar();
    else if (!e.isIntersecting && !corriendo) dibujar(0);
  }, { threshold: [0, 0.85] }).observe(canvas);
}
