# Rituel — Analyse d'architecture (état des lieux)

> Étape 1 du chantier de refactorisation. Ce document décrit l'existant tel
> qu'il est aujourd'hui, sans le juger à l'excès : il sert de base partagée
> avant de définir l'architecture cible (Étape 2) et de la mettre en œuvre par
> étapes indépendantes et réversibles.

Date : 2026-07 · Périmètre : application front `index.html` + PWA + fonctions
serverless `api/`.

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
