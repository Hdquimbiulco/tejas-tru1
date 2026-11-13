// =============================================================================
// JAVASCRIPT PRINCIPAL DEL SEGUNDO SITIO (versión «mosaico»)
// -----------------------------------------------------------------------------
// Partes del archivo (buscar el título con Ctrl+F):
//   0. CARGA                      → pantalla de carga con porcentaje
//   1. PORTADA                    → fotogramas de la lluvia atados al scroll
//   1b. LÁMINA 3D                 → modelo de Blender que gira y cambia de color
//   2. PALABRAS QUE SE ENCIENDEN  → «Por qué empezar por el material»
//   3. ENTRADAS                   → tarjetas que aparecen al llegar
//   4. MOSAICO                    → filtros por material y visor
//   5. COMPARADOR                 → grupos que se abren y cierran
//   6. MENÚ EN CELULAR
//   7. ENTREGA EN OBRA            → la línea de ruta se llena
//   8. COTIZAR                    → calculadora, WhatsApp y correo
//   9. PIE Y FIN DE LA CARGA
//
// GSAP anima; ScrollTrigger ata la animación al scroll (ver el primer sitio,
// tejas/src/main.js, para la explicación de trigger, start, end, scrub y pin).
// =============================================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cargarFotogramas, crearSecuencia } from './secuencia.js';
import { cargarLamina, crearLamina } from './lamina3d.js';   // lámina de PVC en 3D

gsap.registerPlugin(ScrollTrigger);

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
const celular = innerWidth < 768;
document.documentElement.classList.add('cargando');

// ---------------------------------------------------------------------------
// 0. CARGA — el porcentaje cuenta fotogramas y fotos terminados
// ---------------------------------------------------------------------------
const PASO = celular ? 2 : 1;            // en celular, 1 de cada 2 fotogramas
const escenas = $$('[data-frames]');
const medios = $$('[data-cargar]');
const PESO_MEDIO = 6;                    // una foto cuenta como 6 fotogramas
const PESO_MODELO = 20;                  // el modelo 3D cuenta como 20 fotogramas
const totalCarga = escenas.reduce((n, e) => n + Math.ceil(e.dataset.total / PASO), 0) + medios.length * PESO_MEDIO + PESO_MODELO;
let cargado = 0;
function sumar(n = 1) {
  cargado += n;
  const pct = Math.min(100, Math.round((cargado / totalCarga) * 100));
  $('#cargaPct').textContent = `${pct} %`;
  $('#cargaBarra').style.transform = `scaleX(${pct / 100})`;
}
const [fotogramas, modeloLamina] = await Promise.all([
  Promise.all(escenas.map((e) => cargarFotogramas(e.dataset.frames, +e.dataset.total, PASO, sumar))),
  // Los tres modelos 3D (PVC, policarbonato y polipropileno). Si alguno no carga,
  // el sitio sigue sin la sección 3D (modeloLamina = null).
  Promise.all(['lamina_pvc', 'lamina_policarbonato', 'lamina_polipropileno'].map((n) => cargarLamina(`${import.meta.env.BASE_URL}modelos/${n}.glb`))).then(
    (m) => { sumar(PESO_MODELO); return m; },
    () => { sumar(PESO_MODELO); return null; },
  ),
  ...medios.map((m) => m.decode().catch(() => {}).then(() => sumar(PESO_MEDIO))),
]);

