# Bot Telegram + PIX (Modo **B — Manual**) — **Arquivo Markdown Completo**
> Projeto: Bot Telegram (Node.js + Telegraf) hospedado na **Vercel**, com geração automática de **QR Code** e **Cópia & Cola** (modo manual de PIX). Após envio do comprovante, o bot processa e entrega **link** e/ou **arquivo**. Inclui roteiro para automação estilo *n8n* (opcional).

---

## Sumário
1. Visão geral  
2. Requisitos & dependências  
3. Estrutura do projeto  
4. Variáveis de ambiente (Vercel)  
5. Código completo (arquivos)  
6. Como configurar o bot no Telegram (token + webhook)  
7. Deploy na Vercel — passo a passo  
8. Fluxo *n8n* (orquestração recomendada)  
9. Testes & validação  
10. Checklist final e dicas de segurança

---

## 1) Visão geral
Este projeto entrega um bot capaz de:
- Apresentar botões (packs, grupo, etc.).  
- Gerar cobrança no **modo manual** (B): cria **QR Code** + payload Cópia & Cola usando chave PIX e valor.  
- Receber comprovante (foto/arquivo) do usuário no chat.  
- Permitir validação manual (pelo operador) ou automatizada com OCR/integração externa.  
- Enviar **link** (ex.: Google Drive, link temporário) ou **arquivo** no Telegram após validação.  
- Hospedar todo webhook na **Vercel** usando funções serverless (API routes).

---

## 2) Requisitos & dependências
- Node.js 16+  
- Conta no Telegram e um Bot Token (via @BotFather)  
- Conta Vercel (gratuita suficiente)  
- Se desejar, n8n (self-host ou cloud) para orquestrar webhooks e logs

**Dependências npm (sugeridas):**
```json
{
  "telegraf": "^4.12.2",
  "axios": "^1.4.0",
  "qrcode": "^1.5.1",
  "emv-qrcode": "^1.0.6",   // para criar payload EMV (Cópia & Cola)
  "form-data": "^4.0.0"     // opcional para upload a PSP ou storage
}
```

> Observação: `emv-qrcode` (ou equivalente) gera o payload EMV (padrão BR) para o QR Pix — facilita gerar cópia & cola correta. Se preferir, pode montar payload manualmente, mas recomenda-se lib.

---

## 3) Estrutura do projeto
```
bot-pix-vercel/
├─ api/
│  ├─ telegram-webhook.js       # webhook do Telegram (Vercel)
│  └─ trigger-delivery.js       # endpoint para triggerar entrega (internal)
├─ src/
│  ├─ bot.js                    # lógica do bot (handlers, keyboards)
│  ├─ pix/
│  │  └─ manual.js              # criação de QR e payload copia&cola (Modo B)
│  └─ deliver.js                # funções para enviar link/arquivo via Telegram
├─ utils/
│  └─ qrcode.js                 # wrapper qrcode -> gera PNG/DataURL
├─ scripts/
│  └─ setWebhook.js             # script local para setWebhook (uma vez)
├─ package.json
└─ README.md (este arquivo)
```

---

## 4) Variáveis de ambiente (Vercel)
No painel do seu projeto na Vercel adicione (Settings → Environment Variables):

```
TELEGRAM_BOT_TOKEN=xxxxx
TELEGRAM_WEBHOOK_SECRET=/telegram-webhook-secret   # caminho do webhook (ex: /tg-hook-abc123)
APP_URL=https://<seu-projeto>.vercel.app           # URL do deploy
MY_PIX_KEY=seu_chave_pix@seudominio.com.br         # chave PIX que irá receber pagamentos
DEFAULT_CURRENCY=BRL
DEFAULT_LOCALE=pt-BR
DELIVERY_BASE_URL=https://storage-ou-linkbase/      # opcional, se entregar links
OPERATOR_CHAT_ID=123456789                         # chatId do operador (para notificações)
TRIGGER_SECRET=uma_senha_secreta_para_trigger      # opcional, para proteger trigger-delivery
```

> **Importante:** não exponha tokens e chaves em repositórios públicos.

---

## 5) Código completo (copie e cole nos arquivos correspondentes)

### `package.json`
```json
{
  "name": "bot-pix-vercel",
  "version": "1.0.0",
  "main": "src/bot.js",
  "scripts": {
    "start": "node scripts/setWebhook.js",
    "dev": "vercel dev"
  },
  "dependencies": {
    "telegraf": "^4.12.2",
    "axios": "^1.4.0",
    "qrcode": "^1.5.1",
    "emv-qrcode": "^1.0.6",
    "form-data": "^4.0.0"
  }
}
```

---

