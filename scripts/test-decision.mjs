// Le premier vrai test de ce depot. Il porte sur le moteur de decision, parce
// que c'est le seul endroit ou une erreur se traduit par un mauvais conseil
// donne a quelqu'un qui paie pour du conseil.
//
// Aucun framework : le moteur est pur, `node scripts/test-decision.mjs` suffit.

import { composerRoutine } from '../src/features/decision/decision.js';

let passes = 0;
let echecs = 0;

function verifie(titre, condition, detail) {
  if (condition) {
    passes += 1;
    console.log(`  ok   ${titre}`);
  } else {
    echecs += 1;
    console.log(`  ECHEC ${titre}${detail ? `\n        ${detail}` : ''}`);
  }
}

const nettoyant = { nom: 'Gel nettoyant purifiant', categorie: 'nettoyant' };
const toner = { nom: 'Lotion apaisante', categorie: 'toner' };
const serumNiacinamide = { nom: 'Sérum niacinamide 10%', categorie: 'serum' };
const serumVitC = { nom: 'Sérum vitamine C 15%', categorie: 'serum' };
const retinol = { nom: 'Crème rétinol 0.3', categorie: 'serum' };
const acide = { nom: 'Exfoliant acide glycolique 7%', categorie: 'masque' };
const creme = { nom: 'Crème hydratante légère', categorie: 'creme' };
const spf = { nom: 'Fluide SPF 50', categorie: 'spf' };
const demaquillant = { nom: 'Huile démaquillante', categorie: 'demaquillant' };

const noms = (r) => r.etapes.map((e) => e.nom);
const ecarte = (r, motCle) => r.ecartes.some((e) => e.produit.nom.includes(motCle));

console.log('\nOrdre d\'application');
{
  const r = composerRoutine({
    produits: [creme, nettoyant, spf, serumNiacinamide, toner],
    moment: 'matin',
    date: '2026-09-07',
  });
  verifie(
    'du plus fluide au plus riche, SPF en dernier',
    JSON.stringify(noms(r)) === JSON.stringify([
      'Gel nettoyant purifiant', 'Lotion apaisante', 'Sérum niacinamide 10%',
      'Crème hydratante légère', 'Fluide SPF 50',
    ]),
    `obtenu : ${noms(r).join(' → ')}`,
  );
  verifie('les etapes sont numerotees', r.etapes[0].rang === 1 && r.etapes[4].rang === 5);
}

console.log('\nMoment de la journee');
{
  const soir = composerRoutine({ produits: [spf, nettoyant], moment: 'soir', date: '2026-09-07' });
  verifie('le SPF ne sort pas le soir', !noms(soir).includes('Fluide SPF 50') && ecarte(soir, 'SPF'));

  const matin = composerRoutine({ produits: [demaquillant, nettoyant], moment: 'matin', date: '2026-09-07' });
  verifie('le demaquillant ne sort pas le matin', !noms(matin).includes('Huile démaquillante'));

  const matinRetinol = composerRoutine({ produits: [retinol, nettoyant], moment: 'matin', date: '2026-09-07' });
  verifie('le retinol ne sort pas le matin (photosensibilite)', !noms(matinRetinol).includes('Crème rétinol 0.3'));

  const soirVitC = composerRoutine({ produits: [serumVitC, nettoyant], moment: 'soir', date: '2026-09-07' });
  verifie('la vitamine C est repoussee au matin', !noms(soirVitC).includes('Sérum vitamine C 15%'));
}

console.log('\nIncompatibilites');
{
  const r = composerRoutine({ produits: [retinol, acide, nettoyant], moment: 'soir', date: '2026-09-07' });
  const aRetinol = noms(r).includes('Crème rétinol 0.3');
  const aAcide = noms(r).includes('Exfoliant acide glycolique 7%');
  verifie('retinoide et acide jamais le meme soir', aRetinol !== aAcide, `retinol=${aRetinol} acide=${aAcide}`);
  verifie('l\'ecart est explique en francais', r.ecartes.some((e) => e.raison && e.raison.length > 10));
}

console.log('\nMemoire des jours precedents');
{
  const hier = composerRoutine({
    produits: [retinol, nettoyant],
    moment: 'soir',
    date: '2026-09-07',
    historique: [{ date: '2026-09-06', actifs: ['retinoide'] }],
  });
  verifie('retinol applique hier : la peau se repose', !noms(hier).includes('Crème rétinol 0.3'));
  verifie('la raison mentionne hier', hier.ecartes.some((e) => /hier/i.test(e.raison)));

  const troisFois = composerRoutine({
    produits: [retinol, nettoyant],
    moment: 'soir',
    date: '2026-09-07',
    historique: [
      { date: '2026-09-02', actifs: ['retinoide'] },
      { date: '2026-09-03', actifs: ['retinoide'] },
      { date: '2026-09-04', actifs: ['retinoide'] },
    ],
  });
  verifie('trois fois dans la semaine : on s\'arrete la', !noms(troisFois).includes('Crème rétinol 0.3'));

  const loin = composerRoutine({
    produits: [retinol, nettoyant],
    moment: 'soir',
    date: '2026-09-07',
    historique: [{ date: '2026-08-01', actifs: ['retinoide'] }],
  });
  verifie('un vieux passage ne bloque rien', noms(loin).includes('Crème rétinol 0.3'));
}

console.log('\nCe que l\'application doit dire');
{
  const sansSpf = composerRoutine({ produits: [nettoyant, creme], moment: 'matin', date: '2026-09-07' });
  verifie('l\'absence de SPF est signalee le matin', sansSpf.notes.some((n) => /solaire/i.test(n)));

  const vide = composerRoutine({ produits: [], moment: 'soir', date: '2026-09-07' });
  verifie('une routine vide le dit', vide.notes.length > 0 && vide.etapes.length === 0);
}

console.log(`\n${passes} passes, ${echecs} echecs\n`);
process.exit(echecs === 0 ? 0 : 1);
