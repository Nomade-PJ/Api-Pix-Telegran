// broadcast_pix.js
// Disparo automático para 3.771 usuários elegíveis
// Mensagem com botões de produto — ao clicar, gera PIX automaticamente
//
// Como usar:
//   node broadcast_pix.js
//
// Variáveis de ambiente necessárias (já existem no .env do projeto):
//   TELEGRAM_BOT_TOKEN
//   SUPABASE_URL
//   SUPABASE_SERVICE_KEY  (ou SUPABASE_KEY)

require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Configurações de disparo ───────────────────────────────────────────────
const DELAY_MS        = 50;   // ms entre cada usuário (20/seg — seguro p/ Telegram)
const BATCH_LOG_EVERY = 100;  // logar progresso a cada N usuários

// ── Mensagem ───────────────────────────────────────────────────────────────
const TEXTO = `Ei, saudades de mim? 😏🔥

Sou a Val, e voltei com tudo no meu bot novinho 🌶️

Tem conteúdo fresquinho te esperando, amor...
Olha só o que eu preparei pra você:

💫 Destaques da Semana — R$ 19
🎥 Bastidores Exclusivos — R$ 25
🔥 Surpresa Premium — R$ 29
✨ Essencial Premium — R$ 30
🎯 Mix Especial (MAIS ESCOLHIDO) — R$ 35
💌 Conteúdo Personalizado — R$ 45
🔥 Conteúdo VIP — R$ 50
💎 Pacote Completo — R$ 79

Tem pra todos os gostos e bolsos 😈
Do mais suave ao mais ousado...

👇 Clica no produto que você quer e eu já gero o pagamento pra você:`;

// ── Botões inline — cada clique abre o bot no produto ─────────────────────
// Formato: t.me/BOT?start=produto_PRODUCTID
// O bot já tem handler para /start com parâmetro deep link
const INLINE_KEYBOARD = {
  inline_keyboard: [
    [
      { text: '💫 Destaques — R$19',   url: 'https://t.me/acessoval_bot?start=produto_destaquesdasemana' },
      { text: '🎥 Bastidores — R$25',  url: 'https://t.me/acessoval_bot?start=produto_bastidoresexclusivos' }
    ],
    [
      { text: '🔥 Surpresa — R$29',    url: 'https://t.me/acessoval_bot?start=produto_surpresapremium' },
      { text: '✨ Essencial — R$30',   url: 'https://t.me/acessoval_bot?start=produto_essencialpremium' }
    ],
    [
      { text: '🎯 Mix Especial — R$35', url: 'https://t.me/acessoval_bot?start=produto_mixespecialmaisescol' }
    ],
    [
      { text: '💌 Personalizado — R$45', url: 'https://t.me/acessoval_bot?start=produto_conteudopersonalizad' },
      { text: '🔥 VIP — R$50',           url: 'https://t.me/acessoval_bot?start=produto_conteudovip' }
    ],
    [
      { text: '💎 Pacote Completo — R$79', url: 'https://t.me/acessoval_bot?start=produto_pacotecompleto' }
    ]
  ]
};

// ── Buscar usuários elegíveis do banco ────────────────────────────────────
async function getEligibleUsers() {
  console.log('🔍 Buscando usuários elegíveis no banco...');

  const { data, error } = await supabase
    .from('users')
    .select('telegram_id, first_name')
    .eq('is_admin', false)
    .eq('is_creator', false)
    .eq('is_blocked', false)
    .not('phone_number', 'is', null)
    .not('phone_number', 'like', '+5564%')
    .not('phone_number', 'like', '5564%')
    .not('phone_number', 'like', '+5586%')
    .not('phone_number', 'like', '5586%')
    .not('phone_number', 'like', '+5598%')
    .not('phone_number', 'like', '5598%');

  if (error) throw new Error(`Erro ao buscar usuários: ${error.message}`);

  console.log(`✅ ${data.length} usuários elegíveis encontrados`);
  return data;
}

// ── Enviar mensagem para um usuário ──────────────────────────────────────
async function sendMessage(telegramId) {
  try {
    await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`,
      {
        chat_id: telegramId,
        text: TEXTO,
        parse_mode: 'Markdown',
        reply_markup: INLINE_KEYBOARD
      },
      { timeout: 10000 }
    );
    return 'ok';
  } catch (err) {
    const status = err.response?.data?.error_code;
    if (status === 403) return 'blocked';   // bot bloqueado pelo usuário
    if (status === 400) return 'invalid';   // chat não encontrado
    return 'error';
  }
}

// ── Registrar resultado na campanha ──────────────────────────────────────
async function updateCampaign(campaignId, sent, failed) {
  await supabase
    .from('broadcast_campaigns')
    .update({
      sent_count:   sent,
      failed_count: failed,
      status:       'sent',
      sent_at:      new Date().toISOString()
    })
    .eq('id', campaignId);
}

// ── Loop principal de disparo ─────────────────────────────────────────────
async function run() {
  console.log('🚀 Iniciando broadcast...\n');

  const CAMPAIGN_ID = '6e71d3e8-7335-4913-a45d-5fe9bc170fef'; // criada anteriormente

  const users = await getEligibleUsers();
  const total = users.length;

  let sent    = 0;
  let blocked = 0;
  let errors  = 0;
  const startTime = Date.now();

  for (let i = 0; i < total; i++) {
    const user = users[i];
    const result = await sendMessage(user.telegram_id);

    if (result === 'ok')      sent++;
    else if (result === 'blocked' || result === 'invalid') blocked++;
    else errors++;

    // Log de progresso
    if ((i + 1) % BATCH_LOG_EVERY === 0 || i === total - 1) {
      const elapsed  = ((Date.now() - startTime) / 1000).toFixed(0);
      const pct      = (((i + 1) / total) * 100).toFixed(1);
      const eta      = total > i + 1
        ? Math.round(((Date.now() - startTime) / (i + 1)) * (total - i - 1) / 1000)
        : 0;
      console.log(
        `📊 ${i + 1}/${total} (${pct}%) | ✅ ${sent} | ❌ ${blocked + errors} | ⏱ ${elapsed}s | ETA ~${eta}s`
      );
    }

    // Delay entre envios para respeitar rate limit do Telegram
    if (i < total - 1) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  // Atualizar status da campanha no banco
  await updateCampaign(CAMPAIGN_ID, sent, blocked + errors);

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log('\n🎉 BROADCAST CONCLUÍDO!');
  console.log(`✅ Enviados com sucesso: ${sent}`);
  console.log(`🚫 Bloqueados/inválidos: ${blocked}`);
  console.log(`❌ Erros:               ${errors}`);
  console.log(`⏱  Tempo total:          ${totalTime}s`);
}

run().catch(err => {
  console.error('❌ Erro fatal:', err.message);
  process.exit(1);
});
