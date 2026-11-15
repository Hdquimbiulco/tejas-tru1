// =============================================================================
// ESTILO DEL MAPA DE SUCURSALES (capas de MapLibre)
// -----------------------------------------------------------------------------
// El mapa no usa mapas de calles: sólo dibuja los límites oficiales que están
// en public/geo/ (país, provincias, cantones y parroquias). Por eso nunca
// aparecen calles, barrios ni edificios.
//
// Volumen como en el modelo: la superficie azul se dibuja varias veces corrida
// unos píxeles hacia abajo en un azul más oscuro (el "canto" del mapa), más una
// sombra suave. Se hace así y no con fill-extrusion porque una superficie
// extruida tapa las líneas amarillas de las provincias (MapLibre dibuja las
// líneas a nivel del suelo). Al acercarse a una ciudad (zoom mayor a 7.5)
// el canto y la sombra se quitan: ahí sólo estorban en la costa.
//
// Para cambiar colores, cambiar COLORES.
// Lo usa mapaSucursales.js.
// =============================================================================

export const COLORES = {
  superficie: '#1b3a5c',   // azul marino de la cara de arriba
  canto: '#0e2440',        // azul más oscuro del grosor
  limite: '#e2b33a',       // amarillo dorado de las provincias
  parroquia: '#21497a',    // relleno de las parroquias de la ciudad elegida
  parroquiaActiva: '#2f6aa8',
  amarillo: '#f6c21c',     // marcadores y parroquia elegida
};

const GROSOR = 7;   // capas del canto (cada una 1 px más abajo)

export function crearEstilo(base) {
  const fuente = (archivo) => ({ type: 'geojson', data: `${base}geo/${archivo}` });
  const canto = Array.from({ length: GROSOR }, (_, i) => ({
    id: `pais-canto-${i}`, type: 'fill', source: 'pais', maxzoom: 7.5,
    paint: { 'fill-color': COLORES.canto, 'fill-translate': [(GROSOR - i) * 0.6, GROSOR - i] },
  }));
  return {
    version: 8,
    sources: {
      pais: fuente('ecuador.geojson'),
      provincias: fuente('provincias.geojson'),
      cantones: fuente('cantones.geojson'),
      // promoteId: el código de parroquia sirve para resaltarla (feature-state)
      parroquias: { ...fuente('parroquias.geojson'), promoteId: 'codigo' },
    },
    layers: [
      { id: 'fondo', type: 'background', paint: { 'background-color': 'rgba(0,0,0,0)' } },
      // Sombra suave debajo del país
      { id: 'pais-sombra', type: 'fill', source: 'pais', maxzoom: 7.5, paint: { 'fill-color': 'rgba(14, 36, 64, .22)', 'fill-translate': [14, 22] } },
      ...canto,
      { id: 'pais', type: 'fill', source: 'pais', paint: { 'fill-color': COLORES.superficie } },
      // Parroquias: sólo las del cantón elegido (el filtro lo cambia mapaSucursales.js)
      {
        id: 'parroquias', type: 'fill', source: 'parroquias', filter: ['==', ['get', 'canton'], ''],
        paint: {
          'fill-color': ['case',
            ['boolean', ['feature-state', 'elegida'], false], COLORES.parroquiaActiva,
            ['boolean', ['feature-state', 'encima'], false], '#27548a',
            COLORES.parroquia],
        },
      },
      {
        id: 'parroquias-borde', type: 'line', source: 'parroquias', filter: ['==', ['get', 'canton'], ''],
        paint: { 'line-color': COLORES.limite, 'line-opacity': 0.55, 'line-width': 0.8 },
      },
      {
        id: 'provincias-borde', type: 'line', source: 'provincias',
        layout: { 'line-join': 'round' },
        paint: { 'line-color': COLORES.limite, 'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 9, 1.8] },
      },
      {
        id: 'canton-borde', type: 'line', source: 'cantones', filter: ['==', ['get', 'codigo'], ''],
        layout: { 'line-join': 'round' },
        paint: { 'line-color': COLORES.amarillo, 'line-width': 2.4 },
      },
      {
        id: 'parroquia-elegida', type: 'line', source: 'parroquias', filter: ['==', ['get', 'codigo'], ''],
        layout: { 'line-join': 'round' },
        paint: { 'line-color': COLORES.amarillo, 'line-width': 3.2 },
      },
    ],
  };
}
