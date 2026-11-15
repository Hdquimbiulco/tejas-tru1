// =============================================================================
// PÁGINA DE VERSIONES (dist/versiones/index.html)
// -----------------------------------------------------------------------------
// La corre el workflow de GitHub Pages (.github/workflows/) después de construir
// cada versión en dist/versiones/<etiqueta>/. Lista las etiquetas v* del
// repositorio, de la más nueva a la más antigua, con la fecha de su commit, su título y la
// explicación de qué cambió (el mensaje de la etiqueta).
//
// PARA CREAR UNA VERSIÓN NUEVA (desde la carpeta del sitio):
//   git tag -a v5-nombre-corto -m "Título" -m "Qué cambió y por qué."
//   git push origin v5-nombre-corto
// y después hacer push a main (o volver a correr el workflow a mano).
//
// Uso: node scripts/versiones.mjs <carpeta-dist> <base-del-sitio>
//   ej.: node scripts/versiones.mjs dist /tejas-tru1/
// =============================================================================
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';

const [,, dist = 'dist', base = '/'] = process.argv;
const SEP = '\u001f';   // separador que no aparece en los mensajes
// Orden: de la versión más alta a la más baja (v10 va antes que v9).
// Fecha: la del commit de la versión (%(*committerdate)), no la de la etiqueta.
const salida = execFileSync('git', ['for-each-ref', '--sort=-v:refname',
  `--format=%(refname:short)${SEP}%(*committerdate:short)${SEP}%(contents:subject)${SEP}%(contents:body)${SEP}%(objectname:short)%(*objectname:short)\u001e`,
  'refs/tags/v*'], { encoding: 'utf8' });

const versiones = salida.split('\u001e').map((r) => r.trim()).filter(Boolean).map((r) => {
  const [etiqueta, fecha, titulo, cuerpo, commit] = r.split(SEP);
  return { etiqueta, fecha, titulo, cuerpo: cuerpo.trim(), commit };
}).filter((v) => existsSync(`${dist}/versiones/${v.etiqueta}/index.html`));

const html = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const parrafos = (t) => t.split(/\n\s*\n/).map((p) => `<p>${html(p).replace(/\n/g, '<br>')}</p>`).join('');

const tarjetas = versiones.map((v) => `
  <article>
    <header><h2>${html(v.titulo || v.etiqueta)}</h2><span>${html(v.fecha)}</span></header>
    <p class="etiqueta">${html(v.etiqueta)} · commit ${html(v.commit.slice(-7))}</p>
    ${v.cuerpo ? parrafos(v.cuerpo) : ''}
    <a href="${base}versiones/${encodeURIComponent(v.etiqueta)}/">Abrir esta versión →</a>
  </article>`).join('');

mkdirSync(`${dist}/versiones`, { recursive: true });
writeFileSync(`${dist}/versiones/index.html`, `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Versiones del sitio</title>
<style>
  body { margin: 0; padding: 40px 20px 60px; background: #0f1316; color: #f3efe8; font: 17px/1.5 system-ui, sans-serif; }
  main { max-width: 760px; margin: 0 auto; }
  h1 { margin: 0 0 6px; font-size: 32px; }
  .bajada { margin: 0 0 28px; color: #b9c0c5; }
  .actual { display: inline-block; margin-bottom: 28px; padding: 12px 20px; border-radius: 999px; background: #ff6a3d; color: #111; font-weight: 800; text-decoration: none; }
  article { margin-bottom: 16px; padding: 20px 22px; border-radius: 18px; background: #1a2026; }
  article header { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
  h2 { margin: 0; font-size: 21px; }
  article header span, .etiqueta { color: #b9c0c5; font-size: 14px; }
  .etiqueta { margin: 4px 0 10px; }
  article a { color: #5fd0f5; font-weight: 700; }
</style></head>
<body><main>
  <h1>Versiones del sitio</h1>
  <p class="bajada">Cada versión es el sitio tal como estaba en ese momento, para compararla con la actual.</p>
  <a class="actual" href="${base}">Abrir la versión actual →</a>
  ${tarjetas || '<p>Todavía no hay versiones guardadas.</p>'}
</main></body></html>
`);
console.log(`versiones/index.html con ${versiones.length} versiones`);