// ---------------------------------------------------------------------------
// 1. PORTADA — la escena queda fija y el scroll elige el fotograma
// Los textos .cap aparecen y se van según data-tramo="inicio,fin".
// ---------------------------------------------------------------------------
const secuencias = await Promise.all(escenas.map((e, i) => crearSecuencia(e.querySelector('canvas'), fotogramas[i])));
escenas.forEach((escena, i) => {
  const secuencia = secuencias[i];
  secuencia.liberar();
  if (quieto) return;
  const tl = gsap.timeline({
    defaults: { ease: 'none', duration: 0.04 },
    onUpdate: () => secuencia.mostrar(tl.progress()),
    scrollTrigger: {
      trigger: escena,
      start: 'top top',
      end: `+=${escena.dataset.pantallas * 100}%`,
      pin: true,
      scrub: 0.35,
      onToggle: ({ isActive }) => { if (!isActive) secuencia.liberar(); },
    },
  });
  escena.querySelectorAll('[data-tramo]').forEach((el) => {
    const [a, b] = el.dataset.tramo.split(',').map(Number);
    // Los textos entran de lado (x) en lugar de desde abajo, para distinguirlo del primer sitio.
    const desde = el.classList.contains('cap-der') ? 60 : -60;
    if (a > 0) tl.fromTo(el, { autoAlpha: 0, x: desde }, { autoAlpha: 1, x: 0 }, a);
    if (b < 1) tl.to(el, { autoAlpha: 0, x: -desde / 2 }, b - 0.04);
  });
  tl.set({}, {}, 1);
});
// ---------------------------------------------------------------------------
// 1b. LÁMINAS 3D — la sección queda fija; el scroll gira la lámina de PVC, cambia
// su color y después la reemplaza por la de policarbonato y por la de polipropileno.
// Un solo escritor: este bloque sólo MIDE (avance, color y etapa); lamina3d.js
// mueve los modelos.
//   avance 0    → 0,36 : PVC, un tramo por color
//   0,36 → 0,42        : cambio a policarbonato (etapa de 0 a 1)
//   0,42 → 0,68        : policarbonato
//   0,68 → 0,74        : cambio a polipropileno (etapa de 1 a 2)
//   0,74 → 1           : polipropileno
// Dentro del tramo de cada lámina, "recorrido" va de 0 a 1: la cámara se acerca y
// la recorre de punta a punta (lamina3d.js).
// Los data-tramo de los .detalle de index.html siguen estos mismos números.
// ---------------------------------------------------------------------------
const FIN_PVC = 0.36;
const INICIO_PC = 0.42;
const FIN_PC = 0.68;
const INICIO_PP = 0.74;
const seccionLamina = $('#lamina');
const colores = $$('.colores li');
const coloresPvc = colores.filter((li) => li.dataset.material === 'pvc');
const acabadoPc = colores.find((li) => li.dataset.material === 'pc');
const acabadoPp = colores.find((li) => li.dataset.material === 'pp');
colores.forEach((li) => li.style.setProperty('--muestra', li.dataset.color));
if (!modeloLamina) {
  seccionLamina.hidden = true;             // sin modelos no se muestra la sección
} else {
  const lamina = crearLamina(seccionLamina.querySelector('canvas'), ...modeloLamina);
  let avanceLamina = 0;
  let colorActivo = 0;                     // índice dentro de coloresPvc
  let etapa = 0;
  let recorrido = 0;                       // avance dentro del tramo de la lámina actual                           // 0 = PVC, 1 = policarbonato, 2 = polipropileno
  let aLaVista = false;
  let fijacion = null;                     // el ScrollTrigger que deja fija la sección
  if (!quieto) {
    // Los detalles 01 a 08 aparecen y se van según su data-tramo.
    const tlDetalles = gsap.timeline({ defaults: { ease: 'none', duration: 0.04 } });
    seccionLamina.querySelectorAll('.detalle').forEach((el) => {
      const [a, b] = el.dataset.tramo.split(',').map(Number);
      if (a > 0) tlDetalles.fromTo(el, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0 }, a);
      if (b < 1) tlDetalles.to(el, { autoAlpha: 0, y: -24 }, b - 0.04);
    });
    tlDetalles.set({}, {}, 1);
    fijacion = ScrollTrigger.create({
      trigger: seccionLamina,
      start: 'top top',
      end: '+=700%',                       // siete pantallas: unas dos y media por lámina
      pin: true,
      scrub: 0.4,
      animation: tlDetalles,
      onUpdate: (st) => {
        const p = st.progress;
        avanceLamina = p;
        // Un tramo de scroll por color de PVC (5 colores = 5 tramos hasta FIN_PVC).
        colorActivo = Math.min(coloresPvc.length - 1, Math.floor((p / FIN_PVC) * coloresPvc.length));
        // gsap.utils.clamp(0, 1, x) deja x entre 0 y 1.
        etapa = gsap.utils.clamp(0, 1, (p - FIN_PVC) / (INICIO_PC - FIN_PVC))
          + gsap.utils.clamp(0, 1, (p - FIN_PC) / (INICIO_PP - FIN_PC));
        // Fuera de los tramos (en los cambios) vale 1 o 0: la cámara está lejos.
        recorrido = p < INICIO_PC ? gsap.utils.clamp(0, 1, p / FIN_PVC)
          : p < INICIO_PP ? gsap.utils.clamp(0, 1, (p - INICIO_PC) / (FIN_PC - INICIO_PC))
          : (p - INICIO_PP) / (1 - INICIO_PP);
        const activo = etapa > 1.5 ? acabadoPp : etapa > 0.5 ? acabadoPc : coloresPvc[colorActivo];
        colores.forEach((li) => li.classList.toggle('activo', li === activo));
      },
    });
  }
  // Se dibuja sólo mientras la sección está en pantalla. Con la sección fija, "en
  // pantalla" dura hasta el final de la fijación más una pantalla (lo que tarda en
  // salir por arriba); 'bottom top' a secas no cuenta las pantallas fijas.
  ScrollTrigger.create({
    trigger: seccionLamina, start: 'top bottom',
    end: () => (fijacion ? fijacion.end + innerHeight : 'bottom top'),
    onToggle: ({ isActive }) => { aLaVista = isActive; },
  });
  gsap.ticker.add(() => { if (aLaVista) lamina.render(avanceLamina, coloresPvc[colorActivo].dataset.color, etapa, recorrido); });
  lamina.render(0, coloresPvc[0].dataset.color, 0, 0);
}

