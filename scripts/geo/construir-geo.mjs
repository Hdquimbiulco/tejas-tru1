// Genera los GeoJSON del mapa de sucursales a partir de los límites del INEC 2024
// (HDX cod-ab-ecu, licencia CC BY-IGO) y ubica cada sucursal en su cantón y parroquia.
import { writeFileSync, mkdirSync } from 'node:fs';
import { leerDbf, leerShp, aGeojson } from './shp.mjs';

// Uso: node scripts/geo/construir-geo.mjs <carpeta con los ecu_adm_adm*_2024.*>
// (la carpeta sale de descomprimir ecu_adm_2024.zip; ver public/geo/LEEME.md)
const ORIGEN = (process.argv[2] || '').replace(/\/?$/, '/');
if (ORIGEN === '/') throw new Error('Falta la carpeta con los shapefiles del INEC');
const DESTINO = new URL('../../public/geo/', import.meta.url).pathname;
mkdirSync(DESTINO, { recursive: true });

const capa = (n) => ({ filas: leerDbf(`${ORIGEN}ecu_adm_adm${n}_2024.dbf`).filas, geoms: leerShp(`${ORIGEN}ecu_adm_adm${n}_2024.shp`) });
// Galápagos queda fuera del mapa (igual que el modelo): todo lo que está al oeste de -85°.
const sinGalapagos = (g) => g && { ...g, coordinates: g.coordinates.filter((p) => p[0][0][0] > -85) };

// Punto dentro de polígono (MultiPolygon GeoJSON)
function dentro([x, y], g) {
  for (const poli of g.coordinates) {
    let adentro = false;
    poli.forEach((anillo) => {
      for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
        const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) adentro = !adentro;
      }
    });
    if (adentro) return true;
  }
  return false;
}
const guardar = (nombre, features) => {
  const txt = JSON.stringify({ type: 'FeatureCollection', features });
  writeFileSync(DESTINO + nombre, txt);
  console.log(nombre, features.length, 'elementos,', Math.round(txt.length / 1024), 'KB');
};

// Sucursales: [id, ciudad, longitud, latitud, dirección, sector, demo].
// Quito con su dirección real; el resto, ubicaciones de demostración en el
// centro de cada ciudad (demo queda en true si no se escribe).
const SUCURSALES = [
  ['quito', 'Quito', -78.54975, -0.35440, 'Panamericana Sur S59 S/N y calle Matilde Álvarez', 'Guamaní, sur de Quito', false],
  ['esmeraldas', 'Esmeraldas', -79.6517, 0.9682],
  ['ibarra', 'Ibarra', -78.1223, 0.3517],
  ['lago-agrio', 'Lago Agrio', -76.8828, 0.0847],
  ['santo-domingo', 'Santo Domingo', -79.1754, -0.2530],
  ['el-coca', 'El Coca', -76.9842, -0.4625],
  ['portoviejo', 'Portoviejo', -80.4544, -1.0546],
  ['manta', 'Manta', -80.7089, -0.9677],
  ['quevedo', 'Quevedo', -79.4604, -1.0225],
  ['latacunga', 'Latacunga', -78.6155, -0.9352],
  ['ambato', 'Ambato', -78.6168, -1.2491],
  ['el-puyo', 'El Puyo', -78.0024, -1.4924],
  ['babahoyo', 'Babahoyo', -79.5344, -1.8022],
  ['riobamba', 'Riobamba', -78.6546, -1.6636],
  ['guayaquil', 'Guayaquil', -79.8891, -2.1894],
  ['duran', 'Durán', -79.8385, -2.1703],
  ['milagro', 'Milagro', -79.5872, -2.1347],
  ['cuenca', 'Cuenca', -79.0059, -2.9001],
  ['machala', 'Machala', -79.9554, -3.2581],
  ['loja', 'Loja', -79.2042, -3.9931],
];

// ---- País y provincias (vista nacional)
const a0 = capa(0), a1 = capa(1), a2 = capa(2), a3 = capa(3);
guardar('ecuador.geojson', [{ type: 'Feature', properties: { nombre: 'Ecuador' }, geometry: sinGalapagos(aGeojson(a0.geoms[0], 0.004, 4, 0.0004)) }]);
guardar('provincias.geojson', a1.filas.map((f, i) => ({ f, g: sinGalapagos(aGeojson(a1.geoms[i], 0.004, 4, 0.0004)) }))
  .filter(({ f, g }) => g && g.coordinates.length && f.ADM1_ES !== 'Galápagos')
  .map(({ f, g }) => ({ type: 'Feature', properties: { codigo: f.ADM1_PCODE, nombre: f.ADM1_ES }, geometry: g })));

// ---- Cantones con sucursal (vista de ciudad) y sus parroquias
const cantones = a2.filas.map((f, i) => ({ f, g: aGeojson(a2.geoms[i], 0.0008, 4, 0.000001) }));
const parroquias = a3.filas.map((f, i) => ({ f, i }));
const sucursales = []; const cantonesUsados = new Map(); const parroquiasUsadas = [];
for (const [id, ciudad, lon, lat, dir, sector, demo = true] of SUCURSALES) {
  const c = cantones.find(({ g }) => g && dentro([lon, lat], g));
  if (!c) throw new Error('sin cantón: ' + ciudad);
  if (!cantonesUsados.has(c.f.ADM2_PCODE)) {
    cantonesUsados.set(c.f.ADM2_PCODE, c);
    for (const p of parroquias.filter(({ f }) => f.ADM2_PCODE === c.f.ADM2_PCODE)) {
      const g = aGeojson(a3.geoms[p.i], 0.0006, 4, 0.0000005);
      if (g) parroquiasUsadas.push({ f: p.f, g });
    }
  }
  const p = parroquiasUsadas.find(({ f, g }) => f.ADM2_PCODE === c.f.ADM2_PCODE && dentro([lon, lat], g));
  if (!p) throw new Error('sin parroquia: ' + ciudad);
  sucursales.push({
    id, nombre: `Truvec ${ciudad}`, ciudad, canton: c.f.ADM2_ES, codigoCanton: c.f.ADM2_PCODE,
    provincia: c.f.ADM1_ES, parroquia: p.f.ADM3_ES, codigoParroquia: p.f.ADM3_PCODE,
    sector: sector || null, direccion: dir || null, demo,
    coordenadas: { latitud: lat, longitud: lon },
  });
  console.log(ciudad.padEnd(14), '→', c.f.ADM2_ES, '/', p.f.ADM3_ES, '/', c.f.ADM1_ES);
}
guardar('cantones.geojson', [...cantonesUsados.values()].map(({ f, g }) => ({ type: 'Feature', properties: { codigo: f.ADM2_PCODE, nombre: f.ADM2_ES, provincia: f.ADM1_ES }, geometry: g })));
guardar('parroquias.geojson', parroquiasUsadas.map(({ f, g }) => ({ type: 'Feature', properties: { codigo: f.ADM3_PCODE, nombre: f.ADM3_ES, canton: f.ADM2_PCODE }, geometry: g })));
writeFileSync(DESTINO + 'sucursales.json', JSON.stringify(sucursales, null, 2) + '\n');
console.log('sucursales.json', sucursales.length);