### `api/telegram-webhook.js`  
(Vercel serverless handler - trata updates do Telegram)
```js
// api/telegram-webhook.js
const { Telegraf } = require('telegraf');
const BotLogic = require('../src/bot');

const bot = BotLogic.createBot(process.env.TELEGRAM_BOT_TOKEN);

// Vercel handler
module.exports = async (req, res) => {
  try {
    // Seguridad por path:
    if (req.url !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return res.status(403).send('Forbidden');
    }
    // O body do Telegram vem como application/json
    await bot.handleUpdate(req.body);
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).send('Error');
  }
};
```

> No Vercel, o arquivo `api/telegram-webhook.js` expõe o endpoint `https://<app>/api/telegram-webhook.js` — por isso usamos `TELEGRAM_WEBHOOK_SECRET` para exigir o caminho exato.

---

### `src/bot.js`
(centraliza Telegraf, handlers e integração com pix/manual)
```js
// src/bot.js
const { Telegraf, Markup } = require('telegraf');
const manualPix = require('./pix/manual');
const deliver = require('./deliver');

function createBot(token) {
  const bot = new Telegraf(token);

  bot.start((ctx) => {
    const text = `Olá! Bem-vindo. Escolha uma opção:`;
    return ctx.reply(text, Markup.inlineKeyboard([
      [Markup.button.callback('Comprar Pack A (R$30)', 'buy:packA')],
      [Markup.button.callback('Comprar Pack B (R$50)', 'buy:packB')],
      [Markup.button.url('Entrar no grupo', 'https://t.me/seugrupo')]
    ]));
  });

  bot.action(/buy:(.+)/, async (ctx) => {
    try {
      const productId = ctx.match[1];
      const chatId = ctx.chat.id;
      // Definir preço por produto (exemplo simples)
      const prices = { packA: "30.00", packB: "50.00" };
      const amount = prices[productId] || "10.00";

      // Criar cobrança modo manual (B)
      const resp = await manualPix.createManualCharge({ amount, productId });
      const charge = resp.charge;

      // Salvar mapping txid -> chatId (simples memória) - ideal: usar DB (Supabase/Postgres)
      const txid = charge.txid || `manual_${Date.now()}_${chatId}`;
      // **Você deve guardar isso em DB.**
      // Para demo, salvamos na memória (não recomendado para produção)
      global._TXS = global._TXS || {};
      global._TXS[txid] = { chatId, productId, amount, charge };

      // Enviar QRCode + copia&cola e instruções
      if (charge.qrcodeDataUrl) {
        await ctx.replyWithPhoto({ url: charge.qrcodeDataUrl }, {
          caption: `Pague **R$ ${amount}** usando PIX
Chave: ${charge.key}
Copia & Cola:
\`\`\`${charge.copiaCola}\`\`\`

Após pagar, envie o comprovante (foto) aqui.
TXID: ${txid}`,
          parse_mode: 'Markdown'
        });
      } else {
        await ctx.reply(`Pague R$ ${amount} na chave: ${charge.key}
Copia & Cola:
${charge.copiaCola}
Envie o comprovante quando pagar.
TXID: ${txid}`);
      }
    } catch (err) {
      console.error('Error on buy:', err);
      await ctx.reply('Ocorreu um erro ao gerar a cobrança. Tente novamente mais tarde.');
    }
  });

  // Receber comprovante (foto ou documento)
  bot.on(['photo', 'document'], async (ctx) => {
    try {
      const chatId = ctx.chat.id;
      // pegar último txid vinculado a este chat (simples exemplo)
      // Ideal: usar DB para mapping; aqui, procura por txid mais recente do chat
      let txid;
      if (global._TXS) {
        txid = Object.keys(global._TXS).reverse().find(t => global._TXS[t].chatId === chatId);
      }
      if (!txid) {
        await ctx.reply('Não localizei uma cobrança pendente. Se pagou, envie o TXID ou entre em contato com suporte.');
        return;
      }

      // Salvar info do comprovante (por simplicidade, apenas notificar operador)
      const operatorId = process.env.OPERATOR_CHAT_ID;
      if (operatorId) {
        const fileId = ctx.message.photo ? ctx.message.photo.slice(-1)[0].file_id : (ctx.message.document && ctx.message.document.file_id);
        await ctx.telegram.sendMessage(operatorId, `Novo comprovante recebido.
ChatId: ${chatId}
TXID: ${txid}
FileId: ${fileId}`);
        await ctx.reply('Comprovante recebido. Em breve validaremos e liberaremos seu acesso.');
      } else {
        await ctx.reply('Comprovante recebido. Porém não há operador configurado para validar automaticamente.');
      }
      // Opcional: armazenar fileId em DB para posterior análise.
      global._TXS[txid].proof = true;
    } catch (err) {
      console.error('Error receiving proof:', err);
      await ctx.reply('Erro ao receber comprovante. Tente novamente.');
    }
  });

  // Endpoint auxiliar para trigger delivery via HTTP (usado por operador/n8n)
  // NOTA: a chamada para envio final será feita via api/trigger-delivery.js
  return bot;
}

