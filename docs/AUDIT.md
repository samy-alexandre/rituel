# Rituel — Audit technique « lead frontend »

> Revue en lecture seule (aucune modification de code). Objectif : préparer une base
> ultra-propre pour les mois à venir, sans changer un pixel, un comportement ou l'UX.
> Date : 2026-07. Périmètre : `index.html`, `src/`, `public/app.legacy.js`, `src/styles/`, `api/`.

## Contexte (état sain de départ)

Le projet est déjà **bien meilleur** qu'un monolithe : 33 modules `src/features/*`, couche
`core/ui/data`, état partagé centralisé (`core/state.js`), CSS découpé par domaine, build Vite +
ESLint + Prettier. Perf récemment traitée : décors WebP (−87 %), service worker cache-first,
rayons/ombres partiellement tokenisés. **Points forts à préserver** : mobile-first réel
(`max-width:480`, `dvh`, `safe-area-inset` partout), backend serverless séparé, `<html lang>`,
toutes les `<img>` ont un `alt`, dépendances toutes utilisées (aucune inutile).

---

## Synthèse chiffrée

| Sujet | Mesure |
|---|---|
| Plus gros fichiers | `ritual.js` 2032 l · `app.legacy.js` 2069 l · `index.html` 1252 l |
| Couleurs en dur (hors tokens) | **195 hex + 271 rgba() = 466** |
| Tailles de police distinctes | **40** (11 / 11.5 / 12 / 12.5 / 13 / 13.5 …) |
| Durées d'animation distinctes | **~22** (.12 / .13 / .15 / .16 / .18 / .25 / .26 / .28 …) |
| Z-index distincts | **~30**, de `-1` à `9000` + un `99999` inline |
| Espacements px distincts | 33 |
| Ombres neutres uniques restantes | 41 |
| `!important` | 24 · vendor prefixes `-webkit-` : 44 |
| `onclick=` inline | **351** (dont 224 dans `index.html`) |
| Fonctions exposées sur `window` | 33 modules (pont transitoire) |
| État global mutable `window.__*` | `__allRituels` (42×), `__cmProds`, `__cmPhotos`, `__homeRoutine`… |
| `catch {}` vides (avalent l'erreur) | 26 dans `app.legacy.js` |
| `console.*` laissés | 5 |
| Duplication | `toISOString().slice(0,10)` ×15 (helper `todayStr` existe), `split(' · ')` ×11 |
| `app.legacy.js` linté ? | **Non** (2069 l hors garde-fou ESLint) |
| CSS potentiellement mort | ~23 classes sans référence (`cm-menu*`, `cm-modal*`, `cm-autosave`…) |

---

## 1. Refactor pur (0 changement visuel)

| # | Problème | Impact | Fichiers | Risque | Gain | 0 pixel ? |
|---|---|---|---|---|---|---|
| R1 | **Z-index chaotiques** (`-1`→`9000`, `99999` inline) sans échelle nommée | Élevé | tous les `*.css`, `ritual.js` (inline) | Faible (ordre préservable) | Fin des « guerres de z-index », lisibilité | ✅ Oui (si ordre conservé) |
| R2 | **Couleurs exactes-token en dur** (ex. `rgba(46,33,28,…)`, gris = `--ink`/`--muted`) | Moyen | `*.css` | Faible (matchs exacts seulement) | CSS theme-aware, cohérence | ✅ Oui (exacts uniquement) |
| R3 | **Espacements exacts-échelle en dur** (`16px`→`--sp-4`, `8/12/20/24`…) | Moyen | `*.css` | Faible (valeurs inchangées) | Piloté par tokens | ✅ Oui (valeurs identiques) |
| R4 | **Durées exactes en dur** (`.2s`→`--dur-2`, sans changer la valeur) | Faible | `*.css` | Faible | Cohérence | ✅ Oui (exacts) |
| R5 | **CSS mort** (~23 classes : `cm-menu*`, `cm-modal*`, `cm-autosave`, `cm-title-edit`, `cn-moment`…) reliquats de features retirées | Moyen | `ritual.css`, `products.css`, `auth.css`… | Faible (à confirmer : classes construites dynamiquement) | −poids CSS, −bruit | ✅ Oui (si vraiment inutilisées) |
| R6 | **JS mort** : éditeur `rd*` (`openRituelEditor` délègue toujours à `openRituelChemin`), hub `rh*` partiellement retiré | Moyen | `ritual-editor.js`, `ritual.js` | Moyen (vérifier 0 appelant réel) | −code à maintenir | ✅ Oui (suppression pure) |
| R7 | **Duplication de helpers** : `toISOString().slice(0,10)` ×15 alors que `todayStr()` existe ; `split(' · ')` (parse nom·marque) ×11 sans helper | Faible | `app.legacy.js`, features | Faible | DRY, 1 seule source | ✅ Oui |
| R8 | **`app.legacy.js` non linté** (2069 l hors ESLint) | Moyen | `eslint.config.mjs` | Faible | Détecte vars inutilisées, bugs latents | ✅ Oui (config seule) |
| R9 | **`console.*` de debug** (5) | Faible | src + legacy | Faible | Propreté prod | ✅ Oui |

## 2. Design (modifie le rendu — À NE PAS faire sans validation)

| # | Problème | Impact | Risque | 0 pixel ? |
|---|---|---|---|---|
| D1 | **40 tailles de police** → échelle serrée (11/11.5/12/12.5 → 3-4 pas) | Élevé (cohérence) | Change la taille du texte partout | ❌ Non |
| D2 | **41 ombres uniques** → 3 niveaux d'élévation | Moyen | Change la profondeur de cartes | ❌ Non |
| D3 | **~22 durées** → 3 (150/250/350) | Moyen | Change les timings ressentis | ❌ Non |
| D4 | **Teintes proches fusionnées** (parmi les 466 couleurs) | Moyen | Change des nuances | ❌ Non |
| D5 | Icônes/emoji tailles hétérogènes | Faible | Change des tailles | ❌ Non |

## 3. Architecture

| # | Problème | Impact | Fichiers | Risque | Gain | 0 pixel ? |
|---|---|---|---|---|---|---|
| A1 | **351 `onclick=` inline** + 33 ponts `window.*` = couplage vue↔logique. Bloque lazy-loading, CSP stricte, vraie autonomie des modules | Élevé | `index.html`, tous les modules | Moyen (mécanique mais volumineux) | Modules autonomes, code-splitting, sécurité CSP | ✅ Oui si fait proprement (délégation d'événements) |
| A2 | **`ritual.js` 2032 l / 119 fns** = module géant, responsabilités multiples (chemin + panneau + hub + cartes) | Moyen | `ritual.js` | Moyen (état `chDraft` partagé) | Lisibilité, testabilité | ✅ Oui (déplacements) |
| A3 | **`app.legacy.js` 2069 l** = shell mixte (home + journal + auth + profil) non séparé | Moyen | `app.legacy.js` | Moyen (couplé à `state`/rendu accueil) | Séparation claire | ✅ Oui (extractions) |
| A4 | **Pas de couche d'accès données** : chaque écran refait ses requêtes Supabase à la main ; cache via `window.__*` mutables (42× `__allRituels`) | Élevé | partout | Moyen | Source unique, moins de bugs de synchro | ✅ Oui (introduction progressive) |

## 4. Performance

| # | Problème | Impact | Risque | État |
|---|---|---|---|---|
| P1 | Décors 9 Mo JPEG | Élevé | — | ✅ **Fait** (WebP −87 %) |
| P2 | SW ne cachait rien | Moyen | — | ✅ **Fait** (cache-first assets) |
| P3 | **Bundle 418 Ko JS chargé d'un bloc** (33 modules eager) | Moyen | dépend de A1 | Lazy-loading possible seulement APRÈS A1 (onclick→listeners) |
| P4 | Google Fonts : 2 familles × nombreux poids | Faible | Faible | Sous-ensemble de poids réellement utilisés → −réseau |
| P5 | `will-change` / animations `transform` : globalement bien (60 fps) mais à vérifier appareil | Faible | — | Audit device requis |

## 5. Accessibilité

| # | Problème | Impact | Fichiers | Risque | 0 pixel ? |
|---|---|---|---|---|---|
| Acc1 | **44 `<div/span onclick>`** cliquables (non focusables clavier, non annoncés « bouton ») | Élevé | `index.html` (30), JS (14) | Faible-moyen | ✅ Oui (`role="button"`+`tabindex`+`keydown`, ou passage `<button>` sans style visible modifié) |
| Acc2 | **`prefers-reduced-motion` quasi ignoré** (2 fichiers) malgré beaucoup d'animations (luciole, marcheur, transitions) | Moyen | tous `*.css` | Faible | ✅ Oui pour tous (invisible), amélioration pour utilisateurs sensibles |
| Acc3 | **Inputs sans label** (39 inputs / 30 labels) | Moyen | `index.html` | Faible | ✅ Oui (`aria-label` / `<label for>`) |
| Acc4 | Focus visibles partiels (6 fichiers seulement) | Faible | `*.css` | Faible | ✅ Oui (`:focus-visible` global discret) |
| Acc5 | Contraste texte sur décors (`--muted` sur fond clair, texte sur photos) | Moyen | à mesurer | — | ❌ Peut nécessiter ajustement couleur (design) |

## 6. Dette technique

| # | Problème | Impact | Fichiers | 0 pixel ? |
|---|---|---|---|---|
| DT1 | **26 `catch {}` vides** (avalent silencieusement les erreurs) | Moyen | `app.legacy.js` | ✅ Oui (logguer sans changer le flux) |
| DT2 | `app.legacy.js` hors ESLint (2069 l) | Moyen | config | ✅ Oui |
| DT3 | 24 `!important` (hacks de spécificité) | Faible | `*.css` | ⚠️ Prudence (peut changer le rendu si retiré) |
| DT4 | Pas de tests automatisés (les smokes headless sont ad hoc, non versionnés) | Moyen | — | ✅ Oui (ajout d'un dossier `tests/`) |
| DT5 | 44 vendor prefixes `-webkit-` manuels (autoprefixer via build possible) | Faible | `*.css` | ✅ Oui |

---

# Plan d'action priorisé

## Phase A — Refactors 100 % sûrs (0 pixel, 0 comportement)
Ordre recommandé (chaque point = 1 commit isolé, build vert, vérif) :

1. **A-1 · Nettoyage mort** : supprimer le CSS mort confirmé (R5) + JS mort `rd*`/`rh*` (R6) + `console.*` (R9). *Gain immédiat, risque faible.*
2. **A-2 · Z-index → échelle sémantique** (R1) : `--z-base/dropdown/overlay/panel/modal/toast`, en **préservant l'ordre exact**. Provablement 0 pixel.
3. **A-3 · Linter `app.legacy.js`** (R8/DT2) : l'inclure dans ESLint (règles souples), corriger vars inutilisées / bugs latents détectés.
4. **A-4 · DRY helpers** (R7) : router les `toISOString().slice(0,10)` vers `todayStr()`, factoriser `split(' · ')` dans un `parseNomMarque()`.
5. **A-5 · Tokenisation des valeurs EXACTES** (R2/R3/R4) : remplacer les littéraux couleur/espacement/durée qui **matchent déjà un token**, sans changer aucune valeur.
6. **A-6 · `catch {}` → log** (DT1) : garder le même flux, mais tracer l'erreur (facilite le debug futur).
7. **A-7 · Accessibilité invisible** (Acc2/Acc4) : bloc global `@media (prefers-reduced-motion:reduce)` + `:focus-visible` discret. Invisible pour la majorité, gain réel.

## Phase B — Optimisations (améliorent, nécessitent des tests)
1. **B-1 · `onclick` inline → délégation d'événements** (A1) : le *keystone*. Débloque lazy-loading + CSP. Gros mais mécanique ; à faire module par module, testé.
2. **B-2 · Lazy-loading des modules non critiques** (P3) — après B-1.
3. **B-3 · Couche d'accès données** (A4) : `data/rituels.js`, `data/products.js`… remplacer les `window.__*` par un petit store. Progressif.
4. **B-4 · Sous-découpage de `ritual.js`** (A2) et **du shell `app.legacy.js`** (A3).
5. **B-5 · Accessibilité `<div onclick>` → boutons/rôles** (Acc1/Acc3) : comportement quasi identique, à tester au clavier/lecteur d'écran.
6. **B-6 · Sous-ensemble de poids de police** (P4), autoprefixer au build (DT5), suite de tests versionnée (DT4).

## Phase C — Décisions de design (changent volontairement l'apparence)
À décider ensemble, validées écran par écran, **jamais mélangées au refactor** :
1. **C-1 · Échelle typographique** (40 → ~4 tailles) — D1.
2. **C-2 · Système d'élévation** (41 ombres → 3 niveaux) — D2.
3. **C-3 · Échelle de durées** (150/250/350) — D3.
4. **C-4 · Palette resserrée** (fusion de teintes proches) — D4.
5. **C-5 · Icônes homogènes** — D5.
6. **C-6 · Contraste sur décors** (Acc5).

---

## Recommandation

Commencer par la **Phase A** intégralement (7 étapes, toutes 0-pixel, faible risque, gros gain de
propreté), puis **B-1** (le keystone `onclick`→délégation) qui débloque le reste. La Phase C
n'est pas de la dette : c'est du design, à traiter séparément quand tu voudras faire évoluer
l'identité visuelle.
