// api/analyze-photo.js
// Regard bienveillant (NON médical) de Léa/Léo sur la photo du jour.
// La clé API reste cachée côté serveur. Renvoie { observation, eclat, conseil }.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API manquante (ANTHROPIC_API_KEY)." });
  }
  try {
    const { image, media_type = 'image/jpeg', profile = {} } = req.body || {};
    if (!image) return res.status(400).json({ error: "Aucune image reçue." });

    const estH = profile.coach === 'homme';
    const coachNom = estH ? 'Léo' : 'Léa';
    const peau = profile.skin || 'non précisé';

    const system = `Tu es ${coachNom}, ${estH ? 'le' : 'la'} coach beauté bienveillant${estH ? '' : 'e'} de l'application Rituel. On te montre la photo du visage du jour de la personne (type de peau indiqué : ${peau}). Tu lui donnes un petit retour CHALEUREUX, ENCOURAGEANT et NON MÉDICAL sur l'aspect de sa peau aujourd'hui.

RÈGLES ABSOLUES
- Tu n'es PAS médecin : aucun diagnostic, aucun nom de maladie ou de pathologie, aucune affirmation clinique. Si tu remarques un signe qui pourrait être médical, invite avec douceur à voir un dermatologue, sans inquiéter.
- Si la photo évoque plaie, brûlure, infection, gonflement ou lésion inhabituelle : reste descriptif, et suggère doucement un avis médical.
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
      return res.status(500).json({ error: data.error.message || 'Erreur côté IA' });
    }
    let text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('').trim();
    let out = { observation: text, eclat: null, conseil: '' };
    try {
      const m = text.match(/\{[\s\S]*\}/);
      if (m) {
        const j = JSON.parse(m[0]);
        if (j.observation) out.observation = String(j.observation);
        if (typeof j.eclat === 'number') out.eclat = Math.max(0, Math.min(100, Math.round(j.eclat)));
        out.conseil = j.conseil ? String(j.conseil) : '';
      }
    } catch (e) { /* on garde le texte brut en observation */ }

    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
}
