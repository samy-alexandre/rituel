// api/barcode.js : recherche d'un produit par code-barres (EAN/UPC)
// 1) Open Beauty/Food/Products Facts en parallèle  2) filet UPCitemdb (gratuit, 100/jour)
// Cache CDN 7 jours pour économiser les quotas.
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

  const off = async (base) => {
    try {
      const r = await tf(base + code + '.json?fields=product_name,product_name_fr,brands', 3500);
      if (!r.ok) return null;
      const j = await r.json();
      const p = j && j.product;
      if (!p) return null;
      const nom = (p.product_name_fr || p.product_name || '').trim();
      const marque = ((p.brands || '').split(',')[0] || '').trim();
      if (!nom && !marque) return null;
      return { nom, marque, source: 'open-facts' };
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
          hit = { nom: (it.title || '').trim(), marque: (it.brand || '').trim(), source: 'upcitemdb' };
        }
      }
    } catch (e) {}
  }

  if (!hit) { res.status(200).json({ found: false }); return; }
  res.status(200).json({ found: true, ...hit });
}
