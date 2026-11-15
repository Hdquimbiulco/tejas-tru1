// =============================================================================
// JAVASCRIPT PRINCIPAL DEL SEGUNDO SITIO (versión «mosaico»)
// -----------------------------------------------------------------------------
// Partes del archivo (buscar el título con Ctrl+F):
//   0. CARGA                      → pantalla de carga con porcentaje
//   1. PORTADA                    → fotogramas de la lluvia atados al scroll
//   1b. LÁMINAS EN VIDEO          → el menú de materiales sigue al video
//   2. PALABRAS QUE SE ENCIENDEN  → «Por qué empezar por el material»
//   3. ENTRADAS                   → tarjetas que aparecen al llegar
//   4. MOSAICO                    → filtros por material y visor
//   5. COMPARADOR                 → grupos que se abren y cierran
//   6. MENÚ EN CELULAR
//   7. ENTREGA EN OBRA            → la línea de ruta se llena
//   8. COTIZAR                    → calculadora, WhatsApp y correo
//   8b. MAPA DE SUCURSALES        → se carga al acercarse (mapaSucursales.js)
//   9. PIE Y FIN DE LA CARGA
//
// GSAP anima; ScrollTrigger ata la animación al scroll (ver el primer sitio,
// tejas/src/main.js, para la explicación de trigger, start, end, scrub y pin).
// =============================================================================

import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cargarFotogramas, crearSecuencia } from './secuencia.js';

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
const totalCarga = escenas.reduce((n, e) => n + Math.ceil(e.dataset.total / PASO), 0) + medios.length * PESO_MEDIO;
let cargado = 0;
function sumar(n = 1) {
  cargado += n;
  const pct = Math.min(100, Math.round((cargado / totalCarga) * 100));
  $('#cargaPct').textContent = `${pct} %`;
  $('#cargaBarra').style.transform = `scaleX(${pct / 100})`;
}
const [fotogramas] = await Promise.all([
  Promise.all(escenas.map((e) => cargarFotogramas(e.dataset.frames, +e.dataset.total, PASO, sumar))),
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
// 1b. LÁMINAS EN VIDEO — el menú de la izquierda sigue al video
// HTML: #lamina (ver el comentario 2b de index.html para los segundos).
//   - El video se reproduce cuando se ve al menos el 40 % y se pausa al salir;
//     pause() guarda el punto, así que al volver sigue donde quedó (con su audio).
//   - Suena con volumen bajo (VOLUMEN) y el botón «Silenciar» lo apaga.
//     Si el navegador no deja sonar todavía (pasa cuando la persona aún no ha
//     hecho clic ni tocado nada en la página), arranca sin sonido y el sonido
//     se enciende con el primer clic o tecla, salvo que la persona lo haya
//     silenciado. En iPhone y iPad el volumen lo manda el equipo: VOLUMEN no
//     tiene efecto ahí.
//   - Cada material y cada color con data-desde salta a ese segundo del video.
//   - Con «reducir movimiento» no arranca solo: se reproduce con «Reproducir».
// ---------------------------------------------------------------------------
const seccionLamina = $('#lamina');
const video = seccionLamina.querySelector('video');
const acabados = [...seccionLamina.querySelectorAll('.acabado')];
const coloresVideo = [...seccionLamina.querySelectorAll('.colores li[data-desde]')];
const gruposDetalle = [...seccionLamina.querySelectorAll('.detalle-grupo')];
const botonPausa = seccionLamina.querySelector('[data-accion="pausa"]');
const botonSonido = seccionLamina.querySelector('[data-accion="sonido"]');
const barraVideo = seccionLamina.querySelector('.video-avance span');
const VOLUMEN = 0.35;                     // 0 = mudo, 1 = volumen completo del equipo
video.volume = VOLUMEN;
const enTramo = (el, t) => t >= +el.dataset.desde && t < +el.dataset.hasta;

let videoALaVista = false;
let pausadoPorPersona = quieto;            // con «reducir movimiento» empieza pausado
let silenciadoPorPersona = false;

// Marca el material y el color que se ven, y muestra los detalles de ese material.
function sincronizar() {
  const t = video.currentTime;
  const activo = acabados.find((a) => enTramo(a, t)) || acabados[0];
  acabados.forEach((a) => {
    const es = a === activo;
    a.classList.toggle('activo', es);
    // Avance dentro del tramo del material (la barrita bajo su nombre)
    const fin = Math.min(+a.dataset.hasta, video.duration || +a.dataset.hasta);
    a.style.setProperty('--avance', es ? (t - a.dataset.desde) / (fin - a.dataset.desde) : 0);
  });
  coloresVideo.forEach((li) => li.classList.toggle('activo', enTramo(li, t)));
  gruposDetalle.forEach((g) => g.classList.toggle('activo', g.dataset.material === activo.dataset.material));
  if (video.duration) barraVideo.style.transform = `scaleX(${t / video.duration})`;
}
video.addEventListener('timeupdate', sincronizar);
// timeupdate llega unas 4 veces por segundo: entre medio, el cuadro de animación
// mantiene suave la barrita (sólo mientras se reproduce).
function cuadro() { if (!video.paused) { sincronizar(); requestAnimationFrame(cuadro); } }
video.addEventListener('play', () => { requestAnimationFrame(cuadro); });

function actualizarSonido() {
  botonSonido.textContent = video.muted ? 'Activar sonido' : 'Silenciar';
}
function reproducir() {
  video.play().catch((e) => {
    // El navegador no dejó sonar: se reproduce sin sonido hasta el primer clic.
    if (e.name !== 'NotAllowedError' || video.muted) return;
    video.muted = true;
    actualizarSonido();
    video.play().catch(() => {});
  });
}
// Primer clic o tecla en la página: si el video quedó mudo por el navegador,
// se le devuelve el sonido. Los botones del video se manejan solos.
function devolverSonido(e) {
  if (e.target.closest && e.target.closest('.video-controles')) return;
  if (silenciadoPorPersona || !video.muted) return;
  video.muted = false;
  actualizarSonido();
}
document.addEventListener('click', devolverSonido);
document.addEventListener('keydown', devolverSonido);
function actualizarPausa() {
  botonPausa.textContent = video.paused ? 'Reproducir' : 'Pausar';
  botonPausa.setAttribute('aria-label', video.paused ? 'Reproducir el video' : 'Pausar el video');
}
video.addEventListener('play', actualizarPausa);
video.addEventListener('pause', actualizarPausa);

// Saltar a un material o a un color: el video va a ese segundo y se reproduce.
function saltar(segundo) {
  video.currentTime = segundo;
  pausadoPorPersona = false;
  sincronizar();
  reproducir();
}
acabados.forEach((a) => a.querySelector('.acabados-nombre').addEventListener('click', () => saltar(+a.dataset.desde)));
coloresVideo.forEach((li) => {
  // El color es un <li>: se le da rol de botón para el teclado y los lectores de pantalla.
  li.setAttribute('role', 'button');
  li.tabIndex = 0;
  li.addEventListener('click', () => saltar(+li.dataset.desde));
  li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); saltar(+li.dataset.desde); } });
});

