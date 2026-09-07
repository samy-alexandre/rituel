// Rituel v2 — l'application qui decide.
//
// Elle EST l'application : elle occupe index.html, donc le manifeste, l'icone
// de l'ecran d'accueil et le futur emballage Play Store pointent dessus sans
// rien changer. L'ancienne reste servie sur /classique.html le temps que la
// bascule soit jugee sure - migration documentee, pas suppression en force.
//
// Ce qu'elle sait faire, et rien d'autre :
//   - savoir qui vous etes (Supabase, deja en place) ;
//   - connaitre vos produits (table `products`, deja en place) ;
//   - DECIDER la routine du moment et dire pourquoi elle ecarte le reste ;
//   - se souvenir de ce que vous avez applique, pour que demain en tienne compte ;
//   - vendre l'abonnement (Stripe, deja en place).
//
// L'historique est persiste cote serveur des que la table existe (voir
// src/v2/historique.js et docs/migration-historique.sql), avec repli local
// automatique. C'est la seule chose que l'abonnement vend : une memoire qui
// disparait au changement de telephone n'est pas une memoire.

import './app.css';
import { sb } from '../core/supabase.js';
import { composerRoutine, traceDuJour } from '../features/decision/decision.js';
import {
  lireHistorique as chargerHistorique,
  consigner as noterAuServeur,
  profondeur as profondeurMemoire,
} from './historique.js';
import { activerRappels, dejaDemande, enregistrerServiceWorker } from './rappels.js';

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

// Chaque categorie de produit a sa station dans le jardin. Ces illustrations
// existaient deja dans l'application - c'est son identite, et rien ne sert de
// la remplacer par des puces grises. Le moteur decide QUELLES stations
// composent le chemin du soir ; le jardin les met en scene.
const STATION = {
  demaquillant: 'preparer',
  nettoyant: 'nettoyer',
  toner: 'equilibrer',
  masque: 'masque',
  cible: 'traiter',
  serum: 'traiter',
  yeux: 'yeux',
  creme: 'hydrater',
  spf: 'proteger',
  autre: 'equilibrer',
};


// Mode demonstration (/?demo) : l'application tourne avec une
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

// Un feuillage pose derriere l'interface. Dessine plutot que texture : il suit
// le theme (var(--feuille)) et pese quelques centaines d'octets.
const FEUILLAGE = `
  <svg class="feuillage" viewBox="0 0 400 300" aria-hidden="true" preserveAspectRatio="xMidYMin slice">
    <g fill="currentColor">
      <path d="M-10 40c60-34 118-26 150 14 12 15 16 33 12 52-38 6-72-4-96-26-19-17-31-38-66-40z"/>
      <path d="M410 8c-58 6-104 38-118 84-5 17-3 34 5 49 38-4 68-24 86-52 14-22 19-47 27-81z"/>
      <path d="M330 250c-40-18-80-10-104 22-9 12-13 26-11 40 30 6 57-2 76-20 15-14 25-27 39-42z"/>
    </g>
  </svg>`;

