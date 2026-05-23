/**
 * setup-webhook.js
 * 
 * Registra (ou atualiza) o webhook do bot no Telegram.
 * 
 * Execute UMA VEZ após o deploy:
 *   node scripts/setup-webhook.js
 * 
 * Ou com variáveis inline:
 *   TELEGRAM_BOT_TOKEN=xxx VERCEL_URL=https://seu-app.vercel.app WEBHOOK_SECRET_TOKEN=xxx node scripts/setup-webhook.js
 */

require('dotenv').config();

const BOT_TOKEN          = process.env.TELEGRAM_BOT_TOKEN;
const VERCEL_URL         = process.env.VERCEL_URL;           // ex: https://seu-app.vercel.app
const WEBHOOK_SECRET     = process.env.WEBHOOK_SECRET_TOKEN; // string de até 256 chars, apenas A-Z a-z 0-9 _ -

// ── Validações ──────────────────────────────────────────────
if (!BOT_TOKEN) {
  console.error('❌  TELEGRAM_BOT_TOKEN não definido');
  process.exit(1);
}
if (!VERCEL_URL) {
  console.error('❌  VERCEL_URL não definido (ex: https://meu-app.vercel.app)');
  process.exit(1);
}
if (!WEBHOOK_SECRET) {
  console.error('❌  WEBHOOK_SECRET_TOKEN não definido');
  console.error('    Gere um com: openssl rand -hex 32');
  process.exit(1);
}

// Telegram exige: 1-256 chars, apenas A-Za-z0-9_-
if (!/^[A-Za-z0-9_\-]{1,256}$/.test(WEBHOOK_SECRET)) {
  console.error('❌  WEBHOOK_SECRET_TOKEN inválido — use apenas letras, números, _ ou -');
  process.exit(1);
}

// ── Rota do webhook (genérica, sem segredo na URL) ──────────
const WEBHOOK_URL = `${VERCEL_URL.replace(/\/$/, '')}/api/telegram-webhook`;

// ── Registro ─────────────────────────────────────────────────
async function setupWebhook() {
  console.log('🔧 Registrando webhook no Telegram...');
  console.log(`   URL: ${WEBHOOK_URL}`);
  console.log(`   Secret: ${'*'.repeat(WEBHOOK_SECRET.length)} (${WEBHOOK_SECRET.length} chars)`);

  const response = await fetch(
    `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: WEBHOOK_URL,
        secret_token: WEBHOOK_SECRET,
        allowed_updates: ['message', 'callback_query', 'chat_member'],
        drop_pending_updates: false,
      }),
    }
  );

  const result = await response.json();

  if (!result.ok) {
    console.error('❌ Erro ao registrar webhook:', result.description);
    process.exit(1);
  }

  console.log('✅ Webhook registrado com sucesso!');
  console.log(`   ${result.description}`);

  // ── Verificar o registro ──────────────────────────────────
  const infoRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`);
  const info    = await infoRes.json();

  console.log('\n📋 Estado atual do webhook:');
  console.log(`   URL:              ${info.result.url}`);
  console.log(`   Has secret:       ${info.result.has_custom_certificate !== undefined ? '✅ sim' : '❓'}`);
  console.log(`   Pending updates:  ${info.result.pending_update_count}`);
  console.log(`   Last error:       ${info.result.last_error_message || 'nenhum'}`);

  if (info.result.url !== WEBHOOK_URL) {
    console.warn('\n⚠️  URL registrada difere da esperada — verifique a variável VERCEL_URL');
  }
}

setupWebhook().catch(err => {
  console.error('❌ Erro inesperado:', err.message);
  process.exit(1);
});
