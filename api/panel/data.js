// api/panel/data.js — Nexus Panel API completa
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
      const today = new Date().toISOString().split('T')[0];
      const { data: hoje } = await supabase.from('transactions').select('amount').eq('status', 'delivered').gte('created_at', today);
      const vendasHoje = hoje?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      const { data: semana } = await supabase.from('transactions').select('amount').eq('status', 'delivered').gte('created_at', new Date(Date.now() - 7*86400000).toISOString());
      const vendasSemana = semana?.reduce((a, t) => a + parseFloat(t.amount || 0), 0) || 0;
      const { data: recentTx } = await supabase.from('transactions').select('txid, amount, status, created_at, telegram_id').order('created_at', { ascending: false }).limit(8);
      const { data: recentUsers } = await supabase.from('users').select('telegram_id, first_name, username, created_at').order('created_at', { ascending: false }).limit(8);
      const { count: failCount } = await supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'delivery_failed');
      return res.json({ users: users.count, transactions: transactions.count, pendentes: pendentes.count, grupos: grupos.count, tickets: tickets.count, broadcastAtivo: broadcast.count, totalSales, vendasHoje, vendasSemana, recentTx, recentUsers, failures: failCount });
    }

    if (action === 'transactions') {
      const { page = 1, limit = 20, status, search } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = supabase.from('transactions').select('txid, telegram_id, amount, status, created_at, delivered_at, product_id, delivery_error_type, delivery_attempts', { count: 'exact' });
      if (status && status !== 'all') query = query.eq('status', status);
      if (search) {
        const n = parseInt(search);
        if (!isNaN(n)) query = query.or('txid.ilike.%' + search + '%,telegram_id.eq.' + n);
        else query = query.ilike('txid', '%' + search + '%');
      }
      query = query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
      const { data, count } = await query;
      return res.json({ data, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
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
      await supabase.from('transactions').update({ status: 'reversed', notes: reason || 'Revertido via painel web' }).eq('txid', txid);
      return res.json({ ok: true });
    }

    if (action === 'deliverByTxid' && req.method === 'POST') {
      await supabase.from('transactions').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('txid', req.body.txid);
      return res.json({ ok: true });
    }

    if (action === 'deliveryFailures') {
      const { data } = await supabase.from('transactions').select('txid, telegram_id, amount, delivery_error, delivery_error_type, delivery_attempts, last_delivery_attempt_at').eq('status', 'delivery_failed').order('last_delivery_attempt_at', { ascending: false }).limit(50);
      return res.json({ data });
    }

    if (action === 'forceDelivered' && req.method === 'POST') {
      await supabase.from('transactions').update({ status: 'delivered', delivered_at: new Date().toISOString() }).eq('txid', req.body.txid);
      return res.json({ ok: true });
    }

    if (action === 'users') {
      const { page = 1, limit = 20, search, blocked } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = supabase.from('users').select('id, telegram_id, first_name, last_name, username, is_blocked, is_admin, is_creator, created_at', { count: 'exact' });
      if (blocked === 'true') query = query.eq('is_blocked', true);
      else if (blocked === 'false') query = query.eq('is_blocked', false);
      if (search) {
        const n = parseInt(search);
        if (!isNaN(n)) query = query.or('first_name.ilike.%' + search + '%,username.ilike.%' + search + '%,telegram_id.eq.' + n);
        else query = query.or('first_name.ilike.%' + search + '%,username.ilike.%' + search + '%');
      }
      query = query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
      const { data, count } = await query;
      return res.json({ data, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
    }

    if (action === 'userDetail') {
      const { telegram_id } = req.query;
      const { data: user } = await supabase.from('users').select('*').eq('telegram_id', parseInt(telegram_id)).single();
      const { data: txs } = await supabase.from('transactions').select('txid, amount, status, created_at').eq('telegram_id', parseInt(telegram_id)).order('created_at', { ascending: false }).limit(10);
      return res.json({ user, transactions: txs });
    }

    if (action === 'blockUser' && req.method === 'POST') {
      await supabase.from('users').update({ is_blocked: true }).eq('telegram_id', req.body.telegram_id);
      return res.json({ ok: true });
    }

    if (action === 'unblockUser' && req.method === 'POST') {
      await supabase.from('users').update({ is_blocked: false }).eq('telegram_id', req.body.telegram_id);
      return res.json({ ok: true });
    }

    if (action === 'products') {
      const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      return res.json({ data });
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
      await supabase.from('products').update({ ...updates, updated_at: new Date().toISOString() }).eq('product_id', product_id);
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

    if (action === 'groups') {
      const { data } = await supabase.from('groups').select('*').order('created_at', { ascending: false });
      return res.json({ data });
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

    if (action === 'tickets') {
      const { page = 1, limit = 20, status } = req.query;
      const offset = (parseInt(page) - 1) * parseInt(limit);
      let query = supabase.from('support_tickets').select('id, ticket_number, subject, status, created_at, telegram_id', { count: 'exact' });
      if (status && status !== 'all') query = query.eq('status', status);
      query = query.order('created_at', { ascending: false }).range(offset, offset + parseInt(limit) - 1);
      const { data, count } = await query;
      if (data?.length) {
        const tids = [...new Set(data.map(t => t.telegram_id).filter(Boolean))];
        if (tids.length) {
          const { data: usersData } = await supabase.from('users').select('telegram_id, first_name, username').in('telegram_id', tids);
          const userMap = {};
          usersData?.forEach(u => { userMap[u.telegram_id] = u; });
          data.forEach(t => { t.user = userMap[t.telegram_id] || null; });
        }
      }
      return res.json({ data, total: count, page: parseInt(page), pages: Math.ceil(count / parseInt(limit)) });
    }

    if (action === 'ticketMessages') {
      const { data } = await supabase.from('support_messages').select('*').eq('ticket_id', req.query.ticket_id).order('created_at', { ascending: true });
      return res.json({ data });
    }

    if (action === 'resolveTicket' && req.method === 'POST') {
      await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', req.body.ticket_id);
      return res.json({ ok: true });
    }

    if (action === 'closeTicket' && req.method === 'POST') {
      await supabase.from('support_tickets').update({ status: 'closed' }).eq('id', req.body.ticket_id);
      return res.json({ ok: true });
    }

    if (action === 'broadcasts') {
      const { data } = await supabase.from('broadcast_campaigns').select('*').order('created_at', { ascending: false }).limit(30);
      return res.json({ data });
    }

    if (action === 'cancelBroadcast' && req.method === 'POST') {
      await supabase.from('broadcast_campaigns').update({ status: 'cancelled' }).eq('id', req.body.campaign_id);
      return res.json({ ok: true });
    }

    if (action === 'coupons') {
      const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
      return res.json({ data });
    }

    if (action === 'createCoupon' && req.method === 'POST') {
      const { code, discount_percentage, product_id, max_uses, expires_at } = req.body;
      const { data, error } = await supabase.from('coupons').insert([{ code: code.toUpperCase(), discount_percentage: parseFloat(discount_percentage), product_id: product_id || null, max_uses: max_uses ? parseInt(max_uses) : null, expires_at: expires_at || null, is_active: true, current_uses: 0 }]).select().single();
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

    if (action === 'autoResponses') {
      const { data } = await supabase.from('auto_responses').select('*').order('priority', { ascending: false });
      return res.json({ data });
    }

    if (action === 'createAutoResponse' && req.method === 'POST') {
      const { keyword, response, priority } = req.body;
      const { data, error } = await supabase.from('auto_responses').insert([{ keyword: keyword.toLowerCase(), response, priority: parseInt(priority) || 0, is_active: true, usage_count: 0 }]).select().single();
      if (error) return res.status(400).json({ error: error.message });
      return res.json({ ok: true, data });
    }

    if (action === 'deleteAutoResponse' && req.method === 'DELETE') {
      await supabase.from('auto_responses').delete().eq('id', req.query.id);
      return res.json({ ok: true });
    }

    if (action === 'trustedUsers') {
      const { data } = await supabase.from('trusted_users').select('*').order('created_at', { ascending: false });
      return res.json({ data });
    }

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

    if (action === 'blockedDDDs') {
      const { data } = await supabase.from('blocked_area_codes').select('*').order('area_code');
      return res.json({ data });
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

    if (action === 'stats') {
      const { data: byDayData } = await supabase.from('transactions').select('created_at, amount').eq('status', 'delivered').gte('created_at', new Date(Date.now() - 30*86400000).toISOString());
      const byDay = {};
      byDayData?.forEach(t => { const d = t.created_at.split('T')[0]; byDay[d] = (byDay[d] || 0) + parseFloat(t.amount || 0); });
      const { data: allTx } = await supabase.from('transactions').select('status');
      const byStatus = {};
      allTx?.forEach(t => { byStatus[t.status] = (byStatus[t.status] || 0) + 1; });
      const { data: newUsersData } = await supabase.from('users').select('created_at').gte('created_at', new Date(Date.now() - 30*86400000).toISOString());
      const byDayUsers = {};
      newUsersData?.forEach(u => { const d = u.created_at.split('T')[0]; byDayUsers[d] = (byDayUsers[d] || 0) + 1; });
      return res.json({ byDay, byStatus, byDayUsers });
    }

    return res.status(404).json({ error: 'Action not found: ' + action });

  } catch (err) {
    console.error('[NEXUS-PANEL]', err.message);
    return res.status(500).json({ error: err.message });
  }
};