const etat = {
  user: null,
  profil: null,
  produits: [],
  historique: [],
  // Les stations validees du moment en cours. Remises a zero au changement de
  // moment : le chemin du matin et celui du soir ne se partagent pas.
  validees: new Set(),
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

// Ce que l'abonnement achete reellement : la profondeur de la memoire.
//
// Sept jours suffisent a voir le conseil fonctionner - « tu as mis du retinol
// hier » marche des le premier soir, gratuitement. Ce qui se paie, c'est le
// rythme sur des semaines : la frequence hebdomadaire d'un actif fort ne se
// mesure pas sur une fenetre de sept jours glissants qui oublie a mesure.
//
// On ne bride jamais la justesse du conseil du jour. On bride sa portee.
const MEMOIRE_GRATUITE = 7;

// L'historique COMPLET vit dans etat.historique, charge une fois au demarrage
// depuis le serveur (voir historique.js). Les vues sont synchrones : elles ne
// doivent jamais attendre le reseau pour afficher la routine du jour.
function lireHistorique(complet = false) {
  const liste = etat.historique || [];
  if (complet || etat.abonne) return liste;
  const limite = new Date();
  limite.setDate(limite.getDate() - MEMOIRE_GRATUITE);
  return liste.filter((h) => new Date(h.date) > limite);
}

async function consigner(routine) {
  const trace = traceDuJour(routine);
  etat.historique = await noterAuServeur(etat.user ? etat.user.id : null, trace);
}

function dejaFait(moment) {
  return lireHistorique().some((h) => h.date === aujourdhui() && h.moment === moment);
}

// ---------------------------------------------------------------------------
// Donnees distantes
// ---------------------------------------------------------------------------

// En mode invite les produits vivent dans le navigateur. Ils seront transferes
// au compte le jour de l'inscription : personne ne doit ressaisir sa salle de
// bain parce qu'il a fini par creer un compte.
const CLE_PRODUITS_INVITE = 'rituel.v2.produits.invite';

function lireProduitsInvite() {
  try {
    const lu = JSON.parse(localStorage.getItem(CLE_PRODUITS_INVITE) || '[]');
    return Array.isArray(lu) ? lu : [];
  } catch {
    return [];
  }
}

function ecrireProduitsInvite(liste) {
  try {
    localStorage.setItem(CLE_PRODUITS_INVITE, JSON.stringify(liste));
  } catch {
    /* stockage refuse : les produits ne survivront pas a la fermeture */
  }
}

async function chargerProduits() {
  if (!etat.user) { etat.produits = lireProduitsInvite(); return; }
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

// L'ARRIVEE AU BOUT DU CHEMIN.
//
// C'est le moment que Sam appelle « j'ai fait quelque chose aujourd'hui », et
// c'est le coeur du produit. Il ne se felicite pas avec un score ni une
// etoile : le jardin s'illumine, on annonce le nombre de soirs tenus, et ca
// s'efface. Une barre d'experience ferait basculer l'application du cote du
// jeu mobile, exactement ce qu'on evite depuis le debut.
function feter() {
  const jours = profondeurMemoire(lireHistorique(true)) + 1;
  const app = racine.querySelector('.app');
  if (!app) return;

  const mot = document.createElement('div');
  mot.className = 'arrivee';
  mot.innerHTML = `
    <span class="arrivee-titre">Chemin terminé</span>
    <span class="arrivee-detail">${jours > 1 ? `${jours} jours que vous le tenez` : 'Votre premier soir'}</span>`;
  app.appendChild(mot);
  app.classList.add('illumine');

  setTimeout(() => {
    mot.classList.add('part');
    app.classList.remove('illumine');
    setTimeout(() => mot.remove(), 400);
  }, 2600);

  // Le rappel se propose ICI, une fois le chemin termine : la personne vient de
  // voir ce que l'application lui apporte. Demande a l'ouverture, la permission
  // est refusee par reflexe - et un refus est definitif, le navigateur ne
  // repose plus jamais la question.
  if (!dejaDemande()) setTimeout(proposerRappel, 3200);
}

function proposerRappel() {
  const app = racine.querySelector('.app');
  if (!app || racine.querySelector('.proposition')) return;

  const bloc = document.createElement('div');
  bloc.className = 'proposition';
  bloc.innerHTML = `
    <span class="proposition-titre">Vous rappeler demain ?</span>
    <span class="proposition-detail">Un mot le soir, à l'heure où vous faites votre rituel.</span>
    <div class="proposition-boutons">
      <button class="bouton" data-rappel="oui">Oui, rappelez-moi</button>
      <button class="lien-danger" data-rappel="non">Non merci</button>
    </div>`;
  app.appendChild(bloc);

  bloc.querySelector('[data-rappel="non"]').addEventListener('click', () => bloc.remove());
  bloc.querySelector('[data-rappel="oui"]').addEventListener('click', async () => {
    bloc.querySelector('[data-rappel="oui"]').disabled = true;
    const actif = await activerRappels(etat.user ? etat.user.id : null);
    bloc.querySelector('.proposition-titre').textContent = actif
      ? 'C\'est noté'
      : 'Les rappels sont bloqués';
    bloc.querySelector('.proposition-detail').textContent = actif
      ? 'Rituel vous fera signe demain soir.'
      : 'Vous pouvez les réactiver dans les réglages de votre navigateur.';
    bloc.querySelector('.proposition-boutons').remove();
    setTimeout(() => bloc.remove(), 3000);
  });
}

let arreterVie = null;
// Un numero de generation par rendu. Le montage de la scene 3D est asynchrone
// (import differe + chargement des modeles) : sans ce jeton, changer d'onglet
// pendant le chargement laissait une scene orpheline tourner pour toujours, et
// chaque aller-retour en empilait une de plus jusqu'a figer l'appareil.
let generation = 0;

// MODE INVITE : l'application entiere fonctionne sans compte.
//
// Mesure du marche, pas intuition : un mur d'inscription pose AVANT la
// premiere valeur perd 20 a 40 % des personnes qui l'atteignent, et le retirer
// remonte la retention a J1 de 15 a 30 %. C'est le changement au meilleur
// retour de tout un parcours d'entree.
//
// L'ordre est donc : diagnostic -> produits -> LA ROUTINE S'AFFICHE -> et
// seulement alors, « creez un compte pour ne pas perdre votre rituel ». Le
// compte se justifie par ce qu'on a deja recu, il ne se demande pas d'avance.
function estInvite() {
  return !etat.user && !!etat.profil;
}

function rendre() {
  generation += 1;
  const mienne = generation;
  // Chaque rendu remplace le DOM : sans cet arret, chaque bascule matin/soir
  // laisserait derriere elle une boucle d'animation orpheline qui tourne dans
  // le vide et mange la batterie.
  if (arreterVie) { arreterVie(); arreterVie = null; }
  // Le routage du parcours d'entree. Personne ne voit d'ecran de connexion
  // avant d'avoir recu quelque chose : sans profil on pose les trois questions,
  // avec un profil l'application fonctionne, compte ou pas. L'inscription
  // n'apparait qu'a la fin, et seulement pour ne pas perdre ce qu'on a deja.
  racine.innerHTML = (etat.user || etat.profil) ? vueApp() : vueDiagnosticSeul();
  brancher();
  const scene = racine.querySelector('canvas.scene');
  if (scene) {
    const routine = composerRoutine({
      produits: etat.produits,
      moment: etat.moment,
      historique: lireHistorique(),
      date: aujourdhui(),
      profil: etat.profil,
    });
    const carte = racine.querySelector('.carte-station');
    const lignes = [...racine.querySelectorAll('.etapes3d li')];

    // Mise a jour CIBLEE du DOM : appeler rendre() ici demonterait la scene 3D
    // et la rechargerait a chaque pas sur le chemin.
    let stationVue = -1;
    const montrer = (i) => {
      const e = routine.etapes[i];
      if (!e || !carte) return;
      stationVue = i;
      const faite = etat.validees.has(i);
      carte.querySelector('.rang').textContent = `Étape ${e.rang} sur ${routine.etapes.length}`;
      carte.querySelector('.nom').textContent = e.nom;
      carte.querySelector('.actif').textContent = e.actifs[0] || '';
      const bouton = carte.querySelector('.valider');
      bouton.textContent = faite ? 'Fait' : 'Appliqué';
      bouton.disabled = faite;
      carte.hidden = false;
      lignes.forEach((l, k) => {
        l.classList.toggle('ici', k === i);
        l.classList.toggle('faite', etat.validees.has(k));
      });
      racine.querySelector('.indice')?.setAttribute('hidden', '');
    };

    // Import differe : Three.js et les modeles pesent plus que tout le reste de
    // l'application. Les ecrans Produits et Rituel+ ne les telechargent jamais.
    import('./jardin3d.js').then(({ monterJardin3d }) => {
      if (mienne !== generation || !scene.isConnected) return null;
      return monterJardin3d(scene, routine.etapes, etat.moment, montrer);
    }).then((arret) => {
      if (!arret) return;
      // Un rendu plus recent est arrive pendant le chargement : cette scene est
      // deja perimee, on la demonte au lieu de la laisser tourner.
      if (mienne !== generation || !scene.isConnected) { arret(); return; }
      arreterVie = arret;
      // Toucher une etape de la liste emmene le parcours jusqu'a elle.
      lignes.forEach((l) => {
        const aller = () => arret.allerA(Number(l.dataset.station));
        l.addEventListener('click', aller);
        l.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); aller(); }
        });
      });

      // Les stations deja validees aujourd'hui restent allumees au rechargement.
      etat.validees.forEach((i) => arret.valider(i));

      carte?.querySelector('.valider')?.addEventListener('click', async () => {
        if (stationVue < 0 || etat.validees.has(stationVue)) return;
        const faite = stationVue;
        etat.validees.add(faite);
        arret.valider(faite);
        montrer(faite);

        // On avance EXPLICITEMENT a la station suivante plutot que d'attendre
        // que la camera se rapproche assez pour la detecter : la detection de
        // proximite est un signal d'ambiance, pas un mecanisme de navigation,
        // et le parcours restait bloque sur l'etape qu'on venait de finir.
        if (faite + 1 < routine.etapes.length) {
          setTimeout(() => { if (scene.isConnected) montrer(faite + 1); }, 760);
        }

        // La routine n'est consignee QUE lorsque le chemin est entierement
        // parcouru : c'est l'arrivee au bout qui vaut « j'ai fait ma routine »,
        // pas le premier produit applique.
        if (arret.toutesValidees()) {
          await consigner(routine);
          feter();
        }
      });
    }).catch((err) => console.error('jardin 3D :', err));
  }
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

