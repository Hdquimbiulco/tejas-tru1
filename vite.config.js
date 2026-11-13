import { defineConfig } from 'vite';

// Configuración de Vite, la herramienta que sirve el sitio en local y lo
// compila en la carpeta dist/.
// base: la carpeta donde vivirá el sitio publicado. En local y en un servidor
// propio es la raíz "/". Si se publica en una subcarpeta (por ejemplo, en
// GitHub Pages), se define la variable VITE_BASE con esa subcarpeta.
export default defineConfig({
  base: process.env.VITE_BASE || '/',
});
