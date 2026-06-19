// api/health.js — Health check do sistema
// Verifica se o banco e as variáveis essenciais estão OK
// Uso: GET https://api-pix-telegran.vercel.app/api/health

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const started = Date.now();
  const checks = {};

  // ── 1. Variáveis de ambiente obrigatórias ──────────────────
  const requiredEnvs = [
    'TELEGRAM_BOT_TOKEN',
    'SUPABASE_URL',
    'SUPABASE_SERVICE_KEY',
    'ADMIN_SECRET',
    'PANEL_SALT',
    'WEBHOOK_SECRET_TOKEN',
    'CRON_SECRET',
  ];

  const missingEnvs = requiredEnvs.filter(k => !process.env[k]);
  checks.env = {
    ok: missingEnvs.length === 0,
    missing: missingEnvs.length > 0 ? missingEnvs : undefined,
  };

  // ── 2. Conexão com o Supabase ──────────────────────────────
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
    const dbStart = Date.now();
    const { error } = await supabase
      .from('settings')
      .select('id')
      .limit(1)
      .single();

    checks.database = {
      ok: !error,
      latency_ms: Date.now() - dbStart,
      error: error?.message ?? undefined,
    };
  } catch (err) {
    checks.database = { ok: false, error: err.message };
  }

  // ── 3. Resultado geral ─────────────────────────────────────
  const allOk = Object.values(checks).every(c => c.ok);

  return res.status(allOk ? 200 : 503).json({
    status: allOk ? 'ok' : 'degraded',
    uptime_ms: Date.now() - started,
    timestamp: new Date().toISOString(),
    checks,
  });
};