module.exports = { createBot };
```

---

### `src/pix/manual.js`  
(Gera payload Cópia & Cola e QR Code com `emv-qrcode` + `qrcode`)
```js
// src/pix/manual.js
const EMV = require('emv-qrcode'); // biblioteca para montar EMV BR (BR Code)
const QRCode = require('qrcode');

async function createManualCharge({ amount = "10.00", productId }) {
  const key = process.env.MY_PIX_KEY;
  if (!key) throw new Error('MY_PIX_KEY não configurada.');

  // Gerar txid
  const txid = `manual-${Date.now()}`;

  // Montar objeto EMV conforme documentação da lib
  // Nota: a API da lib pode variar; adapte conforme a versão instalada.
  const payloadObj = {
    pixKey: key,
    amount: parseFloat(amount).toFixed(2),
    txid
  };

  // Utilizando 'emv-qrcode' (API hipotética) para criar BR Code string
  // Caso a API do pacote seja diferente, adapte aqui.
  const brCode = EMV.PixBR({ pixKey: key, amount: payloadObj.amount, txid: payloadObj.txid }).toString();
  const copiaCola = brCode;

  // Gerar data URL do QR code (PNG)
  const qrcodeDataUrl = await QRCode.toDataURL(copiaCola);

  return {
    mode: 'manual',
    charge: {
      txid,
      key,
      amount: payloadObj.amount,
      copiaCola,
      qrcodeDataUrl
    }
  };
}

module.exports = { createManualCharge };
```

> **Obs.:** `emv-qrcode` aqui é uma sugestão — caso a versão exata do pacote varie, adapte o código conforme a API da lib escolhida. A ideia principal: obter a string do payload BRCode para gerar o QR.

---

### `src/deliver.js`
(Enviar link ou arquivo para o usuário)
```js
// src/deliver.js
const { Telegram } = require('telegraf');

const tg = new Telegram(process.env.TELEGRAM_BOT_TOKEN);

async function deliverByLink(chatId, link, caption = 'Aqui está seu acesso:') {
  return tg.sendMessage(chatId, `${caption}
${link}`);
}

async function deliverFile(chatId, fileUrl, filename = 'pack.zip') {
  // Envia documento via URL
  return tg.sendDocument(chatId, { url: fileUrl }, { filename });
}

module.exports = { deliverByLink, deliverFile };
```

---

### `api/trigger-delivery.js`  
(Endpoint para operador / n8n chamar quando pagamento validado)
```js
// api/trigger-delivery.js
const deliver = require('../src/deliver');

module.exports = async (req, res) => {
  try {
    // Segurança: adicionar secret header se desejar
    const secret = req.headers['x-trigger-secret'];
    if (process.env.TRIGGER_SECRET && secret !== process.env.TRIGGER_SECRET) {
      return res.status(403).send('Forbidden');
    }

    const { txid, action } = req.body;
    if (!txid) return res.status(400).send('txid required');

    // recuperar mapping (no exemplo, usamos memória)
    const txs = global._TXS || {};
    if (!txs[txid]) return res.status(404).send('txid not found');

    const record = txs[txid];
    const chatId = record.chatId;
    const productId = record.productId;

    // Ex.: se preferir enviar link
    if (action === 'link') {
      const link = `${process.env.DELIVERY_BASE_URL}/${productId}`; // ajustar
      await deliver.deliverByLink(chatId, link, 'Acesso liberado! Seu link:');
    } else {
      // enviar arquivo
      const fileUrl = `${process.env.DELIVERY_BASE_URL}/${productId}.zip`;
      await deliver.deliverFile(chatId, fileUrl, `${productId}.zip`);
    }

    // marcar como entregue
    record.delivered = true;
    return res.status(200).send({ ok: true });
  } catch (err) {
    console.error('trigger deliver err', err);
    return res.status(500).send('error');
  }
};
```

---

### `scripts/setWebhook.js`  
(Script local para configurar webhook junto ao Telegram — execute uma vez localmente)
```js
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
```

> **Como usar:** localmente, defina as env vars e rode `node scripts/setWebhook.js`. Após deploy, pode rodar localmente para vincular o webhook à URL pública da Vercel.

---

## 6) Como configurar o bot no Telegram
1. Crie o bot com @BotFather → pegue `TELEGRAM_BOT_TOKEN`.  
2. No Vercel, defina `TELEGRAM_BOT_TOKEN` e `TELEGRAM_WEBHOOK_SECRET` e `APP_URL`.  
   - `TELEGRAM_WEBHOOK_SECRET` deve ser algo como `/tg-hook-abc123` (inclua a barra inicial).  
3. No seu computador (com as env vars apontando para APP_URL), execute `node scripts/setWebhook.js` para apontar o webhook do Telegram para `https://<app>.vercel.app/tg-hook-abc123`.  
4. Alternativa: você pode usar a API `setWebhook` diretamente pelo navegador ou terminal com `curl`.

