// Domaine « Graphe d'évolution de l'éclat » (Journal) — courbe du score de peau dans le temps.
// Extrait de app.legacy.js (Phase B), déplacé VERBATIM. Deps héritées (currentUser, sb)
// globales. Aucun état, aucune const partagée.

// ===== Graphe d'évolution de l'éclat (Journal) =====
async function loadEclatGraph() {
  const sec = document.getElementById('eclat-section');
  if (!sec) return;
  sec.style.display = 'none';
  if (!currentUser) return;
  try {
    const { data } = await sb
      .from('entries')
      .select('date,score_peau')
      .eq('user_id', currentUser.id)
      .not('score_peau', 'is', null)
      .order('date', { ascending: true });
    const pts = (data || []).filter((e) => e.score_peau != null);
    if (pts.length < 2) return;
    const recent = pts.slice(-14);
    const W = 300,
      H = 92,
      pad = 12;
    const vals = recent.map((p) => p.score_peau);
    const min = Math.min(...vals),
      max = Math.max(...vals);
    const range = max - min || 1;
    const stepX = (W - pad * 2) / (recent.length - 1);
    const coords = recent.map((p, i) => {
      const x = pad + i * stepX;
      const y = H - pad - ((p.score_peau - min) / range) * (H - pad * 2);
      return [x, y];
    });
    const line = coords
      .map((c, i) => (i ? 'L' : 'M') + c[0].toFixed(1) + ' ' + c[1].toFixed(1))
      .join(' ');
    const area =
      line +
      ' L ' +
      coords[coords.length - 1][0].toFixed(1) +
      ' ' +
      (H - pad) +
      ' L ' +
      coords[0][0].toFixed(1) +
      ' ' +
      (H - pad) +
      ' Z';
    const dots = coords
      .map(
        (c) =>
          '<circle cx="' +
          c[0].toFixed(1) +
          '" cy="' +
          c[1].toFixed(1) +
          '" r="3" fill="var(--accent)"/>'
      )
      .join('');
    document.getElementById('eclat-graph').innerHTML =
      '<svg viewBox="0 0 ' +
      W +
      ' ' +
      H +
      '" style="width:100%;height:auto;display:block;"><path d="' +
      area +
      '" fill="var(--blush-soft)" opacity="0.6"/><path d="' +
      line +
      '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      dots +
      '</svg>';
    document.getElementById('eclat-last').textContent = vals[vals.length - 1];
    sec.style.display = 'block';
  } catch (e) {}
}

// Pont transitoire : appel hérité (loadEclatGraph au rendu du journal). Résolution via window.
Object.assign(window, { loadEclatGraph });
