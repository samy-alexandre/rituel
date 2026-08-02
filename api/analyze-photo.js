// api/analyze-photo.js
// Regard bienveillant (NON médical) de Léa/Léo sur la photo du jour.
// La clé API reste cachée côté serveur. Renvoie { observation, eclat, conseil }.

module.exports = async function handler(req, res) {
  const { image, media_type = 'image/jpeg', profile = {}, user_id = null } = req.body || {};
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API manquante (ANTHROPIC_API_KEY)." });
  }
  try {
    if (!image) return res.status(400).json({ error: "Aucune image reçue." });

  // ----- L'analyse photo est réservée à Rituel+ -----
  if (user_id) {
    try {
      const SB_URL = process.env.SUPABASE_URL;
      const SB_KEY = process.env.SUPABASE_SERVICE_ROLE;
      if (SB_URL && SB_KEY) {
        const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' };
        const pr = await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + user_id + '&select=is_premium', { headers });
        if (pr.ok) {
          const rows = await pr.json();
          const premium = Array.isArray(rows) && rows.length ? !!rows[0].is_premium : false;
          if (!premium) {
            return res.status(200).json({ needsPlus: true, observation: null });
          }
        }
      }
    } catch (e) { /* en cas de souci, on laisse passer plutôt que de casser l'app */ }
  }

    const estH = profile.coach === 'homme';
    const coachNom = estH ? 'Léo' : 'Léa';
    const peau = profile.skin || 'non précisé';

    const system = `Tu es ${coachNom}, ${estH ? 'le' : 'la'} coach beauté bienveillant${estH ? '' : 'e'} de l'application Rituel. On te montre la photo du visage du jour de la personne (type de peau indiqué : ${peau}). Tu lui donnes un petit retour CHALEUREUX, ENCOURAGEANT et NON MÉDICAL sur l'aspect de sa peau aujourd'hui.

RÈGLES ABSOLUES
- Tu n'es PAS médecin : aucun diagnostic, aucun nom de maladie ou de pathologie, aucune affirmation clinique. Si tu remarques un signe qui pourrait être médical, invite avec douceur à voir un dermatologue, sans inquiéter.
- Si la photo évoque plaie, brûlure, infection, gonflement ou lésion inhabituelle : reste descriptif, et suggère doucement un avis médical.
- Jamais de tiret long « — » dans le texte.
- JAMAIS de remarque négative, dévalorisante ou dure sur l'apparence, le physique, le poids ou les "défauts". Tu regardes d'abord ce qui va bien. Tu ne fais pas de liste de problèmes.
- Ton tendre, positif et bref, comme une amie qui rassure et encourage.
- L'« éclat » est une note d'éclat / forme du jour, BIENVEILLANTE et plutôt généreuse (0–100). Ce n'est ni une note de beauté ni un jugement ; c'est juste un petit repère de suivi.
- Tu écris en français.

Réponds UNIQUEMENT avec un objet JSON valide, sans aucun texte autour, sans backticks :
{"observation":"1 à 2 phrases chaleureuses sur ce que tu vois de positif aujourd'hui","eclat": <entier entre 0 et 100>,"conseil":"une petite suggestion de soin douce et optionnelle (chaîne vide si rien à dire)"}`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type, data: image } },
            { type: 'text', text: "Voici ma photo du jour. Donne-moi ton petit retour bienveillant, au format JSON demandé." }
          ]
        }]
      })
    });

    const data = await r.json();
    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Erreur IA' });
    }
    const content = data.content && data.content[0] && data.content[0].text;
    if (!content) return res.status(500).json({ error: 'Réponse IA vide' });
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) try { parsed = JSON.parse(m[0]); } catch (e2) { parsed = null; }
    }
    if (!parsed) return res.status(202).json({ retry: true, message: "L'IA n'a pas donné un format exploitable." });
    return res.status(200).json(parsed);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
};