---

## 7) Deploy na Vercel — passo a passo
1. Crie repositório Git com esse projeto.  
2. No Vercel, crie um novo projeto e conecte ao repositório.  
3. Em **Settings → Environment Variables**, adicione todas as variáveis listadas na seção 4.  
4. Deploy automático será feito ao push; quando o deploy terminar, obtenha `APP_URL`.  
5. Execute localmente `node scripts/setWebhook.js` (com APP_URL apontando para a URL do deploy) para definir o webhook do Telegram. (Execute apenas uma vez; se redefinir, execute novamente).  
6. Teste o bot enviando `/start` no Telegram.

---

## 8) Fluxo *n8n* (sugestão de orquestração)
Mesmo no modo manual, n8n é útil para auditoria, notificações e entrega.

**Exemplo de workflow:**
1. **HTTP Webhook Node** — expõe um endpoint público (ou privado) que o operador usa para confirmar pagamento (ex.: `/confirm-payment`).  
2. **Function Node** — recebe `{ txid, action }` e valida (checa DB ou mapeamento txid→chatId).  
3. **HTTP Request Node** — chama `https://<app>/api/trigger-delivery` com `{txid, action}` e `x-trigger-secret` no header.  
4. **Google Sheets / Postgres Node** — registra a venda com timestamp.  
5. **Telegram Node** (opcional) — notifica operador/vendedor que envio foi realizado.

**Uso prático:** Quando cliente envia comprovante, operador no Telegram pode abrir painel n8n e confirmar (ou usar botão inline que chama backend), o n8n dispara `trigger-delivery` e o bot entrega o arquivo.

---

## 9) Testes & validação
- Teste geração de QR Code e copia&cola: confirme que o QR abre no app bancário e preenche valor/chave corretamente.  
- Teste upload de comprovante: envie foto e confirme operador recebe notificação com file_id.  
- Teste entrega via endpoint `api/trigger-delivery` chamando manualmente (curl / Postman) com `txid` retornado pelo bot.  
- Teste comportamento em mensagens duplicadas e confirme idempotência (importantíssimo para evitar envios duplos).

---

## 10) Checklist final e boas práticas
- [ ] Configurar `OPERATOR_CHAT_ID` (ID do operador) para receber notificações.  
- [ ] Substituir armazenamento em memória (`global._TXS`) por DB (Supabase/Postgres).  
- [ ] Usar links temporários (signed URLs) para arquivos entregues.  
- [ ] Implementar rate limiting e validação de size do arquivo do comprovante.  
- [ ] Criar rota admin para o operador marcar como validado (ou integrar com n8n).  
- [ ] Testar em um ambiente fechado antes de liberar para clientes reais.  
- [ ] Registrar logs (Centralizado) para auditoria de pagamentos e entregas.  
- [ ] Definir política clara de reembolso/contestação e comunicar ao comprador.

---

## Extras — Modelos de mensagens que você pode usar
- Mensagem inicial:
  > Olá, sou o bot oficial. Para comprar, escolha o pack. Após pagamento via PIX, envie comprovante aqui e liberaremos seu acesso.
- Mensagem após envio de comprovante:
  > Comprovante recebido — iremos validar em até X minutos. Você será notificado aqui. Se quiser acelerar, entre em contato com suporte.

---

## Observações finais
- Este arquivo fornece um **fluxo completo no modo B (manual)** conforme solicitado — simples, rápido e sem necessidade de integração imediata com PSP.  
- Recomendo **implementar DB** desde o início (mesmo que gratuito: Supabase) para mapear `txid ↔ chatId` e armazenar status (`pending`, `proof_received`, `validated`, `delivered`).  
- Caso futuramente queira migrar para **Opção A (automático com PSP)**, é tranquilo — manter o mesmo fluxo de `txid` e `api/trigger-delivery` facilita a transição.

---

Se quiser que eu também gere uma versão compacta do README (apenas comandos de deploy e variáveis) ou um arquivo ZIP com o esqueleto do projeto, eu posso gerar aqui mesmos os arquivos prontos para download.

