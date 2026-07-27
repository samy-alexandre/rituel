// Accès aux photos stockées (Supabase Storage). Module d'accès données : importe le client sb.
import { sb } from '../core/supabase.js';

// Génère une URL signée (valable 1 h) pour une photo privée de l'utilisateur.
export async function signedPhoto(path) {
  if (!path) return null;
  const { data } = await sb.storage.from('photos').createSignedUrl(path, 3600);
  return data ? data.signedUrl : null;
}

// Pont transitoire : appelé en identifiant nu par le code hérité.
window.signedPhoto = signedPhoto;
