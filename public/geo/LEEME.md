# Datos del mapa de sucursales

Archivos que lee el mapa (`src/mapaDatos.js` y `src/mapaEstilo.js`):

| Archivo | Contenido |
| --- | --- |
| `ecuador.geojson` | Contorno de Ecuador continental (sin Galápagos, como el modelo). |
| `provincias.geojson` | 23 provincias continentales: las líneas amarillas. |
| `cantones.geojson` | Sólo los cantones que tienen sucursal: a dónde se acerca el mapa al elegir una ciudad. |
| `parroquias.geojson` | Las parroquias de esos cantones (203): nivel más cercano del mapa. |
| `sucursales.json` | Una entrada por sucursal. |

Coordenadas en WGS84 (EPSG:4326), en orden `[longitud, latitud]`.

## De dónde salen

- **Límites (país, provincias, cantones y parroquias):** INEC, Instituto Nacional de
  Estadística y Censos, versión 2024. Se descargaron del conjunto
  «Ecuador - Subnational Administrative Boundaries» de HDX (OCHA), archivo
  `ecu_adm_2024.zip`: <https://data.humdata.org/dataset/cod-ab-ecu>.
  Licencia: Creative Commons Attribution for Intergovernmental Organisations (CC BY-IGO),
  que permite publicarlos citando la fuente. La cita está en el mapa (botón «i»).
- **Parroquias urbanas:** el INEC entrega el área urbana de cada ciudad como una sola
  parroquia (la cabecera cantonal; su código termina en `50`, por ejemplo «Quito»).
  Las parroquias urbanas internas (Quitumbe, Turubamba, Guamaní, etc.) no están en
  esos datos: habría que pedirlas al municipio de cada ciudad y verificar si se pueden
  publicar. Hasta entonces, el mapa se detiene en la parroquia del INEC.
- **Ubicación de la sucursal de Quito:** la esquina de la Panamericana Sur (Av. Pedro
  Vicente Maldonado) y la calle Matilde Álvarez, en Guamaní, ubicada con OpenStreetMap
  (© colaboradores de OpenStreetMap, ODbL). Conviene confirmarla en el lugar.

## Datos de demostración que falta reemplazar

En `sucursales.json`, todas las sucursales con `"demo": true` (todas menos Quito) están
puestas en el centro de su ciudad y no tienen dirección. Para cada una falta:
la dirección, las coordenadas reales y, si se quiere, el sector.

## Cómo cambiar o agregar una sucursal

Las sucursales se generan con el script, que además calcula solo el cantón, la provincia
y la parroquia de cada una a partir de sus coordenadas:

1. Descargar `ecu_adm_2024.zip` del enlace de arriba y descomprimirlo en una carpeta
   fuera del proyecto (pesa unos 700 MB; sólo hacen falta los `ecu_adm_adm0` a `adm3`).
2. Cambiar la lista `SUCURSALES` en `scripts/geo/construir-geo.mjs`:
   `[id, ciudad, longitud, latitud, dirección, sector, demo]`.
3. Correr `node --max-old-space-size=4096 scripts/geo/construir-geo.mjs <carpeta>`.
   Vuelve a escribir todos los archivos de esta carpeta.
