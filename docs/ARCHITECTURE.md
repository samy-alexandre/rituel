# Rituel — Architecture

> **Refactorisation RÉALISÉE.** Le monolithe `index.html` (~9 600 lignes) est
> devenu un projet **Vite modulaire** : le monstre de logique a été extrait en
> **33 modules de domaine** (`src/features/*`) + une couche partagée
> (`src/core`, `src/ui`, `src/data`), le CSS découpé par domaine, et l'état
> centralisé. Comportement et rendu **préservés à l'identique** (déplacements
> verbatim, byte-identiques vérifiés sur les gros domaines).
>
> - **§0** ci-dessous = **structure actuelle + carte « où trouver quoi »** (à lire en premier).
> - **§1–7** = l'analyse d'origine du monolithe et le plan (conservés comme historique).

---

## 0. Structure actuelle — carte de navigation

### Arborescence

```
index.html            markup pur (~1250 l) : structure DOM de tous les écrans/overlays.
                      0 CSS, 0 logique — juste <script type="module" src="/src/main.js">
                      + handlers onclick inline qui appellent des fonctions exposées sur window.
src/
  main.js             point d'entrée Vite : importe core → ui → data → features, PUIS injecte
                      public/app.legacy.js (le shell restant) une fois la couche prête.
  core/
    state.js          ÉTAT PARTAGÉ (source unique) : currentUser, chDraft, rpSlotView,
                      currentPeriod, currentRoutineView, productSort, productCatFilter, premium…
    supabase.js       client Supabase bundlé → export `sb` (+ window.sb)
    utils.js          escapeHtml, loadScript, todayStr, pad2, validEmail, fmtDateLong
    config.js         SUPABASE_URL / SUPABASE_ANON
  ui/
    toast.js          showToast          dialog.js  cmAsk (modale de confirmation)
  data/
    photos.js         signedPhoto (URL signée Storage)
  features/           33 domaines isolés (voir table ci-dessous)
  styles/             index.css + 12 fichiers CSS par domaine (@import ordonné)
public/
  app.legacy.js       LE SHELL restant (~2000 l) : accueil, streak/plante, journal (vue
                      d'ensemble/évolution/calendrier), auth/session, profil, navigation, RGPD,
                      « ma journée » (sommeil/humeur). Script classique global, pont transitoire.
api/                  9 fonctions serverless Vercel (lea, analyze-photo, barcode, stripe, push…)
```

### Carte « je veux changer X → j'ouvre ce fichier »

| Domaine | Fichier | Ce qu'il contient |
|---|---|---|
| **Le rituel (cœur)** | `features/ritual/ritual.js` | chemin de la fleur, panneau, décor peint, stations, gestes, hub, cartes parcours (119 fns, consts `CM_*`) |
| Éditeur de rituel | `features/ritual-editor/` | feuille `rituel-sheet` (repli hérité) : produits, rappels, conflits |
| Rappels d'un rituel | `features/reminders/` | semainier + heure (cloche du panneau) |
| Rituel guidé | `features/guided/` | parcours plein écran pas-à-pas |
| Voyage du jour | `features/voyage/` | scène jardin peinte, médaillons (consts `VY_POLY`, lit `CM_PAINT`) |
| **Produits — formulaire** | `features/product-form/` | création/édition fiche (photo, catégorie, dates, péremption) |
| Produits — liste/carnet | `features/product-flipbook/` | `loadProducts` (orchestrateur), tri, vue livre feuilletable |
| Produits — cartes | `features/product-cards/` | rendu des cartes du carnet (`CN_TINT`) |
| Produits — fiche | `features/product-book/` | fiche produit plein écran |
| Produits — effets | `features/product-effects/` | sélecteur multi-pastilles d'effets |
| Produits — favoris/fraîcheur | `features/product-favorites/` | `favSet/favSave`, `productDateInfo` |
| Scan code-barres | `features/barcode/` | détection + pré-remplissage fiche |
| **Chat / Léa** | `features/chat/` | messagerie `/api/lea`, quota gratuit |
| Bulle Léa flottante | `features/lea-bubble/` | pastille déplaçable + popup |
| Avis photo (vision IA) | `features/photo-advice/` | `/api/analyze-photo` |
| Lettre du mois | `features/monthly-letter/` | bilan mensuel `/api/lea` |
| **Journal — check-in** | `features/journal/` | « rituel du jour » (4 étapes) |
| Timelapse photos | `features/timelapse/` | diaporama d'évolution |
| Avant / Après | `features/before-after/` | comparateur 1re vs dernière photo |
| Graphe éclat | `features/eclat-graph/` | courbe du score de peau |
| **Caméra** | `features/camera/` | capture HD + upload photo du jour |
| Habitudes | `features/habits/` | trackers perso (CRUD + séries) |
| Cycle | `features/cycle/` | phases du cycle → conseil peau |
| Indice UV | `features/uv/` | géoloc + Open-Meteo |
| Programme Éclat | `features/eclat/` | défi 30 jours (localStorage) |
| Badges | `features/badges/` | récompenses calculées |
| Export PDF | `features/pdf-export/` | « Mon carnet de peau » (jsPDF) |
| Image à partager | `features/share-image/` | story récap |
| **Onboarding** | `features/onboarding/` | parcours d'accueil |
| Quiz type de peau | `features/quiz/` | questionnaire dermato |
| Thèmes de couleur | `features/themes/` | palettes accent (CSS vars) |
| Notifications push | `features/push/` | SW + abonnement Web Push |
| Sélecteur de date | `features/datepicker/` | widget calendrier |
| **Le reste (accueil, journal-overview, auth, profil, nav, streak…)** | `public/app.legacy.js` | shell applicatif à découper plus tard |

