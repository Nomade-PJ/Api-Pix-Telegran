// scripts/setWebhook.js
const axios = require('axios');

async function setWebhook() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const webhookPath = process.env.TELEGRAM_WEBHOOK_SECRET;
  const appUrl = process.env.APP_URL;
  if (!token || !webhookPath || !appUrl) {
    console.error('Configure TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET e APP_URL');
    process.exit(1);
  }
  const webhookUrl = `${appUrl}${webhookPath}`;
  const res = await axios.get(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(webhookUrl)}&allowed_updates=["message","callback_query"]`);
  console.log('setWebhook result:', res.data);
}

setWebhook().catch(err => {
  console.error(err);
  process.exit(1);
});

