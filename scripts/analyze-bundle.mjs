// scripts/analyze-bundle.mjs
// Analyse réelle du bundle construit : ordre d'exécution des modules, position des
// Object.assign(window, ...), et détection des points d'exception top-level potentielle
// qui interrompraient l'exécution avant que les fonctions window.* ne soient définies.
// Usage : node scripts/analyze-bundle.mjs
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// 1) Build de production
console.log('=== Build de production ===');
try {
  execSync('npm run build', { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  console.log('Build OK');
} catch (e) {
  console.log('STDOUT:', (e.stdout || '').slice(-2000));
  console.log('STDERR:', (e.stderr || '').slice(-2000));
  process.exit(1);
}

// 2) Lister les assets JS du build
const distAssets = path.join(root, 'dist', 'assets');
const files = fs.existsSync(distAssets) ? fs.readdirSync(distAssets).filter((f) => f.endsWith('.js')) : [];
console.log('\n=== Assets JS construits ===');
for (const f of files) {
  const size = fs.statSync(path.join(distAssets, f)).size;
  console.log(`  ${f} : ${size} octets`);
}
if (!files.length) {
  console.log('AUCUN asset JS trouvé — index.html ne référence peut-être pas main.js via Vite.');
  process.exit(1);
}

// 3) Trouver le bundle principal (celui qui contient main.js -> contient le plus de code)
const mainFile = files.reduce((a, b) => {
  const sa = fs.statSync(path.join(distAssets, a)).size;
  const sb = fs.statSync(path.join(distAssets, b)).size;
  return sb > sa ? b : a;
});
const mainPath = path.join(distAssets, mainFile);
const bundle = fs.readFileSync(mainPath, 'utf8');
console.log(`\n=== Bundle principal : ${mainFile} (${bundle.length} caractères) ===`);

// 4) Positions des Object.assign(window, ...) et des fonctions cibles
const onbNextPos = bundle.indexOf('onbNext');
const updPos = bundle.indexOf('updateCycleMenuMeta');
const assignPoses = [];
let pos;
const scanRe = /Object\.assign\(window/g;
while ((pos = scanRe.exec(bundle)) !== null) assignPoses.push(pos.index);
console.log(`\nObject.assign(window, ...) : ${assignPoses.length} occurrence(s)`);
console.log(`  - onbNext trouvé à l'index ${onbNextPos}`);
console.log(`  - updateCycleMenuMeta trouvé à l'index ${updPos}`);

// Pour chaque Object.assign, afficher l'extrait qui suit immédiatement (les clés exposées)
console.log('\n=== Clés exposées par chaque Object.assign(window, ...) (ordre d\'exécution) ===');
for (let i = 0; i < assignPoses.length; i++) {
  const start = assignPoses[i];
  const snippet = bundle.slice(start, start + 400);
  console.log(`\n[Object.assign #${i + 1}] à l'index ${start}:`);
  console.log(snippet.split('\n').slice(0, 3).join('\n').slice(0, 300));
}

// 5) Vérifier si onbNext est défini AVANT ou APRÈS le dernier Object.assign
//    (s'il est défini mais jamais exposé → le module s'exécute mais l'exposition échoue)
const lastAssign = assignPoses.length ? assignPoses[assignPoses.length - 1] : -1;
console.log(`\n=== Vérification de présence dans le bundle ===`);
console.log(`  - onbNext présent ? ${onbNextPos >= 0}`);
console.log(`  - updateCycleMenuMeta présent ? ${updPos >= 0}`);
console.log(`  - dernier Object.assign à l'index ${lastAssign}`);
if (onbNextPos < 0) console.log('  ⚠️ onbNext ABSENT du bundle — le module onboarding.js n\'est pas bundlé !');
if (updPos < 0) console.log('  ⚠️ updateCycleMenuMeta ABSENT du bundle — le module cycle.js n\'est pas bundlé !');

// 6) Chercher les modules importés en premier : le début du bundle révèle l'ordre d'exécution
console.log('\n=== Début du bundle (2000 premiers caractères) ===');
console.log(bundle.slice(0, 2000));

// 7) Chercher les appels top-level potentiellement dangereux AVANT la définition de onbNext :
//    document.getElementById(...) en top-level (si module exécuté avant la fin du parse DOM)
//    serait un crash. Cherchons des `document.` directs au top-level dans les modules.
console.log('\n=== Recherche de getElementById au top-level dans le bundle (hors fonctions) ===');
const gidRe = /getElementById\(/g;
const gidPositions = [];
while ((pos = gidRe.exec(bundle)) !== null) gidPositions.push(pos.index);
for (const gp of gidPositions) {
  if (gp < onbNextPos) {
    const ctx = bundle.slice(Math.max(0, gp - 80), gp + 60).replace(/\n/g, ' ');
    console.log(`  getElementById à l'index ${gp} (AVANT onbNext): ...${ctx}...`);
  }
}

// 8) Vérifier : le script `<script type="module">` dans index.html construit
const distIdx = path.join(root, 'dist', 'index.html');
if (fs.existsSync(distIdx)) {
  const html = fs.readFileSync(distIdx, 'utf8');
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]*)"[^>]*>/g)].map((m) => m[1]);
  console.log('\n=== Scripts référencés dans dist/index.html ===');
  for (const s of scripts) console.log(`  ${s}`);
  const moduleRef = html.includes('type="module"');
  console.log(`  - contient <script type="module"> ? ${moduleRef}`);
  console.log('\n=== Extraits onclick dans dist/index.html (onbNext) ===');
  const onbRe = /onclick="[^"]*onbNext[^"]*"/g;
  let m;
  while ((m = onbRe.exec(html)) !== null) console.log(`  ${m[0]}`);
}
