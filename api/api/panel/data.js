// api/panel/data.js — API de dados do painel web
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

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

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = req.headers.authorization?.replace('Bearer ', '');
  if (!auth || !verifyToken(auth)) return res.status(401).json({ error: 'Unauthorized' });

  const { action } = req.query;

  try {
    // ===== DASHBOARD =====
    if (action === 'dashboard') {
      const [users, transactions, pendentes, grupos, tickets, broadcast] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('groups').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'open'),
        supabase.from('broadcast_campaigns').select('*', { count: 'exact', head: true }).in('status', ['pending','sending'])
      ]);
      const { data: salesData } = await supabase.from('transactions').select('amount').eq('status', 'delivered');
      const totalSales = salesData?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      const { data: hoje } = await supabase.from('transactions').select('amount').eq('status', 'delivered').gte('created_at', new Date().toISOString().split('T')[0]);
      const vendasHoje = hoje?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      const { data: semana } = await supabase.from('transactions').select('amount').eq('status', 'delivered').gte('created_at', new Date(Date.now() - 7*86400000).toISOString());
      const vendasSemana = semana?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      const { data: recentTx } = await supabase.from('transactions').select('txid, amount, status, created_at, telegram_id').order('created_at', { ascending: false }).limit(10);
      const { data: recentUsers } = await supabase.from('users').select('telegram_id, first_name, username, created_at').order('created_at', { ascending: false }).limit(10);
      return res.json({ users: users.count, transactions: transactions.count, pendentes: pendentes.count, grupos: grupos.count, tickets: tickets.count, broadcastAtivo: broadcast.count, totalSales, vendasHoje, vendasSemana, recentTx, recentUsers });
    }

    // ===== TRANSAÇÕES =====
    if (action === 'transactions') {
      const { page = 1, limit = 20, status, search } = req.query;
      const offset = (page - 1) * limit;
      let query = supabase.from('transactions').select('txid, telegram_id, amount, status, created_at, delivered_at, product_id, media_pack_id, group_id, delivery_error, delivery_attempts', { count: 'exact' });
      if (status && status !== 'all') query = query.eq('status', status);
      if (search) query = query.or(`txid.ilike.%${search}%,telegram_id.eq.${parseInt(search) || 0}`);
      query = query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
      const { data, count } = await query;
      return res.json({ data, total: count, page: parseInt(page), pages: Math.ceil(count / limit) });
    }

    // ===== APROVAR TRANSAÇÃO =====
    if (action === 'approve' && req.method === 'POST') {
      const { txid } = req.body;
      await supabase.from('transactions').update({ status: 'approved', validated_at: new Date().toISOString() }).eq('txid', txid);
      return res.json({ ok: true });
    }

    // ===== REJEITAR TRANSAÇÃO =====
    if (action === 'reject' && req.method === 'POST') {
      const { txid } = req.body;
      await supabase.from('transactions').update({ status: 'rejected' }).eq('txid', txid);
      return res.json({ ok: true });
    }

    // ===== USUÁRIOS =====
    if (action === 'users') {
      const { page = 1, limit = 20, search, blocked } = req.query;
      const offset = (page - 1) * limit;
      let query = supabase.from('users').select('id, telegram_id, first_name, last_name, username, is_blocked, is_admin, is_creator, created_at', { count: 'exact' });
      if (blocked === 'true') query = query.eq('is_blocked', true);
      if (blocked === 'false') query = query.eq('is_blocked', false);
      if (search) query = query.or(`first_name.ilike.%${search}%,username.ilike.%${search}%,telegram_id.eq.${parseInt(search) || 0}`);
      query = query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
      const { data, count } = await query;
      return res.json({ data, total: count, page: parseInt(page), pages: Math.ceil(count / limit) });
    }

    // ===== BLOQUEAR/DESBLOQUEAR USUÁRIO =====
    if (action === 'toggleBlock' && req.method === 'POST') {
      const { telegram_id, block } = req.body;
      await supabase.from('users').update({ is_blocked: block }).eq('telegram_id', telegram_id);
      return res.json({ ok: true });
    }

    // ===== PRODUTOS =====
    if (action === 'products') {
      const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      return res.json({ data });
    }

    if (action === 'createProduct' && req.method === 'POST') {
      const { product_id, name, description, price, delivery_type, delivery_url } = req.body;
      const { data, error } = await supabase.from('products').insert([{ product_id, name, description, price: parseFloat(price), delivery_type, delivery_url, is_active: true }]).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true, data });
    }

    if (action === 'updateProduct' && req.method === 'PUT') {
      const { product_id, ...updates } = req.body;
      await supabase.from('products').update(updates).eq('product_id', product_id);
      return res.json({ ok: true });
    }

    if (action === 'deleteProduct' && req.method === 'DELETE') {
      const { product_id } = req.query;
      await supabase.from('products').update({ is_active: false }).eq('product_id', product_id);
      return res.json({ ok: true });
    }

    // ===== GRUPOS =====
    if (action === 'groups') {
      const { data } = await supabase.from('groups').select('*, group_members(count)').order('created_at', { ascending: false });
      return res.json({ data });
    }

    if (action === 'toggleGroup' && req.method === 'POST') {
      const { group_id, active } = req.body;
      await supabase.from('groups').update({ is_active: active }).eq('group_id', group_id);
      return res.json({ ok: true });
    }

    // ===== TICKETS =====
    if (action === 'tickets') {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (page - 1) * limit;
      let query = supabase.from('support_tickets').select('*, user:user_id(first_name, username, telegram_id)', { count: 'exact' });
      if (status && status !== 'all') query = query.eq('status', status);
      query = query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
      const { data, count } = await query;
      return res.json({ data, total: count, page: parseInt(page), pages: Math.ceil(count / limit) });
    }

    if (action === 'ticketMessages') {
      const { ticket_id } = req.query;
      const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', ticket_id).order('created_at', { ascending: true });
      return res.json({ data });
    }

    if (action === 'closeTicket' && req.method === 'POST') {
      const { ticket_id } = req.body;
      await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', ticket_id);
      return res.json({ ok: true });
    }

    // ===== CASTCUPOM / BROADCAST =====
    if (action === 'broadcasts') {
      const { data } = await supabase.from('broadcast_campaigns').select('*').order('created_at', { ascending: false }).limit(30);
      return res.json({ data });
    }

    if (action === 'broadcastStats') {
      const { data } = await supabase.from('broadcast_campaigns').select('status, success_count, failed_count, total_users, name, created_at').order('created_at', { ascending: false }).limit(5);
      return res.json({ data });
    }

    // ===== FALHAS DE ENTREGA =====
    if (action === 'deliveryFailures') {
      const { data } = await supabase.from('transactions').select('txid, telegram_id, amount, delivery_error, delivery_error_type, delivery_attempts, last_delivery_attempt_at').eq('status', 'delivery_failed').order('last_delivery_attempt_at', { ascending: false }).limit(50);
      return res.json({ data });
    }

    // ===== PIX KEY =====
    if (action === 'pixKey') {
      const { data } = await supabase.from('settings').select('value').eq('key', 'pix_key').single();
      return res.json({ pixKey: data?.value || '' });
    }

    if (action === 'setPixKey' && req.method === 'POST') {
      const { pixKey } = req.body;
      await supabase.from('settings').upsert({ key: 'pix_key', value: pixKey });
      return res.json({ ok: true });
    }

    // ===== ESTATÍSTICAS AVANÇADAS =====
    if (action === 'stats') {
      const { data: byDay } = await supabase.from('transactions').select('created_at, amount').eq('status', 'delivered').gte('created_at', new Date(Date.now() - 30*86400000).toISOString());
      const byDayMap = {};
      byDay?.forEach(t => {
        const d = t.created_at.split('T')[0];
        byDayMap[d] = (byDayMap[d] || 0) + parseFloat(t.amount || 0);
      });
      const { data: byStatus } = await supabase.from('transactions').select('status').then(r => {
        const counts = {};
        r.data?.forEach(t => counts[t.status] = (counts[t.status] || 0) + 1);
        return { data: counts };
      });
      const { data: topUsers } = await supabase.from('transactions').select('telegram_id, amount').eq('status', 'delivered').order('amount', { ascending: false }).limit(10);
      return res.json({ byDay: byDayMap, byStatus, topUsers });
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (err) {
    console.error('[PANEL-API]', err);
    return res.status(500).json({ error: err.message });
  }
};
