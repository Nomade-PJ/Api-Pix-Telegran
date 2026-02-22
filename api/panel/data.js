// api/panel/data.js — Nexus Panel API v4 — completa com paridade total ao bot
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const JWT_SECRET = process.env.ADMIN_SECRET || 'panel_jwt_secret_2026';

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

function extractDDD(phone) {
  if (!phone) return null;
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) return d.substring(2, 4);
  if (d.length >= 10) return d.substring(0, 2);
  return null;
}

function getBrasilStartOf(period) {
  // UTC-3
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  if (period === 'today') {
    return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) + 3 * 3600000).toISOString();
  }
  if (period === 'month') {
    return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), 1) + 3 * 3600000).toISOString();
  }
  if (period === 'prevmonth') {
    return new Date(Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth() - 1, 1) + 3 * 3600000).toISOString();
  }
  return null;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth || !verifyToken(auth)) return res.status(401).json({ error: 'Unauthorized' });

  const { action } = req.query;

  try {

    // ═══════════════════════════════════════════════
    // DASHBOARD
    // ═══════════════════════════════════════════════
    if (action === 'dashboard') {
      const todayStart = getBrasilStartOf('today');
      const weekStart = new Date(Date.now() - 7 * 86400000).toISOString();

      const [users, txCount, pendentes, tickets, failures, totalSalesR, hojeR, semanaR, avgR, recentTx, recentUsers, trustedR] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).not('telegram_id', 'is', null),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).in('status', ['pending', 'proof_sent']),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'delivery_failed'),
        supabase.from('transactions').select('amount').in('status', ['delivered', 'validated']),
        supabase.from('transactions').select('amount').in('status', ['delivered', 'validated']).gte('delivered_at', todayStart),
        supabase.from('transactions').select('amount').in('status', ['delivered', 'validated']).gte('delivered_at', weekStart),
        supabase.from('transactions').select('amount').in('status', ['delivered', 'validated']),
        supabase.from('transactions').select('txid, amount, status, created_at, telegram_id').order('created_at', { ascending: false }).limit(8),
        supabase.from('users').select('telegram_id, first_name, last_name, username, created_at, phone_number').not('telegram_id', 'is', null).order('created_at', { ascending: false }).limit(8),
        supabase.from('trusted_users').select('*', { count: 'exact', head: true }).lt('trust_score', 80)
      ]);

      const totalSales = totalSalesR.data?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      const vendasHoje = hojeR.data?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      const vendasSemana = semanaR.data?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      const avgTicket = avgR.data?.length ? totalSales / avgR.data.length : 0;

      // Enriquecer transações recentes com nome do usuário
      if (recentTx.data?.length) {
        const tids = [...new Set(recentTx.data.map(t => t.telegram_id).filter(Boolean))];
        if (tids.length) {
          const { data: usrs } = await supabase.from('users').select('telegram_id, first_name, username').in('telegram_id', tids);
          const um = {}; usrs?.forEach(u => { um[u.telegram_id] = u; });
          recentTx.data.forEach(t => { t.user = um[t.telegram_id] || null; });
        }
      }

      return res.json({
        users: users.count, transactions: txCount.count, pendentes: pendentes.count,
        tickets: tickets.count, failures: failures.count,
        trustedPending: trustedR.count || 0,
        totalSales, vendasHoje, vendasSemana, avgTicket,
        recentTx: recentTx.data, recentUsers: recentUsers.data
      });
    }

    // ═══════════════════════════════════════════════
    // ANALYTICS / STATS
    // ═══════════════════════════════════════════════
    if (action === 'stats') {
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
      const todayStart = getBrasilStartOf('today');
      const monthStart = getBrasilStartOf('month');
      const prevMonthStart = getBrasilStartOf('prevmonth');

      const [byDayR, allStatusR, newUsersR, monthR, prevMonthR, byProductR] = await Promise.all([
        supabase.from('transactions').select('delivered_at, amount').eq('status', 'delivered').gte('delivered_at', since30),
        supabase.from('transactions').select('status'),
        supabase.from('users').select('created_at').not('telegram_id', 'is', null).gte('created_at', since30),
        supabase.from('transactions').select('amount').eq('status', 'delivered').gte('delivered_at', monthStart),
        supabase.from('transactions').select('amount').eq('status', 'delivered').gte('delivered_at', prevMonthStart).lt('delivered_at', monthStart),
        supabase.from('transactions').select('product_id, amount').eq('status', 'delivered').not('product_id', 'is', null)
      ]);

      const byDay = {};
      byDayR.data?.forEach(t => {
        const d = (t.delivered_at || '').split('T')[0];
        if (d) byDay[d] = (byDay[d] || 0) + parseFloat(t.amount || 0);
      });

      const byStatus = {};
      allStatusR.data?.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });

      const byDayUsers = {};
      newUsersR.data?.forEach(u => {
        const d = (u.created_at || '').split('T')[0];
        if (d) byDayUsers[d] = (byDayUsers[d] || 0) + 1;
      });

      const byProduct = {};
      byProductR.data?.forEach(t => {
        if (!byProduct[t.product_id]) byProduct[t.product_id] = { count: 0, revenue: 0 };
        byProduct[t.product_id].count++;
        byProduct[t.product_id].revenue += parseFloat(t.amount || 0);
      });

      const monthTotal = monthR.data?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      const prevMonthTotal = prevMonthR.data?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;

      return res.json({ byDay, byStatus, byDayUsers, byProduct, monthTotal, prevMonthTotal, monthTx: monthR.data?.length || 0, prevMonthTx: prevMonthR.data?.length || 0 });
    }

    // ═══════════════════════════════════════════════
    // RELATÓRIO DE USUÁRIOS
    // ═══════════════════════════════════════════════
    if (action === 'userReport') {
      const [totalR, buyersR, blockedR, unblockedR, dddsR] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }).not('telegram_id', 'is', null),
        supabase.from('transactions').select('telegram_id').eq('status', 'delivered'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_blocked', true).not('telegram_id', 'is', null),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('is_blocked', false).not('telegram_id', 'is', null),
        supabase.from('blocked_area_codes').select('area_code')
      ]);

      const uniqueBuyers = new Set(buyersR.data?.map(t => t.telegram_id) || []);
      const total = totalR.count || 0;
      const bought = uniqueBuyers.size;
      const blocked = blockedR.count || 0;
      const unblocked = unblockedR.count || 0;
      const convRate = total > 0 ? ((bought / total) * 100).toFixed(1) : '0.0';

      // Usuários com DDD bloqueado
      const blockedDDDs = dddsR.data?.map(d => d.area_code) || [];
      let dddBlockedCount = 0;
      if (blockedDDDs.length > 0) {
        const { data: usrsPhone } = await supabase.from('users').select('telegram_id, phone_number, is_blocked').not('telegram_id', 'is', null).not('phone_number', 'is', null);
        usrsPhone?.forEach(u => {
          const ddd = extractDDD(u.phone_number);
          if (ddd && blockedDDDs.includes(ddd)) dddBlockedCount++;
        });
      }

      return res.json({ total, bought, blocked, unblocked, convRate, dddBlockedCount, blockedDDDs: blockedDDDs.length });
    }

    // ═══════════════════════════════════════════════
    // TRANSAÇÕES
    // ═══════════════════════════════════════════════
    if (action === 'transactions') {
      const { page = 1, limit = 20, status, search } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = supabase.from('transactions')
        .select('txid, telegram_id, amount, status, created_at, delivered_at, product_id, delivery_error_type, delivery_attempts, notes, proof_file_id, proof_received_at, ocr_confidence', { count: 'exact' });
      if (status && status !== 'all') query = query.eq('status', status);
      if (search) {
        const n = parseInt(search);
        if (!isNaN(n)) query = query.or(`txid.ilike.%${search}%,telegram_id.eq.${n}`);
        else query = query.ilike('txid', `%${search}%`);
      }
      const { data, count } = await query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
      if (data?.length) {
        const tids = [...new Set(data.map(t => t.telegram_id).filter(Boolean))];
        if (tids.length) {
          const { data: usrs } = await supabase.from('users').select('telegram_id, first_name, username').in('telegram_id', tids);
          const um = {}; usrs?.forEach(u => { um[u.telegram_id] = u; });
          data.forEach(t => { t.user = um[t.telegram_id] || null; });
        }
      }
      return res.json({ data, total: count, page: parseInt(page), pages: Math.ceil((count || 0) / parseInt(limit)) });
    }

    if (action === 'transactionDetail') {
      const { txid } = req.query;
      const { data } = await supabase.from('transactions').select('*').eq('txid', txid).single();
      if (data?.telegram_id) {
        const { data: u } = await supabase.from('users').select('first_name, username, phone_number').eq('telegram_id', data.telegram_id).single();
        data.user = u || null;
      }
      return res.json({ data });
    }

    if (action === 'approveTransaction' && req.method === 'POST') {
      await supabase.from('transactions').update({ status: 'approved', validated_at: new Date().toISOString() }).eq('txid', req.body.txid);
      return res.json({ ok: true });
    }
    if (action === 'rejectTransaction' && req.method === 'POST') {
      await supabase.from('transactions').update({ status: 'rejected' }).eq('txid', req.body.txid);
      return res.json({ ok: true });
    }
    if (action === 'reverseTransaction' && req.method === 'POST') {
      const { txid, reason } = req.body;
      await supabase.from('transactions').update({ status: 'reversed', notes: reason || 'Revertido via painel' }).eq('txid', txid);
      return res.json({ ok: true });
    }
    if (action === 'deliverByTxid' && req.method === 'POST') {
      await supabase.from('transactions').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('txid', req.body.txid);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // FALHAS DE ENTREGA
    // ═══════════════════════════════════════════════
    if (action === 'deliveryFailures') {
      const { data } = await supabase.from('transactions')
        .select('txid, telegram_id, amount, delivery_error, delivery_error_type, delivery_attempts, last_delivery_attempt_at, product_id, notes')
        .eq('status', 'delivery_failed')
        .order('last_delivery_attempt_at', { ascending: false })
        .limit(100);
      if (data?.length) {
        const tids = [...new Set(data.map(t => t.telegram_id).filter(Boolean))];
        if (tids.length) {
          const { data: usrs } = await supabase.from('users').select('telegram_id, first_name, username').in('telegram_id', tids);
          const um = {}; usrs?.forEach(u => { um[u.telegram_id] = u; });
          data.forEach(t => { t.user = um[t.telegram_id] || null; });
        }
      }
      return res.json({ data });
    }
    if (action === 'forceDelivered' && req.method === 'POST') {
      await supabase.from('transactions').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('txid', req.body.txid);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // ENTREGA MANUAL
    // ═══════════════════════════════════════════════
    if (action === 'manualDeliverOptions') {
      const { telegram_id } = req.query;
      const { data: user } = await supabase.from('users').select('telegram_id, first_name, username, phone_number').eq('telegram_id', parseInt(telegram_id)).single();
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
      const [{ data: products }, { data: groups }] = await Promise.all([
        supabase.from('products').select('product_id, name, price, delivery_type').eq('is_active', true),
        supabase.from('groups').select('group_id, group_name, subscription_price, subscription_days').eq('is_active', true)
      ]);
      return res.json({ user, products: products || [], groups: groups || [] });
    }
    if (action === 'manualDeliver' && req.method === 'POST') {
      const { telegram_id, product_id, group_id } = req.body;
      const txid = 'MANUAL_' + Date.now() + '_' + telegram_id;
      let amount = 0;
      let finalProductId = product_id || null;
      let finalGroupId = group_id || null;
      if (product_id) {
        const { data: p } = await supabase.from('products').select('price').eq('product_id', product_id).single();
        amount = parseFloat(p?.price || 0);
      } else if (group_id) {
        const { data: g } = await supabase.from('groups').select('subscription_price').eq('group_id', group_id).single();
        amount = parseFloat(g?.subscription_price || 0);
      }
      await supabase.from('transactions').insert([{
        txid, telegram_id: parseInt(telegram_id), amount, status: 'delivered',
        product_id: finalProductId, group_id: finalGroupId,
        delivered_at: new Date().toISOString(), notes: 'Entrega manual via painel web'
      }]);
      return res.json({ ok: true, txid });
    }

    // ═══════════════════════════════════════════════
    // USUÁRIOS — query otimizada com JOIN + paginação
    // ═══════════════════════════════════════════════
    if (action === 'users') {
      const { page = 1, limit = 30, search, blocked } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const lim = parseInt(limit);

      // Query principal para contar
      let countQuery = supabase.from('users').select('*', { count: 'exact', head: true }).not('telegram_id', 'is', null);
      if (blocked === 'true') countQuery = countQuery.eq('is_blocked', true);
      else if (blocked === 'false') countQuery = countQuery.eq('is_blocked', false);
      if (search) {
        const n = parseInt(search);
        if (!isNaN(n)) countQuery = countQuery.or(`first_name.ilike.%${search}%,username.ilike.%${search}%,telegram_id.eq.${n}`);
        else countQuery = countQuery.or(`first_name.ilike.%${search}%,username.ilike.%${search}%`);
      }

      // Query paginada
      let dataQuery = supabase.from('users')
        .select('telegram_id, first_name, last_name, username, is_blocked, is_admin, is_creator, created_at, phone_number')
        .not('telegram_id', 'is', null);
      if (blocked === 'true') dataQuery = dataQuery.eq('is_blocked', true);
      else if (blocked === 'false') dataQuery = dataQuery.eq('is_blocked', false);
      if (search) {
        const n = parseInt(search);
        if (!isNaN(n)) dataQuery = dataQuery.or(`first_name.ilike.%${search}%,username.ilike.%${search}%,telegram_id.eq.${n}`);
        else dataQuery = dataQuery.or(`first_name.ilike.%${search}%,username.ilike.%${search}%`);
      }
      dataQuery = dataQuery.order('created_at', { ascending: false }).range(offset, offset + lim - 1);

      const [{ count }, { data }] = await Promise.all([countQuery, dataQuery]);

      // Enriquecer com total gasto (apenas os 30 da página)
      if (data?.length) {
        const tids = data.map(u => u.telegram_id);
        const { data: spent } = await supabase
          .from('transactions')
          .select('telegram_id, amount')
          .eq('status', 'delivered')
          .in('telegram_id', tids);
        const sm = {};
        spent?.forEach(t => { sm[t.telegram_id] = (sm[t.telegram_id] || 0) + parseFloat(t.amount || 0); });
        data.forEach(u => {
          u.total_gasto = sm[u.telegram_id] || 0;
          u.ddd = extractDDD(u.phone_number);
        });
      }

      return res.json({ data, total: count, page: parseInt(page), pages: Math.ceil((count || 0) / lim), limit: lim });
    }

    if (action === 'userDetail') {
      const { telegram_id } = req.query;
      const tid = parseInt(telegram_id);
      const { data: user } = await supabase.from('users').select('*').eq('telegram_id', tid).single();
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
      user.ddd = extractDDD(user.phone_number);

      const [{ data: txs }, { data: trusted }] = await Promise.all([
        supabase.from('transactions').select('txid, amount, status, created_at, product_id, delivered_at').eq('telegram_id', tid).order('created_at', { ascending: false }).limit(15),
        supabase.from('trusted_users').select('trust_score, approved_transactions, rejected_transactions, auto_approve_threshold').eq('telegram_id', tid).single()
      ]);

      const totalGasto = txs?.filter(t => t.status === 'delivered').reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      return res.json({ user, transactions: txs || [], trusted: trusted || null, totalGasto, totalTx: txs?.length || 0 });
    }

    if (action === 'searchUser') {
      const { q } = req.query;
      if (!q || q.length < 2) return res.json({ data: [] });
      const n = parseInt(q);
      let query = supabase.from('users').select('telegram_id, first_name, last_name, username, phone_number, is_blocked, created_at').not('telegram_id', 'is', null);
      if (!isNaN(n)) query = query.or(`telegram_id.eq.${n},first_name.ilike.%${q}%,username.ilike.%${q}%`);
      else query = query.or(`first_name.ilike.%${q}%,username.ilike.%${q}%`);
      const { data } = await query.limit(10);
      data?.forEach(u => { u.ddd = extractDDD(u.phone_number); });
      return res.json({ data: data || [] });
    }

    if (action === 'blockUser' && req.method === 'POST') {
      await supabase.from('users').update({ is_blocked: true }).eq('telegram_id', req.body.telegram_id);
      return res.json({ ok: true });
    }
    if (action === 'unblockUser' && req.method === 'POST') {
      await supabase.from('users').update({ is_blocked: false }).eq('telegram_id', req.body.telegram_id);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // PRODUTOS
    // ═══════════════════════════════════════════════
    if (action === 'products') {
      const { includeInactive } = req.query;
      let q = supabase.from('products').select('*').order('created_at', { ascending: false });
      if (!includeInactive) q = q.eq('is_active', true);
      const { data } = await q;
      return res.json({ data: data || [] });
    }
    if (action === 'createProduct' && req.method === 'POST') {
      const { product_id, name, description, price, delivery_type, delivery_url } = req.body;
      const { data, error } = await supabase.from('products').insert([{ product_id, name, description, price: parseFloat(price), delivery_type: delivery_type || 'link', delivery_url, is_active: true }]).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true, data });
    }
    if (action === 'updateProduct' && req.method === 'PUT') {
      const { product_id, ...updates } = req.body;
      if (updates.price) updates.price = parseFloat(updates.price);
      updates.updated_at = new Date().toISOString();
      await supabase.from('products').update(updates).eq('product_id', product_id);
      return res.json({ ok: true });
    }
    if (action === 'toggleProduct' && req.method === 'POST') {
      await supabase.from('products').update({ is_active: req.body.is_active }).eq('product_id', req.body.product_id);
      return res.json({ ok: true });
    }
    if (action === 'deleteProduct' && req.method === 'DELETE') {
      await supabase.from('products').update({ is_active: false }).eq('product_id', req.query.product_id);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // GRUPOS
    // ═══════════════════════════════════════════════
    if (action === 'groups') {
      const { data } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
      return res.json({ data: data || [] });
    }
    if (action === 'createGroup' && req.method === 'POST') {
      const { group_id, group_name, group_link, subscription_price, subscription_days } = req.body;
      const { data, error } = await supabase.from('groups').insert([{ group_id, group_name, group_link, subscription_price: parseFloat(subscription_price), subscription_days: parseInt(subscription_days), is_active: true }]).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true, data });
    }
    if (action === 'updateGroup' && req.method === 'PUT') {
      const { group_id, ...updates } = req.body;
      if (updates.subscription_price) updates.subscription_price = parseFloat(updates.subscription_price);
      await supabase.from('groups').update(updates).eq('group_id', group_id);
      return res.json({ ok: true });
    }
    if (action === 'toggleGroup' && req.method === 'POST') {
      await supabase.from('groups').update({ is_active: req.body.is_active }).eq('group_id', req.body.group_id);
      return res.json({ ok: true });
    }
    if (action === 'deleteGroup' && req.method === 'DELETE') {
      await supabase.from('groups').delete().eq('group_id', req.query.group_id);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // TICKETS
    // ═══════════════════════════════════════════════
    if (action === 'tickets') {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = supabase.from('support_tickets')
        .select('id, ticket_number, subject, message, status, priority, created_at, telegram_id', { count: 'exact' });
      if (status && status !== 'all') query = query.eq('status', status);
      const { data, count } = await query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
      if (data?.length) {
        const tids = [...new Set(data.map(t => t.telegram_id).filter(Boolean))];
        if (tids.length) {
          const { data: usrs } = await supabase.from('users').select('telegram_id, first_name, username, phone_number').in('telegram_id', tids);
          const um = {}; usrs?.forEach(u => { um[u.telegram_id] = u; });
          data.forEach(t => { t.user = um[t.telegram_id] || null; });
        }
      }
      return res.json({ data, total: count, page: parseInt(page), pages: Math.ceil((count || 0) / parseInt(limit)) });
    }
    if (action === 'ticketMessages') {
      const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', req.query.ticket_id).order('created_at', { ascending: true });
      return res.json({ data: data || [] });
    }
    if (action === 'replyTicket' && req.method === 'POST') {
      const { ticket_id, message } = req.body;
      const { data: ticket } = await supabase.from('support_tickets').select('user_id').eq('id', ticket_id).single();
      if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });
      await supabase.from('support_messages').insert([{ ticket_id, user_id: ticket.user_id, message, is_admin: true }]);
      await supabase.from('support_tickets').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', ticket_id);
      return res.json({ ok: true });
    }
    if (action === 'resolveTicket' && req.method === 'POST') {
      await supabase.from('support_tickets').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', req.body.ticket_id);
      return res.json({ ok: true });
    }
    if (action === 'closeTicket' && req.method === 'POST') {
      await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', req.body.ticket_id);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // BROADCAST
    // ═══════════════════════════════════════════════
    if (action === 'broadcasts') {
      const { data } = await supabase.from('broadcast_campaigns').select('*').order('created_at', { ascending: false }).limit(30);
      return res.json({ data: data || [] });
    }
    if (action === 'cancelBroadcast' && req.method === 'POST') {
      await supabase.from('broadcast_campaigns').update({ status: 'cancelled' }).eq('id', req.body.campaign_id);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // CUPONS
    // ═══════════════════════════════════════════════
    if (action === 'coupons') {
      const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      return res.json({ data: data || [] });
    }
    if (action === 'createCoupon' && req.method === 'POST') {
      const { code, discount_percentage, product_id, max_uses, expires_at } = req.body;
      const { data, error } = await supabase.from('coupons').insert([{
        code: code.toUpperCase(), discount_percentage: parseFloat(discount_percentage),
        product_id: product_id || null, max_uses: max_uses ? parseInt(max_uses) : null,
        expires_at: expires_at || null, is_active: true, current_uses: 0
      }]).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true, data });
    }
    if (action === 'toggleCoupon' && req.method === 'POST') {
      await supabase.from('coupons').update({ is_active: req.body.is_active }).eq('id', req.body.coupon_id);
      return res.json({ ok: true });
    }
    if (action === 'deleteCoupon' && req.method === 'DELETE') {
      await supabase.from('coupons').delete().eq('id', req.query.coupon_id);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // RESPOSTAS AUTOMÁTICAS
    // ═══════════════════════════════════════════════
    if (action === 'autoResponses') {
      const { data } = await supabase.from('auto_responses').select('*').order('priority', { ascending: false });
      return res.json({ data: data || [] });
    }
    if (action === 'createAutoResponse' && req.method === 'POST') {
      const { keyword, response, priority } = req.body;
      const { data, error } = await supabase.from('auto_responses').insert([{
        keyword: keyword.toLowerCase(), response, priority: parseInt(priority) || 0, is_active: true, usage_count: 0
      }]).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true, data });
    }
    if (action === 'toggleAutoResponse' && req.method === 'POST') {
      await supabase.from('auto_responses').update({ is_active: req.body.is_active }).eq('id', req.body.id);
      return res.json({ ok: true });
    }
    if (action === 'deleteAutoResponse' && req.method === 'DELETE') {
      await supabase.from('auto_responses').delete().eq('id', req.query.id);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // USUÁRIOS CONFIÁVEIS
    // ═══════════════════════════════════════════════
    if (action === 'trustedUsers') {
      const { data } = await supabase.from('trusted_users').select('*').order('trust_score', { ascending: false });
      if (data?.length) {
        const tids = data.map(t => t.telegram_id).filter(Boolean);
        if (tids.length) {
          const { data: usrs } = await supabase.from('users').select('telegram_id, first_name, username').in('telegram_id', tids);
          const um = {}; usrs?.forEach(u => { um[u.telegram_id] = u; });
          data.forEach(t => { t.user = um[t.telegram_id] || null; });
        }
      }
      return res.json({ data: data || [] });
    }
    if (action === 'addTrustedUser' && req.method === 'POST') {
      const { telegram_id, initial_score = 80 } = req.body;
      // Buscar user_id pelo telegram_id
      const { data: user } = await supabase.from('users').select('id').eq('telegram_id', parseInt(telegram_id)).single();
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });
      const { error } = await supabase.from('trusted_users').upsert({
        telegram_id: parseInt(telegram_id), user_id: user.id,
        trust_score: parseInt(initial_score), auto_approve_threshold: Math.max(40, 70 - (parseInt(initial_score) / 2)),
        approved_transactions: 0, rejected_transactions: 0, updated_at: new Date().toISOString()
      }, { onConflict: 'telegram_id' });
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    }
    if (action === 'removeTrustedUser' && req.method === 'DELETE') {
      await supabase.from('trusted_users').delete().eq('id', req.query.id);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // PROOF PATTERNS / IA
    // ═══════════════════════════════════════════════
    if (action === 'proofPatterns') {
      const { data } = await supabase.from('proof_patterns').select('*').order('confidence_score', { ascending: false });
      return res.json({ data: data || [] });
    }
    if (action === 'deleteProofPattern' && req.method === 'DELETE') {
      await supabase.from('proof_patterns').delete().eq('id', req.query.id);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // CONFIGURAÇÕES
    // ═══════════════════════════════════════════════
    if (action === 'settings') {
      const { data } = await supabase.from('settings').select('key, value');
      const map = {};
      data?.forEach(s => { map[s.key] = s.value; });
      return res.json({ settings: map });
    }
    if (action === 'saveSetting' && req.method === 'POST') {
      const { key, value } = req.body;
      await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // DDDs BLOQUEADOS
    // ═══════════════════════════════════════════════
    if (action === 'blockedDDDs') {
      const { data } = await supabase.from('blocked_area_codes').select('*').order('area_code');
      return res.json({ data: data || [] });
    }
    if (action === 'addDDD' && req.method === 'POST') {
      const { area_code, state, reason } = req.body;
      const { error } = await supabase.from('blocked_area_codes').insert([{ area_code, state, reason }]);
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true });
    }
    if (action === 'removeDDD' && req.method === 'DELETE') {
      await supabase.from('blocked_area_codes').delete().eq('area_code', req.query.area_code);
      return res.json({ ok: true });
    }

    // ═══════════════════════════════════════════════
    // RECALCULAR VALORES
    // ═══════════════════════════════════════════════
    if (action === 'recalculate' && req.method === 'POST') {
      const { data: delivered } = await supabase.from('transactions').select('amount').eq('status', 'delivered');
      const total = delivered?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      return res.json({ ok: true, total });
    }

    // ── USERS SCROLL (infinite scroll por offset) ──────────────────────────
    if (action === 'usersScroll') {
      const { offset = 0, limit = 30, search, blocked } = req.query;
      const off = parseInt(offset);
      const lim = Math.min(parseInt(limit), 100);

      let countQ = supabase.from('users').select('*', { count: 'exact', head: true }).not('telegram_id', 'is', null);
      let dataQ  = supabase.from('users')
        .select('telegram_id, first_name, last_name, username, phone_number, is_blocked, is_admin, is_creator, created_at')
        .not('telegram_id', 'is', null);

      const applyFilters = q => {
        if (blocked === 'true')  q = q.eq('is_blocked', true);
        else if (blocked === 'false') q = q.eq('is_blocked', false);
        if (search) {
          const n = parseInt(search);
          if (!isNaN(n)) q = q.or(`first_name.ilike.%${search}%,username.ilike.%${search}%,telegram_id.eq.${n}`);
          else q = q.or(`first_name.ilike.%${search}%,username.ilike.%${search}%`);
        }
        return q;
      };

      countQ = applyFilters(countQ);
      dataQ  = applyFilters(dataQ).order('created_at', { ascending: false }).range(off, off + lim - 1);

      const [{ count }, { data }] = await Promise.all([countQ, dataQ]);
      return res.json({ data: data || [], total: count, offset: off, limit: lim });
    }

    // ── SET ADMIN ───────────────────────────────────────────────────────────
    if (action === 'setAdmin' && req.method === 'POST') {
      const { telegram_id, is_admin } = req.body;
      const { error } = await supabase.from('users').update({ is_admin: !!is_admin }).eq('telegram_id', telegram_id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    // ── MEDIA PACKS ─────────────────────────────────────────────────────────
    if (action === 'mediaPacks') {
      const { data } = await supabase.from('media_packs')
        .select('pack_id, name, description, price, items_per_delivery, is_active, variable_prices, created_at')
        .order('created_at', { ascending: false });
      return res.json({ data: data || [] });
    }

    // ── MEDIA ITEMS ─────────────────────────────────────────────────────────
    if (action === 'mediaItems') {
      const { pack_id } = req.query;
      if (!pack_id) return res.status(400).json({ error: 'pack_id obrigatório' });
      const { data } = await supabase.from('media_items')
        .select('id, file_name, file_url, file_type, thumbnail_url, size_bytes, is_active, created_at')
        .eq('pack_id', pack_id)
        .eq('is_active', true)
        .order('created_at', { ascending: true });
      return res.json({ data: data || [] });
    }

    // ── RETRY DELIVERY ──────────────────────────────────────────────────────
    if (action === 'retryDelivery' && req.method === 'POST') {
      const { txid } = req.body;
      // Reseta o status para approved para que o cron tente novamente
      const { error } = await supabase.from('transactions')
        .update({ status: 'approved', delivery_error: null, delivery_error_type: null, last_delivery_attempt_at: null })
        .eq('txid', txid);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    // ── PROGRESS TICKET (open -> in_progress) ──────────────────────────────
    if (action === 'progressTicket' && req.method === 'POST') {
      const { ticket_id } = req.body;
      const { error } = await supabase.from('support_tickets')
        .update({ status: 'in_progress', updated_at: new Date().toISOString() })
        .eq('id', ticket_id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ ok: true });
    }

    // ── RECALCULATE VALUES (alias) ──────────────────────────────────────────
    if (action === 'recalculateValues' && req.method === 'POST') {
      const { data: delivered } = await supabase.from('transactions')
        .select('amount').in('status', ['delivered', 'validated']);
      const total = delivered?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      // Salva como setting confirmado
      await supabase.from('settings').upsert(
        { key: 'total_vendas_confirmado', value: total.toFixed(2), description: 'Recalculado pelo painel web em ' + new Date().toLocaleDateString('pt-BR') },
        { onConflict: 'key' }
      );
      return res.json({ ok: true, total, fixed: 0 });
    }

    return res.status(404).json({ error: 'Action not found: ' + action });

  } catch (err) {
    console.error('[NEXUS-API]', err.message, err.stack?.split('\n')[1]);
    return res.status(500).json({ error: err.message });
  }
};