if (!quieto) gsap.to('#avance', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: true } });

// ---------------------------------------------------------------------------
// 2. PALABRAS QUE SE ENCIENDEN
// data-calientes="material|clima,|luz" → palabras que quedan en color.
// ---------------------------------------------------------------------------
$$('.encendido').forEach((texto) => {
  const calientes = (texto.dataset.calientes || '').split('|').filter(Boolean);
  texto.innerHTML = texto.textContent.trim().split(/\s+/).map((w) => {
    const caliente = calientes.some((c) => w.toLowerCase().replace(/[«»]/g, '').startsWith(c));
    return `<span${caliente ? ' class="caliente"' : ''}>${w}</span>`;
  }).join(' ');
  if (!quieto) {
    gsap.from(texto.querySelectorAll('span'), {
      opacity: 0.12, stagger: 0.05, ease: 'none',
      scrollTrigger: { trigger: texto, start: 'top 78%', end: 'bottom 50%', scrub: true },
    });
  }
});

// ---------------------------------------------------------------------------
// 3. ENTRADAS — las tarjetas suben y aparecen una tras otra al llegar
// ScrollTrigger.batch agrupa las que entran juntas en pantalla.
// ---------------------------------------------------------------------------
if (!quieto) {
  const entrar = (selector, extra = {}) => {
    gsap.set(selector, { autoAlpha: 0, y: 60 });
    ScrollTrigger.batch(selector, {
      start: 'top 88%',
      once: true,
      onEnter: (lote) => gsap.to(lote, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.12, ...extra }),
    });
  };
  entrar('.material');
  entrar('.rasgo', { duration: 0.6, stagger: 0.06 });
  entrar('.obra');
  entrar('.cabecera');
}

// ---------------------------------------------------------------------------
// 4. MOSAICO — filtros por material y visor de la foto ampliada
// HTML: .filtro[data-filtro] y .pieza[data-material]; <dialog id="visor">.
// ---------------------------------------------------------------------------
const NOMBRES = { pvc: 'PVC', pc: 'Policarbonato', pp: 'Polipropileno' };
$$('.filtro').forEach((boton) => boton.addEventListener('click', () => {
  const filtro = boton.dataset.filtro;
  $$('.filtro').forEach((b) => b.classList.toggle('activo', b === boton));
  const visibles = [];
  $$('.pieza').forEach((p) => {
    const mostrar = filtro === 'todos' || p.dataset.material === filtro;
    p.classList.toggle('oculta', !mostrar);
    if (mostrar) visibles.push(p);
  });
  // Las fotos que quedan aparecen con un pequeño zoom, una tras otra.
  if (!quieto) gsap.fromTo(visibles, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.5, stagger: 0.03, ease: 'power2.out' });
  ScrollTrigger.refresh();   // la altura de la sección cambió: recalcular lo que viene abajo
}));
const visor = $('#visor');
$$('.pieza').forEach((p) => p.addEventListener('click', () => {
  const img = p.querySelector('img');
  visor.querySelector('img').src = img.src;
  visor.querySelector('img').alt = img.alt;
  visor.querySelector('p').textContent = `${NOMBRES[p.dataset.material]} · ${img.alt}`;
  visor.showModal();
}));
visor.querySelector('.visor-cerrar').addEventListener('click', () => visor.close());
// Tocar fuera de la foto (en el fondo oscuro) también cierra.
visor.addEventListener('click', (e) => { if (e.target === visor) visor.close(); });

// ---------------------------------------------------------------------------
// 5. COMPARADOR — cada grupo se abre y se cierra con su botón
// La clase "abierto" en <tbody class="grupo"> muestra sus filas (CSS sección 8).
// ---------------------------------------------------------------------------
$$('.grupo-titulo button').forEach((boton) => boton.addEventListener('click', () => {
  const abierto = boton.closest('.grupo').classList.toggle('abierto');
  boton.setAttribute('aria-expanded', abierto);
  ScrollTrigger.refresh();
}));

// ---------------------------------------------------------------------------
// 6. MENÚ EN CELULAR
// ---------------------------------------------------------------------------
const barra = $('.barra');
const menuBoton = $('.menu-boton');
menuBoton.addEventListener('click', () => {
  const abierto = barra.classList.toggle('abierta');
  menuBoton.setAttribute('aria-expanded', abierto);
});
$$('.menu a').forEach((a) => a.addEventListener('click', () => {
  barra.classList.remove('abierta');
  menuBoton.setAttribute('aria-expanded', 'false');
}));

