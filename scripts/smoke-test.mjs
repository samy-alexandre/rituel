// scripts/smoke-test.mjs
// Test de fumée après `npm run build` : vérifie statiquement que le build Vite
// est sain avant tout déploiement.
//   - dist/index.html existe et référence le point d'entrée JS de Vite (/assets/*.js)
//   - ce fichier JS existe bien dans dist/assets/
//   - manifest.json et sw.js ont bien été copiés depuis public/ à la racine du build
// Aucune dépendance : uniquement Node natif (fs + regex).
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

const failures = [];
const ok = (msg) => console.log('  ✓ ' + msg);
const bad = (msg) => failures.push(msg);

// 1. dist/index.html existe
const indexPath = join(dist, 'index.html');
if (!existsSync(indexPath)) {
  bad('dist/index.html manquant — le build Vite n\'a pas produit de page.');
} else {
  ok('dist/index.html présent');
  const html = readFileSync(indexPath, 'utf8');

  // Le point d'entrée : <script type="module" crossorigin src="/assets/xxx.js">
  const m = html.match(/<script[^>]*type="module"[^>]*src="([^"]+)"/);
  if (!m) {
    bad('dist/index.html ne référence aucun <script type="module"> (point d\'entrée Vite introuvable).');
  } else {
    const entry = m[1].replace(/^\//, ''); // "/assets/app-xxx.js" → "assets/app-xxx.js"
    const entryPath = join(dist, entry);
    ok('point d\'entrée Vite : ' + entry);
    if (!existsSync(entryPath)) {
      bad(`point d'entrée ${entry} manquant dans dist/ — build incomplet.`);
    } else {
      const size = statSync(entryPath).size;
      if (size === 0) {
        bad(`point d'entrée ${entry} vide (0 octet).`);
      } else {
        ok(`${entry} présent (${(size / 1024).toFixed(1)} Ko)`);
      }
    }
  }

  // assets/ non vide dans tous les cas
  const assetsDir = join(dist, 'assets');
  if (existsSync(assetsDir)) {
    const files = readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
    if (!files.length) bad('dist/assets/ ne contient aucun fichier .js.');
    else ok(`dist/assets/ : ${files.length} fichier(s) JS`);
  }
}

// 2. Fichiers statiques copiés depuis public/ (PWA)
for (const f of ['manifest.json', 'sw.js', 'favicon.ico']) {
  if (existsSync(join(dist, f))) ok(`${f} copié dans le build`);
  else bad(`dist/${f} manquant — PWA incomplète.`);
}

if (failures.length) {
  console.error('\n❌ Test de fumée échoué :');
  for (const f of failures) console.error('   - ' + f);
  process.exit(1);
}
console.log('\n✅ Test de fumée réussi : build sain.');