// L'ecran d'entree : une promesse, puis les trois questions. Aucun champ de
// connexion, aucun mot de passe. C'est la premiere chose que voit quelqu'un
// qui arrive, et elle doit donner envie d'aller plus loin, pas de partir.
function vueDiagnosticSeul() {
  return `<div class="app" data-moment="${etat.moment}">
    ${FEUILLAGE}
    <div class="contenu">
      <div class="entete">
        <span class="date">Rituel</span>
        <h1>Quoi mettre <em>ce soir</em></h1>
      </div>
      <p class="promesse">Vous avez déjà les produits. Rituel vous dit lesquels
      appliquer, dans quel ordre, et lesquels laisser de côté — parce qu'il se
      souvient de ce que vous avez mis hier.</p>
      ${vueDiagnostic()}
    </div>
  </div>`;
}

function vueApp() {
  if (!etat.profil) {
    return `<div class="app" data-moment="${etat.moment}">${FEUILLAGE}
      <div class="contenu">${vueDiagnostic()}</div></div>`;
  }
  const contenu = etat.onglet === 'aujourdhui' ? vueAujourdhui()
    : etat.onglet === 'produits' ? vueProduits()
      : vueAbonnement();
  return `<div class="app" data-moment="${etat.moment}">
    ${FEUILLAGE}
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

  const titre = etat.moment === 'matin' ? 'Ce <em>matin</em>' : 'Ce <em>soir</em>';

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

  const n = routine.etapes.length;

  const jardin = n ? `
    <div class="jardin3d">
      <div class="vue3d">
        <canvas class="scene"></canvas>
        <p class="indice">Glissez vers le haut pour avancer sur le chemin</p>
        <div class="voile-scene"></div>
        <div class="carte-station" hidden>
          <span class="rang"></span>
          <span class="nom"></span>
          <span class="actif"></span>
          <button class="valider" type="button">Appliqué</button>
        </div>
      </div>
      <ol class="etapes3d">
        ${routine.etapes.map((e, i) => `
          <li data-station="${i}" tabindex="0" role="button">
            <span class="rang">${e.rang}</span>
            <span class="nom">${ech(e.nom)}</span>
            ${e.actifs.length ? `<span class="actif">${ech(e.actifs[0])}</span>` : ''}
          </li>`).join('')}
      </ol>
    </div>` : '';

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

  // Lea a peut-etre deja pris la premiere note : on ne la redit pas.
  const ditParLea = motDeLea(routine);
  const notes = routine.notes
    .filter((n) => n !== ditParLea)
    .map((n) => `<p class="note">${ech(n)}</p>`).join('');

  const fait = dejaFait(etat.moment);

  // L'invitation ne s'affiche que le jour ou elle devient vraie : quand la
  // personne a vraiment plus d'historique que ce qu'on lui laisse voir.
  const profondeur = profondeurMemoire(lireHistorique(true));
  const invitation = !etat.abonne && profondeur > MEMOIRE_GRATUITE ? `
    <div class="verrou">
      <p>Vous tenez votre rituel depuis ${profondeur} jours. Rituel n'en garde
      que ${MEMOIRE_GRATUITE} en mémoire pour régler vos actifs forts.</p>
      <button class="bouton secondaire" data-onglet="abonnement">Voir Rituel+</button>
    </div>` : '';

  return `
    <div class="entete">
      <span class="date">${ech(dateLisible())}</span>
      <h1>${titre}</h1>
    </div>

    <div class="bascule" role="group" aria-label="Moment de la journée">
      <button data-moment="matin" aria-pressed="${etat.moment === 'matin'}">Matin</button>
      <button data-moment="soir" aria-pressed="${etat.moment === 'soir'}">Soir</button>
    </div>

    ${jardin}
    ${vueLea(routine)}
    ${notes}
    ${ecartes}

    <button class="bouton${fait ? ' secondaire' : ''}" id="applique" ${fait ? 'disabled' : ''}>
      ${fait ? 'Noté pour aujourd\'hui' : 'J\'ai appliqué cette routine'}
    </button>
    ${invitation}`;
}

// Lea dit UNE chose, celle qui apprend quelque chose. Les ecarts triviaux
// (« a garder pour le soir ») ne lui vont pas : elle ne parle que quand elle a
// une raison que la personne n'aurait pas trouvee seule.
//
// Elle rend aussi le mot qu'elle a pris, pour que l'affichage des notes ne le
// repete pas juste en dessous - la meme phrase deux fois de suite fait perdre
// toute autorite au conseil.
function motDeLea(routine) {
  const interessant = routine.ecartes.find((e) => /décape|dégrade|récupère|semaine|tire/i.test(e.raison));
  return routine.notes[0] || (interessant
    ? `${interessant.produit.nom} attendra : ${interessant.raison.replace(/ — on garde.*$/, '')}.`
    : null);
}

function vueLea(routine) {
  const mot = motDeLea(routine);
  if (!mot) return '';
  return `
    <aside class="lea">
      <span class="lea-nom">Léa</span>
      <p class="lea-mot">${ech(mot)}</p>
    </aside>`;
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

// Le bloc compte. Sans suppression de compte, une application est refusee au
// Play Store et hors du RGPD - ce n'est pas une finition, c'est un prerequis
// de publication. Le mot de passe oublie est du meme ordre : sans lui, le
// premier utilisateur qui l'oublie est perdu pour toujours.
// Sans compte : l'invitation a en creer un, formulee par ce qu'on RISQUE de
// perdre, jamais par ce qu'on doit donner. C'est le seul endroit de
// l'application ou l'inscription est proposee, et elle arrive apres la valeur.
function vueInscription() {
  const jours = profondeurMemoire(lireHistorique(true));
  return `
    <section class="compte">
      <p class="legende">Garder votre rituel</p>
      <p style="color:var(--doux);font-size:15.5px;line-height:1.5">
        ${etat.produits.length || jours
    ? `Vos ${etat.produits.length} produit${etat.produits.length > 1 ? 's' : ''}${jours ? ` et vos ${jours} jours de mémoire vivent` : ' vivent'} dans ce navigateur. Un compte les emmène sur votre téléphone, et les retrouve si vous le changez.`
    : 'Un compte garde vos produits et votre mémoire d\'un appareil à l\'autre.'}
      </p>
      <form id="form-inscription" style="display:flex;flex-direction:column;gap:12px">
        <div class="champ">
          <label for="email">Adresse e-mail</label>
          <input id="email" type="email" autocomplete="email" required />
        </div>
        <div class="champ">
          <label for="mdp">Mot de passe</label>
          <input id="mdp" type="password" autocomplete="new-password" required minlength="6" />
        </div>
        ${etat.erreur ? `<p class="erreur">${ech(etat.erreur)}</p>` : ''}
        <button class="bouton" type="submit" ${etat.occupe ? 'disabled' : ''}>
          ${etat.occupe ? 'Un instant…' : 'Créer mon compte'}
        </button>
        <button class="bouton secondaire" type="button" id="connexion" ${etat.occupe ? 'disabled' : ''}>
          J'ai déjà un compte
        </button>
      </form>
    </section>`;
}

function vueCompte() {
  if (!etat.user) return vueInscription();
  const email = etat.user && etat.user.email ? etat.user.email : '';
  return `
    <section class="compte">
      <p class="legende">Votre compte</p>
      ${email ? `<p class="compte-email">${ech(email)}</p>` : ''}
      ${etat.message ? `<p class="succes">${ech(etat.message)}</p>` : ''}
      <button class="bouton secondaire" id="motdepasse">Changer mon mot de passe</button>
      <button class="bouton secondaire" id="deconnexion">Se déconnecter</button>
      <button class="lien-danger" id="supprimer-compte">
        ${etat.confirmeSuppression ? 'Confirmer : tout effacer définitivement' : 'Supprimer mon compte'}
      </button>
      ${etat.confirmeSuppression ? `
        <p class="avertissement">Vos produits, votre historique et votre compte
        seront effacés sans retour possible. Touchez à nouveau pour confirmer.</p>` : ''}
    </section>`;
}

function vueAbonnement() {
  if (etat.abonne) {
    return `
      <div class="entete"><h1>Rituel+</h1></div>
      <div class="offre">
        <p>Votre abonnement est actif. Merci — c'est ce qui fait vivre l'application.</p>
        <button class="bouton secondaire" id="portail">Gérer mon abonnement</button>
      </div>
      ${vueCompte()}`;
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
    ${vueCompte()}`;
}

