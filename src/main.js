// Point d'entrée Vite (module ESM).
//
// Rôle transitoire (Phase A de la migration — voir docs/ARCHITECTURE-CIBLE.md) :
//  1. importer le CSS de l'app (Vite l'extrait dans un <link> au build → pas de FOUC) ;
//  2. fournir Supabase bundlé sur `window.supabase` (remplace l'ancien <script> CDN),
//     AVANT que le code hérité ne s'exécute (il fait `window.supabase.createClient(...)`) ;
//  3. charger le code applicatif hérité (`public/app.legacy.js`), qui reste pour l'instant un
//     script CLASSIQUE global : les ~530 fonctions et les 377 handlers `onclick=` inline en
//     dépendent. Les phases suivantes le découperont en modules `src/features/*`.
// Couche core/ (modules ESM propres) importée AVANT le code hérité : chaque module s'expose
// aussi sur window pour rester accessible au script classique hérité (pont transitoire).
import './core/state.js'; // état partagé (currentUser, chDraft, state) exposé sur window
import './core/supabase.js'; // crée le client `sb` (bundlé) et l'expose sur window.sb
import './core/utils.js'; // escapeHtml, loadScript
// Features extraites du monolithe (Phase B). Chaque module s'expose sur window (pont transitoire).
import './data/photos.js';
import './ui/toast.js';
import './ui/dialog.js';
import './features/chat/chat.js';
import './features/datepicker/datepicker.js';
import './features/reminders/reminders.js';
import './features/camera/camera.js';
import './features/journal/journal.js';
import './features/guided/guided.js';
import './features/voyage/voyage.js';
import './features/quiz/quiz.js';
import './features/eclat/eclat.js';
import './features/timelapse/timelapse.js';
import './features/barcode/barcode.js';
import './features/cycle/cycle.js';
import './features/uv/uv.js';
import './features/product-book/product-book.js';
import './features/product-effects/product-effects.js';
import './features/product-form/product-form.js';
import './features/product-cards/product-cards.js';
import './styles/index.css';

// On injecte le code hérité seulement maintenant, une fois la couche core prête, pour garantir
// l'ordre d'exécution (le module est différé, le DOM est déjà parsé quand on arrive ici).
const legacy = document.createElement('script');
legacy.src = '/app.legacy.js';
document.body.appendChild(legacy);
