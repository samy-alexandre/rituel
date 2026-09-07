// LE MOTEUR DE DECISION.
//
// Tout le reste de l'application sait EDITER une routine. Ce module est le seul
// qui sache en DECIDER une. C'est la difference entre un carnet et un conseil,
// et c'est la seule chose ici pour laquelle quelqu'un paierait : personne n'a
// envie de se rappeler a 23 h qu'il a mis du retinol hier et qu'il ne faut donc
// pas d'acide ce soir.
//
// Trois regles de conception :
//   1. Module PUR - aucun DOM, aucun reseau, aucun `window` en entree. Il prend
//      des donnees, il rend des donnees. C'est ce qui le rend testable, et donc
//      c'est ce qui rend ses conseils verifiables.
//   2. Il travaille sur le modele produit EXISTANT (nom, categorie, dates). Les
//      actifs sont deduits du nom, parce qu'aucun champ ne les porte en base et
//      qu'une migration Supabase n'est pas un prerequis pour tester une idee.
//   3. Il ne tait jamais un ecart. Chaque produit ecarte sort avec sa raison en
//      francais - c'est ce que l'utilisateur lit, et c'est ce qui construit sa
//      confiance dans les jours ou la routine change.

// ---------------------------------------------------------------------------
// L'ordre d'application. Du plus fluide au plus riche : une creme posee avant
// un serum empeche le serum de penetrer. C'est la seule regle que tout le monde
// connait de travers et qui se voit immediatement.
// ---------------------------------------------------------------------------

const ORDRE = {
  demaquillant: 10,
  nettoyant: 20,
  masque: 30, // exfoliant ou masque : sur peau nette, avant tout soin
  toner: 40,
  cible: 50, // traitement localise, au contact direct de la peau
  serum: 60,
  yeux: 70,
  creme: 80,
  spf: 90, // toujours en dernier, jamais dilue par autre chose
  autre: 85,
};

// Le demaquillant n'a pas de sens au reveil, le SPF n'en a aucun le soir.
const MOMENTS = {
  demaquillant: ['soir'],
  spf: ['matin'],
  masque: ['soir'],
  nettoyant: ['matin', 'soir'],
  toner: ['matin', 'soir'],
  cible: ['matin', 'soir'],
  serum: ['matin', 'soir'],
  yeux: ['matin', 'soir'],
  creme: ['matin', 'soir'],
  autre: ['matin', 'soir'],
};

// ---------------------------------------------------------------------------
// Les actifs. `motifs` sert a les reconnaitre dans un nom de produit ecrit par
// un humain, avec ses abreviations et ses fautes.
//
// `soirSeulement` traduit la photosensibilite : un actif qui rend la peau
// sensible au soleil ne s'applique pas le matin.
// `maxParSemaine` est une frequence de PRUDENCE, pas un dogme - c'est ce qui
// evite a un debutant de se bruler la peau en une semaine de retinol quotidien.
// ---------------------------------------------------------------------------

const ACTIFS = {
  retinoide: {
    nom: 'rétinoïde',
    motifs: [/r[ée]tin(ol|al|o[ïi]de)/i, /tr[ée]tino[ïi]ne/i, /adapal[eè]ne/i, /granactive/i],
    soirSeulement: true,
    maxParSemaine: 3,
    reposApres: 1, // le soir qui suit, on laisse la peau tranquille
  },
  exfoliant: {
    nom: 'exfoliant acide',
    motifs: [/\baha\b/i, /\bbha\b/i, /\bpha\b/i, /glycolique/i, /salicylique/i, /lactique/i, /mand[ée]lique/i, /peeling/i, /exfoli/i],
    soirSeulement: true,
    maxParSemaine: 3,
    reposApres: 1,
  },
  vitamineC: {
    nom: 'vitamine C',
    motifs: [/vitamine\s*c\b/i, /\bvit\.?\s*c\b/i, /ascorbique/i, /ascorbyl/i, /\bthd\b/i],
    soirSeulement: false,
    preferMatin: true, // antioxydant : sa place est avant l'exposition, pas apres
  },
  niacinamide: {
    nom: 'niacinamide',
    motifs: [/niacinamide/i, /vitamine\s*b3/i],
    soirSeulement: false,
  },
  peroxydeBenzoyle: {
    nom: 'peroxyde de benzoyle',
    motifs: [/peroxyde\s*de\s*benzoyle/i, /benzoyl/i, /\bbpo\b/i],
    soirSeulement: false,
    maxParSemaine: 7,
  },
  hydratantDoux: {
    nom: 'actif apaisant',
    motifs: [/acide\s*hyaluronique/i, /hyaluron/i, /panth[ée]nol/i, /c[ée]ramide/i, /squalane/i, /centella/i, /\bcica\b/i],
    soirSeulement: false,
  },
};

