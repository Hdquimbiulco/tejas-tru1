// =============================================================================
// TECHO DE TEJAS QUE ESCONDE LA PALABRA "TRUVEC" (pie de página)
// -----------------------------------------------------------------------------
// Un techo de tejas coloniales tapa todo el recuadro. Debajo, en el piso, está
// escrita la palabra TRUVEC en grande. Al pasar el puntero, las tejas cercanas
// se levantan girando sobre su borde de atrás, suben y se achican hasta
// dejar ver las letras; después de un momento vuelven a caer con un pequeño
// rebote.
//
// Es la misma teja del primer sitio (tejas/src/palabraTejas.js): medio
// cilindro abierto y mate, en tonos terracota como la imagen teja.png.
//
// Usa Three.js. Piezas básicas: renderer (dibuja en el <canvas>), scene (el
// "mundo"), camera (desde dónde se mira), luz y mesh (objeto = forma + material).
// HTML: <div class="pie-techo"> con <canvas id="techoTejas">.
// Lo carga main.js (sección 9) cuando el pie está por entrar en pantalla.
// =============================================================================
import {
  WebGLRenderer, Scene, OrthographicCamera, PMREMGenerator, InstancedMesh, CylinderGeometry,
  MeshStandardMaterial, MeshBasicMaterial, Object3D, Color, DirectionalLight, CanvasTexture,
  Mesh, PlaneGeometry, Raycaster, Vector2, Vector3, Plane, PCFShadowMap, ACESFilmicToneMapping,
  SRGBColorSpace,
} from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const PALABRA = 'TRUVEC';
const PASO = 0.5;          // ancho de una teja (unidades 3D, no píxeles)
const FILA = 0.62;         // distancia entre filas
const LARGO = FILA * 1.3;  // largo de una teja (se traslapa con la de atrás)
const GIRO_MAX = 1.1;      // cuánto gira una teja levantada (radianes, unos 63°)
const SUBIDA = 1.2;        // cuánto sube una teja levantada
const RADIO = 1.9;         // alcance del puntero
const ESPERA = 1500;       // milisegundos que una teja sigue levantada
const FONDO = '#0f1316';   // color del pie (var(--fondo) en CSS)
const LETRAS = '#ff6a3d';  // color de la palabra (var(--acento) en CSS)

// Colores de las tejas (sacados de teja.png): para cambiar los tonos, cambiar estos códigos.
const TONOS = ['#d9733f', '#e48a52', '#c45f33', '#eb9a5e', '#cf6a38', '#b8552d', '#e07d45'];

