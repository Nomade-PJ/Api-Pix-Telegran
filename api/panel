// api/panel/auth.js — Login do painel web
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const SALT = 'vipsdaval_panel_2026';
const JWT_SECRET = process.env.ADMIN_SECRET || 'panel_jwt_secret_2026';

function hashPassword(password) {
  return crypto.createHmac('sha256', SALT).update(password).digest('hex');
}

function generateToken(email) {
  const payload = { email, ts: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  try {
    const [data, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Verificar token existente
  if (req.method === 'GET') {
    const auth = req.headers.authorization?.replace('Bearer ', '');
    if (!auth) return res.status(401).json({ ok: false });
    const payload = verifyToken(auth);
    if (!payload) return res.status(401).json({ ok: false });
    return res.status(200).json({ ok: true, email: payload.email });
  }

  // Login
  if (req.method === 'POST') {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const hash = hashPassword(password);
    const { data: user } = await supabase
      .from('panel_users')
      .select('id, email, name')
      .eq('email', email.toLowerCase().trim())
      .eq('password_hash', hash)
      .single();

    if (!user) return res.status(401).json({ error: 'Email ou senha incorretos' });

    await supabase.from('panel_users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    const token = generateToken(user.email);
    return res.status(200).json({ ok: true, token, name: user.name, email: user.email });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
