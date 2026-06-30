/**
 * segments.js — Queries de segmentação
 * Retorna usuários de cada segmento prontos para receber remarketing
 */
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const BATCH = 80; // usuários por rodada (seguro p/ rate limit)

// ── COLD: nunca comprou, não opted_out, hora certa de enviar ─────────────
async function getColdBatch() {
  const { data, error } = await sb.rpc('get_cold_users', { batch_size: BATCH });
  if (!error) {
    return (data || []).map(r => ({
      telegram_id: r.telegram_id,
      first_name: r.first_name,
      username: r.username,
      remarketing_log: r.log_sequence_step !== null
        ? [{ sequence_step: r.log_sequence_step, next_send_at: r.log_next_send_at }]
        : []
    }));
  }

  // Fallback: query direta + join em memória.
  // Não há FK declarada entre users e remarketing_log (relacionam-se só por
  // telegram_id, sem constraint), então o PostgREST não consegue fazer embed automático.
  // Buscamos os usuários e os logs separadamente e juntamos em memória.
  const { data: rows, error: e2 } = await sb
    .from('users')
    .select('telegram_id, first_name, username')
    .eq('is_blocked', false)
    .not('telegram_id', 'in', sb
      .from('transactions')
      .select('telegram_id')
      .eq('status', 'delivered')
    )
    .limit(BATCH * 5);

  if (e2) throw e2;
  if (!rows || rows.length === 0) return [];

  const ids = rows.map(u => u.telegram_id);
  const { data: logs } = await sb
    .from('remarketing_log')
    .select('telegram_id, segment, sequence_step, last_sent_at, next_send_at, total_sent, opted_out, converted')
    .in('telegram_id', ids);

  const logByUser = new Map((logs || []).map(l => [l.telegram_id, l]));

  return rows.filter(u => {
    const log = logByUser.get(u.telegram_id);
    if (!log) return true; // nunca contatado
    if (log.opted_out || log.converted) return false;
    if (log.sequence_step >= 5) return false; // esgotou sequência
    return !log.next_send_at || new Date(log.next_send_at) <= new Date();
  }).map(u => ({
    ...u,
    remarketing_log: logByUser.has(u.telegram_id) ? [logByUser.get(u.telegram_id)] : []
  })).slice(0, BATCH);
}

// ── WARM: criou PIX mas não pagou (abandoned), hora certa ───────────────
async function getWarmBatch() {
  const now = new Date().toISOString();

  // Pega últimas transações abandonadas por usuário
  const { data, error } = await sb.rpc('get_warm_users', { batch_size: BATCH, now_ts: now });
  if (error) {
    // fallback: query direta
    // Não há FK declarada entre transactions e remarketing_log (relacionam-se só por
    // telegram_id, sem constraint), então o PostgREST não consegue fazer embed automático.
    // Buscamos as transações e os logs separadamente e juntamos em memória.
    const { data: rows, error: e2 } = await sb
      .from('transactions')
      .select(`
        telegram_id, product_id, media_pack_id, amount, created_at,
        users!transactions_user_id_fkey!inner (first_name, username, is_blocked)
      `)
      .in('status', ['pending', 'expired'])
      .is('proof_file_id', null)
      .eq('users.is_blocked', false)
      .gte('created_at', new Date(Date.now() - 30 * 86400000).toISOString())
      .order('created_at', { ascending: false });

    if (e2) throw e2;

    // Deduplica por telegram_id — pega mais recente
    const seen = new Set();
    const deduped = (rows || []).filter(r => {
      if (seen.has(r.telegram_id)) return false;
      seen.add(r.telegram_id);
      return !r.users.is_blocked;
    });

    if (deduped.length === 0) return [];

    // Busca os logs de remarketing desses telegram_ids numa query separada
    const ids = deduped.map(r => r.telegram_id);
    const { data: logs } = await sb
      .from('remarketing_log')
      .select('telegram_id, segment, sequence_step, last_sent_at, next_send_at, total_sent, opted_out, converted')
      .in('telegram_id', ids);

    const logByUser = new Map((logs || []).map(l => [l.telegram_id, l]));

    return deduped.filter(r => {
      const log = logByUser.get(r.telegram_id);
      if (!log) return true;
      if (log.opted_out || log.converted) return false;
      if (log.sequence_step >= 3) return false;
      return !log.next_send_at || new Date(log.next_send_at) <= new Date();
    }).map(r => ({
      ...r,
      remarketing_log: logByUser.has(r.telegram_id) ? [logByUser.get(r.telegram_id)] : []
    })).slice(0, BATCH);
  }
  return data || [];
}