// Le vocabulaire de la barre est botanique, pas generique. Un soleil, un
// flacon et une etoile auraient pu appartenir a n'importe quelle application ;
// une pousse, un flacon d'ou sort une feuille et une fleur qui s'ouvre disent
// qu'on est entre quelque part.
const ICONES = {
  // Une jeune pousse a deux feuilles : le rituel du jour, ce qui recommence.
  aujourdhui: '<path d="M12 21V11"/>'
    + '<path d="M12 12.4C12 9.1 9.6 6.6 6.2 6.2 5.8 9.6 8.2 12.1 11.6 12.4z"/>'
    + '<path d="M12.4 11.2c0-3.3 2.4-5.9 5.8-6.2.4 3.4-2 6-5.4 6.3z"/>',
  // Un flacon d'ou s'echappe une feuille.
  produits: '<path d="M10.5 3h3v3.4l2 3.2A2 2 0 0116 10.7V19a2 2 0 01-2 2h-4a2 2 0 01-2-2v-8.3c0-.4.1-.8.3-1.1l2.2-3.2V3z"/>'
    + '<path d="M12 16.5c0-2 1.3-3.3 3.2-3.5-.1 2-1.3 3.3-3.2 3.5z"/>',
  // Une fleur ouverte : ce qui s'epanouit quand on va plus loin.
  abonnement: '<circle cx="12" cy="12" r="2.1"/>'
    + '<path d="M12 9.9c0-2.5.8-4.4 0-5.9-.8 1.5 0 3.4 0 5.9z"/>'
    + '<path d="M12 14.1c0 2.5-.8 4.4 0 5.9.8-1.5 0-3.4 0-5.9z"/>'
    + '<path d="M9.9 12c-2.5 0-4.4-.8-5.9 0 1.5.8 3.4 0 5.9 0z"/>'
    + '<path d="M14.1 12c2.5 0 4.4.8 5.9 0-1.5-.8-3.4 0-5.9 0z"/>'
    + '<path d="M10.5 10.5C8.7 8.7 7 7.7 6.6 6.6c1.1.4 2.1 2.1 3.9 3.9z"/>'
    + '<path d="M13.5 13.5c1.8 1.8 3.5 2.8 3.9 3.9-1.1-.4-2.1-2.1-3.9-3.9z"/>'
    + '<path d="M13.5 10.5c1.8-1.8 3.5-2.8 3.9-3.9-1.1.4-2.1 2.1-3.9 3.9z"/>'
    + '<path d="M10.5 13.5c-1.8 1.8-3.5 2.8-3.9 3.9 1.1-.4 2.1-2.1 3.9-3.9z"/>',
};

