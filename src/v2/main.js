// Rituel v2 — l'application qui decide.
//
// Elle ne remplace pas encore l'ancienne : elle vit a cote, sur /refonte.html,
// le temps d'etre jugee. C'est la migration documentee exigee par le projet,
// pas un remplacement en force.
//
// Ce qu'elle sait faire, et rien d'autre :
//   - savoir qui vous etes (Supabase, deja en place) ;
//   - connaitre vos produits (table `products`, deja en place) ;
//   - DECIDER la routine du moment et dire pourquoi elle ecarte le reste ;
//   - se souvenir de ce que vous avez applique, pour que demain en tienne compte ;
//   - vendre l'abonnement (Stripe, deja en place).
//
// L'historique vit dans le navigateur pour cette premiere version. C'est un
// choix assume : il rend la memoire testable par douze personnes des ce soir,
// sans migration de base. La persistance serveur est l'etape d'apres, pas un
// prerequis pour savoir si l'idee tient.

import './app.css';
import { sb } from '../core/supabase.js';
import { composerRoutine, traceDuJour } from '../features/decision/decision.js';

const CATEGORIES = [
  ['demaquillant', 'Démaquillant'],
  ['nettoyant', 'Nettoyant'],
  ['toner', 'Lotion'],
  ['serum', 'Sérum'],
  ['yeux', 'Yeux'],
  ['creme', 'Crème'],
  ['spf', 'SPF'],
  ['masque', 'Masque / exfoliant'],
  ['cible', 'Soin ciblé'],
  ['autre', 'Autre'],
];

const NOM_CATEGORIE = Object.fromEntries(CATEGORIES);

// Mode demonstration (/refonte.html?demo) : l'application tourne avec une
// salle de bain d'exemple, sans compte et sans ecrire une ligne en base.
// Ce n'est pas un artifice de test - c'est ce qui permet de juger le conseil
// AVANT de creer un compte, et c'est exactement ce qu'on demandera aux douze
// testeurs de regarder en premier.
const DEMO = typeof location !== 'undefined' && /[?&]demo\b/.test(location.search);

const PRODUITS_DEMO = [
  { id: 'd1', nom: 'Huile démaquillante douce', categorie: 'demaquillant' },
  { id: 'd2', nom: 'Gel nettoyant purifiant', categorie: 'nettoyant' },
  { id: 'd3', nom: 'Sérum vitamine C 15%', categorie: 'serum' },
  { id: 'd4', nom: 'Sérum niacinamide 10%', categorie: 'serum' },
  { id: 'd5', nom: 'Crème rétinol 0.3', categorie: 'serum' },
  { id: 'd6', nom: 'Exfoliant acide glycolique 7%', categorie: 'masque' },
  { id: 'd7', nom: 'Crème hydratante céramides', categorie: 'creme' },
  { id: 'd8', nom: 'Fluide solaire SPF 50', categorie: 'spf' },
];

// Le diagnostic. Trois questions, un seul ecran : chaque question de plus est
// une personne de moins qui arrive jusqu'a la routine.
const DIAGNOSTIC = [
  {
    cle: 'typePeau',
    question: 'Votre peau, plutôt…',
    choix: [['seche', 'Sèche'], ['normale', 'Normale'], ['mixte', 'Mixte'], ['grasse', 'Grasse']],
  },
  {
    cle: 'tolerance',
    question: 'Elle réagit…',
    choix: [
      ['sensible', 'Facilement — ça tiraille, ça rougit'],
      ['normale', 'Normalement'],
      ['resistante', 'Rarement — elle encaisse tout'],
    ],
  },
  {
    cle: 'objectif',
    question: 'Ce que vous voulez changer',
    choix: [
      ['imperfections', 'Imperfections'], ['rides', 'Rides'],
      ['taches', 'Taches'], ['hydratation', 'Hydratation'], ['eclat', 'Éclat'],
    ],
  },
];

const etat = {
  user: null,
  profil: null,
  produits: [],
  onglet: 'aujourdhui',
  moment: momentParDefaut(),
  abonne: false,
  occupe: false,
  erreur: '',
  ajout: null, // { nom, categorie } quand le formulaire est ouvert
};

const racine = document.getElementById('racine');

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function momentParDefaut() {
  const h = new Date().getHours();
  return h >= 5 && h < 17 ? 'matin' : 'soir';
}

function aujourdhui() {
  return new Date().toISOString().slice(0, 10);
}