// ── BUYER: comprou, hora de upsell ──────────────────────────────────────
async function getBuyerBatch() {
  // Não há FK declarada entre transactions e remarketing_log (relacionam-se só por
  // telegram_id, sem constraint), então o PostgREST não consegue fazer embed automático.
  // Buscamos as transações e os logs separadamente e juntamos em memória.
  const { data, error } = await sb
    .from('transactions')
    .select(`
      telegram_id, product_id, media_pack_id, delivered_at,
      users!transactions_user_id_fkey!inner (first_name, username, is_blocked)
    `)
    .eq('status', 'delivered')
    .eq('users.is_blocked', false)
    .order('delivered_at', { ascending: false });

  if (error) throw error;

  const seen = new Set();
  const deduped = (data || []).filter(r => {
    if (seen.has(r.telegram_id)) return false;
    seen.add(r.telegram_id);
    return true;
  });

  if (deduped.length === 0) return [];

  const ids = deduped.map(r => r.telegram_id);
  const { data: logs } = await sb
    .from('remarketing_log')
    .select('telegram_id, segment, sequence_step, last_sent_at, next_send_at, total_sent, opted_out, converted')
    .in('telegram_id', ids);

  const logByUser = new Map((logs || []).map(l => [l.telegram_id, l]));

  return deduped.filter(r => {
    const log = logByUser.get(r.telegram_id);
    if (!log) return true;
    if (log.opted_out || log.converted) return false;
    if (log.sequence_step >= 4) return false;
    return !log.next_send_at || new Date(log.next_send_at) <= new Date();
  }).map(r => ({
    ...r,
    remarketing_log: logByUser.has(r.telegram_id) ? [logByUser.get(r.telegram_id)] : []
  })).slice(0, BATCH);
}

// ── Upsert log após envio ────────────────────────────────────────────────
async function upsertLog(telegramId, segment, currentStep, nextIntervalHours) {
  const nextSend = new Date(Date.now() + nextIntervalHours * 3600 * 1000).toISOString();

  const { error } = await sb
    .from('remarketing_log')
    .upsert({
      telegram_id:   telegramId,
      segment,
      sequence_step: currentStep + 1,
      last_sent_at:  new Date().toISOString(),
      next_send_at:  nextSend,
      updated_at:    new Date().toISOString(),
    }, {
      onConflict:           'telegram_id',
      ignoreDuplicates:     false,
    });

  // Incrementa total_sent via update separado
  await sb.rpc('increment_remarketing_sent', { uid: telegramId }).catch(() => {
    // fallback: ignora se RPC não existir
  });

  if (error) console.error('  ⚠️  upsertLog error:', error.message);
}

// ── Opt-out ──────────────────────────────────────────────────────────────
async function optOut(telegramId) {
  await sb
    .from('remarketing_log')
    .upsert({
      telegram_id:  telegramId,
      opted_out:    true,
      opted_out_at: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }, { onConflict: 'telegram_id' });
}

// ── Marcar convertido ────────────────────────────────────────────────────
async function markConverted(telegramId) {
  await sb
    .from('remarketing_log')
    .update({ converted: true, converted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('telegram_id', telegramId);
}

// ── Buscar imagem aleatória do pack para remarketing ─────────────────────
async function getRandomImage(packId = 'pack_premium') {
  const { data } = await sb
    .from('media_items')
    .select('storage_path')
    .eq('pack_id', packId)
    .eq('file_type', 'photo')
    .eq('is_active', true);

  if (!data || data.length === 0) return null;
  const item = data[Math.floor(Math.random() * data.length)];

  // Gera signed URL (1h)
  const { data: signed, error } = await sb.storage
    .from('media-packs')
    .createSignedUrl(item.storage_path.replace('media-packs/', ''), 3600);

  if (error) return null;
  return signed.signedUrl;
}

module.exports = { getColdBatch, getWarmBatch, getBuyerBatch, upsertLog, optOut, markConverted, getRandomImage };
