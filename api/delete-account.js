// api/delete-account.js
// Supprime DÉFINITIVEMENT un compte et toutes ses données.
// La clé service_role (pleins pouvoirs) reste cachée ici, jamais dans l'app.
// Pas de dépendance externe : on appelle Supabase directement via fetch.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const URL = process.env.SUPABASE_URL;
  const SERVICE = process.env.SUPABASE_SERVICE_ROLE;
  if (!URL || !SERVICE) {
    return res.status(500).json({ error: 'Configuration serveur incomplète.' });
  }

  // Token de la personne connectée (envoyé par l'app)
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Non authentifié.' });

  const adminHeaders = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, 'Content-Type': 'application/json' };

  // Liste TOUS les fichiers sous un dossier, en descendant dans les sous-dossiers
  async function listAllFiles(prefix) {
    const out = [];
    const res = await fetch(`${URL}/storage/v1/object/list/photos`, {
      method: 'POST',
      headers: adminHeaders,
      body: JSON.stringify({ prefix, limit: 1000, sortBy: { column: 'name', order: 'asc' } })
    });
    if (!res.ok) return out;
    const items = await res.json();
    for (const it of (items || [])) {
      const full = prefix ? `${prefix}/${it.name}` : it.name;
      if (it && it.id === null) {
        // c'est un dossier → on descend dedans
        const sub = await listAllFiles(full);
        for (const f of sub) out.push(f);
      } else {
        out.push(full);
      }
    }
    return out;
  }

  try {
    // 1. Vérifier QUI fait la demande (on ne supprime que soi-même)
    const who = await fetch(`${URL}/auth/v1/user`, {
      headers: { apikey: SERVICE, Authorization: `Bearer ${token}` }
    });
    if (!who.ok) return res.status(401).json({ error: 'Session invalide.' });
    const user = await who.json();
    const userId = user.id;
    if (!userId) return res.status(401).json({ error: 'Utilisateur introuvable.' });

    // 2. Supprimer TOUTES les photos du stockage (racine + sous-dossiers, ex. products/)
    try {
      const files = await listAllFiles(userId);
      if (files.length) {
        await fetch(`${URL}/storage/v1/object/photos`, {
          method: 'DELETE',
          headers: adminHeaders,
          body: JSON.stringify({ prefixes: files })
        });
      }
    } catch (e) { /* non bloquant */ }

    // 2bis. Supprimer le compteur d'usage IA (pas de cascade auth dessus)
    try {
      await fetch(`${URL}/rest/v1/ai_usage?user_id=eq.${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: adminHeaders
      });
    } catch (e) { /* non bloquant */ }

    // 3. Supprimer le compte. Les lignes profiles/entries s'effacent automatiquement
    //    grâce au "on delete cascade" défini sur les tables.
    const del = await fetch(`${URL}/auth/v1/admin/users/${userId}`, {
      method: 'DELETE',
      headers: adminHeaders
    });
    if (!del.ok) {
      const msg = await del.text();
      return res.status(500).json({ error: 'Suppression du compte impossible : ' + msg });
    }

    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
};
