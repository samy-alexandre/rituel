// LEA.
//
// Sam : « c'est l'intérêt principal de l'app, je veux la voir partout ».
//
// Deux regles la gouvernent, et elles decident de tout le reste :
//
// 1. LE MOTEUR DECIDE, LEA EXPLIQUE. Elle ne recalcule jamais la routine :
//    celle-ci vient de src/features/decision/, qui est pur, teste et
//    reproductible. Un modele qui deciderait a la place rendrait le conseil
//    non testable - et un conseil de soin qu'on ne peut pas verifier n'a rien
//    a faire dans une application payante.
//
// 2. ELLE NE PARLE QUE QUAND ELLE A QUELQUE CHOSE A DIRE. Une presence qui
//    commente tout devient un bandeau publicitaire qu'on apprend a ignorer en
//    trois jours.

// Son visage. Dessine au trait plutot qu'illustre : a cette taille un portrait
// detaille devient une bouillie, tandis qu'un profil net reste lisible a 40 px
// comme a 200. Il prend la couleur du theme, donc il ne jure jamais.
export const VISAGE = `
  <svg class="lea-visage" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <clipPath id="lea-rond"><circle cx="32" cy="32" r="30"/></clipPath>
    </defs>
    <circle cx="32" cy="32" r="30" class="lea-fond"/>
    <g clip-path="url(#lea-rond)" fill="none" stroke="currentColor"
       stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 30c0-9 5.6-15 12.6-15 6.6 0 11.4 4.6 11.4 11.6 0 3.4-.6 6-1.6 8.4"/>
      <path d="M20 30c0 6.2 2.4 11 6.4 13.6"/>
      <path d="M42.4 35c1.6 1 2.2 2.6 1.6 4.2-.5 1.4-1.8 2.2-3.2 2"/>
      <path d="M26.4 43.6c1.8 1.2 4 1.8 6.2 1.6"/>
      <path d="M25 29.4c1.2-.8 2.6-.8 3.8 0"/>
      <path d="M36 29.4c1.2-.8 2.6-.8 3.8 0"/>
      <path d="M32.4 33v3.4c0 .7-.5 1.2-1.2 1.2h-1"/>
      <path d="M20.5 27c1-7 6-11.4 12.6-11.4 4 0 7.2 1.4 9.3 3.9"/>
      <path d="M17.6 33.4c-.4-4 .3-7.6 1.9-10.4"/>
      <path d="M26 46.6c-5.4 1.8-9 5.2-10.4 10.2"/>
      <path d="M35.6 46c6.6 1.4 11.2 5 13 11"/>
    </g>
  </svg>`;

/**
 * Interroge Lea. La routine du jour lui est donnee TELLE QUE LE MOTEUR L'A
 * DECIDEE : elle commente une decision deja prise, elle n'en prend pas.
 */
export async function demanderALea({ messages, routine, profil, userId }) {
  const contexte = {
    profil,
    moment: routine.moment,
    etapes: routine.etapes.map((e) => ({ rang: e.rang, nom: e.nom, actifs: e.actifs })),
    ecartes: routine.ecartes.map((e) => ({ nom: e.produit.nom, raison: e.raison })),
  };

  const r = await fetch('/api/lea', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId || null,
      profile: contexte,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });

  const data = await r.json();
  if (!r.ok || data.error) throw new Error(data.error || 'Léa ne répond pas');
  return data.reply;
}
