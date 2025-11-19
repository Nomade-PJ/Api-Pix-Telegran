# ⚡ Comandos Rápidos - Bot PIX

## 🚀 Início Rápido (5 minutos)

### 1. Instalar dependências
```bash
npm install
```

### 2. Criar arquivo .env local (para testes)
```bash
# Copie env.example para .env e edite com seus dados
copy env.example .env
```

**Edite `.env` com:**
- Token do bot (@BotFather)
- Sua chave PIX
- Chat ID (use @userinfobot)

### 3. Testar localmente (opcional)
```bash
npm run dev
```

### 4. Deploy na Vercel
```bash
# Instalar CLI da Vercel
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

### 5. Configurar variáveis na Vercel
No painel da Vercel → Settings → Environment Variables:
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `APP_URL`
- `MY_PIX_KEY`
- `OPERATOR_CHAT_ID`

### 6. Configurar webhook
```bash
npm start
```

## 📋 Comandos Úteis

### Verificar webhook atual
```bash
curl https://api.telegram.org/bot{SEU_TOKEN}/getWebhookInfo
```

### Remover webhook
```bash
curl https://api.telegram.org/bot{SEU_TOKEN}/deleteWebhook
```

### Ver logs da Vercel
```bash
vercel logs
```

### Ver logs de uma função específica
```bash
vercel logs api/telegram-webhook
```

### Testar endpoint de entrega
```bash
curl -X POST https://seu-projeto.vercel.app/api/trigger-delivery \
  -H "Content-Type: application/json" \
  -H "x-trigger-secret: sua_senha" \
  -d '{"txid": "manual-123", "action": "link"}'
```

## 🔧 Comandos de Desenvolvimento

### Rodar localmente
```bash
vercel dev
```

### Build do projeto
```bash
vercel build
```

### Fazer redeploy
```bash
vercel --prod
```

## 📱 Comandos do Bot (no Telegram)

### Para usuários:
- `/start` - Iniciar conversa e ver opções

### Fluxo:
1. Clicar em botão de compra
2. Receber QR Code + Cópia & Cola
3. Fazer pagamento
4. Enviar foto do comprovante
5. Aguardar validação

## 🛠️ Troubleshooting

### Bot não responde?
```bash
# Verificar webhook
curl https://api.telegram.org/bot{TOKEN}/getWebhookInfo

# Ver logs
vercel logs
```

### Erro no deploy?
```bash
# Limpar cache
vercel --force

# Redeployar
vercel --prod
```

### QR Code não aparece?
- Verifique `MY_PIX_KEY` nas env vars
- Veja logs: `vercel logs api/telegram-webhook`

## 📊 Monitoramento

### Ver logs em tempo real
```bash
vercel logs --follow
```

### Ver todas as funções
```bash
vercel ls
```

### Ver detalhes do projeto
```bash
vercel inspect
```

## 🔐 Obter informações do Telegram

### Seu Chat ID
1. Fale com @userinfobot
2. Copie o número retornado

### Chat ID de um grupo
1. Adicione @userinfobot ao grupo
2. Ele mostrará o ID do grupo

### Token do bot
1. Fale com @BotFather
2. `/mybots` → Escolha seu bot → API Token

## 📦 Estrutura de Resposta da API

### Webhook Info (sucesso):
```json
{
  "ok": true,
  "result": {
    "url": "https://seu-projeto.vercel.app/tg-hook-seg123",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### Trigger Delivery (sucesso):
```json
{
  "ok": true
}
```

## 🎯 Exemplo Completo de Setup

```bash
# 1. Clone/baixe o projeto
cd bot-pix-vercel

# 2. Instale dependências
npm install

# 3. Deploy na Vercel
vercel

# 4. Copie a URL do deploy
# https://meu-bot-abc123.vercel.app

# 5. Configure variáveis na Vercel (via painel web)

# 6. Crie .env local para configurar webhook
echo TELEGRAM_BOT_TOKEN=123456:ABC-DEF > .env
echo TELEGRAM_WEBHOOK_SECRET=/tg-hook-seg123 >> .env
echo APP_URL=https://meu-bot-abc123.vercel.app >> .env

# 7. Configure webhook
npm start

# 8. Teste no Telegram
# Procure seu bot e envie /start
```

## ✅ Checklist Rápido

- [ ] `npm install` executado
- [ ] Deploy na Vercel feito
- [ ] Variáveis configuradas na Vercel
- [ ] Webhook configurado
- [ ] Bot responde ao `/start`
- [ ] QR Code sendo gerado
- [ ] Comprovante sendo recebido
- [ ] Notificação chegando ao operador
- [ ] Entrega via API funcionando

## 🆘 Ajuda Rápida

**Bot não responde:**
→ Verifique webhook: `getWebhookInfo`

**QR Code não aparece:**
→ Confira `MY_PIX_KEY` nas env vars

**Comprovante não notifica:**
→ Confira `OPERATOR_CHAT_ID`

**Erro 403 no webhook:**
→ Verifique `TELEGRAM_WEBHOOK_SECRET`

**Entrega não funciona:**
→ Confira `TRIGGER_SECRET` no header

---

📖 **Documentação completa:** `INSTALACAO.md`
📝 **Código do projeto:** `README.md`

