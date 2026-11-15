// =============================================================================
// DATOS DEL MAPA DE SUCURSALES
// -----------------------------------------------------------------------------
// Lee public/geo/sucursales.json y los límites de cantones y parroquias, y
// prepara lo que el mapa necesita: el recuadro (bbox) de cada cantón y
// parroquia para acercarse, y un punto interior de cada parroquia para su nombre.
//
// Sucursal (sucursales.json):
//   { id, nombre, ciudad, canton, codigoCanton, provincia, parroquia,
//     codigoParroquia, sector, direccion, demo, coordenadas: { latitud, longitud } }
//   demo: true = ubicación de demostración (no es una sucursal real todavía).
// PARA AGREGAR UNA SUCURSAL: ver public/geo/LEEME.md.
// Lo usa mapaSucursales.js.
// =============================================================================

async function leer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`No se pudo leer ${url} (${r.status})`);
  return r.json();
}

// Recuadro [[oeste, sur], [este, norte]] de una geometría.
function recuadro(geometria) {
  const b = [[180, 90], [-180, -90]];
  geometria.coordinates.flat(2).forEach(([x, y]) => {
    b[0][0] = Math.min(b[0][0], x); b[0][1] = Math.min(b[0][1], y);
    b[1][0] = Math.max(b[1][0], x); b[1][1] = Math.max(b[1][1], y);
  });
  return b;
}

function dentro([x, y], geometria) {
  return geometria.coordinates.some((poligono) => {
    let adentro = false;
    poligono.forEach((anillo) => {
      for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
        const [xi, yi] = anillo[i]; const [xj, yj] = anillo[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
      }
    });
    return adentro;
  });
}

// Punto para escribir el nombre: dentro de la parroquia y lo más cerca posible
// del centro de su recuadro (una parroquia con forma de "C" tiene el centro afuera).
function puntoInterior(geometria, [[o, s], [e, n]]) {
  const centro = [(o + e) / 2, (s + n) / 2];
  if (dentro(centro, geometria)) return centro;
  let mejor = null; let distancia = Infinity;
  for (let i = 1; i < 12; i++) {
    for (let j = 1; j < 12; j++) {
      const p = [o + ((e - o) * i) / 12, s + ((n - s) * j) / 12];
      const d = (p[0] - centro[0]) ** 2 + (p[1] - centro[1]) ** 2;
      if (d < distancia && dentro(p, geometria)) { mejor = p; distancia = d; }
    }
  }
  return mejor || centro;
}

export async function cargarDatos(base) {
  const [sucursales, cantones, parroquias] = await Promise.all([
    leer(`${base}geo/sucursales.json`),
    leer(`${base}geo/cantones.geojson`),
    leer(`${base}geo/parroquias.geojson`),
  ]);
  const porCanton = new Map(cantones.features.map((f) => [f.properties.codigo, { ...f.properties, recuadro: recuadro(f.geometry) }]));
  const porParroquia = new Map(parroquias.features.map((f) => {
    const caja = recuadro(f.geometry);
    return [f.properties.codigo, { ...f.properties, recuadro: caja, punto: puntoInterior(f.geometry, caja) }];
  }));
  return { sucursales, cantones: porCanton, parroquias: porParroquia };
}
