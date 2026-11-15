// Lector mínimo de shapefile (polígonos) + dbf, con simplificación Douglas-Peucker.
import { readFileSync } from 'node:fs';

export function leerDbf(ruta) {
  const b = readFileSync(ruta);
  const n = b.readUInt32LE(4), cab = b.readUInt16LE(8), largo = b.readUInt16LE(10);
  const campos = [];
  for (let o = 32; b[o] !== 0x0d; o += 32) {
    campos.push({ nombre: b.toString('latin1', o, o + 11).replace(/\0.*$/, ''), tipo: String.fromCharCode(b[o + 11]), largo: b[o + 16] });
  }
  const filas = [];
  for (let i = 0; i < n; i++) {
    let o = cab + i * largo + 1; const f = {};
    for (const c of campos) { f[c.nombre] = b.toString('utf8', o, o + c.largo).trim(); o += c.largo; }
    filas.push(f);
  }
  return { campos, filas };
}

export function leerShp(ruta) {
  const b = readFileSync(ruta);
  const geoms = []; let o = 100;
  while (o < b.length) {
    const largo = b.readInt32BE(o + 4) * 2; const r = o + 8; const tipo = b.readInt32LE(r);
    if (tipo === 0) { geoms.push(null); o = r + largo; continue; }
    const nPartes = b.readInt32LE(r + 36), nPuntos = b.readInt32LE(r + 40);
    const partes = []; for (let i = 0; i < nPartes; i++) partes.push(b.readInt32LE(r + 44 + i * 4));
    const p0 = r + 44 + nPartes * 4; const anillos = [];
    for (let i = 0; i < nPartes; i++) {
      const fin = i + 1 < nPartes ? partes[i + 1] : nPuntos; const a = [];
      for (let k = partes[i]; k < fin; k++) a.push([b.readDoubleLE(p0 + k * 16), b.readDoubleLE(p0 + k * 16 + 8)]);
      anillos.push(a);
    }
    geoms.push(anillos); o = r + largo;
  }
  return geoms;
}

const area = (a) => { let s = 0; for (let i = 0, j = a.length - 1; i < a.length; j = i++) s += (a[j][0] - a[i][0]) * (a[j][1] + a[i][1]); return s / 2; };

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const pila = [[0, pts.length - 1]];
  while (pila.length) {
    const [i, j] = pila.pop(); let max = 0, idx = -1;
    const [x1, y1] = pts[i], [x2, y2] = pts[j]; const dx = x2 - x1, dy = y2 - y1; const L = dx * dx + dy * dy;
    for (let k = i + 1; k < j; k++) {
      const [x, y] = pts[k]; let d;
      if (L === 0) d = (x - x1) ** 2 + (y - y1) ** 2;
      else { let t = ((x - x1) * dx + (y - y1) * dy) / L; t = Math.max(0, Math.min(1, t)); d = (x - x1 - t * dx) ** 2 + (y - y1 - t * dy) ** 2; }
      if (d > max) { max = d; idx = k; }
    }
    if (max > tol * tol) { keep[idx] = 1; pila.push([i, idx], [idx, j]); }
  }
  return pts.filter((_, k) => keep[k]);
}

const redondear = (a, dec) => a.map(([x, y]) => [+x.toFixed(dec), +y.toFixed(dec)]);

// Convierte los anillos del shapefile a MultiPolygon GeoJSON, simplificados.
// Anillo exterior = horario en shapefile (área "positiva" con esta fórmula).
export function aGeojson(anillos, tol, dec, areaMin = 0) {
  const polis = [];
  // El anillo más grande siempre es exterior: los de su mismo sentido también.
  const signo = Math.sign(anillos.reduce((m, a) => (Math.abs(area(a)) > Math.abs(m) ? area(a) : m), 0));
  for (const a of anillos) {
    const ext = Math.sign(area(a)) === signo;
    if (Math.abs(area(a)) < areaMin) continue;
    let s = redondear(dp(a, tol), dec);
    if (s.length < 4) continue;
    // GeoJSON: exterior antihorario, huecos horario
    s = s.slice().reverse();
    if (ext) polis.push([s]); else if (polis.length) polis[polis.length - 1].push(s);
  }
  return polis.length ? { type: 'MultiPolygon', coordinates: polis } : null;
}
