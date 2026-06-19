/**
 * setup-bot-commands.js
 *
 * Configura o Menu Button e os comandos visíveis do bot no Telegram.
 * Execute UMA VEZ após o deploy ou sempre que mudar os comandos.
 *
 * Uso:
 *   node -r dotenv/config scripts/setup-bot-commands.js
 */

require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN não definido');
  process.exit(1);
}

const BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

const COMMANDS = [
  { command: 'start',         description: '🏠 Exibir menu principal' },
  { command: 'planos',        description: '📋 Ver planos disponíveis' },
  { command: 'status',        description: '✅ Ver minha assinatura' },
  { command: 'meusconteudos', description: '📦 Conteúdos que já comprei' },
  { command: 'suporte',       description: '💬 Precisa de ajuda?' },
  { command: 'sobre',         description: 'ℹ️ Sobre a plataforma' },
  { command: 'criador',       description: '🎛️ Painel do criador' },
  { command: 'admin',         description: '🔐 Painel administrativo' },
];

async function post(method, body) {
  const res = await fetch(`${BASE}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function setup() {
  console.log('🔧 Configurando Menu Button...');
  const menuResult = await post('setChatMenuButton', {
    menu_button: { type: 'commands' }
  });
  console.log(menuResult.ok ? '✅ Menu Button configurado' : `❌ Erro: ${menuResult.description}`);

  console.log('🔧 Registrando comandos...');
  const cmdResult = await post('setMyCommands', {
    commands: COMMANDS,
    scope: { type: 'all_private_chats' }
  });
  console.log(cmdResult.ok ? `✅ ${COMMANDS.length} comandos registrados` : `❌ Erro: ${cmdResult.description}`);
}

setup().catch(err => {
  console.error('❌ Erro inesperado:', err.message);
  process.exit(1);
});
