// Optimise les grands décors peints (jardins/clairière) en WebP.
// Ces illustrations sont servies à ~3 Mo chacune en JPEG (qualité largement sur-encodée) ;
// en WebP à qualité visuellement équivalente elles tombent à quelques centaines de Ko.
// Gain mobile majeur (90 % des usages). Dimensions conservées (853×1844, taille d'affichage).
//
// Usage : node scripts/optimize-images.mjs   (nécessite sharp, devDependency)
import sharp from 'sharp';
import { statSync } from 'fs';

const SCENES = ['jardin-matin', 'jardin-soir', 'clairiere'];
const QUALITY = 80; // illustrations : rendu quasi identique, poids divisé par ~12
const DIR = 'public/img';

const kb = (p) => (statSync(p).size / 1024).toFixed(0);

let before = 0,
  after = 0;
for (const name of SCENES) {
  const src = `${DIR}/${name}.jpg`;
  const out = `${DIR}/${name}.webp`;
  const b = statSync(src).size;
  await sharp(src).webp({ quality: QUALITY, effort: 6 }).toFile(out);
  const a = statSync(out).size;
  before += b;
  after += a;
  console.log(`  ${name}: ${kb(src)} Ko (jpg) → ${kb(out)} Ko (webp)  [-${Math.round((1 - a / b) * 100)}%]`);
}
console.log(
  `\n  TOTAL décors : ${(before / 1048576).toFixed(1)} Mo → ${(after / 1048576).toFixed(2)} Mo  ` +
    `(-${Math.round((1 - after / before) * 100)}%)`
);