botonPausa.addEventListener('click', () => {
  pausadoPorPersona = !video.paused;
  if (pausadoPorPersona) video.pause(); else reproducir();
});
video.addEventListener('click', () => botonPausa.click());
botonSonido.addEventListener('click', () => {
  video.muted = !video.muted;
  silenciadoPorPersona = video.muted;
  actualizarSonido();
  if (!video.muted && video.paused) { pausadoPorPersona = false; reproducir(); }
});

// Se carga cuando falta poco para llegar (el video pesa unos 18 MB) …
new IntersectionObserver(([e], obs) => {
  if (e.isIntersecting) { video.preload = 'auto'; obs.disconnect(); }
}, { rootMargin: '800px 0px' }).observe(video);
// … y se reproduce sólo a la vista. Al salir se pausa (video y audio).
new IntersectionObserver(([e]) => {
  videoALaVista = e.isIntersecting;
  if (!videoALaVista) video.pause();
  else if (!pausadoPorPersona) reproducir();
}, { threshold: 0.4 }).observe(video);
// Si el navegador pausa el video por su cuenta (pestaña oculta, etc.), al volver
// a la pestaña sigue si la sección está a la vista.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) video.pause();
  else if (videoALaVista && !pausadoPorPersona) reproducir();
});
sincronizar();
actualizarPausa();

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
// 8b. MAPA DE SUCURSALES — se descarga recién cuando la sección está por
// entrar en pantalla (1.000 px antes), para no hacer más lenta la carga.
// Todo el mapa está en src/mapaSucursales.js.
// ---------------------------------------------------------------------------
const seccionMapa = $('#mapa');
const verMapa = new IntersectionObserver(([e]) => {
  if (!e.isIntersecting) return;
  verMapa.disconnect();
  import('./mapaSucursales.js')
    .then(({ crearMapa }) => crearMapa(seccionMapa, { whatsapp: WHATSAPP }))
    .catch((error) => {
      seccionMapa.querySelector('.mapa-estado').textContent = 'No se pudo cargar el mapa de sucursales.';
      console.error(error);
    });
}, { rootMargin: '1000px 0px' });
verMapa.observe(seccionMapa);

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
