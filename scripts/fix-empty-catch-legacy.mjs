// scripts/fix-empty-catch-legacy.mjs
// Point 5 Priorité 1 de l'audit : dans public/app.legacy.js, les blocs catch
// qui avalent l'erreur silencieusement (catch(e){} vide ou avec juste un
// commentaire) logent désormais l'erreur via console.error avec un contexte.
// N'insère QUE ce log, sans rien changer d'autre au fichier.
import fs from 'node:fs';

const PATH = 'public/app.legacy.js';

const src = fs.readFileSync(PATH, 'utf8');

// Regex ciblée : catch(e) { } ou catch(e){ /* commentaire seul */ }
// ou catch(e){// commentaire} — c'est-à-dire un corps ne contenant que
// des espaces et/ou un seul bloc de commentaire (/* */ ou //).
// On capture le paramètre du catch pour pouvoir logger l'erreur avec lui.
const catchRe = /catch\s*\(\s*([A-Za-z_$][\w$]*)\s*\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;

let count = 0;
let replaced = false;

const out = src.replace(catchRe, (match, param, body) => {
  // Ne garder que si le corps est vide (espaces/retours à la ligne)
  // ou ne contient qu'un ou plusieurs commentaires (aucune instruction).
  const noComments = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  if (!noComments.trim()) {
    // Corps vide ou avec commentaire(s) seul(s) → insérer le log.
    const logged =
      '\n    console.error("catch silencieux (app.legacy.js):", ' + param + ');\n' + body;
    count++;
    return 'catch (' + param + ') {' + logged + '}';
  }
  return match;
});

if (count > 0) {
  fs.writeFileSync(PATH, out);
  replaced = true;
}

console.log(
  JSON.stringify({ file: PATH, catchSilencieuxCorriges: count, fichierReecrit: replaced })
);

if (!replaced) {
  process.exitCode = 1;
}