// Les incompatibilites reellement etablies. Volontairement COURT : la liste
// longue qui circule melange des faits et des mythes, et un conseil faux coute
// plus cher que pas de conseil du tout.
//
// Le couple vitamine C + niacinamide n'y figure PAS : l'idee qu'ils
// s'annulent vient d'une etude sur des solutions chauffees, elle a ete
// largement demontee depuis. On ne la repete pas.
const INCOMPATIBLES = [
  {
    paire: ['retinoide', 'exfoliant'],
    raison: 'rétinoïde et acide exfoliant le même soir, c\'est le combo qui décape',
  },
  {
    paire: ['retinoide', 'vitamineC'],
    raison: 'la vitamine C travaille mieux le matin, le rétinoïde le soir',
  },
  {
    paire: ['retinoide', 'peroxydeBenzoyle'],
    raison: 'le peroxyde de benzoyle dégrade le rétinoïde appliqué en même temps',
  },
  {
    paire: ['exfoliant', 'vitamineC'],
    raison: 'deux acides à la suite, la peau tire',
  },
];

// ---------------------------------------------------------------------------

function actifsDe(produit) {
  const texte = `${produit.nom || ''} ${produit.effets || ''}`;
  return Object.entries(ACTIFS)
    .filter(([, a]) => a.motifs.some((m) => m.test(texte)))
    .map(([cle]) => cle);
}

function categorieDe(produit) {
  const c = (produit.categorie || 'autre').toLowerCase();
  return ORDRE[c] === undefined ? 'autre' : c;
}

// Combien de fois cet actif a-t-il ete applique dans les `jours` derniers jours.
// L'historique attendu : [{ date: 'AAAA-MM-JJ', actifs: ['retinoide'] }, ...]
function comptePassages(historique, actif, jours, aujourdhui) {
  const limite = new Date(aujourdhui);
  limite.setDate(limite.getDate() - jours);
  return historique.filter((h) => {
    if (!h || !Array.isArray(h.actifs) || !h.actifs.includes(actif)) return false;
    const d = new Date(h.date);
    return d > limite && d <= new Date(aujourdhui);
  }).length;
}

function joursDepuis(historique, actif, aujourdhui) {
  const dates = historique
    .filter((h) => h && Array.isArray(h.actifs) && h.actifs.includes(actif))
    .map((h) => new Date(h.date))
    .sort((a, b) => b - a);
  if (!dates.length) return Infinity;
  return Math.round((new Date(aujourdhui) - dates[0]) / 86400000);
}

/**
 * Compose la routine d'un moment donne.
 *
 * @param {object[]} produits    - { nom, categorie, effets? } tels qu'en base
 * @param {'matin'|'soir'} moment
 * @param {object[]} historique  - [{ date, actifs: [] }], le plus recent en premier
 * @param {string} date          - le jour considere, 'AAAA-MM-JJ'
 * @returns {{moment, etapes, ecartes, notes}}
 */
