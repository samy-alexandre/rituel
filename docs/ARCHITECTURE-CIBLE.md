# Rituel — Architecture cible (blueprint)

> Étape 2 du chantier. Ce document définit **où l'on va** et **comment on y va
> sans rien casser**. Décisions validées : **build Vite**, migration **sur la
> branche** (main/prod figé jusqu'à validation finale). Aucune modification de
> code dans ce commit : c'est un plan.

---

## 1. Principes directeurs

1. **L'app fonctionne à chaque commit.** Aucune étape ne laisse le projet
   cassé. On enveloppe l'existant avant de le découper.
2. **Même rendu final, mêmes comportements.** La refacto est structurelle, pas
   fonctionnelle.
3. **Mobile-first mesurable.** Chaque étape perf doit *réduire* le poids/temps
   du premier chargement (90 % d'utilisateurs mobiles via TWA Play Store).
4. **Étapes indépendantes et réversibles.** Un commit = une étape annulable.
5. **Pas de big-bang de dé-globalisation.** Les ~530 fonctions et 377 handlers
   `onclick=` inline sont trop couplés pour tout réécrire d'un coup : on migre
   par domaines, en gardant un pont `window.*` tant que le HTML inline en
   dépend (voir §4, Phase A/B).

---

## 2. Stack cible

| Couche | Choix | Pourquoi |
|---|---|---|
| Bundler | **Vite** | minification, tree-shaking, code-splitting, dev server rapide, config minimale, détection auto sur Vercel |
| Modules | **ESM** (`import`/`export`) | standard, analysable statiquement |
| Supabase | **bundlé, version épinglée** (`npm i @supabase/supabase-js`) | supprime une requête CDN bloquante + fige le comportement |
| Sortie | **site statique `dist/`** | déploiement Vercel + TWA Play Store **inchangés sur le principe** |
| Backend | `api/` **inchangé** (Vercel Functions) | déjà propre |
| PWA | `manifest.json` + `sw.js` via `public/` | restent à la racine du build |
| Qualité | **ESLint + Prettier** (étape 7) | garde-fous pour la durée de vie |

Le TWA charge une URL : peu importe que le site soit écrit à la main ou bâti
par Vite. Seul le workflow dev/déploiement gagne un `npm run build` (que
Vercel exécute automatiquement).

---

## 3. Arborescence cible

```
index.html                 # entrée Vite : <head> + markup + <script type="module" src="/src/main.js">
public/                    # copié tel quel à la racine du build (URLs inchangées)
  manifest.json  sw.js  favicon.ico  icons/  img/  screenshots/
src/
  main.js                  # point d'entrée : importe les styles puis démarre l'app
  app.js                   # orchestration transitoire (nav, init) — issu du gros <script>
  core/
    config.js              # constantes publiques (SUPABASE_URL, clé anon…)
    supabase.js            # client Supabase (bundlé)
    store.js               # état applicatif centralisé (remplace window.__*)
    auth.js                # session, currentUser
    bridge.js              # expose sur window les fns encore appelées en inline (transition)
  data/                    # accès données : 1 module par entité (couche unique)
    rituels.js  products.js  journal.js  routine.js  reminders.js …
  features/                # 1 dossier par domaine fonctionnel
    ritual/                # (cm*) chemin.js, panel.js, guide.js, scene.js, ritual.css
    home/  voyage/  journal/  products/  chat/  profile/  onboarding/  reminders/
  ui/                      # briques transverses : toast.js, modal.js, sheet.js, nav.js
  styles/
    tokens.css             # variables :root (design system)
    base.css  nav.css  overlays.css  …  (CSS découpé par domaine + co-localisé dans features/)
api/                       # inchangé
vite.config.js  package.json  vercel.json
.eslintrc.cjs  .prettierrc  (étape 7)
```

Conventions :
- **Nommage** : fichiers en `kebab-case`, exports nommés, un domaine = un
  dossier `features/<domaine>/`. Les préfixes historiques (`cm`, `vy`, `rh`…)
  disparaissent au profit des dossiers ; les noms de fonctions publiques
  exposées à l'inline sont conservés tant que le HTML les référence.
- **CSS** : co-localisé avec sa feature (`features/ritual/ritual.css`), importé
  par le module JS de la feature → Vite le regroupe. `styles/tokens.css` reste
  la source unique des variables.

---

## 4. Stratégie de migration (le cœur du sujet)

L'objectif est de passer du monolithe à cette cible **sans jamais casser**.
On procède en phases, chacune découpée en commits/étapes.

### Phase A — Envelopper (Étape 3 : réorganisation de l'arborescence)
- Scaffolder Vite (`package.json`, `vite.config.js`).
- `index.html` devient l'entrée Vite : on **sort le CSS** dans `src/styles/`
  et le **JS** dans `src/app.js`, importés par `src/main.js`.
- **La logique n'est pas modifiée.** Les fonctions restent globales : un module
  `core/bridge.js` (ou l'IIFE historique) les ré-expose sur `window` pour que
  les 377 `onclick=` inline continuent de fonctionner.
- Supabase passe du `<script>` CDN à un import bundlé.
- **Vérif** : `vite build` OK + smoke test headless (l'app se charge sans
  erreur JS, l'écran d'auth s'affiche, le rendu est identique).

### Phase B — Découper par domaine (Étapes 4-5 : refactorisation + extraction)
- Scinder `src/app.js` en `features/*` et `ui/*`, un domaine à la fois
  (commencer par les plus autonomes : chat, profil, journal ; finir par le
  cœur `ritual`).
- Introduire `core/store.js` (état observable) et `data/*` (accès Supabase
  centralisé) pour **remplacer progressivement `window.__*`** et le motif
  d'invalidation par nullification.
- À chaque domaine extrait : l'app doit rester identique (smoke test).

### Phase C — Nettoyer (Étape 6 : code mort & doublons)
- Supprimer `village/` (mort), l'éditeur `rd*` hérité, le hub `rh*` retiré, les
  fonctions orphelines (`cmBack`, `cmDelete`…), les métas `<head>` dupliquées,
  les fichiers parasites (`village/dzq`, `img/bld/d3d3`).
- Dédupliquer les motifs répétés (requêtes Supabase, invalidation de cache).

### Phase D — Optimiser (Étape 7 : perf mobile)
- **Code-splitting / lazy-load** des gros modules non critiques au démarrage :
  chat IA, jsPDF, caméra/analyse photo, voyage. `import()` dynamique.
- Optimiser les images (formats/tailles servis au mobile), les polices.
- Activer minification + budget de taille. Garde-fous ESLint/Prettier.

### Étape 8 — Vérification finale
- Parcours complet de toutes les fonctionnalités (checklist), build de prod,
  puis fusion sur `main`.

### Transition des handlers inline (`onclick=`)
Tant qu'ils existent, les fonctions cibles sont exposées via `core/bridge.js`.
Leur migration vers de la délégation d'événements (`addEventListener`) est
**optionnelle** et postérieure : 377 sites, gain surtout pour une CSP stricte.
On ne la fait que si nécessaire, jamais dans la même étape qu'un découpage.

---

## 5. Ce qui NE change pas (garanties)

- URLs des assets (`/icons/…`, `/img/…`, `/manifest.json`, `/sw.js`) → via
  `public/`, identiques.
- `manifest.json`, `start_url`, `scope`, `sw.js` (stratégie réseau-first).
- Le design (variables CSS, rendu visuel).
- Les fonctions serverless `api/`.
- Le comportement fonctionnel de l'app.

---

## 6. Suivi des étapes

| # | Étape | Phase | Commit |
|---|---|---|---|
| 1 | Analyse de l'existant | — | ✅ `docs/ARCHITECTURE.md` |
| 2 | Architecture cible | — | ✅ ce document |
| 3 | Réorganisation arborescence (scaffold Vite) | A | à venir |
| 4 | Refactorisation des gros blocs | B | à venir |
| 5 | Extraction composants & services | B | à venir |
| 6 | Nettoyage code mort & doublons | C | à venir |
| 7 | Optimisations perf mobile | D | à venir |
| 8 | Vérification finale + fusion main | — | à venir |

Chaque étape : réalisée seule → vérifiée (build + smoke test) → commit explicite
→ push **sur la branche**. `main` reste figé jusqu'à l'étape 8.
