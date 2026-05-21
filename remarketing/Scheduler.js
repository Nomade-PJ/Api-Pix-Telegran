/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║   remarketing/scheduler.js                                   ║
 * ║   Motor de Remarketing 24/7                                  ║
 * ║                                                              ║
 * ║   Como rodar: node remarketing/scheduler.js                  ║
 * ║   Com PM2:    pm2 start remarketing/scheduler.js             ║
 * ║               --name remarketing --no-autorestart=false      ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const { COLD, WARM, BUYER } = require('./templates');
const { send }              = require('./sender');
const {
  getColdBatch, getWarmBatch, getBuyerBatch,
  upsertLog, optOut, markConverted, getRandomImage,
} = require('./segments');

// ── Validação de ambiente ─────────────────────────────────────────────────
['TELEGRAM_BOT_TOKEN','SUPABASE_URL','SUPABASE_SERVICE_KEY'].forEach(k => {
  if (!process.env[k]) { console.error(`❌  ${k} não encontrado no .env`); process.exit(1); }
});

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// ── Config ────────────────────────────────────────────────────────────────
const DELAY_BETWEEN_SENDS_MS = 800;   // ~75 msgs/min — bem abaixo do limite TG
const CYCLE_INTERVAL_MIN     = 10;    // roda a cada 10 minutos
const BR_TZ_OFFSET           = -3;    // UTC-3 (Brasília)

// Intervalo entre mensagens por segmento/step (horas)
const COLD_INTERVALS  = [6, 6, 6, 12, 24];    // step 0→1: 6h, 4→5: 24h
const WARM_INTERVALS  = [2, 8, 24];            // recuperação rápida
const BUYER_INTERVALS = [24, 72, 168, 360];    // 1d, 3d, 7d, 15d

// ── Helpers ───────────────────────────────────────────────────────────────
const sleep  = (ms) => new Promise(r => setTimeout(r, ms));
const log    = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

// Verifica se estamos em horário comercial BR (8h-22h)
function isBRBusinessHour() {
  const utcHour = new Date().getUTCHours();
  const brHour  = ((utcHour + BR_TZ_OFFSET + 24) % 24);
  return brHour >= 8 && brHour < 22;
}

// Botão de compra para inline keyboard
function makeButton(productId, label) {
  const botName = process.env.BOT_USERNAME || '';
  const url     = botName
    ? `https://t.me/${botName}?start=${productId}`
    : `https://t.me/${process.env.TELEGRAM_BOT_TOKEN.split(':')[0]}`;
  return [[{ text: label || '🛒 Comprar agora', url }]];
}

// ── PROCESSAR COLD ────────────────────────────────────────────────────────
async function processCold() {
  const users = await getColdBatch();
  if (!users.length) return 0;

  log(`📦 COLD — ${users.length} usuários`);
  let sent = 0;

  for (const u of users) {
    const log_entry = u.remarketing_log?.[0];
    const step      = log_entry?.sequence_step ?? 0;
    const template  = COLD[Math.min(step, COLD.length - 1)];
    const nome      = u.first_name || '';
    const text      = template.text(nome);
    const product   = template.product;
    const interval  = COLD_INTERVALS[Math.min(step, COLD_INTERVALS.length - 1)];
    const imageUrl  = await getRandomImage('pack_premium');
    const buttons   = makeButton(product, '🛒 Ver produtos');

    try {
      await send(u.telegram_id, text, imageUrl, buttons);
      await upsertLog(u.telegram_id, 'cold', step, interval);
      sent++;
      process.stdout.write(`  ✅ cold step${step} → ${u.first_name || u.telegram_id}\n`);
    } catch (err) {
      const code = err.tgCode || 0;
      if (code === 403) {
        // Bloqueou o bot — opt-out automático
        await optOut(u.telegram_id);
        await sb.from('users').update({ is_blocked: true }).eq('telegram_id', u.telegram_id);
        process.stdout.write(`  🚫 blocked → ${u.telegram_id}\n`);
      } else {
        process.stdout.write(`  ❌ err(${code}) → ${u.telegram_id}: ${err.message}\n`);
      }
    }

    await sleep(DELAY_BETWEEN_SENDS_MS);
  }

  return sent;
}

