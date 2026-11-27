module.exports = function config(_req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return res.status(503).json({ error: 'ยังไม่ได้ตั้งค่า Supabase URL และ Publishable Key' });
  return res.status(200).json({ url, publishableKey });
};