export function composerRoutine({ produits = [], moment = 'soir', historique = [], date } = {}) {
  const aujourdhui = date || new Date().toISOString().slice(0, 10);
  const candidats = produits.map((p) => ({
    produit: p,
    categorie: categorieDe(p),
    actifs: actifsDe(p),
  }));

  const ecartes = [];
  const notes = [];
  const garde = (c, raison) => { ecartes.push({ produit: c.produit, raison }); };

  // 1. Le moment. Un demaquillant au reveil ou un SPF avant de dormir ne sont
  //    pas des erreurs de gout, ce sont des erreurs tout court.
  let restants = candidats.filter((c) => {
    const permis = MOMENTS[c.categorie] || ['matin', 'soir'];
    if (!permis.includes(moment)) {
      garde(c, moment === 'matin'
        ? 'à garder pour le soir'
        : 'à garder pour le matin');
      return false;
    }
    const nocturne = c.actifs.find((a) => ACTIFS[a].soirSeulement);
    if (nocturne && moment === 'matin') {
      garde(c, `${ACTIFS[nocturne].nom} : le soleil et lui ne s'entendent pas`);
      return false;
    }
    const matinal = c.actifs.find((a) => ACTIFS[a].preferMatin);
    if (matinal && moment === 'soir') {
      garde(c, `${ACTIFS[matinal].nom} : elle sert surtout avant la journée`);
      return false;
    }
    return true;
  });

  // 2. La frequence. Un actif fort applique tous les jours des le debut est la
  //    cause numero un des abandons : la peau brule, la personne arrete tout.
  restants = restants.filter((c) => {
    for (const a of c.actifs) {
      const regle = ACTIFS[a];
      if (!regle.maxParSemaine) continue;
      if (comptePassages(historique, a, 7, aujourdhui) >= regle.maxParSemaine) {
        garde(c, `${regle.nom} déjà utilisé ${regle.maxParSemaine} fois cette semaine`);
        return false;
      }
      const ecoules = joursDepuis(historique, a, aujourdhui);
      if (regle.reposApres && ecoules < regle.reposApres + 1) {
        // Dire « hier » quand c'etait il y a une heure fait mentir l'application
        // sur la seule chose qu'elle vend : sa memoire.
        const quand = ecoules === 0 ? 'déjà appliqué aujourd\'hui'
          : ecoules === 1 ? 'appliqué hier'
            : `appliqué il y a ${ecoules} jours`;
        garde(c, `${regle.nom} ${quand}, la peau récupère`);
        return false;
      }
    }
    return true;
  });

  // 3. Les incompatibilites entre ce qui reste. En cas de conflit on garde le
  //    produit le plus doux et on repousse l'autre : mieux vaut une routine
  //    tiede qu'une peau abimee.
  const forceDe = (c) => (c.actifs.includes('retinoide') ? 3
    : c.actifs.includes('exfoliant') ? 2
      : c.actifs.includes('peroxydeBenzoyle') ? 2 : 1);

  const retenus = [];
  for (const c of [...restants].sort((a, b) => forceDe(b) - forceDe(a))) {
    const conflit = retenus.find((r) => INCOMPATIBLES.some(({ paire }) =>
      (r.actifs.includes(paire[0]) && c.actifs.includes(paire[1]))
      || (r.actifs.includes(paire[1]) && c.actifs.includes(paire[0]))));
    if (conflit) {
      const regle = INCOMPATIBLES.find(({ paire }) =>
        (conflit.actifs.includes(paire[0]) && c.actifs.includes(paire[1]))
        || (conflit.actifs.includes(paire[1]) && c.actifs.includes(paire[0])));
      garde(c, `${regle.raison} — on garde ${conflit.produit.nom} ce soir`);
      continue;
    }
    retenus.push(c);
  }

  // 4. L'ordre. C'est la sortie que l'utilisateur lit, numerotee.
  const etapes = retenus
    .sort((a, b) => ORDRE[a.categorie] - ORDRE[b.categorie])
    .map((c, i) => ({
      rang: i + 1,
      nom: c.produit.nom,
      categorie: c.categorie,
      actifs: c.actifs.map((a) => ACTIFS[a].nom),
      produit: c.produit,
    }));

  if (moment === 'matin' && !etapes.some((e) => e.categorie === 'spf')) {
    notes.push('Il manque une protection solaire — c\'est le seul produit qui change vraiment quelque chose sur le long terme.');
  }
  if (!etapes.length) {
    notes.push('Aucun produit ne convient à ce moment de la journée.');
  }

  return { moment, date: aujourdhui, etapes, ecartes, notes };
}

// Ce qu'il faut consigner apres application, pour que demain sache ce qu'hier a fait.
export function traceDuJour(routine) {
  const actifs = new Set();
  for (const e of routine.etapes) {
    for (const [cle, a] of Object.entries(ACTIFS)) {
      if (e.actifs.includes(a.nom)) actifs.add(cle);
    }
  }
  return { date: routine.date, moment: routine.moment, actifs: [...actifs] };
}

export const _interne = { ACTIFS, ORDRE, INCOMPATIBLES, actifsDe };

// Pont transitoire : le HTML herite appelle encore les fonctions via window.
if (typeof window !== 'undefined') {
  window.composerRoutine = composerRoutine;
  window.traceDuJour = traceDuJour;
}
