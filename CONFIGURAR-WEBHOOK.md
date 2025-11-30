# 🔧 CONFIGURAR WEBHOOK - SOLUÇÃO RÁPIDA

## ❌ Problema Identificado

O bot não está recebendo mensagens porque **o webhook não está configurado** para apontar para a URL da Vercel.

Sem webhook configurado = Telegram não envia as mensagens para o bot = Sem logs, sem resposta.

## ✅ Solução Rápida (Escolha UMA opção)

### Opção 1: Via cURL (Mais Rápido) ⚡

Abra o terminal e execute (substitua os valores):

```bash
curl -X POST "https://api.telegram.org/bot{SEU_TOKEN_COMPLETO}/setWebhook?url=https://api-pix-telegran.vercel.app/webhook-secreto-aleatorio"
```

**Exemplo:**
```bash
curl -X POST "https://api.telegram.org/bot123456789:ABCdefGHIjklMNOpqrsTUVwxyz/setWebhook?url=https://api-pix-telegran.vercel.app/webhook-secreto-aleatorio"
```

### Opção 2: Via Navegador 🌐

Cole esta URL no navegador (substitua `{SEU_TOKEN}`):

```
https://api.telegram.org/bot{SEU_TOKEN}/setWebhook?url=https://api-pix-telegran.vercel.app/webhook-secreto-aleatorio
```

Você verá uma resposta JSON:
```json
{
  "ok": true,
  "result": true,
  "description": "Webhook was set"
}
```

### Opção 3: Via Script Node.js 📝

```bash
# No terminal, no diretório do projeto:
node scripts/setWebhook.js
```

## 🔍 Verificar se Funcionou

### 1. Verificar webhook configurado:

```bash
curl "https://api.telegram.org/bot{SEU_TOKEN}/getWebhookInfo"
```

Deve retornar:
```json
{
  "ok": true,
  "result": {
    "url": "https://api-pix-telegran.vercel.app/webhook-secreto-aleatorio",
    "has_custom_certificate": false,
    "pending_update_count": 0
  }
}
```

### 2. Testar no Telegram:

Envie `/start` para o bot. Você deve ver:
- ✅ O bot responde com os produtos
- ✅ Logs aparecem na Vercel em tempo real

## ⚠️ Informações Importantes

### Onde está seu token?

1. **Na Vercel:**
   - Vá em: Settings → Environment Variables
   - Procure por: `TELEGRAM_BOT_TOKEN`

2. **Ou no BotFather:**
   - Abra o Telegram
   - Procure @BotFather
   - Envie `/mybots`
   - Selecione seu bot
   - API Token

### Qual é a URL correta?

Depende de onde você hospedou:

- **Vercel:** `https://api-pix-telegran.vercel.app/webhook-secreto-aleatorio`
- **Hostgator:** `https://seu-dominio.com.br/webhook-secreto-aleatorio`
- **Outro:** Verifique a URL do seu deploy

## 🚀 Após Configurar

1. ✅ Webhook configurado
2. ✅ Logs aparecem na Vercel
3. ✅ Bot responde no Telegram
4. ✅ Tudo funcionando!

---

**💡 Dica:** Após configurar o webhook, aguarde 30 segundos e teste enviando `/start` no Telegram.

