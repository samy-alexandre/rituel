// api/barcode.js : recherche d'un produit par code-barres (EAN/UPC)
// 1) Open Beauty/Food/Products Facts en parallèle  2) filet UPCitemdb (gratuit, 100/jour)
// Récupère nom, marque, et (si dispo) une courte description + catégorie. Cache CDN 7 jours.
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const code = String((req.query && req.query.code) || '').replace(/[^0-9]/g, '');
  if (!code || code.length < 8 || code.length > 14) {
    res.status(400).json({ found: false, error: 'code invalide' });
    return;
  }
  res.setHeader('Cache-Control', 's-maxage=604800, stale-while-revalidate=86400');

  const tf = (url, ms) => {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), ms);
    return fetch(url, { signal: c.signal, headers: { 'User-Agent': 'Rituel/1.0 (monrituel.app)' } })
      .finally(() => clearTimeout(t));
  };

  // Condense une description en une courte phrase d'effets (max ~60 caractères)
  const condense = (txt) => {
    if (!txt) return '';
    let s = String(txt).replace(/\s+/g, ' ').trim();
    // garder la première phrase / ou couper proprement
    const firstSentence = s.split(/[.!?·]/)[0].trim();
    s = firstSentence || s;
    if (s.length > 60) s = s.slice(0, 57).trim() + '…';
    return s;
  };

  // Devine une catégorie Rituel à partir des mots-clés
  const guessCat = (txt) => {
    const t = (txt || '').toLowerCase();
    if (/nettoyant|cleanser|gel lavant|mousse/.test(t)) return 'nettoyant';
    if (/démaquill|demaquill|micellaire|cleansing oil|huile démaqu/.test(t)) return 'demaquillant';
    if (/lotion|tonique|toner|essence/.test(t)) return 'toner';
    if (/s[ée]rum|serum|concentr[ée]/.test(t)) return 'serum';
    if (/yeux|eye|contour des yeux/.test(t)) return 'yeux';
    if (/spf|solaire|sunscreen|protection solaire|fps/.test(t)) return 'spf';
    if (/masque|mask|gommage|exfoli|peeling|scrub/.test(t)) return 'masque';
    if (/cr[èe]me|cream|hydratant|moisturiz|baume|lait/.test(t)) return 'creme';
    return null;
  };

  const off = async (base) => {
    try {
      const r = await tf(base + code + '.json?fields=product_name,product_name_fr,brands,generic_name,generic_name_fr,categories,abbreviated_product_name', 3500);
      if (!r.ok) return null;
      const j = await r.json();
      const p = j && j.product;
      if (!p) return null;
      const nom = (p.product_name_fr || p.product_name || p.abbreviated_product_name || '').trim();
      const marque = ((p.brands || '').split(',')[0] || '').trim();
      if (!nom && !marque) return null;
      const desc = condense(p.generic_name_fr || p.generic_name || '');
      const catSource = (p.categories || '') + ' ' + (p.generic_name_fr || p.generic_name || '') + ' ' + nom;
      const categorie = guessCat(catSource);
      return { nom, marque, effets: desc, categorie, source: 'open-facts' };
    } catch (e) { return null; }
  };

  const bases = [
    'https://world.openbeautyfacts.org/api/v2/product/',
    'https://world.openfoodfacts.org/api/v2/product/',
    'https://world.openproductsfacts.org/api/v2/product/'
  ];
  const hits = await Promise.all(bases.map(off));
  let hit = hits.find(Boolean);

  if (!hit) {
    try {
      const r = await tf('https://api.upcitemdb.com/prod/trial/lookup?upc=' + code, 4500);
      if (r.ok) {
        const j = await r.json();
        const it = j && j.items && j.items[0];
        if (it && (it.title || it.brand)) {
          hit = {
            nom: (it.title || '').trim(),
            marque: (it.brand || '').trim(),
            effets: condense(it.description || ''),
            categorie: guessCat((it.category || '') + ' ' + (it.title || '')),
            source: 'upcitemdb'
          };
        }
      }
    } catch (e) {}
  }

  if (!hit) { res.status(200).json({ found: false }); return; }
  res.status(200).json({ found: true, ...hit });
}
