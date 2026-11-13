// =============================================================================
// LÁMINAS EN 3D (sección #lamina de index.html)
// -----------------------------------------------------------------------------
// Carga los modelos hechos en Blender (public/modelos/*.glb) y los dibuja en un
// <canvas>. main.js (sección 1b) le pasa tres datos en cada cuadro:
//   avance  → de 0 a 1, cuánto se recorrió la sección (gira la lámina)
//   color   → código "#rrggbb" para teñir la lámina de PVC
//   etapa   → de 0 a 2: 0 = PVC, 1 = policarbonato, 2 = polipropileno; los valores
//             intermedios son el cambio de una lámina a la siguiente
//   recorrido → de 0 a 1, cuánto se avanzó dentro del tramo de la lámina actual:
//             la cámara empieza lejos, se acerca y recorre la lámina de punta a
//             punta, y se vuelve a alejar antes del cambio
// Este archivo es el ÚNICO que mueve las láminas y cambia su color
// (patrón 01 de docs/kb: un solo escritor por propiedad).
//
// Los modelos vienen comprimidos con gltf-transform (meshopt + texturas WebP):
// por eso el cargador necesita el MeshoptDecoder.
// =============================================================================

import {
  WebGLRenderer, Scene, PerspectiveCamera, PMREMGenerator, DirectionalLight, Group,
  Mesh, PlaneGeometry, MeshStandardMaterial, Color, Fog, CanvasTexture, RepeatWrapping, SRGBColorSpace,
  ACESFilmicToneMapping, PCFShadowMap, Vector3,
} from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/** Descarga un modelo. Se llama al inicio para que la pantalla de carga lo espere. */
export function cargarLamina(url) {
  const cargador = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return cargador.loadAsync(url);
}

/** Prepara un modelo: sombras y su material principal. */
function preparar(gltf) {
  let material = null;
  // Según cómo se exporte, "lamina" puede ser la malla o un grupo que la contiene.
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    material = material || o.material;
  });
  return material;
}

const Y = new Vector3(0, 1, 0);

/** Deja un número entre 0 y 1. */
function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

/** Curva de aceleración suave (entra y sale despacio), de 0 a 1. */
function suave(t) {
  return t * t * (3 - 2 * t);
}

/** Cuadrícula de líneas finas dibujada en un canvas: 2 × 2 cuadros por imagen. */
function texturaCuadricula() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1a2127';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#2c3842';
  ctx.lineWidth = 4;
  for (const v of [2, 256]) {
    ctx.beginPath(); ctx.moveTo(v, 0); ctx.lineTo(v, 512); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, v); ctx.lineTo(512, v); ctx.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(30, 30);          // 30 m de piso → cuadros de 50 cm
  t.anisotropy = 4;              // líneas nítidas aunque el piso se vea inclinado
  return t;
}