function dateLisible() {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function ech(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// ---------------------------------------------------------------------------
// L'historique : ce que la personne a vraiment applique.
// C'est la seule donnee qui rend le conseil de demain different de celui d'hier.
// ---------------------------------------------------------------------------

function cleHistorique() {
  return `rituel.v2.historique.${etat.user ? etat.user.id : 'anon'}`;
}

function cleProfil() {
  return `rituel.v2.profil.${etat.user ? etat.user.id : 'anon'}`;
}

function lireProfil() {
  try {
    const brut = localStorage.getItem(cleProfil());
    return brut ? JSON.parse(brut) : null;
  } catch {
    return null;
  }
}

function ecrireProfil(profil) {
  try {
    localStorage.setItem(cleProfil(), JSON.stringify(profil));
  } catch {
    /* sans stockage, le diagnostic sera redemande - pas bloquant */
  }
}

function lireHistorique() {
  try {
    const brut = localStorage.getItem(cleHistorique());
    const liste = brut ? JSON.parse(brut) : [];
    return Array.isArray(liste) ? liste : [];
  } catch {
    return []; // navigation privee, stockage refuse : on decide sans memoire
  }
}

function ecrireHistorique(liste) {
  try {
    localStorage.setItem(cleHistorique(), JSON.stringify(liste.slice(-90)));
  } catch {
    /* le conseil du jour reste juste, seule la memoire manque */
  }
}

function consigner(routine) {
  const trace = traceDuJour(routine);
  const liste = lireHistorique().filter(
    (h) => !(h.date === trace.date && h.moment === trace.moment),
  );
  liste.push(trace);
  ecrireHistorique(liste);
}

function dejaFait(moment) {
  return lireHistorique().some((h) => h.date === aujourdhui() && h.moment === moment);
}

// ---------------------------------------------------------------------------
// Donnees distantes
// ---------------------------------------------------------------------------

async function chargerProduits() {
  const { data, error } = await sb
    .from('products')
    .select('id,nom,categorie,effets')
    .eq('user_id', etat.user.id);
  if (error) throw error;
  etat.produits = data || [];
}

async function chargerAbonnement() {
  // Le nom exact de la colonne a change au fil du temps : on lit la ligne et on
  // cherche un indice, plutot que de parier sur un schema qu'on n'a pas ecrit.
  try {
    const { data } = await sb.from('profiles').select('*').eq('id', etat.user.id).maybeSingle();
    if (!data) return;
    etat.abonne = Object.entries(data).some(([k, v]) =>
      /premium|abonne|subscri|plan/i.test(k) && v && v !== 'free' && v !== 'none');
  } catch {
    etat.abonne = false;
  }
}

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------

function rendre() {
  racine.innerHTML = etat.user ? vueApp() : vueSeuil();
  brancher();
}

function vueSeuil() {
  return `
    <div class="seuil">
      <h1>Rituel</h1>
      <p class="promesse">Vous avez déjà les produits. Rituel vous dit lesquels appliquer
      ce soir, dans quel ordre, et lesquels laisser de côté — parce qu'il se souvient
      de ce que vous avez mis hier.</p>
      <form id="form-auth" style="display:flex;flex-direction:column;gap:14px">
        <div class="champ">
          <label for="email">Adresse e-mail</label>
          <input id="email" type="email" autocomplete="email" required />
        </div>
        <div class="champ">
          <label for="mdp">Mot de passe</label>
          <input id="mdp" type="password" autocomplete="current-password" required minlength="6" />
        </div>
        ${etat.erreur ? `<p class="erreur">${ech(etat.erreur)}</p>` : ''}
        <button class="bouton" type="submit" ${etat.occupe ? 'disabled' : ''}>
          ${etat.occupe ? 'Un instant…' : 'Entrer'}
        </button>
        <button class="bouton secondaire" type="button" id="inscription" ${etat.occupe ? 'disabled' : ''}>
          Créer un compte
        </button>
      </form>
    </div>`;
}

function vueApp() {
  if (!etat.profil) {
    return `<div class="app"><div class="contenu">${vueDiagnostic()}</div></div>`;
  }
  const contenu = etat.onglet === 'aujourdhui' ? vueAujourdhui()
    : etat.onglet === 'produits' ? vueProduits()
      : vueAbonnement();
  return `<div class="app">
    <div class="contenu">${contenu}</div>
    ${vueNav()}
  </div>`;
}

function vueDiagnostic() {
  const brouillon = etat.diagnostic || {};
  const complet = DIAGNOSTIC.every((q) => brouillon[q.cle]);
  return `
    <div class="entete">
      <span class="date">Trois questions, une fois</span>
      <h1>Votre peau</h1>
    </div>
    <p style="color:var(--doux)">Rituel s'en sert pour régler le rythme des actifs
    forts. Une peau qui réagit vite ne reçoit pas de rétinol au même rythme
    qu'une peau qui encaisse.</p>
    ${DIAGNOSTIC.map((q) => `
      <div class="champ">
        <label>${ech(q.question)}</label>
        <div class="puces">
          ${q.choix.map(([cle, libelle]) => `
            <button type="button" class="puce" data-diag="${q.cle}" data-valeur="${cle}"
              aria-pressed="${brouillon[q.cle] === cle}">${ech(libelle)}</button>`).join('')}
        </div>
      </div>`).join('')}
    <button class="bouton" id="valider-diagnostic" ${complet ? '' : 'disabled'}>
      ${complet ? 'C\'est parti' : 'Répondez aux trois'}
    </button>`;
}

function vueAujourdhui() {
  const routine = composerRoutine({
    produits: etat.produits,
    moment: etat.moment,
    historique: lireHistorique(),
    date: aujourdhui(),
    profil: etat.profil,
  });

  const titre = etat.moment === 'matin' ? 'Ce matin' : 'Ce soir';

  if (!etat.produits.length) {
    return `
      <div class="entete">
        <span class="date">${ech(dateLisible())}</span>
        <h1>${titre}</h1>
      </div>
      <p class="vide">Ajoutez d'abord vos produits — Rituel a besoin de savoir
      ce que vous avez sous la main pour décider.</p>
      <button class="bouton" data-onglet="produits">Ajouter mes produits</button>`;
  }

  const etapes = routine.etapes.map((e) => `
    <li class="etape">
      <span class="rang">${e.rang}</span>
      <div>
        <div class="nom">${ech(e.nom)}</div>
        <div class="meta">${ech(NOM_CATEGORIE[e.categorie] || e.categorie)}</div>
        ${e.actifs.map((a) => `<span class="actif">${ech(a)}</span>`).join(' ')}
      </div>
    </li>`).join('');

  // Les raisons sont le produit. Sans elles, l'application redevient une liste.
  const ecartes = routine.ecartes.length ? `
    <section>
      <p class="legende">${etat.moment === 'matin' ? 'Pas ce matin' : 'Pas ce soir'}</p>
      <div class="ecartes">
        ${routine.ecartes.map((e) => `
          <div class="ecarte">
            <span class="quoi">${ech(e.produit.nom)}</span>
            <span class="pourquoi">${ech(e.raison)}</span>
          </div>`).join('')}
      </div>
    </section>` : '';

  const notes = routine.notes.map((n) => `<p class="note">${ech(n)}</p>`).join('');

  const fait = dejaFait(etat.moment);

  return `
    <div class="entete">
      <span class="date">${ech(dateLisible())}</span>
      <h1>${titre}</h1>
    </div>

    <div class="bascule" role="group" aria-label="Moment de la journée">
      <button data-moment="matin" aria-pressed="${etat.moment === 'matin'}">Matin</button>
      <button data-moment="soir" aria-pressed="${etat.moment === 'soir'}">Soir</button>
    </div>

    ${etapes ? `<ul class="etapes">${etapes}</ul>` : ''}
    ${notes}
    ${ecartes}

    <button class="bouton${fait ? ' secondaire' : ''}" id="applique" ${fait ? 'disabled' : ''}>
      ${fait ? 'Noté pour aujourd\'hui' : 'J\'ai appliqué cette routine'}
    </button>`;
}

function vueProduits() {
  const liste = etat.produits.length ? `
    <div class="produits">
      ${etat.produits.map((p) => `
        <div class="produit">
          <div>
            <div>${ech(p.nom)}</div>
            <div class="categorie">${ech(NOM_CATEGORIE[p.categorie] || 'Autre')}</div>
          </div>
          <button data-supprimer="${ech(p.id)}" aria-label="Retirer ${ech(p.nom)}">Retirer</button>
        </div>`).join('')}
    </div>` : '<p class="vide">Aucun produit pour l\'instant.</p>';

  const formulaire = etat.ajout ? `
    <form id="form-produit" style="display:flex;flex-direction:column;gap:16px">
      <div class="champ">
        <label for="pnom">Nom du produit</label>
        <input id="pnom" value="${ech(etat.ajout.nom)}" placeholder="Sérum niacinamide 10%" required />
      </div>
      <div class="champ">
        <label>Catégorie</label>
        <div class="puces">
          ${CATEGORIES.map(([cle, nom]) => `
            <button type="button" class="puce" data-cat="${cle}"
              aria-pressed="${etat.ajout.categorie === cle}">${ech(nom)}</button>`).join('')}
        </div>
      </div>
      <p class="legende">Écrivez le nom complet : Rituel y repère les actifs
      (rétinol, acides, vitamine C) pour éviter les mauvaises associations.</p>
      ${etat.erreur ? `<p class="erreur">${ech(etat.erreur)}</p>` : ''}
      <button class="bouton" type="submit" ${etat.occupe ? 'disabled' : ''}>Ajouter</button>
      <button class="bouton secondaire" type="button" id="annuler">Annuler</button>
    </form>` : '<button class="bouton" id="ouvrir-ajout">Ajouter un produit</button>';

  return `
    <div class="entete"><h1>Mes produits</h1></div>
    ${liste}
    ${formulaire}`;
}

function vueAbonnement() {
  if (etat.abonne) {
    return `
      <div class="entete"><h1>Rituel+</h1></div>
      <div class="offre">
        <p>Votre abonnement est actif. Merci — c'est ce qui fait vivre l'application.</p>
        <button class="bouton secondaire" id="portail">Gérer mon abonnement</button>
      </div>`;
  }

  return `
    <div class="entete"><h1>Rituel+</h1></div>
    <p style="color:var(--doux)">La routine du jour restera toujours gratuite.
    Ce qui s'apprend avec le temps demande de la mémoire, et c'est ce que finance
    l'abonnement.</p>
    <div class="offre">
      <div class="prix">4,99 € <span>par mois</span></div>
      <ul>
        <li>La mémoire longue : Rituel tient le compte de vos actifs sur des semaines,
        pas seulement d'un jour à l'autre.</li>
        <li>L'adaptation : la fréquence de vos actifs forts monte à votre rythme,
        au lieu d'une règle fixe.</li>
        <li>L'historique complet de ce que votre peau a reçu.</li>
      </ul>
      ${etat.erreur ? `<p class="erreur">${ech(etat.erreur)}</p>` : ''}
      <button class="bouton" id="souscrire" ${etat.occupe ? 'disabled' : ''}>
        ${etat.occupe ? 'Ouverture du paiement…' : 'S\'abonner'}
      </button>
    </div>
    <button class="bouton secondaire" id="deconnexion">Se déconnecter</button>`;
}

function vueNav() {
  const item = (cle, libelle, chemin) => `
    <button data-onglet="${cle}" ${etat.onglet === cle ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24">${chemin}</svg>
      <span>${libelle}</span>
    </button>`;
  return `<nav class="nav">
    ${item('aujourdhui', 'Aujourd\'hui', '<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>')}
    ${item('produits', 'Produits', '<path d="M10 3h4v3l1 2v11a2 2 0 01-2 2h-2a2 2 0 01-2-2V8l1-2V3z"/><path d="M9 12h6"/>')}
    ${item('abonnement', 'Rituel+', '<path d="M12 4l2.2 5.2L20 10l-4.4 3.6L17 20l-5-3-5 3 1.4-6.4L4 10l5.8-.8L12 4z"/>')}
  </nav>`;
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

function surClic(selecteur, fn) {
  racine.querySelectorAll(selecteur).forEach((el) => el.addEventListener('click', fn));
}

function brancher() {
  const form = racine.querySelector('#form-auth');
  if (form) {
    form.addEventListener('submit', (e) => { e.preventDefault(); authentifier('connexion'); });
    racine.querySelector('#inscription')?.addEventListener('click', () => authentifier('inscription'));
  }

  surClic('[data-diag]', (e) => {
    const { diag, valeur } = e.currentTarget.dataset;
    etat.diagnostic = { ...(etat.diagnostic || {}), [diag]: valeur };
    rendre();
  });

  racine.querySelector('#valider-diagnostic')?.addEventListener('click', () => {
    etat.profil = etat.diagnostic;
    ecrireProfil(etat.profil);
    rendre();
  });

  surClic('[data-onglet]', (e) => {
    etat.onglet = e.currentTarget.dataset.onglet;
    etat.erreur = '';
    rendre();
  });

  surClic('[data-moment]', (e) => {
    etat.moment = e.currentTarget.dataset.moment;
    rendre();
  });

  racine.querySelector('#applique')?.addEventListener('click', () => {
    consigner(composerRoutine({
      produits: etat.produits,
      moment: etat.moment,
      historique: lireHistorique(),
      date: aujourdhui(),
    }));
    rendre();
  });

  racine.querySelector('#ouvrir-ajout')?.addEventListener('click', () => {
    etat.ajout = { nom: '', categorie: 'serum' };
    rendre();
  });

  racine.querySelector('#annuler')?.addEventListener('click', () => {
    etat.ajout = null;
    etat.erreur = '';
    rendre();
  });

  surClic('[data-cat]', (e) => {
    etat.ajout.nom = racine.querySelector('#pnom').value;
    etat.ajout.categorie = e.currentTarget.dataset.cat;
    rendre();
  });

  racine.querySelector('#form-produit')?.addEventListener('submit', (e) => {
    e.preventDefault();
    ajouterProduit(racine.querySelector('#pnom').value.trim(), etat.ajout.categorie);
  });

  surClic('[data-supprimer]', (e) => supprimerProduit(e.currentTarget.dataset.supprimer));
  racine.querySelector('#souscrire')?.addEventListener('click', souscrire);
  racine.querySelector('#portail')?.addEventListener('click', souscrire);
  racine.querySelector('#deconnexion')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    etat.user = null;
    etat.produits = [];
    rendre();
  });
}

async function authentifier(mode) {
  const email = racine.querySelector('#email').value.trim();
  const password = racine.querySelector('#mdp').value;
  etat.occupe = true;
  etat.erreur = '';
  rendre();
  try {
    const { error } = mode === 'inscription'
      ? await sb.auth.signUp({ email, password })
      : await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  } catch (err) {
    etat.erreur = mode === 'inscription'
      ? 'Impossible de créer le compte. Cette adresse est peut-être déjà utilisée.'
      : 'Adresse ou mot de passe incorrect.';
    console.error(err);
  } finally {
    etat.occupe = false;
    rendre();
  }
}

async function ajouterProduit(nom, categorie) {
  if (!nom) { etat.erreur = 'Donnez un nom au produit.'; return rendre(); }
  if (DEMO) {
    etat.produits = [...etat.produits, { id: `d${Date.now()}`, nom, categorie }];
    etat.ajout = null;
    return rendre();
  }
  etat.occupe = true;
  rendre();
  try {
    const { error } = await sb.from('products')
      .insert({ user_id: etat.user.id, nom, categorie });
    if (error) throw error;
    await chargerProduits();
    etat.ajout = null;
    etat.erreur = '';
  } catch (err) {
    etat.erreur = 'Le produit n\'a pas pu être enregistré.';
    console.error(err);
  } finally {
    etat.occupe = false;
    rendre();
  }
}

async function supprimerProduit(id) {
  if (DEMO) {
    etat.produits = etat.produits.filter((p) => p.id !== id);
    return rendre();
  }
  try {
    await sb.from('products').delete().eq('id', id);
    await chargerProduits();
  } catch (err) {
    etat.erreur = 'Suppression impossible.';
    console.error(err);
  }
  rendre();
}

async function souscrire() {
  if (DEMO) {
    etat.erreur = 'Démonstration : créez un compte pour vous abonner.';
    return rendre();
  }
  etat.occupe = true;
  etat.erreur = '';
  rendre();
  try {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch('/api/checkout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ plan: 'mois' }),
    });
    const j = await r.json();
    if (!r.ok || !j.url) throw new Error(j.error || 'reponse inattendue');
    window.location.href = j.url;
  } catch (err) {
    etat.erreur = 'Le paiement n\'a pas pu s\'ouvrir. Réessayez dans un instant.';
    console.error(err);
    etat.occupe = false;
    rendre();
  }
}

// ---------------------------------------------------------------------------

async function demarrer() {
  if (DEMO) {
    etat.user = { id: 'demo' };
    etat.produits = PRODUITS_DEMO;
    etat.profil = lireProfil();
    rendre();
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  etat.user = session ? session.user : null;
  if (etat.user) {
    etat.profil = lireProfil();
    try {
      await Promise.all([chargerProduits(), chargerAbonnement()]);
    } catch (err) {
      console.error(err);
      etat.erreur = 'Vos produits n\'ont pas pu être chargés.';
    }
  }
  rendre();
}

if (!DEMO) sb.auth.onAuthStateChange((_evt, session) => {
  const avant = etat.user ? etat.user.id : null;
  etat.user = session ? session.user : null;
  if (etat.user && etat.user.id !== avant) demarrer();
  else if (!etat.user) rendre();
});

demarrer();