### Le pont transitoire (à connaître avant de modifier)

Les modules sont en ESM **strict**, mais `index.html` a **224 handlers `onclick=""`
inline** et le shell hérité (`app.legacy.js`) appelle des fonctions par identifiant nu.
Pour que tout se résolve pendant la transition :

- chaque module **expose ses fonctions publiques sur `window`** (`Object.assign(window, {…})`
  en fin de fichier) — c'est ce qui rend les `onclick` inline et les appels hérités valides ;
- l'**état partagé** (currentUser, chDraft, rpSlotView…) vit sur `window` via `core/state.js` :
  une lecture/écriture en identifiant nu s'y résout (module strict comme script hérité) ;
- quelques constantes partagées entre deux mondes sont laissées côté hérité et **exposées sur
  window** (`CATS`, `CAT_RANK`, `SKIN_LABELS`…), ou re-exposées par le module qui les détient
  (`CM_PAINT`, `VY_POLY` par `features/ritual`, lues par `features/voyage`).

**Règle en ajoutant/déplaçant une fonction :** si elle est appelée depuis un `onclick` inline,
depuis `app.legacy.js`, ou depuis un autre module → elle DOIT figurer dans le `Object.assign(window, …)`
de son fichier. (Un audit d'exposition automatique existe : cf. commits « audit d'exposition ».)

### Dette assumée (restante, non bloquante)

