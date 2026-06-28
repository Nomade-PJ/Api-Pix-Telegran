// api/panel/auth.js — Login do painel web
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// OBRIGATÓRIO: estas variáveis devem estar configuradas no Vercel.
// Sem elas o servidor não aceita nenhum login — sem fallback, sem exceção.
const SALT = process.env.PANEL_SALT;
const JWT_SECRET = process.env.ADMIN_SECRET;

if (!SALT || !JWT_SECRET) {
  console.error('❌ [AUTH] PANEL_SALT e ADMIN_SECRET são obrigatórios. Configure no Vercel e faça redeploy.');
}

// ===== Hash legado (HMAC) — mantido só para validar senhas antigas e migrá-las =====
function legacyHashPassword(password) {
  return crypto.createHmac('sha256', SALT).update(password).digest('hex');
}

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

function isBcryptHash(hash) {
  return typeof hash === 'string' && /^\$2[aby]\$/.test(hash);
}

// ===== Token de sessão (HMAC-assinado, contém um csrfToken embutido) =====
function generateToken(email, csrfToken) {
  const payload = { email, csrf: csrfToken, ts: Date.now(), exp: Date.now() + 24 * 60 * 60 * 1000 };
  const data = Buffer.from(JSON.stringify(payload)).toString('base64');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
  return `${data}.${sig}`;
}

function verifyToken(token) {
  try {
    const [data, sig] = token.split('.');
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('hex');
    if (!safeCompare(sig, expected)) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch { return null; }
}

// ===== Parser simples de cookies (não depender de req.cookies do runtime) =====
function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(val);
  });
  return out;
}

function buildCookie(name, value, { httpOnly, maxAge }) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Strict', 'Secure'];
  if (httpOnly) parts.push('HttpOnly');
  parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

module.exports = async function handler(req, res) {
  const allowedOrigin = process.env.PANEL_ORIGIN || 'https://api-pix-telegran.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Verificar sessão existente (lê o cookie httpOnly, não mais Authorization header)
  if (req.method === 'GET') {
    const cookies = parseCookies(req);
    const sessionToken = cookies['panel_session'];
    if (!sessionToken) return res.status(401).json({ ok: false });
    const payload = verifyToken(sessionToken);
    if (!payload) return res.status(401).json({ ok: false });

    let name = null;
    try {
      const { data: user } = await supabase
        .from('panel_users')
        .select('name')
        .eq('email', payload.email)
        .single();
      name = user?.name || null;
    } catch { /* não crítico para a verificação de sessão */ }

    return res.status(200).json({ ok: true, email: payload.email, name });
  }

  // Bloquear qualquer operação se as variáveis críticas não estiverem configuradas
  if (!SALT || !JWT_SECRET) {
    return res.status(500).json({ error: 'Servidor mal configurado. Contate o administrador.' });
  }

  if (req.method === 'POST') {
    const body = req.body || {};

    // ===== LOGOUT: limpa os cookies de sessão e csrf =====
    if (body.logout) {
      res.setHeader('Set-Cookie', [
        buildCookie('panel_session', '', { httpOnly: true, maxAge: 0 }),
        buildCookie('panel_csrf', '', { httpOnly: false, maxAge: 0 })
      ]);
      return res.status(200).json({ ok: true });
    }

    // ===== LOGIN =====
    const { email, password } = body;
    if (!email || !password) return res.status(400).json({ error: 'Email e senha obrigatórios' });

    const normalizedEmail = email.toLowerCase().trim();
    const { data: user } = await supabase
      .from('panel_users')
      .select('id, email, name, password_hash')
      .eq('email', normalizedEmail)
      .single();

    if (!user) return res.status(401).json({ error: 'Email ou senha incorretos' });

    let passwordMatches = false;
    let needsRehash = false;

    if (isBcryptHash(user.password_hash)) {
      // Já migrado para bcrypt
      passwordMatches = await bcrypt.compare(password, user.password_hash);
    } else {
      // Hash legado em HMAC — valida com o método antigo e marca para migrar
      const legacyHash = legacyHashPassword(password);
      passwordMatches = safeCompare(legacyHash, user.password_hash);
      if (passwordMatches) needsRehash = true;
    }

    if (!passwordMatches) return res.status(401).json({ error: 'Email ou senha incorretos' });

    // Migração automática e silenciosa: na primeira vez que a senha certa é digitada
    // com o hash antigo, já trocamos para bcrypt no banco.
    if (needsRehash) {
      try {
        const newHash = await bcrypt.hash(password, 12);
        await supabase.from('panel_users').update({ password_hash: newHash }).eq('id', user.id);
        console.log(`🔐 [AUTH] Hash de senha do usuário ${user.email} migrado de HMAC para bcrypt`);
      } catch (migrateErr) {
        console.error('⚠️ [AUTH] Falha ao migrar hash para bcrypt (login ainda foi liberado):', migrateErr.message);
      }
    }

    await supabase.from('panel_users').update({ last_login: new Date().toISOString() }).eq('id', user.id);

    const csrfToken = crypto.randomBytes(32).toString('hex');
    const token = generateToken(user.email, csrfToken);

    res.setHeader('Set-Cookie', [
      buildCookie('panel_session', token, { httpOnly: true, maxAge: 24 * 60 * 60 }),
      buildCookie('panel_csrf', csrfToken, { httpOnly: false, maxAge: 24 * 60 * 60 })
    ]);

    return res.status(200).json({ ok: true, name: user.name, email: user.email });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
