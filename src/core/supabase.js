// Client Supabase unique de l'application (bundlé, version épinglée).
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON);

// Pont transitoire vers le code hérité (script classique global) : celui-ci référence `sb`
// en identifiant nu, résolu via l'objet global. À retirer quand tout sera modularisé.
window.sb = sb;