// ---------------------------------------------------------------------------
// 7. ENTREGA EN OBRA — al llegar, la ruta se llena parada por parada
// --i = número de parada; el CSS lo usa como retraso de cada tramo.
// ---------------------------------------------------------------------------
$$('.ruta li').forEach((li, i) => li.style.setProperty('--i', i));
ScrollTrigger.create({ trigger: '.ruta', start: 'top 75%', once: true, onEnter: () => $('.ruta').classList.add('activa') });

// ---------------------------------------------------------------------------
// 8. COTIZAR
// ---------------------------------------------------------------------------
// Datos de contacto de PRUEBA: reemplazar por los reales de ventas.
const WHATSAPP = '593999999999';
const CORREO = 'ventas@truvec.example';
$$('[data-wa]').forEach((a) => { a.href = `https://wa.me/${WHATSAPP}`; });
$('[data-wa-texto]').textContent = `+${WHATSAPP.slice(0, 3)} ${WHATSAPP.slice(3, 5)} ${WHATSAPP.slice(5, 8)} ${WHATSAPP.slice(8)}`;
$('[data-correo-texto]').textContent = CORREO;

// Ancho útil por lámina (m) y peso por m²: se llenan con la ficha técnica; sin dato no se estima.
const ANCHO_UTIL = { pp: null, pc: null, pvc: null };
const PESO_M2 = { pp: null, pc: null, pvc: null };
const TRASLAPE = 0.05;
let pedido = {};
// El material elegido es la tarjeta (radio) marcada.
const materialElegido = () => $('input[name="material"]:checked');
function calcular() {
  const opcion = materialElegido();
  const material = opcion.value;
  const area = (+$('#largo').value || 0) * (+$('#ancho').value || 0);
  const conTraslape = area * (1 + TRASLAPE);
  const lamina = +$('#largoLamina').value || 0;
  const ancho = ANCHO_UTIL[material];
  const laminas = ancho && lamina ? `${Math.ceil(conTraslape / (ancho * lamina))} láminas de ${lamina} m` : `Láminas de ${lamina} m: pendiente del ancho útil`;
  const peso = PESO_M2[material] ? `${Math.round(conTraslape * PESO_M2[material])} kg aproximados` : 'Peso: pendiente de la ficha técnica';
  pedido = { material: opcion.dataset.nombre, medidas: `${$('#largo').value} × ${$('#ancho').value} m`, area: `${area.toFixed(1)} m² (${conTraslape.toFixed(1)} m² con traslapes)`, lamina: `${lamina} m` };
  $('#resultado').innerHTML = `<strong>${area.toFixed(1)} m²</strong><em>${conTraslape.toFixed(1)} m² de ${opcion.dataset.nombre} con 5 % de traslapes y cortes</em><span>${laminas}</span><span>${peso}</span>`;
}
$('#calculo').addEventListener('input', calcular);
$('#calculo').addEventListener('change', calcular);
$('#calculo').addEventListener('submit', (e) => e.preventDefault());
calcular();
// Los botones «Cotizar …» con data-material dejan marcado ese material.
$$('a[data-material]').forEach((a) => a.addEventListener('click', () => {
  $(`input[name="material"][value="${a.dataset.material}"]`).checked = true;
  calcular();
}));
$('#contacto').addEventListener('submit', (e) => {
  e.preventDefault();
  const datos = new FormData(e.target);
  const texto = [
    'Hola, quiero una cotización.',
    `Nombre: ${datos.get('nombre')}`,
    `Teléfono: ${datos.get('telefono')}`,
    datos.get('ciudad') && `Ciudad: ${datos.get('ciudad')}`,
    `Material: ${pedido.material}`,
    `Techo: ${pedido.medidas}, ${pedido.area}`,
    `Largo de lámina: ${pedido.lamina}`,
  ].filter(Boolean).join('\n');
  const aviso = $('#contactoAviso');
  if (e.submitter?.value === 'correo') {
    location.href = `mailto:${CORREO}?subject=${encodeURIComponent('Cotización de techo')}&body=${encodeURIComponent(texto)}`;
    aviso.textContent = 'Se abrió el correo con el pedido listo para enviar.';
  } else {
    window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
    aviso.textContent = 'Se abrió WhatsApp con el pedido listo para enviar.';
  }
  aviso.hidden = false;
});

// ---------------------------------------------------------------------------
// 9. PIE Y FIN DE LA CARGA
// La palabra TRUVEC del pie se desliza hacia la izquierda mientras el pie entra.
// ---------------------------------------------------------------------------
if (!quieto) {
  gsap.fromTo('#gigante', { xPercent: 8 }, {
    xPercent: -4, ease: 'none',
    scrollTrigger: { trigger: '.pie', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });
}
ScrollTrigger.refresh();
document.documentElement.classList.remove('cargando');
gsap.to('#carga', { autoAlpha: 0, duration: 0.6, delay: 0.15 });
