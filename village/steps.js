/* ------------------------------------------------------------------
   steps.js — catalogue canonique des étapes
   ------------------------------------------------------------------
   Source unique de vérité. Une étape existe ici pour toujours.
   Elle ne connaît NI son bâtiment, NI sa position, NI son parcours.

   Rien ne se supprime dans ce fichier. Une étape retirée d'un parcours
   reste ici, et ses produits gardent leur step_id valide.
   ------------------------------------------------------------------ */

export const STEPS = [
  {
    id: 'depart',
    label: 'Départ',
    kind: 'repere',        // repère : pas de produit, pas de feuille
    hint: 'Le portail. On passe dessous, le parcours commence.'
  },
  {
    id: 'preparer',
    label: 'Préparer',
    kind: 'soin',
    hint: 'Démaquillage, retrait des huiles.'
    // Retirée des trois parcours à ce jour (cf. cahier V2), mais conservée.
    // Voir parcours.js : la station existe, enabled: false.
  },
  {
    id: 'nettoyer',
    label: 'Nettoyer',
    kind: 'soin',
    hint: 'Nettoyant, gel ou baume.'
  },
  {
    id: 'equilibrer',
    label: 'Équilibrer',
    kind: 'soin',
    hint: 'Lotion, tonique, eau florale.'
  },
  {
    id: 'traiter',
    label: 'Traiter',
    kind: 'soin',
    hint: 'Sérum, actif ciblé.'
  },
  {
    id: 'hydrater',
    label: 'Hydrater',
    kind: 'soin',
    hint: 'Crème, émulsion.'
  },
  {
    id: 'proteger',
    label: 'Protéger',
    kind: 'soin',
    hint: 'SPF. Matin uniquement.'
  },
  {
    id: 'arrivee',
    label: 'Arrivée',
    kind: 'repere',
    hint: 'Le belvédère. Fin du parcours.'
  }
];

const INDEX = Object.fromEntries(STEPS.map(s => [s.id, s]));

export const getStep = id => INDEX[id] || null;

/** true si l'étape porte un produit (donc une feuille au clic). */
export const isSoin = id => INDEX[id]?.kind === 'soin';
