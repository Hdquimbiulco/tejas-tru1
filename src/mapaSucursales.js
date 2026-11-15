// =============================================================================
// MAPA DE SUCURSALES (sección #mapa)
// -----------------------------------------------------------------------------
// Tres niveles:
//   1. PAÍS       Ecuador completo, inclinado, con un marcador por sucursal.
//                 Los marcadores que se tapan se juntan en uno con su número.
//   2. CIUDAD     Al elegir una sucursal (marcador o lista) el mapa se acerca a
//                 su cantón, muestra sus parroquias y resalta la de la sucursal.
//   3. PARROQUIA  Al tocar una parroquia (o "Ver la parroquia" en la ficha) se
//                 acerca a ella. Aquí termina: no hay barrios ni calles.
//
// MapLibre GL JS dibuja el mapa (src/mapaEstilo.js = capas y colores).
// Los datos salen de public/geo/ (src/mapaDatos.js los lee).
// Todo el texto se escribe con textContent (nunca HTML armado a mano).
// main.js lo carga recién cuando la sección se acerca a la pantalla.
// =============================================================================
import { Map as Mapa, Marker, NavigationControl, AttributionControl } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { crearEstilo } from './mapaEstilo.js';
import { cargarDatos } from './mapaDatos.js';

const ECUADOR = [[-81.1, -5.05], [-75.15, 1.5]];          // Ecuador continental
const LIMITES = [[-86, -8], [-70, 4.5]];                  // hasta dónde se puede mover
const INCLINACION_PAIS = 22;                              // grados en la vista nacional
const JUNTAR_PX = 28;                                     // marcadores más cerca que esto se juntan

// Ícono del marcador: gota amarilla con un obrero con casco.
const PIN_SVG = `<svg viewBox="0 0 40 52" aria-hidden="true"><path d="M20 51C20 51 3 31.5 3 19.5a17 17 0 0 1 34 0C37 31.5 20 51 20 51Z" fill="#f6c21c" stroke="#0e2440" stroke-width="2"/><circle cx="20" cy="19.5" r="12" fill="#fff6d6"/><path d="M13.6 17.6a6.4 6.4 0 0 1 12.8 0Z" fill="#0e2440"/><rect x="12.2" y="17" width="15.6" height="2.2" rx="1.1" fill="#0e2440"/><circle cx="20" cy="22" r="3.1" fill="#0e2440"/><path d="M13.5 30.5c.8-3.6 3.4-5.2 6.5-5.2s5.7 1.6 6.5 5.2Z" fill="#0e2440"/></svg>`;

// Crea un elemento con clase y texto (sin HTML).
function el(etiqueta, clase, texto) {
  const e = document.createElement(etiqueta);
  if (clase) e.className = clase;
  if (texto != null) e.textContent = texto;
  return e;
}
// Códigos del INEC: una parroquia que termina en 50 es la cabecera cantonal (el área urbana).
const esUrbana = (codigo) => codigo.endsWith('50');

