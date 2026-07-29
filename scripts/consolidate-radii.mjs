// Consolide les valeurs de border-radius vers l'échelle de tokens (--r-*).
// Cible UNIQUEMENT les déclarations `border-[…]radius:` (jamais un `Npx` global) ; laisse les
// cercles (50%), les valeurs déjà tokenisées (var(...)) et les micro-rayons (≤9px, intentionnels).
// Dry-run par défaut ; `--apply` pour écrire.
import { readFileSync, writeFileSync } from 'fs';
import { readdirSync } from 'fs';

const APPLY = process.argv.includes('--apply');
const DIR = 'src/styles';

// px → token (écart ≤2px, imperceptible). ≤9 non listé = laissé tel quel.
const MAP = {
  10: '--r-sm', 11: '--r-sm', 12: '--r-sm', 13: '--r-sm',
  14: '--r-md', 15: '--r-md', 16: '--r-md',
  18: '--r-lg', 19: '--r-lg', 20: '--r-lg', 22: '--r-lg',
  24: '--r-xl', 26: '--r-xl', 28: '--r-xl',
  46: '--r-pill', 99: '--r-pill', 100: '--r-pill',
};

const RADIUS_DECL = /(border-[a-z-]*radius:\s*)([^;}]+)/g;
const PX = /\b(\d+)px\b/g;

let totalDecls = 0,
  totalChanged = 0;
const samples = [];

for (const file of readdirSync(DIR).filter((f) => f.endsWith('.css') && f !== 'tokens.css')) {
  const path = `${DIR}/${file}`;
  const src = readFileSync(path, 'utf8');
  let changedInFile = 0;

  const out = src.replace(RADIUS_DECL, (m, prop, value) => {
    totalDecls++;
    if (value.includes('%') || value.includes('var(')) return m; // cercles / déjà tokenisé
    let touched = false;
    const nv = value.replace(PX, (pxm, n) => {
      const tok = MAP[Number(n)];
      if (tok) {
        touched = true;
        return `var(${tok})`;
      }
      return pxm; // ≤9px ou valeur inconnue → inchangé
    });
    if (touched) {
      changedInFile++;
      totalChanged++;
      if (samples.length < 12) samples.push(`  ${file}: ${value.trim()}  →  ${nv.trim()}`);
      return prop + nv;
    }
    return m;
  });

  if (changedInFile && APPLY) writeFileSync(path, out);
  if (changedInFile) console.log(`  ${file}: ${changedInFile} déclaration(s) consolidée(s)`);
}

console.log(`\n  ${totalChanged}/${totalDecls} déclarations border-radius consolidées.`);
console.log(`  Échantillon des transformations :\n${samples.join('\n')}`);
console.log(APPLY ? '\n  ✅ APPLIQUÉ.' : '\n  (dry-run — relancer avec --apply pour écrire)');
