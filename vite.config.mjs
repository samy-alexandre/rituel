import { defineConfig } from 'vite';

// Config Vite — extension .mjs volontaire : package.json n'a PAS "type":"module"
// (certaines fonctions api/ sont en CommonJS), donc on force l'ESM ici via l'extension.
//
// Sortie = site statique dans dist/ → déploiement Vercel + TWA Play Store inchangés.
// public/ (manifest, sw.js, icons, img, screenshots, app.legacy.js) est copié tel quel
// à la racine du build : les URLs absolues et relatives restent identiques.
export default defineConfig({
  // Cibles alignées sur les navigateurs mobiles (WebView Android / iOS Safari récents).
  build: {
    target: 'es2019',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
