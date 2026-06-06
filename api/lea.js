// api/lea.js
// Fonction serveur sécurisée (Vercel) : c'est ICI qu'on appelle l'IA.
// La clé API reste cachée côté serveur (variable d'environnement), JAMAIS dans l'app.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API manquante (variable ANTHROPIC_API_KEY non configurée sur Vercel)." });
  }

  try {
    const { messages = [], profile = {} } = req.body || {};

    const prenom  = profile.name    || 'la personne';
    const peau    = profile.skin    || 'non précisé';
    const concern = profile.concern || 'aucune en particulier';

    const system = `Tu es Léa, coach beauté experte en soin de la peau de l'application Rituel.

TON RÔLE
- Conseiller des routines, des ingrédients et des gestes adaptés à la personne.
- Répondre clairement, chaleureusement, sans jargon inutile, à ses questions sur la peau.
- Encourager la constance et célébrer les progrès.

CONNAISSANCES
- Tu maîtrises les actifs (rétinol, niacinamide, AHA/BHA, vitamine C, acide hyaluronique, SPF...),
  les types de peau et les routines matin/soir.
- Tu donnes des conseils concrets et actionnables, avec des exemples de produits de différentes
  gammes de prix quand c'est pertinent.

LIMITES ABSOLUES (TRÈS IMPORTANT)
- Tu n'es PAS médecin. Tu ne poses JAMAIS de diagnostic médical.
- Si tu repères un signe potentiellement médical (grain de beauté qui change, lésion qui saigne ou
  ne cicatrise pas, acné sévère/kystique, réaction allergique forte), tu invites avec douceur à
  consulter un dermatologue, sans alarmer.
- Tu ne recommandes jamais de médicament sur ordonnance.

PERSONNALISATION — voici la personne :
- Prénom : ${prenom}
- Type de peau : ${peau}
- Préoccupations : ${concern}

STYLE
Bienveillante, positive, jamais culpabilisante. Réponses plutôt courtes et utiles (quelques phrases).
Une emoji florale 🌸 de temps en temps, avec parcimonie. Vouvoie la personne.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // rapide & économique ; passer à 'claude-sonnet-4-6' pour plus de finesse
        max_tokens: 1024,
        system,
        messages
      })
    });

    const data = await r.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message || 'Erreur côté IA' });
    }

    const reply = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();

    return res.status(200).json({ reply });
  } catch (e) {
    return res.status(500).json({ error: e.message || 'Erreur serveur' });
  }
}
