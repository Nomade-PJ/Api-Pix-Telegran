// api/jobs/remarketing.js
const { COLD, WARM, BUYER } = require('../../remarketing/Templates');
const { send }              = require('../../remarketing/Sender');
const {
  getColdBatch, getWarmBatch, getBuyerBatch,
  upsertLog, optOut, getRandomImage,
} = require('../../remarketing/Segments');
const { createClient }      = require('@supabase/supabase-js');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BR_TZ_OFFSET = -3; // UTC-3 (Brasília)
const DELAY_BETWEEN_SENDS_MS = 800;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Verifica se estamos em horário comercial BR (8h-22h)
function isBRBusinessHour() {
  const utcHour = new Date().getUTCHours();
  const brHour  = ((utcHour + BR_TZ_OFFSET + 24) % 24);
  return brHour >= 8 && brHour < 22;
}

// Botão de compra para inline keyboard (usando a correção 'produto_'!)
function makeButton(productId, label) {
  const botName = process.env.BOT_USERNAME || '';
  const url     = botName
    ? `https://t.me/${botName}?start=produto_${productId}`
    : `https://t.me/${process.env.TELEGRAM_BOT_TOKEN.split(':')[0]}?start=produto_${productId}`;
  return [[{ text: label || '🛒 Comprar agora', url }]];
}

module.exports = async (req, res) => {
  try {
    // 1. Validar método
    if (req.method !== 'POST' && req.method !== 'GET') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 2. Validar autenticação do cron job
    const receivedToken = req.headers['x-cron-secret'] || req.query.secret;
    const expectedToken = process.env.CRON_SECRET;
    
    if (expectedToken && receivedToken !== expectedToken) {
      console.error('🚫 [REMARKETING-JOB] Secret inválido ou ausente');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚀 [REMARKETING-JOB] Iniciando ciclo de remarketing...');
    
    // 3. Verificar horário comercial
    if (!isBRBusinessHour()) {
      console.log('⏸ [REMARKETING-JOB] Fora do horário comercial BR (8h-22h). Ciclo suspenso.');
      return res.status(200).json({ 
        success: true, 
        message: 'Paused: outside business hours (BR 8h-22h)' 
      });
    }

    // 4. Buscar usuários de cada lote (fatia reduzida para evitar timeout no Vercel)
    console.log('🔍 [REMARKETING-JOB] Buscando usuários qualificados...');
    const coldList  = (await getColdBatch()).slice(0, 5);
    const warmList  = (await getWarmBatch()).slice(0, 5);
    const buyerList = (await getBuyerBatch()).slice(0, 5);
    
    console.log(`📊 [REMARKETING-JOB] Lotes obtidos: Cold:${coldList.length}, Warm:${warmList.length}, Buyer:${buyerList.length}`);

    let sentCold = 0;
    let sentWarm = 0;
    let sentBuyer = 0;

    const COLD_INTERVALS  = [6, 6, 6, 12, 24];
    const WARM_INTERVALS  = [2, 8, 24];
    const BUYER_INTERVALS = [24, 72, 168, 360];

    // --- PROCESSAR COLD ---
    for (const u of coldList) {
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
        sentCold++;
        console.log(`  ✅ COLD step${step} enviado para: ${u.first_name || u.telegram_id}`);
      } catch (err) {
        if (err.tgCode === 403) {
          await optOut(u.telegram_id);
          await sb.from('users').update({ is_blocked: true }).eq('telegram_id', u.telegram_id);
          console.log(`  🚫 blocked (opt-out) -> ${u.telegram_id}`);
        } else {
          console.error(`  ❌ erro em COLD -> ${u.telegram_id}: ${err.message}`);
        }
      }
      await sleep(DELAY_BETWEEN_SENDS_MS);
    }

    // --- PROCESSAR WARM ---
    for (const r of warmList) {
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
        sentWarm++;
        console.log(`  ✅ WARM step${step} enviado para: ${nome || r.telegram_id}`);
      } catch (err) {
        if (err.tgCode === 403) {
          await optOut(r.telegram_id);
          await sb.from('users').update({ is_blocked: true }).eq('telegram_id', r.telegram_id);
          console.log(`  🚫 blocked (opt-out) -> ${r.telegram_id}`);
        } else {
          console.error(`  ❌ erro em WARM -> ${r.telegram_id}: ${err.message}`);
        }
      }
      await sleep(DELAY_BETWEEN_SENDS_MS);
    }

    // --- PROCESSAR BUYER ---
    for (const r of buyerList) {
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
        sentBuyer++;
        console.log(`  ✅ BUYER step${step} enviado para: ${nome || r.telegram_id}`);
      } catch (err) {
        if (err.tgCode === 403) {
          await optOut(r.telegram_id);
          await sb.from('users').update({ is_blocked: true }).eq('telegram_id', r.telegram_id);
          console.log(`  🚫 blocked (opt-out) -> ${r.telegram_id}`);
        } else {
          console.error(`  ❌ erro em BUYER -> ${r.telegram_id}: ${err.message}`);
        }
      }
      await sleep(DELAY_BETWEEN_SENDS_MS);
    }

    const totalSent = sentCold + sentWarm + sentBuyer;
    console.log(`🏁 [REMARKETING-JOB] Ciclo completo. Enviados: ${totalSent} mensagens.`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    return res.status(200).json({
      success: true,
      stats: {
        cold: sentCold,
        warm: sentWarm,
        buyer: sentBuyer,
        total: totalSent
      }
    });

  } catch (err) {
    console.error('❌ [REMARKETING-JOB] Erro crítico no ciclo:', err.message);
    console.error(err.stack);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: err.message
    });
  }
};
