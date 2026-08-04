// scripts/remove-home-dupes.cjs
// Suppression des 10 fonctions du domaine accueil devenues des doublons (présentes dans src/features/home/home.js).
// Suppression robuste : depuis 'function NOM(', on matche les accolades pour délimiter exactement le corps.
const fs = require('fs');
const path = 'public/app.legacy.js';
let src = fs.readFileSync(path, 'utf8');

const NOMS = [
  'plantLockedToast',
  'openPlantSheet',
  'pickPlant',
  'closePlantSheet',
  'loadHomeData',
  'updateRestBtn',
  'takeRestDay',
  'applyRituelTypeToHome',
  'loadHomeRoutine',
  'fmtSleep'
];

function removeFunction(srcIn, nom) {
  const marker = 'function ' + nom + '(';
  let idx = srcIn.indexOf(marker);
  if (idx === -1) return { src: srcIn, removed: false };

  // Trouver l'accolade ouvrante
  let brace = srcIn.indexOf('{', idx);
  if (brace === -1) return { src: srcIn, removed: false };

  // Parcourir en comptant les accolades
  let depth = 0;
  let inStr = null; // '"', "'" ou '`'
  let i = brace;
  for (; i < srcIn.length; i++) {
    const c = srcIn[i];
    if (inStr) {
      if (c === '\\') { i++; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  if (depth !== 0) return { src: srcIn, removed: false };

  // Supprimer du début de la ligne contenant 'function NOM(' jusqu'à juste après l'accolade fermante
  let lineStart = srcIn.lastIndexOf('\n', idx);
  if (lineStart === -1) lineStart = 0;
  else lineStart = lineStart + 1;

  let out = srcIn.slice(0, lineStart) + srcIn.slice(i);
  // Nettoyer une éventuelle ligne vide résiduelle créée par la suppression sur une ligne dédiée
  out = out.replace(/\n{3,}/g, '\n\n');
  return { src: out, removed: true };
}

let any = false;
for (const nom of NOMS) {
  let guard = 0;
  while (guard < 5) {
    const r = removeFunction(src, nom);
    if (!r.removed) break;
    src = r.src;
    any = true;
  }
}

fs.writeFileSync(path, src);
console.log(any ? 'OK : fonctions supprimées ; restant avec "function {nom}(" :' : 'AUCUN changement');
for (const nom of NOMS) {
  const still = src.includes('function ' + nom + '(');
  console.log('  - ' + nom + ' : ' + (still ? 'ENCORE PRESENT' : 'supprimée ✓'));
}
