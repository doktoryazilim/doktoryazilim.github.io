// Vercel Serverless Function: yeni sipariş geldiğinde Kapso ile WhatsApp bildirimi gönderir.
// Gerekli ortam değişkenleri (Vercel > Settings > Environment Variables):
//   KAPSO_API_KEY, KAPSO_PHONE_NUMBER_ID, ADMIN_PHONE (örn 905313599315)
// Opsiyonel: KAPSO_TEMPLATE_NAME, KAPSO_TEMPLATE_LANG (varsayılan tr)
const clip = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').slice(0, n);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { KAPSO_API_KEY, KAPSO_PHONE_NUMBER_ID, ADMIN_PHONE } = process.env;
  if (!KAPSO_API_KEY || !KAPSO_PHONE_NUMBER_ID || !ADMIN_PHONE) {
    return res.status(500).json({ error: 'env eksik' });
  }
  let o = req.body;
  if (typeof o === 'string') { try { o = JSON.parse(o); } catch (e) { o = null; } }
  if (!o || !Array.isArray(o.items) || !o.items.length || o.items.length > 50) {
    return res.status(400).json({ error: 'gecersiz siparis' });
  }
  const tl = (n) => Number(n || 0).toLocaleString('tr-TR') + ' TL';
  const lines = o.items.map(i =>
    '• ' + clip(i.name, 80) + ' x' + Number(i.qty || 1) + ' = ' + tl(Number(i.price || 0) * Number(i.qty || 1)));
  const text = '🛒 YENİ SİPARİŞ' +
    '\nMüşteri: ' + clip(o.customerName, 80) +
    '\nTelefon: ' + clip(o.customerPhone, 30) +
    '\nAdres: ' + clip(o.customerAddress, 200) +
    '\n\n' + lines.join('\n') +
    '\n\nToplam: ' + tl(o.total) +
    '\nSipariş No: ' + clip(o.id, 8);

  const tpl = process.env.KAPSO_TEMPLATE_NAME;
  const body = tpl ? {
    messaging_product: 'whatsapp', to: ADMIN_PHONE, type: 'template',
    template: { name: tpl, language: { code: process.env.KAPSO_TEMPLATE_LANG || 'tr' },
      components: [{ type: 'body', parameters: [{ type: 'text', text: text.replace(/\n+/g, ' | ') }] }] }
  } : {
    messaging_product: 'whatsapp', recipient_type: 'individual', to: ADMIN_PHONE,
    type: 'text', text: { body: text }
  };
  try {
    const r = await fetch('https://api.kapso.ai/meta/whatsapp/v24.0/' + KAPSO_PHONE_NUMBER_ID + '/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': KAPSO_API_KEY },
      body: JSON.stringify(body)
    });
    const t = await r.text();
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, detail: r.ok ? undefined : t });
  } catch (e) {
    return res.status(502).json({ ok: false, error: String(e) });
  }
};