export async function crearMapa(seccion, { whatsapp }) {
  const base = import.meta.env.BASE_URL;
  const lienzo = seccion.querySelector('.mapa-mapa');
  const estado = seccion.querySelector('.mapa-estado');
  const ficha = seccion.querySelector('.mapa-ficha');
  const lista = seccion.querySelector('.mapa-lista ul');
  const volver = seccion.querySelector('.mapa-volver');
  const ruta = seccion.querySelector('.mapa-ruta');

  let datos;
  try {
    datos = await cargarDatos(base);
  } catch (error) {
    estado.textContent = 'No se pudo cargar el mapa de sucursales. Intentar de nuevo más tarde.';
    estado.classList.add('mapa-error');
    console.error(error);
    return;
  }
  const { sucursales, cantones, parroquias } = datos;
  let mapa = null;              // queda en null si el navegador no puede mostrar el mapa
  let sucursalEnFicha = null;   // sucursal que muestra la ficha (null = ninguna)
  // Qué hace elegir una sucursal en la lista: sin mapa, sólo abrir su ficha.
  let alElegir = (s) => { fichaSucursal(s); marcarEnLista(s.id); };

  // ---------- Lista de sucursales (funciona aunque no haya mapa) -------------
  const botones = new globalThis.Map();
  [...sucursales].sort((a, b) => a.ciudad.localeCompare(b.ciudad, 'es')).forEach((s) => {
    const li = el('li');
    const b = el('button', 'mapa-item');
    b.type = 'button';
    b.append(el('span', 'mapa-item-ciudad', s.ciudad), el('span', 'mapa-item-provincia', s.provincia));
    b.addEventListener('click', () => alElegir(s));
    li.append(b);
    lista.append(li);
    botones.set(s.id, b);
  });
  seccion.querySelector('.mapa-lista-total').textContent = `${sucursales.length} sucursales`;
  const marcarEnLista = (id) => botones.forEach((b, k) => b.setAttribute('aria-pressed', String(k === id)));

  // ---------- Ficha de una sucursal o de una parroquia ------------------------
  function dato(dl, nombre, valor) {
    if (!valor) return;
    dl.append(el('dt', null, nombre), el('dd', null, valor));
  }
  function abrirFicha(titulo, llenar) {
    ficha.replaceChildren();
    const cerrar = el('button', 'mapa-ficha-cerrar', '×');
    cerrar.type = 'button';
    cerrar.setAttribute('aria-label', 'Cerrar');
    cerrar.addEventListener('click', () => { ficha.hidden = true; sucursalEnFicha = null; marcarEnLista(null); });
    ficha.append(cerrar, el('h3', null, titulo));
    llenar(ficha);
    ficha.hidden = false;
  }
  function fichaSucursal(s) {
    sucursalEnFicha = s;
    abrirFicha(s.nombre, (f) => {
      if (s.demo) f.append(el('p', 'mapa-ficha-demo', 'Ubicación de demostración'));
      const dl = el('dl');
      dato(dl, 'Dirección', s.direccion || 'Dirección de demostración');
      dato(dl, 'Sector', s.sector);
      dato(dl, 'Parroquia', `${s.parroquia}${esUrbana(s.codigoParroquia) ? ' (área urbana)' : ''}`);
      dato(dl, 'Ciudad', s.ciudad === s.canton ? s.ciudad : `${s.ciudad} · cantón ${s.canton}`);
      dato(dl, 'Provincia', s.provincia);
      f.append(dl);
      const acciones = el('div', 'mapa-ficha-acciones');
      if (mapa) {
        const verParroquia = el('button', 'boton boton-borde', 'Ver la parroquia');
        verParroquia.type = 'button';
        verParroquia.addEventListener('click', () => irParroquia(s.codigoParroquia));
        acciones.append(verParroquia);
      }
      const wa = el('a', 'boton boton-wa', 'Escribir por WhatsApp');
      wa.href = `https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, quisiera información de ${s.nombre}.`)}`;
      wa.target = '_blank';
      wa.rel = 'noopener';
      acciones.append(wa);
      f.append(acciones);
    });
  }
  function fichaParroquia(p) {
    const canton = cantones.get(p.canton);
    sucursalEnFicha = null;
    abrirFicha(p.nombre, (f) => {
      const dl = el('dl');
      dato(dl, 'Tipo', esUrbana(p.codigo) ? 'Parroquia urbana (cabecera cantonal)' : 'Parroquia rural');
      dato(dl, 'Cantón', canton.nombre);
      dato(dl, 'Provincia', canton.provincia);
      f.append(dl);
      const aqui = sucursales.filter((s) => s.codigoParroquia === p.codigo);
      f.append(el('p', 'mapa-ficha-sub', aqui.length ? 'Sucursal en esta parroquia:' : 'No hay sucursal en esta parroquia.'));
      aqui.forEach((s) => {
        const b = el('button', 'boton boton-claro', s.nombre);
        b.type = 'button';
        b.addEventListener('click', () => { fichaSucursal(s); marcarEnLista(s.id); });
        f.append(b);
      });
    });
  }

  // ---------- Sin WebGL 2: queda la lista con sus fichas ---------------------
  if (!document.createElement('canvas').getContext('webgl2')) {
    estado.textContent = 'Este navegador no puede mostrar el mapa. Las sucursales están en la lista.';
    estado.classList.add('mapa-error');
    return;
  }

  // ---------- Mapa ------------------------------------------------------------
  const relleno = () => (lienzo.clientWidth < 600 ? 16 : 60);
  // Al acercarse, deja libre el lugar de la ficha (a la derecha en computadora,
  // abajo en celular) para que la zona elegida no quede tapada.
  const rellenoConFicha = () => (lienzo.clientWidth < 600
    ? { top: 50, left: 20, right: 20, bottom: Math.round(lienzo.clientHeight * 0.5) }
    : { top: 60, left: 50, bottom: 50, right: 400 });
  mapa = new Mapa({
    container: lienzo,
    style: crearEstilo(base),
    bounds: ECUADOR,
    fitBoundsOptions: { padding: relleno() },
    pitch: INCLINACION_PAIS,
    maxPitch: 30,
    minZoom: 4.5,
    maxZoom: 13,          // nivel de parroquia: no se acerca hasta las calles
    maxBounds: LIMITES,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    cooperativeGestures: true,   // la página sigue bajando con la rueda o un dedo
    attributionControl: false,
    locale: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Usar Ctrl + rueda para acercar el mapa',
      'CooperativeGesturesHandler.MacHelpText': 'Usar ⌘ + rueda para acercar el mapa',
      'CooperativeGesturesHandler.MobileHelpText': 'Usar dos dedos para mover el mapa',
      'NavigationControl.ZoomIn': 'Acercar',
      'NavigationControl.ZoomOut': 'Alejar',
      'AttributionControl.ToggleAttribution': 'Fuentes',
      'Map.Title': 'Mapa de sucursales',
    },
  });
  mapa.touchZoomRotate.disableRotation();
  mapa.keyboard.disableRotation();
  mapa.addControl(new NavigationControl({ showCompass: false }), 'top-right');
  mapa.addControl(new AttributionControl({
    compact: true,
    customAttribution: 'Límites: INEC 2024 (CC BY-IGO) · Ubicación de Quito: © colaboradores de OpenStreetMap',
  }), 'bottom-right');
  mapa.on('error', (e) => console.error(e.error));

  // ---------- Marcadores de sucursal -----------------------------------------
  const marcadores = sucursales.map((s) => {
    const boton = el('button', 'mapa-pin');
    boton.type = 'button';
    boton.setAttribute('aria-label', `Sucursal ${s.ciudad}`);
    boton.insertAdjacentHTML('afterbegin', PIN_SVG);   // ícono fijo (no lleva datos)
    const cuenta = el('span', 'mapa-pin-cuenta');
    const nombre = el('span', 'mapa-pin-nombre', s.ciudad);
    boton.append(cuenta, nombre);
    const m = { s, boton, nombre, cuenta, grupo: [s] };
    boton.addEventListener('click', (e) => {
      e.stopPropagation();
      if (m.grupo.length > 1) {
        // Varios juntos: acercar hasta que se separen
        const lon = m.grupo.map((x) => x.coordenadas.longitud); const lat = m.grupo.map((x) => x.coordenadas.latitud);
        mapa.fitBounds([[Math.min(...lon), Math.min(...lat)], [Math.max(...lon), Math.max(...lat)]], { padding: 120, maxZoom: 10, duration: 1200 });
      } else elegirSucursal(s);
    });
    m.marcador = new Marker({ element: boton, anchor: 'bottom' }).setLngLat([s.coordenadas.longitud, s.coordenadas.latitud]).addTo(mapa);
    // El nombre de Quito siempre se ve: su marcador va por encima de los vecinos
    if (s.id === 'quito') boton.style.zIndex = 2;
    return m;
  });

  // Junta los marcadores que en pantalla quedan a menos de JUNTAR_PX.
  function juntar() {
    const libres = marcadores.map((m) => ({ m, p: mapa.project(m.marcador.getLngLat()) }));
    const usados = new Set();
    libres.forEach(({ m, p }) => {
      if (usados.has(m)) return;
      const grupo = libres.filter((o) => !usados.has(o.m) && Math.hypot(o.p.x - p.x, o.p.y - p.y) < JUNTAR_PX);
      grupo.forEach((o) => usados.add(o.m));
      m.grupo = grupo.map((o) => o.m.s);
      m.boton.hidden = false;
      m.cuenta.textContent = grupo.length > 1 ? String(grupo.length) : '';
      m.nombre.textContent = grupo.length > 1 ? m.grupo.map((x) => x.ciudad).join(' · ') : m.s.ciudad;
      m.boton.setAttribute('aria-label', grupo.length > 1 ? `${grupo.length} sucursales: ${m.nombre.textContent}` : `Sucursal ${m.s.ciudad}`);
      grupo.slice(1).forEach((o) => { o.m.boton.hidden = true; o.m.grupo = [o.m.s]; });
    });
    // Nombres: si uno se monta sobre otro marcador o nombre, se esconde (el
    // marcador sigue visible). Quito va primero para que su nombre siempre se vea.
    const visibles = marcadores.filter((m) => !m.boton.hidden).sort((a, b) => (b.s.id === 'quito') - (a.s.id === 'quito'));
    visibles.forEach((m) => m.nombre.classList.remove('tapado'));
    const ocupados = visibles.map((m) => m.boton.querySelector('svg').getBoundingClientRect());
    const choca = (r, o) => r.left < o.right && r.right > o.left && r.top < o.bottom && r.bottom > o.top;
    visibles.forEach((m) => {
      const r = m.nombre.getBoundingClientRect();
      if (m.s.id !== 'quito' && ocupados.some((o) => choca(r, o))) m.nombre.classList.add('tapado'); else ocupados.push(r);
    });
  }

  // ---------- Nombres de las parroquias (sólo del cantón elegido) -----------
  let etiquetas = [];
  function ponerEtiquetas(codigoCanton) {
    etiquetas.forEach((e) => e.marcador.remove());
    etiquetas = [...parroquias.values()]
      .filter((p) => p.canton === codigoCanton)
      // las grandes primero: si dos nombres chocan, queda el de la más grande
      .sort((a, b) => (b.recuadro[1][0] - b.recuadro[0][0]) * (b.recuadro[1][1] - b.recuadro[0][1]) - (a.recuadro[1][0] - a.recuadro[0][0]) * (a.recuadro[1][1] - a.recuadro[0][1]))
      .map((p) => {
        const b = el('button', 'mapa-etiqueta', p.nombre);
        b.type = 'button';
        b.addEventListener('click', (e) => { e.stopPropagation(); irParroquia(p.codigo); });
        return { p, b, marcador: new Marker({ element: b, anchor: 'center' }).setLngLat(p.punto).addTo(mapa) };
      });
    ordenarEtiquetas();
  }
  // Esconde los nombres que se montan sobre otro ya visible.
  function ordenarEtiquetas() {
    const ocupados = [];
    etiquetas.forEach(({ b }) => {
      b.hidden = false;
      const r = b.getBoundingClientRect();
      const choca = ocupados.some((o) => r.left < o.right + 4 && r.right + 4 > o.left && r.top < o.bottom + 2 && r.bottom + 2 > o.top);
      if (choca) b.hidden = true; else ocupados.push(r);
    });
  }

  // ---------- Niveles ---------------------------------------------------------
  let nivel = 'pais';
  let cantonActual = '';
  let parroquiaActual = '';
  const filtrar = (capa, campo, valor) => mapa.setFilter(capa, ['==', ['get', campo], valor]);

  function elegirParroquia(codigo) {
    if (parroquiaActual) mapa.setFeatureState({ source: 'parroquias', id: parroquiaActual }, { elegida: false });
    parroquiaActual = codigo;
    if (codigo) mapa.setFeatureState({ source: 'parroquias', id: codigo }, { elegida: true });
    filtrar('parroquia-elegida', 'codigo', codigo);
    etiquetas.forEach(({ p, b }) => b.classList.toggle('elegida', p.codigo === codigo));
  }
  function mostrarCanton(codigo) {
    if (codigo === cantonActual) return;
    cantonActual = codigo;
    ['parroquias', 'parroquias-borde'].forEach((capa) => filtrar(capa, 'canton', codigo));
    filtrar('canton-borde', 'codigo', codigo);
    if (codigo) ponerEtiquetas(codigo); else { etiquetas.forEach((e) => e.marcador.remove()); etiquetas = []; }
  }
  function escribirRuta() {
    ruta.replaceChildren();
    const paso = (texto, accion) => {
      const b = el(accion ? 'button' : 'span', 'mapa-ruta-paso', texto);
      if (accion) { b.type = 'button'; b.addEventListener('click', accion); }
      ruta.append(b);
    };
    paso('Ecuador', nivel === 'pais' ? null : irPais);
    if (nivel === 'pais') return;
    const c = cantones.get(cantonActual);
    paso(c.provincia, null);
    paso(c.nombre, nivel === 'parroquia' ? () => irCanton(cantonActual, parroquiaActual) : null);
    if (nivel === 'parroquia') paso(parroquias.get(parroquiaActual).nombre, null);
  }
  function cambiarNivel(n) {
    nivel = n;
    seccion.dataset.nivel = n;
    volver.hidden = n === 'pais';
    escribirRuta();
  }

  function irPais() {
    mostrarCanton('');
    elegirParroquia('');
    ficha.hidden = true;
    sucursalEnFicha = null;
    marcarEnLista(null);
    cambiarNivel('pais');
    mapa.fitBounds(ECUADOR, { padding: relleno(), pitch: INCLINACION_PAIS, duration: 1400 });
  }
  function irCanton(codigo, parroquia = '') {
    mostrarCanton(codigo);
    elegirParroquia(parroquia);
    cambiarNivel('canton');
    mapa.fitBounds(cantones.get(codigo).recuadro, { padding: rellenoConFicha(), pitch: 0, maxZoom: 11.5, duration: 1600 });
  }
  function irParroquia(codigo) {
    const p = parroquias.get(codigo);
    mostrarCanton(p.canton);
    elegirParroquia(codigo);
    cambiarNivel('parroquia');
    mapa.fitBounds(p.recuadro, { padding: rellenoConFicha(), pitch: 0, maxZoom: 13, duration: 1400 });
    // Si la ficha abierta es de una sucursal de esta parroquia, se deja; si no, ficha de la parroquia.
    if (sucursalEnFicha?.codigoParroquia !== codigo) fichaParroquia(p);
  }
  function elegirSucursal(s) {
    irCanton(s.codigoCanton, s.codigoParroquia);
    fichaSucursal(s);
    marcarEnLista(s.id);
  }

  // ---------- Eventos del mapa -------------------------------------------------
  let encima = null;
  mapa.on('mousemove', 'parroquias', (e) => {
    const id = e.features[0]?.id;
    if (id === encima) return;
    if (encima) mapa.setFeatureState({ source: 'parroquias', id: encima }, { encima: false });
    encima = id;
    if (id) mapa.setFeatureState({ source: 'parroquias', id }, { encima: true });
    mapa.getCanvas().style.cursor = 'pointer';
  });
  mapa.on('mouseleave', 'parroquias', () => {
    if (encima) mapa.setFeatureState({ source: 'parroquias', id: encima }, { encima: false });
    encima = null;
    mapa.getCanvas().style.cursor = '';
  });
  mapa.on('click', 'parroquias', (e) => { if (e.features[0]) irParroquia(e.features[0].id); });
  mapa.on('zoomend', () => { juntar(); ordenarEtiquetas(); });
  mapa.on('pitchend', juntar);
  mapa.on('resize', juntar);
  volver.addEventListener('click', irPais);
  alElegir = elegirSucursal;

  mapa.on('load', () => {
    estado.hidden = true;
    // Las fuentes empiezan plegadas en el botón (i): en celular tapaban el mapa.
    lienzo.querySelector('.maplibregl-compact-show')?.classList.remove('maplibregl-compact-show');
    juntar();
    cambiarNivel('pais');
  });
}