// ── PROCESSAR WARM ────────────────────────────────────────────────────────
async function processWarm() {
  const rows = await getWarmBatch();
  if (!rows.length) return 0;

  log(`🔥 WARM — ${rows.length} usuários`);
  let sent = 0;

  for (const r of rows) {
    const u         = r.users || r;
    const log_entry = r.remarketing_log?.[0];
    const step      = log_entry?.sequence_step ?? 0;
    const template  = WARM[Math.min(step, WARM.length - 1)];
    const nome      = u.first_name || r.first_name || '';
    const text      = template.text(nome);
    const product   = r.product_id || r.media_pack_id || 'pack_premium';
    const interval  = WARM_INTERVALS[Math.min(step, WARM_INTERVALS.length - 1)];
    const imageUrl  = await getRandomImage('pack_premium');
    const buttons   = makeButton(product, '⚡ Finalizar compra');

    try {
      await send(r.telegram_id, text, imageUrl, buttons);
      await upsertLog(r.telegram_id, 'warm', step, interval);
      sent++;
      process.stdout.write(`  ✅ warm step${step} → ${nome || r.telegram_id}\n`);
    } catch (err) {
      const code = err.tgCode || 0;
      if (code === 403) {
        await optOut(r.telegram_id);
        await sb.from('users').update({ is_blocked: true }).eq('telegram_id', r.telegram_id);
        process.stdout.write(`  🚫 blocked → ${r.telegram_id}\n`);
      } else {
        process.stdout.write(`  ❌ err(${code}) → ${r.telegram_id}: ${err.message}\n`);
      }
    }

    await sleep(DELAY_BETWEEN_SENDS_MS);
  }

  return sent;
}

// ── PROCESSAR BUYER ───────────────────────────────────────────────────────
async function processBuyer() {
  const rows = await getBuyerBatch();
  if (!rows.length) return 0;

  log(`💎 BUYER — ${rows.length} usuários`);
  let sent = 0;

  for (const r of rows) {
    const u         = r.users || r;
    const log_entry = r.remarketing_log?.[0];
    const step      = log_entry?.sequence_step ?? 0;
    const template  = BUYER[Math.min(step, BUYER.length - 1)];
    const nome      = u.first_name || '';
    const text      = template.text(nome, r.product_id);
    const product   = template.forcedProduct || r.product_id || 'destaquesdasemana';
    const interval  = BUYER_INTERVALS[Math.min(step, BUYER_INTERVALS.length - 1)];
    const imageUrl  = await getRandomImage('pack_premium');
    const buttons   = makeButton(product, '✨ Ver novidades');

    try {
      await send(r.telegram_id, text, imageUrl, buttons);
      await upsertLog(r.telegram_id, 'buyer', step, interval);
      sent++;
      process.stdout.write(`  ✅ buyer step${step} → ${nome || r.telegram_id}\n`);
    } catch (err) {
      const code = err.tgCode || 0;
      if (code === 403) {
        await optOut(r.telegram_id);
        await sb.from('users').update({ is_blocked: true }).eq('telegram_id', r.telegram_id);
        process.stdout.write(`  🚫 blocked → ${r.telegram_id}\n`);
      } else {
        process.stdout.write(`  ❌ err(${code}) → ${r.telegram_id}: ${err.message}\n`);
      }
    }

    await sleep(DELAY_BETWEEN_SENDS_MS);
  }

  return sent;
}

// ── CICLO PRINCIPAL ───────────────────────────────────────────────────────
async function runCycle() {
  const start = Date.now();
  log('━━━━━━━━━━━━━━━ CICLO REMARKETING ━━━━━━━━━━━━━━━');

  if (!isBRBusinessHour()) {
    log('⏸  Fora do horário comercial BR (8h-22h). Aguardando...');
    return;
  }

  try {
    const cold  = await processCold();
    await sleep(2000);
    const warm  = await processWarm();
    await sleep(2000);
    const buyer = await processBuyer();

    const total = cold + warm + buyer;
    const ms    = Date.now() - start;
    log(`✅ Ciclo concluído — ${total} msgs enviadas (cold:${cold} warm:${warm} buyer:${buyer}) em ${ms}ms`);
  } catch (err) {
    log(`❌ Erro no ciclo: ${err.message}`);
    console.error(err.stack);
  }
}

// ── LOOP 24/7 ─────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════╗');
  console.log('║     🚀 MOTOR DE REMARKETING — INICIADO 24/7          ║');
  console.log(`║     Ciclo a cada ${CYCLE_INTERVAL_MIN} min | Horário BR 8h-22h         ║`);
  console.log('║     Ctrl+C para parar | PM2 para rodar em produção   ║');
  console.log('╚══════════════════════════════════════════════════════╝');
  console.log('');

  // Primeira execução imediata
  await runCycle();

  // Loop contínuo
  const intervalMs = CYCLE_INTERVAL_MIN * 60 * 1000;
  setInterval(runCycle, intervalMs);

  // Manter processo vivo
  process.on('SIGINT',  () => { log('👋 Encerrando...'); process.exit(0); });
  process.on('SIGTERM', () => { log('👋 Encerrando...'); process.exit(0); });
}

main().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
