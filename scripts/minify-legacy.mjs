// Minifie le script hérité (public/app.legacy.js, copié verbatim par Vite dans dist/) APRÈS
// le build. C'est un script CLASSIQUE global : on garde les noms (keepNames + pas de mangle
// top-level) pour que les ~377 handlers onclick inline continuent de résoudre les fonctions.
// La source reste lisible en dev ; seule la sortie de prod est minifiée.
import { transformSync } from 'esbuild';
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const path = 'dist/app.legacy.js';
const src = readFileSync(path, 'utf8');
const before = statSync(path).size;
const { code } = transformSync(src, {
  minify: true,
  keepNames: true, // préserve les noms de fonctions globales (handlers inline)
  target: 'es2019',
  legalComments: 'none',
});
writeFileSync(path, code);
const after = statSync(path).size;
console.log(
  `minify-legacy: ${(before / 1024).toFixed(0)} Ko → ${(after / 1024).toFixed(0)} Ko ` +
    `(-${(100 - (after / before) * 100).toFixed(0)} %)`
);
