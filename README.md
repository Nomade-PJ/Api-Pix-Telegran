# Bot Telegram + PIX (Modo Manual)

Bot Telegram com geração automática de **QR Code PIX** e **Cópia & Cola**, hospedado na **Vercel**. Após receber comprovante de pagamento, permite validação manual e entrega de links/arquivos.

## 🚀 Início Rápido

### 1. Instalação
```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo `env.example` e configure suas variáveis:

**Obrigatórias:**
- `TELEGRAM_BOT_TOKEN` - Token do seu bot (obtenha com @BotFather)
- `TELEGRAM_WEBHOOK_SECRET` - Caminho secreto do webhook (ex: `/tg-hook-abc123`)
- `APP_URL` - URL do seu projeto na Vercel (após deploy)
- `MY_PIX_KEY` - Sua chave PIX para receber pagamentos

**Opcionais:**
- `OPERATOR_CHAT_ID` - ID do operador para receber notificações
- `DELIVERY_BASE_URL` - URL base para entrega de arquivos
- `TRIGGER_SECRET` - Senha para proteger endpoint de entrega

### 3. Deploy na Vercel

1. Conecte seu repositório à Vercel
2. Configure as variáveis de ambiente no painel da Vercel (Settings → Environment Variables)
3. Deploy automático será feito
4. Copie a URL do deploy (ex: `https://seu-projeto.vercel.app`)

### 4. Configurar Webhook do Telegram

Após o deploy, execute localmente (com as variáveis configuradas):

```bash
npm start
```

Ou configure manualmente via URL:
```
https://api.telegram.org/bot{SEU_TOKEN}/setWebhook?url=https://seu-projeto.vercel.app/tg-hook-abc123
```

## 📁 Estrutura do Projeto

```
bot-pix-vercel/
├─ api/
│  ├─ telegram-webhook.js       # Webhook do Telegram
│  └─ trigger-delivery.js       # Endpoint para entrega após validação
├─ src/
│  ├─ bot.js                    # Lógica principal do bot
│  ├─ pix/
│  │  └─ manual.js              # Geração de QR Code e payload PIX
│  └─ deliver.js                # Funções para envio de links/arquivos
├─ scripts/
│  └─ setWebhook.js             # Script para configurar webhook
├─ package.json
└─ README.md
```

## 🎯 Funcionalidades

- ✅ Geração automática de QR Code PIX
- ✅ Payload Cópia & Cola (padrão BR Code)
- ✅ Recebimento de comprovante via foto/documento
- ✅ Notificação ao operador
- ✅ Entrega automatizada via API
- ✅ Hospedagem serverless na Vercel

## 🔄 Fluxo de Uso

1. Usuário inicia conversa com `/start`
2. Escolhe um pack (A ou B)
3. Bot gera QR Code PIX + Cópia & Cola
4. Usuário realiza pagamento e envia comprovante
5. Operador recebe notificação
6. Após validação, chama endpoint `/api/trigger-delivery` com o txid
7. Bot entrega link/arquivo ao usuário

## 🔐 Validação e Entrega

Para validar um pagamento e enviar o conteúdo, faça uma requisição POST:

```bash
curl -X POST https://seu-projeto.vercel.app/api/trigger-delivery \
  -H "Content-Type: application/json" \
  -H "x-trigger-secret: sua_senha_secreta" \
  -d '{"txid": "manual-1234567890", "action": "link"}'
```

**action** pode ser:
- `link` - Envia link de acesso
- `file` - Envia arquivo ZIP

## ⚠️ Importante

### Produção
- **Usar banco de dados** (Supabase/Postgres) em vez de memória para armazenar transações
- **Implementar rate limiting** para evitar spam
- **Usar URLs assinadas** para entrega de arquivos
- **Configurar logs centralizados** para auditoria
- **Validar tamanho dos comprovantes** enviados

### Segurança
- Não exponha `TELEGRAM_BOT_TOKEN` e `TRIGGER_SECRET` em repositórios públicos
- Use webhook secret path difícil de adivinhar
- Implemente validação adicional de comprovantes (OCR, etc.)

## 📦 Dependências

- `telegraf` - Framework para bots do Telegram
- `qrcode` - Geração de QR Codes
- `emv-qrcode` - Criação de payloads PIX (BR Code)
- `axios` - Cliente HTTP

## 🛠️ Desenvolvimento Local

```bash
npm run dev
```

## 📞 Suporte

Para dúvidas sobre configuração ou problemas técnicos, consulte:
- [Documentação Telegraf](https://telegraf.js.org/)
- [Documentação Vercel](https://vercel.com/docs)
- [Especificação PIX](https://www.bcb.gov.br/estabilidadefinanceira/pix)

## ✅ Checklist de Deployment

- [ ] Token do bot configurado
- [ ] Webhook secret definido
- [ ] Chave PIX configurada
- [ ] Variáveis de ambiente na Vercel
- [ ] Deploy realizado com sucesso
- [ ] Webhook configurado no Telegram
- [ ] Teste de compra realizado
- [ ] Operador recebendo notificações
- [ ] Entrega funcionando via API

## 📝 Licença

Este projeto é fornecido como exemplo educacional.

