/**
 * sender.js — Envia mensagem com imagem via Telegram
 * Usa multipart upload (buffer) para 100% de confiabilidade
 */
const axios   = require('axios');
const TG_BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;

const esperar = (ms) => new Promise(r => setTimeout(r, ms));

// ── Baixar imagem do Supabase como buffer ─────────────────────────────────
async function downloadBuffer(url) {
  const r = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 30000,
    maxContentLength: Infinity,
  });
  return Buffer.from(r.data);
}

// ── Enviar texto simples ──────────────────────────────────────────────────
async function sendText(chatId, text, buttons) {
  const body = {
    chat_id:    chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  };
  if (buttons) body.reply_markup = { inline_keyboard: buttons };

  const res  = await fetch(`${TG_BASE}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const json = await res.json();
  if (!json.ok) {
    const err = new Error(json.description || 'sendMessage error');
    err.tgCode = json.error_code;
    throw err;
  }
  return json.result;
}

// ── Enviar foto com caption ───────────────────────────────────────────────
async function sendPhoto(chatId, imageUrl, caption, buttons) {
  try {
    const buffer = await downloadBuffer(imageUrl);

    const form = new FormData();
    form.append('chat_id',    String(chatId));
    form.append('caption',    caption || '');
    form.append('parse_mode', 'Markdown');
    if (buttons) form.append('reply_markup', JSON.stringify({ inline_keyboard: buttons }));
    form.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'preview.jpg');

    const res  = await fetch(`${TG_BASE}/sendPhoto`, { method: 'POST', body: form });
    const json = await res.json();
    if (!json.ok) {
      const err = new Error(json.description || 'sendPhoto error');
      err.tgCode = json.error_code;
      throw err;
    }
    return json.result;
  } catch (err) {
    // Se falhar upload, tenta só texto
    if (!err.tgCode) {
      console.warn(`  ⚠️  sendPhoto falhou (${err.message}), enviando só texto`);
      return sendText(chatId, caption || '', buttons);
    }
    throw err;
  }
}

// ── Função principal de envio com retry 429 ───────────────────────────────
async function send(chatId, text, imageUrl, buttons, tentativa = 1) {
  try {
    if (imageUrl) {
      return await sendPhoto(chatId, imageUrl, text, buttons);
    } else {
      return await sendText(chatId, text, buttons);
    }
  } catch (err) {
    const code = err.tgCode || 0;

    if (code === 429 && tentativa <= 3) {
      console.log(`  ⏳ Rate limit — aguardando 15s (tentativa ${tentativa}/3)...`);
      await esperar(15000);
      return send(chatId, text, imageUrl, buttons, tentativa + 1);
    }

    throw err; // propaga para o scheduler tratar
  }
}

module.exports = { send, sendText, sendPhoto };