/** Prepara la escena con las tres láminas y devuelve render(avance, color, etapa, recorrido). */
export function crearLamina(canvas, gltfPvc, gltfPc, gltfPp) {
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));   // nitidez sin pasarse en pantallas 3x
  renderer.toneMapping = ACESFilmicToneMapping;                 // colores de cine: no se queman las luces
  renderer.toneMappingExposure = 0.8;                           // con 1, los colores se veían desteñidos
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;                       // three 0.187 ya no tiene PCFSoftShadowMap
  // El vidrio del policarbonato dibuja la escena una segunda vez; de cerca ocupa toda
  // la pantalla y bajaba a 10 cuadros por segundo. Esa segunda pasada va a media
  // resolución (se nota poco porque lo que se ve a través está desenfocado).
  renderer.transmissionResolutionScale = 0.5;

  const scene = new Scene();
  // Fondo dentro de la escena (no transparente): el policarbonato "transmite" lo que
  // hay detrás DENTRO de la escena; con fondo transparente se vería negro.
  scene.background = new Color('#151b20');
  // Niebla del mismo color del fondo: el borde del piso se pierde a lo lejos.
  scene.fog = new Fog('#151b20', 8, 16);
  // Reflejos: sin "environment" el barniz y el policarbonato no brillan.
  scene.environment = new PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.7;

  const camera = new PerspectiveCamera(30, 1, 0.05, 30);

  // Sol cálido que proyecta la sombra de la lámina sobre el piso.
  const sol = new DirectionalLight(0xfff1de, 2.6);
  sol.position.set(-2.5, 4, 2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(2048, 2048);
  sol.shadow.normalBias = 0.01;
  // Zona de sombra amplia: con ±2 m, la sombra de la lámina que sube se cortaba
  // en un rectángulo de borde recto.
  Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
  scene.add(sol);
  // Piso oscuro con una cuadrícula suave: recibe la sombra y, sobre todo, deja ver
  // que el policarbonato es transparente (las líneas se ven a través de la lámina).
  const piso = new Mesh(new PlaneGeometry(30, 30), new MeshStandardMaterial({ map: texturaCuadricula(), roughness: 0.95 }));
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = -0.25;
  piso.receiveShadow = true;
  scene.add(piso);

  // PVC: la textura de color trae el terracota "pintado"; se quita para poder teñir
  // con material.color. El grano lo sigue dando la textura de normales.
  const materialPvc = preparar(gltfPvc);
  if (materialPvc) { materialPvc.map = null; materialPvc.needsUpdate = true; }
  // Policarbonato: vidrio de verdad ("transmission", tal como lo exporta Blender).
  // Se quita la textura de color (tinte celeste) y se baja la rugosidad: así la
  // lámina deja ver el piso casi sin teñirlo, y sólo las crestas brillan.
  // Con transparencia común (opacity) se veía blanca: la luz difusa se sumaba en
  // cada onda superpuesta.
  const materialPc = preparar(gltfPc);
  if (materialPc) {
    materialPc.map = null;
    materialPc.color.set('#ffffff');
    materialPc.transmission = 1;
    materialPc.roughness = 0.6;       // se multiplica por la textura de rugosidad (≈ 0,05)
    materialPc.thickness = 0;         // lámina delgada: sin desviación de la luz
    materialPc.envMapIntensity = 1;
    materialPc.needsUpdate = true;
  }
  // Una lámina transparente casi no da sombra: si la proyecta, el piso de abajo
  // queda oscuro y no se ve nada a través de ella.
  gltfPc.scene.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  // Polipropileno: textura de Blender (rojo óxido mate). Con la luz de la escena se
  // veía anaranjado, casi igual al PVC terracota; se oscurece un poco multiplicando
  // la textura por un gris claro.
  const materialPp = preparar(gltfPp);
  if (materialPp) materialPp.color.set('#b8b8b8');

  // Las tres láminas giran juntas dentro de un mismo grupo. Todas quedan siempre
  // paralelas al piso y por encima de él: si una esquina atraviesa el piso, aparece
  // una sombra negra cortada (como al atravesar una pared en un juego).
  const giro = new Group();
  const laminas = [gltfPvc.scene, gltfPc.scene, gltfPp.scene];
  giro.add(...laminas);
  scene.add(giro);

  function ajustarTamano() {
    const { clientWidth: w, clientHeight: h } = canvas;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', ajustarTamano);
  ajustarTamano();

  // Las láminas miden de 2,4 a 3,05 m de largo sobre su eje Z: con giro de 90°
  // (Math.PI / 2) queda atravesada, de izquierda a derecha. El scroll la gira ±0,6.
  const GIRO_CENTRO = Math.PI / 2;
  // Distancias de la cámara al punto que mira: lejos se ve la lámina entera; cerca
  // se ven las ondas, los tornillos y el grano de la textura.
  const LEJOS = 5.5;
  const CERCA = 2;
  const objetivo = new Color();
  const foco = new Vector3();          // punto de la lámina que mira la cámara (suavizado)
  const focoMeta = new Vector3();
  const mira = new Vector3();
  let antes = performance.now();
  let giroY = GIRO_CENTRO - 0.6;
  let distancia = LEJOS;
  let e = 0;   // etapa suavizada
  return {
    render(avance, color, etapa, recorrido) {
      // Suavizado que depende del tiempo real: igual en equipos rápidos y lentos.
      const ahora = performance.now();
      const k = 1 - Math.exp(-(ahora - antes) / 160);
      antes = ahora;
      giroY += (GIRO_CENTRO - 0.6 + avance * 1.2 - giroY) * k;
      e += (etapa - e) * k;
      // Sólo giro horizontal: inclinar el grupo hundía una esquina bajo el piso.
      giro.rotation.set(0, giroY, 0);
      // Cambio de lámina, nunca por debajo del piso: la que se va sube y sale por
      // arriba; la siguiente baja desde arriba girando sobre sí misma. Los dos
      // movimientos se solapan para que la pantalla nunca quede vacía. Sólo se
      // dibuja la lámina que está a la vista. Mientras está a la vista, la lámina
      // además gira despacio sobre sí misma (giroPropio) para mostrar sus lados.
      const actual = Math.min(2, Math.round(e));
      const giroPropio = recorrido * 1.4 - 0.7;
      const subidas = laminas.map((lamina, i) => {
        const sale = suave(clamp01((e - i) / 0.6));
        const llega = i === 0 ? 1 : suave(clamp01((e - (i - 1) - 0.3) / 0.7));
        lamina.position.y = sale > 0 ? sale * 3 : (1 - llega) * 1.2;
        lamina.rotation.y = (1 - llega) * Math.PI + (i === actual ? giroPropio : 0);
        lamina.visible = llega > 0.01 && sale < 0.99;
        return { sale, llega };
      });
      // La sombra se desvanece cuando el PVC sube y vuelve cuando baja el
      // polipropileno (el policarbonato no da sombra). Si no, queda en el piso un
      // bloque oscuro separado de la lámina.
      sol.shadow.intensity = e < 1 ? 1 - subidas[0].sale : subidas[2].llega;

      // ACERCAMIENTO. En cada tramo: 0 → 0,25 la cámara se acerca; 0,25 → 0,85 queda
      // cerca y recorre la lámina a lo largo; 0,85 → 1 se aleja para el cambio.
      const acerca = suave(clamp01(recorrido / 0.25)) - suave(clamp01((recorrido - 0.85) / 0.15));
      const lejania = 1 - acerca;                       // 1 = lejos, 0 = cerca
      // En celular (pantalla alta) la vista de lejos necesita más distancia para que
      // entre la lámina completa; de cerca no hace falta.
      const extraMovil = Math.max(1, 1.05 / camera.aspect) - 1;
      const meta = (CERCA + (LEJOS - CERCA) * lejania) * (1 + extraMovil * lejania);
      distancia += (meta - distancia) * k;
      // Punto que se mira: recorre la lámina de una punta (+0,9 m) a la otra (−0,9 m)
      // sobre su largo (eje Z del modelo), girado igual que la lámina.
      const largo = 0.9 - 1.8 * clamp01((recorrido - 0.25) / 0.6);
      focoMeta.set(0, 0, largo * acerca).applyAxisAngle(Y, giroY + laminas[actual].rotation.y);
      foco.lerp(focoMeta, k);
      // Cámara por encima y por delante del foco; de cerca baja un poco para que se
      // lea el relieve de las ondas.
      camera.position.set(foco.x, foco.y + distancia * (0.5 + 0.25 * lejania), foco.z + distancia);
      // En pantalla ancha la lámina se corre a la derecha (el texto va a la izquierda);
      // en celular sube (el texto va abajo). Se logra mirando un punto desplazado,
      // proporcional a la distancia para que funcione igual de cerca y de lejos.
      if (camera.aspect > 1) mira.set(foco.x - distancia * 0.16, foco.y, foco.z);
      else mira.set(foco.x, foco.y - distancia * 0.13, foco.z);
      camera.lookAt(mira);
      // La niebla empieza detrás de la lámina, a la distancia que tenga la cámara.
      // Con valores fijos, en celular (cámara más lejos) la lámina quedaba dentro
      // de la niebla y el policarbonato casi no se veía.
      scene.fog.near = distancia * 1.25 + 1;
      scene.fog.far = distancia * 1.25 + 9;
      if (materialPvc) materialPvc.color.lerp(objetivo.set(color), k);
      renderer.render(scene, camera);
    },
  };
}