1. **`app.legacy.js` (~2000 l)** : le shell accueil/journal/auth, encore couplé (`state`, rendu
   de l'accueil, logique de série). Découpable en `home`/`journal`/`auth` plus tard, prudemment.
2. **224 `onclick=""` inline** : à migrer progressivement vers des `addEventListener` dans les
   modules → supprimerait le besoin d'exposer sur `window` (vraie autonomie des modules + CSP stricte).

Aucune n'est urgente : l'app est modulaire, buildée (Vite), lintée et maintenable en l'état.

---

## Historique — analyse du monolithe (état des lieux d'origine)

> Ce qui suit est le document d'origine (2026-07) qui décrivait le monolithe
> AVANT extraction et posait le plan. Conservé pour la traçabilité des décisions.

---

## 1. Vue d'ensemble

**Rituel** est une PWA (application web installable) de soin de la peau, avec
une coach IA (« Léa »), un journal, un suivi photo, une boutique de rituels et
une gamification (plante/jardin). Elle est **distribuée sur le Play Store via
un TWA** (Trusted Web Activity) : le binaire Android n'est qu'une coquille qui
charge le site. **90 % des utilisateurs sont sur mobile.**

### Stack réelle

| Couche | Techno | Détail |
|---|---|---|
| Front | HTML/CSS/JS **vanilla**, sans framework | tout dans un seul `index.html` |
| Build | **aucun** (zéro bundler) | les fichiers sont servis tels quels |
| Données/Auth | **Supabase** (JS SDK v2 via CDN) | Postgres + Auth + Storage |
| Backend | **Vercel Functions** (`api/*.js`, ES modules) | IA, Stripe, push, code-barres… |
| Hébergement | **Vercel** (statique + serverless) | `vercel.json` |
| PWA | `manifest.json` + `sw.js` | service worker minimal |

---

## 2. Inventaire des fichiers

```
index.html            644 Ko / 9588 lignes   ← quasi toute l'application
sw.js                 ~1 Ko                   service worker (push + cache réseau-first)
manifest.json         PWA
vercel.json           en-têtes d'hébergement
package.json          1 dépendance (web-push)
api/                  9 fonctions serverless (ES modules) — OK, déjà découpé
  analyze-photo.js, barcode.js, checkout.js, delete-account.js,
  lea.js, portal.js, push-send.js, push.js, stripe-webhook.js
icons/ img/ screenshots/   assets
village/              ⚠️ CODE MORT — 0 référence dans index.html (voir §5)
  buildings.js, engine.js, layers.js, parcours.js, steps.js, worlds.js, village.css
img/bld/d3d3, village/dzq   ⚠️ fichiers parasites (4 octets)
```

### Découpage interne de `index.html`

| Zone | Lignes | Taille | Contenu |
|---|---|---|---|
| `<head>` | 1–26 | — | métas, manifest, polices Google |
| `<script>` config | 27–35 | — | mini-script d'amorçage |
| `<style>` | 37–1774 | **~1737 lignes** | **tout le CSS de l'app** |
| `<body>` (markup) | 1776–2935 | **~1160 lignes** | tous les écrans + overlays + sheets |
| CDN Supabase | 2936 | — | `<script src=".../@supabase/supabase-js@2">` |
| `<script>` app | 2937–9526 | **~6590 lignes** | **toute la logique applicative** |

---

## 3. Cartographie des sous-systèmes (JS)

~**530 fonctions** vivent dans **une seule portée de script** (toutes
globales). Regroupées par préfixe de nommage :

| Préfixe | Nb | Domaine |
|---|---|---|
| `cm*` | 78 | **Chemin du rituel** (création/édition immersive « jardin ») — le plus gros module |
| `vy*` | 13 | Voyage du jour (parcours quotidien gamifié) |
| `pf*` | 11 | Formulaire produit |
| `rj*` | 11 | Journal du rituel |
| `rd*` | 11 | Éditeur de rituel **hérité** (remplacé par `cm*`, voir §5) |
| `dp*` | 11 | Dépenses / coût de la routine |
| `rh*` | 7 | Hub « Mes rituels » (partiellement retiré, voir §5) |
| `lea*` | 8 | Chat / coach IA |
| `rap*` | 7 | Rappels / notifications |
| `onb*` | 5 | Onboarding |
| `cam*` | 5 | Caméra / capture photo |
| `quiz*`, `eclat*`, `pc*`, `tl*`, `cn*` | ~20 | Divers (quiz peau, éclat, parcours…) |
| verbes génériques | ~180 | `open*`(35) `close*`(34) `render*`(25) `load*`(23) `toggle*`(17) `save*`(11) `update*`(9)… |

Les écrans principaux (nav basse) : **Aujourd'hui**, **Suivi** (journal),
**Produits**, **Rituel**, **Moi** (profil) + un écran **Chat**.

---

## 4. Ce qui est bien (à préserver)

- **Zéro-build = déploiement trivial** et démarrage instantané côté dev. La
  simplicité a une vraie valeur ; la cible ne doit pas la sacrifier sans gain.
- **Séparation backend nette** : les secrets (IA, Stripe, push) sont côté
  `api/` serverless, jamais dans le front. Bon réflexe de sécurité.
- **PWA correcte** : manifest complet (icônes, maskable, screenshots,
  catégories), `viewport-fit=cover`, safe-areas (`env(safe-area-inset-*)`)
  utilisées partout → déjà **mobile-first** dans l'esprit.
- **Rendu soigné et cohérent** (design system implicite via variables CSS
  `--bg`, `--accent`, `--serif`…). À ne pas casser.
- **Service worker** en stratégie *réseau d'abord* → les utilisateurs
  reçoivent toujours la dernière version (pas de cache bloquant).

---

## 5. Dette technique & anti-patterns identifiés

Classés par impact (maintenabilité + risque de régression + perf mobile).

### 5.1 — Fichier monolithique (impact : élevé)
Un seul `index.html` de ~9 600 lignes mêlant HTML, CSS et JS. Conséquences :
navigation difficile, revue de code impossible à l'échelle, conflits de merge
fréquents, chargement d'un seul bloc de 644 Ko. **C'est le point n°1.**

### 5.2 — État global mutable dispersé (impact : élevé)
Le cache applicatif transite par des globales `window.__*` :
`__allRituels` (**41 usages**), `__cmProds`, `__cmPhotos`, `__homeRoutine`…
Anti-pattern observé et déjà corrigé en partie ce cycle : le motif
`window.__allRituels = null; loadRituels()` (invalidation par nullification)
qui, couplé à un `loadRituels` sortant tôt, **faisait disparaître les données**.
Il n'existe pas de couche d'accès aux données unique : chaque écran refait ses
requêtes Supabase à la main.

### 5.3 — 377 handlers `on*=` inline dans le markup (impact : moyen)
`onclick="cmPick('nettoyer','p1')"`… Le HTML est généré par concaténation de
chaînes avec la logique embarquée. Difficile à tester, sujet à erreurs
d'échappement, couple fortement vue et comportement, empêche une CSP stricte.

### 5.4 — Code mort & doublons (impact : moyen)
- **`village/`** (7 fichiers, ~29 Ko) : **aucune référence** → suppression.
- **Éditeur `rd*` hérité** : `openRituelEditor` délègue à `openRituelChemin`
  → le chemin `rd*` est en grande partie mort.
- **Hub « Mes rituels » (`rh*` / `renderRituelsHub`)** : retiré du parcours
  utilisateur (remplacé par le panneau de la fleur) mais toujours présent.
- **Fonctions orphelines** : `cmBack`, `cmDelete` (remplacées par le panneau).
- **Métas dupliquées** dans le `<head>` (`apple-mobile-web-app-*` en double).
- **Fichiers parasites** : `village/dzq`, `img/bld/d3d3` (4 octets).

### 5.5 — Dépendances externes non maîtrisées (impact : moyen, surtout mobile)
- **Supabase via CDN, version flottante** `@supabase/supabase-js@2` : requête
  réseau bloquante supplémentaire au démarrage + risque qu'une future version
  mineure change le comportement. À **épingler et bundler**.
- **Google Fonts** en `<link>` bloquant (atténué par `display=optional`).
- **jsPDF** chargé à la demande (bon réflexe) mais depuis un CDN tiers.

### 5.6 — CSS non modularisé (impact : moyen)
~1737 lignes dans un seul `<style>`, sans découpage par domaine, avec des
collisions de noms déjà rencontrées (`.cm-panel` du panneau vs. `.cm-panel`
des stations peintes → bug de disparition des produits corrigé ce cycle). Un
nommage/scoping plus strict éviterait ce genre de collision.

### 5.7 — Absence de garde-fous (impact : moyen sur le long terme)
Pas de linter, pas de formateur, pas de tests, pas de typage. Sur un projet
destiné à vivre plusieurs années, l'absence de filet est un risque.

---

## 6. Contraintes à respecter (non négociables)

1. **Ne pas casser le fonctionnement** ni **changer le rendu final**.
2. **PWA / TWA Play Store** : la sortie doit rester un site statique servi à la
   racine, `manifest.json` + `sw.js` en place, `start_url`/`scope` inchangés.
3. **Mobile-first** : optimiser le premier chargement et l'interaction tactile
   (90 % des usages). Toute évolution doit *réduire* le poids initial, pas
   l'augmenter.
4. **Déploiement Vercel** conservé (statique + `api/` serverless).
5. **Étapes indépendantes et réversibles** : un commit par étape, chacun
   annulable sans effet de bord sur les autres.

---

## 7. Prochaine étape

**Étape 2 — Définition de l'architecture cible.** Le choix structurant est la
**stratégie de build/modules** (rester zéro-build en découpant en modules ESM
natifs, ou introduire un bundler type Vite pour minification + code-splitting
mobile-first). Ce choix conditionne toutes les étapes suivantes
(réorganisation de l'arborescence, refactorisation, extraction de services) et
sera arbitré avec le porteur du projet avant toute modification invasive.
