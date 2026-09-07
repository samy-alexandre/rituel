import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    // Deux pages pendant la migration : index.html reste l'application servie
    // aujourd'hui, refonte.html porte la v2 qui decide. Elles ne partagent que
    // le client Supabase et le moteur de decision.
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        refonte: resolve(__dirname, 'refonte.html'),
      },
    },
  },
});
