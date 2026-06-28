// api/panel/auth.js
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Usa ADMIN_SECRET se existir, senão usa SUPABASE_SERVICE_KEY como fallback
// Garante que JWT_SECRET NUNCA é undefined
const JWT_SECRET = process.env.ADMIN_SECRET || process.env.SUPABASE_SERVICE_KEY || 'fallback-local-dev';

function generateToken(email) {
  const payload = { email, ts: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  try {
    if (!token || !token.includes('.')) return null;
    const lastDot = token.lastIndexOf('.');
    const data = token.substring(0, lastDot);
    const sig = token.substring(lastDot + 1);
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
    if (sig !== expected) return null;
    // base64url → base64 normal
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    console.error('[verifyToken] erro:', e.message);
    return null;
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // GET — verifica token
  if (req.method === 'GET') {
    const auth = (req.headers.authorization || '').replace('Bearer ', '').trim();
    if (!auth) return res.status(401).json({ ok: false, error: 'Token ausente' });
    const payload = verifyToken(auth);
    if (!payload) return res.status(401).json({ ok: false, error: 'Token inválido ou expirado' });
    return res.status(200).json({ ok: true, email: payload.email });
  }

  // POST — login
  if (req.method === 'POST') {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha obrigatórios' });
    }

    const { data: user, error: dbErr } = await supabase
      .from('panel_users')
      .select('id, email, name, password_hash')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (dbErr || !user) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    let passwordOk = false;
    if (user.password_hash?.startsWith('$2')) {
      // bcrypt
      passwordOk = await bcrypt.compare(password, user.password_hash);
    } else if (process.env.PANEL_SALT) {
      // HMAC-SHA256 legado
      const hash = crypto.createHmac('sha256', process.env.PANEL_SALT).update(password).digest('hex');
      passwordOk = (hash === user.password_hash);
    }

    if (!passwordOk) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    await supabase
      .from('panel_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', user.id);

    const token = generateToken(user.email);
    return res.status(200).json({ ok: true, token, name: user.name, email: user.email });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
