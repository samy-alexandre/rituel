// Point d'entrée Vite (module ESM).
//
// Rôle transitoire (Phase A de la migration — voir docs/ARCHITECTURE-CIBLE.md) :
//  1. importer le CSS de l'app (Vite l'extrait dans un <link> au build → pas de FOUC) ;
//  2. fournir Supabase bundlé sur `window.supabase` (remplace l'ancien <script> CDN),
//     AVANT que le code hérité ne s'exécute (il fait `window.supabase.createClient(...)`) ;
//  3. charger le code applicatif hérité (`public/app.legacy.js`), qui reste pour l'instant un
//     script CLASSIQUE global : les ~530 fonctions et les 377 handlers `onclick=` inline en
//     dépendent. Les phases suivantes le découperont en modules `src/features/*`.
import { createClient } from '@supabase/supabase-js';
import './styles/app.css';

// Pont Supabase : l'API historique du code hérité est `window.supabase.createClient(...)`.
window.supabase = { createClient };

// On injecte le code hérité seulement maintenant, une fois `window.supabase` prêt, pour garantir
// l'ordre d'exécution (le module est différé, le DOM est déjà parsé quand on arrive ici).
const legacy = document.createElement('script');
legacy.src = '/app.legacy.js';
document.body.appendChild(legacy);
