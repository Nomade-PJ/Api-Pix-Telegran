// scripts/setWebhook.js
// Script para configurar o webhook do Telegram

const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.APP_URL || 'https://api-pix-telegran.vercel.app';
const WEBHOOK_PATH = '/webhook-secreto-aleatorio';

if (!BOT_TOKEN) {
  console.error('❌ ERRO: TELEGRAM_BOT_TOKEN não está configurado!');
  console.log('\n📝 Configure a variável de ambiente:');
  console.log('   export TELEGRAM_BOT_TOKEN=seu_token_aqui\n');
  process.exit(1);
}

const webhookFullUrl = `${WEBHOOK_URL}${WEBHOOK_PATH}`;

console.log('🔧 Configurando webhook do Telegram...\n');
console.log(`🤖 Bot Token: ${BOT_TOKEN.substring(0, 10)}...`);
console.log(`🌐 Webhook URL: ${webhookFullUrl}\n`);

// Primeiro, vamos ver o webhook atual
https.get(`https://api.telegram.org/bot${BOT_TOKEN}/getWebhookInfo`, (resp) => {
  let data = '';
  resp.on('data', (chunk) => { data += chunk; });
  resp.on('end', () => {
    const result = JSON.parse(data);
    console.log('📊 Status atual do webhook:');
    console.log(JSON.stringify(result.result, null, 2));
    console.log('\n' + '━'.repeat(60) + '\n');
    
    // Agora vamos configurar o novo webhook
    const setWebhookUrl = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${encodeURIComponent(webhookFullUrl)}`;
    
    https.get(setWebhookUrl, (resp2) => {
      let data2 = '';
      resp2.on('data', (chunk) => { data2 += chunk; });
      resp2.on('end', () => {
        const result2 = JSON.parse(data2);
        
        if (result2.ok) {
          console.log('✅ Webhook configurado com sucesso!');
          console.log(`✅ URL: ${webhookFullUrl}`);
          console.log('\n📱 Teste agora no Telegram enviando /start para o bot!\n');
        } else {
          console.error('❌ Erro ao configurar webhook:');
          console.error(result2);
        }
      });
    }).on('error', (err) => {
      console.error('❌ Erro na requisição:', err.message);
    });
  });
}).on('error', (err) => {
  console.error('❌ Erro na requisição:', err.message);
});
