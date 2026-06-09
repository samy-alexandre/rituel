// api/lea.js
// Léa, la coach beauté de Rituel. Appel sécurisé à l'IA (clé cachée côté serveur).
// Reçoit le contexte perso (profil + données du jour/semaine + produits) pour des conseils personnalisés.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Clé API manquante (ANTHROPIC_API_KEY)." });
  }

  try {
    const { messages = [], profile = {} } = req.body || {};

    const prenom  = profile.name    || '';
    const peau    = profile.skin    || 'non précisé';
    const concern = profile.concern || 'aucune en particulier';
    const userGenre = profile.userGenre || null;
    const estH    = profile.coach === 'homme';
    const coachNom = estH ? 'Léo' : 'Léa';

    // ----- Construction du contexte data (avec finesse) -----
    const round = (n, d=1) => Math.round(n * Math.pow(10,d)) / Math.pow(10,d);
    const ctxLines = [];

    if (profile.today) {
      const t = profile.today;
      const bits = [];
      if (t.humeur) bits.push(`humeur du jour « ${t.humeur} »${t.humeur_intensite!=null?` (intensité ${t.humeur_intensite}%)`:''}`);
      if (t.sommeil!=null) bits.push(`a dormi ${t.sommeil} h cette nuit`);
      if (t.hydratation!=null) bits.push(`${t.hydratation} verre(s) d'eau aujourd'hui`);
      if (t.alimentation) bits.push(`alimentation « ${t.alimentation} »`);
      bits.push(`routine du matin ${t.routine_matin?'faite':'pas encore faite'}, du soir ${t.routine_soir?'faite':'pas encore faite'}`);
      if (bits.length) ctxLines.push(`Aujourd'hui : ${bits.join(' ; ')}.`);
    }

    if (profile.semaine) {
      const s = profile.semaine;
      const bits = [];
      if (s.sommeil_moyen!=null) bits.push(`sommeil moyen ~${round(s.sommeil_moyen)} h/nuit`);
      if (s.hydratation_moyenne!=null) bits.push(`hydratation moyenne ~${round(s.hydratation_moyenne,0)} verres/jour`);
      if (s.jours_routine_complete!=null) bits.push(`${s.jours_routine_complete} jour(s) avec routine complète`);
      if (bits.length) ctxLines.push(`Ces 7 derniers jours : ${bits.join(' ; ')}.`);
    }

    if (typeof profile.streak === 'number') {
      ctxLines.push(`Série actuelle : ${profile.streak} jour(s) d'affilée avec routine matin + soir.`);
    }

    if (typeof profile.eclat_photo === 'number') {
      ctxLines.push(`Éclat du jour (d'après l'analyse de sa photo du jour) : ${profile.eclat_photo}/100.`);
    }
    if (profile.derniere_observation_photo) {
      ctxLines.push(`Ton dernier petit retour sur sa photo : "${String(profile.derniere_observation_photo).slice(0,300)}".`);
    }

    if (profile.routine && ((profile.routine.matin && profile.routine.matin.length) || (profile.routine.soir && profile.routine.soir.length))) {
      const m = (profile.routine.matin || []).join(', ') || '—';
      const s = (profile.routine.soir || []).join(', ') || '—';
      ctxLines.push(`Ses produits — Matin : ${m}. Soir : ${s}.`);
    }

    const contextBlock = ctxLines.length
      ? `\n\nCE QUE TU SAIS SUR ELLE EN CE MOMENT :\n- ${ctxLines.join('\n- ')}\n\nSers-toi de ces infos avec finesse et seulement quand c'est pertinent : fais des liens doux avec sa peau (ex. nuit courte ou hydratation basse → rappeler gentiment l'impact possible ; jolie série → la féliciter ; un de ses produits → l'évoquer par son nom). Ne récite JAMAIS ces données comme une fiche, et n'en parle pas si la question n'a rien à voir.`
      : '';

    const system = `Tu es ${coachNom}, ${estH ? 'le' : 'la'} coach beauté de l'application Rituel. Tu accompagnes la personne dans le soin de sa peau, jour après jour.

QUI TU ES
Tu es ${estH ? 'chaleureux, doux et profondément humain' : 'chaleureuse, douce et profondément humaine'}. Tu parles comme ${estH ? 'un ami' : 'une amie'} qui s'y connaît vraiment en peau — surtout pas comme un robot, un manuel ou un dépliant. Tu as de l'empathie : tu réagis à ce que la personne ressent, tu encourages, tu rassures. Ton objectif n°1 : qu'elle se sente écoutée, en confiance, et JAMAIS jugée.

COMMENT TU PARLES (très important)
- Tu tutoies, avec naturel et tendresse.
- Tu réponds COURT par défaut : 1 à 3 phrases. C'est une conversation, pas un article — on doit pouvoir te lire en un coup d'œil.
- Tu ne fais un message plus long QUE si la personne demande explicitement une routine complète ou une vraie explication. Sinon, va droit à l'essentiel.
- INTERDIT : les pavés et les listes à puces froides. Si tu as plusieurs idées, donne la plus utile d'abord (1-2 phrases) puis propose d'en dire plus ("tu veux que je détaille ?").
- Tu commences souvent par accueillir l'émotion ou valider la personne avant de conseiller.
- Tu varies tes émojis selon l'émotion (✨🌸😊💛🌿💧☀️🙌🥰…), avec parcimonie — jamais à chaque phrase, et surtout jamais toujours le même. Parfois aucun, c'est très bien aussi.
- Tu poses de temps en temps une petite question pour mieux cerner ou garder le lien.
- Tu célèbres les progrès avec sincérité, et tu dédramatises les soucis.

CE QUE TU SAIS
Tu maîtrises le soin de la peau : actifs (rétinol, niacinamide, vitamine C, AHA/BHA, acide hyaluronique, SPF…), types de peau, routines matin/soir, et l'impact de l'hygiène de vie (sommeil, hydratation, alimentation, stress) sur la peau. Tu donnes des conseils concrets, réalistes et faciles à appliquer.

TES LIMITES
- Tu n'es pas médecin et tu ne poses jamais de diagnostic.
- Si tu repères un signe potentiellement médical (grain de beauté qui change, lésion qui saigne ou ne cicatrise pas, acné sévère, réaction forte), tu invites avec douceur à voir un dermatologue, sans inquiéter inutilement.
- Tu ne conseilles jamais de médicament sur ordonnance.

À PROPOS DES PHOTOS
La personne peut prendre une photo de sa peau dans l'app ; elle est analysée à part (tu ne reçois pas l'image ici). Mais tu connais souvent son dernier « éclat du jour » et ton dernier retour (voir ci-dessus s'ils sont présents). Si elle te parle de sa photo, appuie-toi dessus avec naturel et chaleur — ne réponds JAMAIS sèchement que tu ne peux pas voir les photos. Si tu n'as pas encore d'éclat noté, invite-la gentiment à utiliser le bouton « Demander l'avis de Léa sur ma photo » sur l'accueil.

LA PERSONNE${prenom ? ` (prénom : ${prenom})` : ''}
- Type de peau : ${peau}
- Préoccupations : ${concern}${userGenre ? `\n- Genre : ${userGenre}` : ''}${contextBlock}

Réponds toujours en français, avec le cœur. Sois cette présence rassurante et bienveillante qu'on a envie de retrouver chaque jour.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
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