function vueNav() {
  const item = (cle, libelle) => `
    <button data-onglet="${cle}" ${etat.onglet === cle ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" aria-hidden="true">${ICONES[cle]}</svg>
      <span>${libelle}</span>
    </button>`;
  return `<nav class="nav">
    ${item('aujourdhui', 'Aujourd\'hui')}
    ${item('produits', 'Produits')}
    ${item('abonnement', 'Rituel+')}
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

  // `button[data-moment]` et non `[data-moment]` : le conteneur .app porte le
  // meme attribut pour piloter l'ambiance, et sans cette precision l'evenement
  // remontait jusqu'a lui, qui reecrivait l'etat avec la valeur en cours - la
  // bascule ne changeait donc jamais de moment.
  surClic('button[data-moment]', (e) => {
    etat.moment = e.currentTarget.dataset.moment;
    // Changer de moment change de chemin : les stations validees du matin
    // n'ont rien a dire sur celui du soir.
    etat.validees = new Set();
    rendre();
  });

  racine.querySelector('#applique')?.addEventListener('click', async (e) => {
    // Le bouton se desactive tout de suite : sans cela un double appui note
    // deux fois la meme routine pendant l'aller-retour reseau.
    e.currentTarget.disabled = true;
    await consigner(composerRoutine({
      produits: etat.produits,
      moment: etat.moment,
      historique: lireHistorique(),
      date: aujourdhui(),
      profil: etat.profil,
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
    etat.historique = [];
    rendre();
  });

  racine.querySelector('#motdepasse')?.addEventListener('click', envoyerLienMotDePasse);

  racine.querySelector('#form-inscription')?.addEventListener('submit', (e) => {
    e.preventDefault();
    authentifier('inscription');
  });
  racine.querySelector('#connexion')?.addEventListener('click', () => authentifier('connexion'));

  // Deux appuis pour supprimer : la premiere touche arme, la seconde execute.
  // Une action irreversible ne doit jamais partir sur un seul geste.
  racine.querySelector('#supprimer-compte')?.addEventListener('click', () => {
    if (!etat.confirmeSuppression) {
      etat.confirmeSuppression = true;
      rendre();
      return;
    }
    supprimerCompte();
  });
}

async function authentifier(mode) {
  const email = racine.querySelector('#email').value.trim();
  const password = racine.querySelector('#mdp').value;
  // Ce qu'on a en invite, capture AVANT que la session change : apres
  // connexion, les cles de stockage ne sont plus les memes.
  const produitsInvite = lireProduitsInvite();
  const profilInvite = etat.profil;

  etat.occupe = true;
  etat.erreur = '';
  rendre();
  try {
    const { data, error } = mode === 'inscription'
      ? await sb.auth.signUp({ email, password })
      : await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data && data.user) {
      etat.user = data.user;
      await migrerVersLeCompte(produitsInvite, profilInvite);
    }
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
  if (DEMO || !etat.user) {
    etat.produits = [...etat.produits, { id: `l${Date.now()}`, nom, categorie }];
    if (!DEMO) ecrireProduitsInvite(etat.produits);
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
  if (DEMO || !etat.user) {
    etat.produits = etat.produits.filter((p) => p.id !== id);
    if (!DEMO) ecrireProduitsInvite(etat.produits);
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

// LA MIGRATION DE L'INVITE VERS SON COMPTE.
//
// Sans elle, le mode invite serait un piege : on saisit sa salle de bain, on
// tient son rituel une semaine, puis creer un compte efface tout. Personne ne
// pardonnerait ca, et personne ne le refera une seconde fois.
async function migrerVersLeCompte(produitsInvite, profilInvite) {
  // Le profil, d'abord : il est sous la cle « anon », il doit passer sous
  // l'identifiant du compte.
  if (profilInvite) {
    etat.profil = profilInvite;
    ecrireProfil(profilInvite);
  }

  if (produitsInvite.length) {
    try {
      const { error } = await sb.from('products').insert(
        produitsInvite.map((p) => ({
          user_id: etat.user.id, nom: p.nom, categorie: p.categorie,
        })),
      );
      if (error) throw error;
      ecrireProduitsInvite([]);
    } catch (err) {
      // On NE VIDE PAS le stockage si l'envoi echoue : mieux vaut un doublon
      // possible qu'une salle de bain perdue.
      console.error('migration des produits :', err);
    }
  }

  // L'historique se recolle tout seul : chargerHistorique fusionne le local
  // avec le serveur et pousse au serveur ce qu'il ignorait.
  etat.historique = await chargerHistorique(etat.user.id);
  await chargerProduits();
}

async function envoyerLienMotDePasse() {
  if (DEMO || !etat.user) return;
  etat.message = '';
  etat.erreur = '';
  try {
    const { error } = await sb.auth.resetPasswordForEmail(etat.user.email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
    etat.message = 'Un lien vient de partir vers votre adresse.';
  } catch (err) {
    console.error(err);
    etat.erreur = 'Le lien n\'a pas pu être envoyé.';
  }
  rendre();
}

async function supprimerCompte() {
  if (DEMO) { etat.confirmeSuppression = false; return rendre(); }
  etat.occupe = true;
  rendre();
  try {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch('/api/delete-account', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    if (!r.ok) throw new Error(await r.text());
    // On efface aussi ce qui reste dans ce navigateur : un compte supprime ne
    // doit pas laisser derriere lui l'historique de la peau de quelqu'un.
    try {
      localStorage.removeItem(cleProfil());
      localStorage.removeItem(`rituel.v2.historique.${etat.user.id}`);
    } catch { /* stockage indisponible : rien a nettoyer */ }
    await sb.auth.signOut();
    etat.user = null;
    etat.produits = [];
    etat.historique = [];
    etat.profil = null;
  } catch (err) {
    console.error(err);
    etat.erreur = 'La suppression a échoué. Réessayez dans un instant.';
  } finally {
    etat.confirmeSuppression = false;
    etat.occupe = false;
    rendre();
  }
}

// ---------------------------------------------------------------------------

async function demarrer() {
  // Le service worker sert deja le hors-ligne et recevra les rappels. On
  // l'enregistre sans attendre : il ne demande aucune autorisation.
  void enregistrerServiceWorker();

  if (DEMO) {
    etat.user = { id: 'demo' };
    etat.produits = PRODUITS_DEMO;
    etat.profil = lireProfil();
    // Trois semaines de rituel deja tenu : sans passe, la demonstration ne
    // montre ni l'adaptation ni ce que l'abonnement apporte. En demonstration
    // l'historique reste en memoire vive, rien n'est ecrit nulle part.
    const passe = [];
    for (let j = 21; j >= 2; j -= 1) {
      const d = new Date();
      d.setDate(d.getDate() - j);
      passe.push({
        date: d.toISOString().slice(0, 10),
        moment: 'soir',
        actifs: j % 4 === 0 ? ['retinoide'] : j % 5 === 0 ? ['exfoliant'] : [],
      });
    }
    etat.historique = passe;
    rendre();
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  etat.user = session ? session.user : null;

  // Sans compte, l'application tourne quand meme : profil et produits viennent
  // du navigateur. C'est ce qui permet de recevoir la premiere routine avant
  // d'avoir donne quoi que ce soit.
  if (!etat.user) {
    etat.profil = lireProfil();
    etat.produits = lireProduitsInvite();
    etat.historique = await chargerHistorique(null);
    rendre();
    return;
  }

  if (etat.user) {
    etat.profil = lireProfil();
    try {
      // L'abonnement d'abord : il decide de la profondeur de memoire lue.
      await chargerAbonnement();
      const [, historique] = await Promise.all([
        chargerProduits(),
        chargerHistorique(etat.user.id),
      ]);
      etat.historique = historique;
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