export async function crearTecho(canvas) {
  // La palabra usa la letra de los títulos: se espera a que esté descargada.
  await document.fonts.load('800 100px "Bricolage Grotesque"');

  // --- Medidas: la proporción la fija el CSS; en celular, tejas más grandes en pantalla
  const anchoPx = canvas.clientWidth;
  const proporcion = anchoPx / canvas.clientHeight;
  const columnas = Math.round(anchoPx / (anchoPx < 700 ? 16 : 28));
  const ANCHO = columnas * PASO;
  const alto = ANCHO / proporcion;

  // --- Dibujante (calidad reducida para no hacer lento el sitio) -------------
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(FONDO);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;

  const scene = new Scene();
  scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  // --- Cámara ortográfica (sin perspectiva), inclinada 58° para ver el relieve
  const camera = new OrthographicCamera(-ANCHO / 2, ANCHO / 2, alto / 2, -alto / 2, 0.1, 100);
  const inclinacion = (58 * Math.PI) / 180;
  camera.position.set(0, 20 * Math.sin(inclinacion), 20 * Math.cos(inclinacion));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();

  // Profundidad del piso que se ve: el recuadro visto en diagonal
  const fondo = alto / Math.sin(inclinacion);

  // --- Luz tipo sol (cálida) que proyecta sombras ----------------------------
  const sol = new DirectionalLight(0xffe7cc, 2.4);
  sol.position.set(-6, 10, 5);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 1024);
  Object.assign(sol.shadow.camera, { left: -ANCHO / 2 - 2, right: ANCHO / 2 + 2, top: fondo / 2 + 2, bottom: -fondo / 2 - 2 });
  sol.shadow.normalBias = 0.02;
  scene.add(sol);

  // --- Piso con la palabra: se escribe en un canvas 2D y se usa como textura.
  // El canvas tiene la proporción del recuadro; al verse en diagonal, las letras
  // quedan derechas en pantalla.
  const hoja = document.createElement('canvas');
  hoja.width = 2048;
  hoja.height = Math.round(2048 / proporcion);
  const h2d = hoja.getContext('2d');
  h2d.fillStyle = FONDO;
  h2d.fillRect(0, 0, hoja.width, hoja.height);
  const fuente = (t) => `800 ${t}px "Bricolage Grotesque", "Helvetica Neue", Arial, sans-serif`;
  h2d.font = fuente(100);
  // Tamaño de letra para que la palabra ocupe el 92 % del ancho
  const tam = Math.min((100 * hoja.width * 0.92) / h2d.measureText(PALABRA).width, hoja.height * 1.05);
  h2d.font = fuente(tam);
  const medida = h2d.measureText(PALABRA);
  h2d.fillStyle = LETRAS;
  h2d.fillText(PALABRA, (hoja.width - medida.width) / 2, (hoja.height + medida.actualBoundingBoxAscent) / 2);
  const textura = new CanvasTexture(hoja);
  textura.colorSpace = SRGBColorSpace;
  // MeshBasicMaterial: el piso no recibe luz, así las letras se ven con su color.
  const piso = new Mesh(new PlaneGeometry(ANCHO, fondo), new MeshBasicMaterial({ map: textura, toneMapped: false }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = -0.03;
  scene.add(piso);

  // --- Colocar las tejas: filas que se traslapan, las impares corridas media teja
  const piezas = [];
  const filas = Math.ceil(fondo / FILA) + 2;
  for (let f = 0; f < filas; f += 1) {
    for (let c = -1; c <= columnas; c += 1) {
      const x = -ANCHO / 2 + c * PASO + (f % 2) * PASO * 0.5 + PASO / 2;
      const z = -fondo / 2 - FILA + f * FILA;
      // h = cuánto está levantada (0 a 1), v = velocidad (resorte), t = hasta cuándo sigue arriba
      piezas.push({ x, z, h: 0, v: 0, t: 0 });
    }
  }

  // Teja colonial: medio cilindro abierto y mate. Se corre para que gire
  // sobre su borde de atrás (el más lejano), como una teja que se levanta.
  const geo = new CylinderGeometry(PASO / 2, PASO / 2, LARGO, 12, 1, true, Math.PI / 2, Math.PI);
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0, LARGO / 2);
  // InstancedMesh: dibuja cientos de copias de la misma teja de una sola vez.
  const tejas = new InstancedMesh(geo, new MeshStandardMaterial({ roughness: 0.82, side: 2 }), piezas.length);
  tejas.castShadow = true;
  tejas.receiveShadow = true;
  const color = new Color();
  piezas.forEach((p, i) => tejas.setColorAt(i, color.set(TONOS[(i * 7 + (i % 5) * 3) % TONOS.length])));
  scene.add(tejas);

  // --- Mover las tejas según el puntero (resorte) ----------------------------
  const dummy = new Object3D();
  function actualizar(objetivo) {
    const ahora = performance.now();
    let movimiento = 0;
    piezas.forEach((p, i) => {
      if (objetivo) {
        // Cerca del puntero (centro de la teja), la teja queda levantada un rato
        const d2 = (p.x - objetivo.x) ** 2 + (p.z + LARGO / 2 - objetivo.z) ** 2;
        if (d2 < RADIO * RADIO) p.t = ahora + ESPERA;
      }
      const meta = p.t > ahora ? 1 : 0;
      p.v += (meta - p.h) * 0.09;   // fuerza del resorte (más alto = cierra más rápido)
      p.v *= 0.8;                   // freno (si se sube a 0.9, rebota más)
      p.h += p.v;
      movimiento += Math.abs(p.v) + Math.abs(meta - p.h) + meta;
      dummy.position.set(p.x, 0.02 + p.h * SUBIDA, p.z);
      dummy.rotation.set(-0.12 - p.h * GIRO_MAX, 0, 0);
      // Al subir se achica: así deja ver las letras de abajo (nunca menos de 4 %)
      dummy.scale.setScalar(Math.max(0.04, 1 - p.h * 0.96));
      dummy.updateMatrix();
      tejas.setMatrixAt(i, dummy.matrix);
    });
    tejas.instanceMatrix.needsUpdate = true;
    return movimiento;
  }

  // --- Puntero: posición del mouse (o del dedo) convertida en un punto del piso 3D
  const raycaster = new Raycaster();
  const plano = new Plane(new Vector3(0, 1, 0), 0);
  const punto = new Vector3();
  const raton = new Vector2();
  let objetivo = null;   // punto bajo el puntero (null = el puntero no está)
  let activo = false;    // el techo está en pantalla
  let corriendo = false; // la animación está corriendo

  function apuntar(e) {
    const r = canvas.getBoundingClientRect();
    raton.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(raton, camera);
    objetivo = raycaster.ray.intersectPlane(plano, punto) ? punto : null;
    arrancar();
  }
  canvas.style.cursor = 'crosshair';
  canvas.addEventListener('pointermove', apuntar);
  canvas.addEventListener('pointerdown', apuntar);   // en celular, al tocar
  canvas.addEventListener('pointerleave', () => { objetivo = null; });
  canvas.addEventListener('pointercancel', () => { objetivo = null; });

  // Un cuadro de animación (unas 60 veces por segundo mientras haya movimiento).
  function cuadro() {
    const m = actualizar(objetivo);
    renderer.render(scene, camera);
    if (!activo || (!objetivo && m < 0.001)) {
      corriendo = false;
      return;
    }
    requestAnimationFrame(cuadro);
  }
  function arrancar() {
    if (corriendo || !activo) return;
    corriendo = true;
    requestAnimationFrame(cuadro);
  }

  // Ajusta el dibujo al tamaño del canvas en pantalla. Si el ancho no cambió
  // (la barra del navegador del celular apareció o se escondió), no hace nada.
  let anchoPrevio = 0;
  function ajustarTamano() {
    if (canvas.clientWidth === anchoPrevio) return;
    anchoPrevio = canvas.clientWidth;
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.render(scene, camera);
  }
  addEventListener('resize', ajustarTamano);
  actualizar(null);   // posición inicial: todas abajo, la palabra tapada
  ajustarTamano();

  // Sólo anima mientras el techo está en pantalla (ahorra batería).
  new IntersectionObserver(([e]) => {
    activo = e.isIntersecting;
    arrancar();
  }).observe(canvas);
}
