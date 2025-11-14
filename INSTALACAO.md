# 📖 Guia de Instalação - Bot Telegram PIX

## Passo 1️⃣: Criar o Bot no Telegram

1. Abra o Telegram e procure por `@BotFather`
2. Envie o comando `/newbot`
3. Escolha um nome para seu bot (ex: "Meu Bot PIX")
4. Escolha um username (deve terminar com "bot", ex: "meubotpix_bot")
5. **Copie o token** que o BotFather vai te enviar (formato: `123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`)

## Passo 2️⃣: Obter seu Chat ID (para receber notificações)

1. Procure por `@userinfobot` no Telegram
2. Envie qualquer mensagem
3. **Copie seu Chat ID** (será um número como `123456789`)

## Passo 3️⃣: Preparar o Projeto

### Clonar/Baixar este projeto
```bash
# Se você ainda não tem os arquivos localmente
cd bot-pix-vercel
```

### Instalar dependências
```bash
npm install
```

## Passo 4️⃣: Fazer Deploy na Vercel

### Opção A: Via Interface Web

1. Acesse [vercel.com](https://vercel.com)
2. Faça login/cadastro (pode usar GitHub)
3. Clique em "Add New" → "Project"
4. Importe seu repositório (ou faça upload dos arquivos)
5. Clique em "Deploy"

### Opção B: Via CLI (recomendado)

```bash
# Instalar Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel
```

Siga as instruções. Ao final, você receberá uma URL como:
```
https://seu-projeto-abc123.vercel.app
```

**⚠️ COPIE ESTA URL! Você vai precisar dela.**

## Passo 5️⃣: Configurar Variáveis de Ambiente na Vercel

1. No painel da Vercel, abra seu projeto
2. Vá em **Settings** → **Environment Variables**
3. Adicione as seguintes variáveis:

### Variáveis Obrigatórias:

| Nome | Valor | Descrição |
|------|-------|-----------|
| `TELEGRAM_BOT_TOKEN` | `123456:ABC-DEF...` | Token do BotFather |
| `TELEGRAM_WEBHOOK_SECRET` | `/tg-hook-seg123` | Caminho secreto (invente um único) |
| `APP_URL` | `https://seu-projeto.vercel.app` | URL do seu deploy |
| `MY_PIX_KEY` | `seuemail@exemplo.com` | Sua chave PIX |

### Variáveis Opcionais (mas recomendadas):

| Nome | Valor | Descrição |
|------|-------|-----------|
| `OPERATOR_CHAT_ID` | `123456789` | Seu Chat ID para notificações |
| `TRIGGER_SECRET` | `senha_forte_123` | Senha para endpoint de entrega |
| `DELIVERY_BASE_URL` | `https://seusite.com/files` | URL base dos arquivos |

4. Clique em **Save**
5. A Vercel vai **re-deployar automaticamente** com as novas variáveis

## Passo 6️⃣: Configurar o Webhook do Telegram

Agora você precisa dizer ao Telegram onde seu bot está hospedado.

### Opção A: Usando o script (recomendado)

1. Crie um arquivo `.env` local com suas variáveis:

```bash
# .env
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_WEBHOOK_SECRET=/tg-hook-seg123
APP_URL=https://seu-projeto.vercel.app
```

2. Execute o script:
```bash
npm start
```

Você deve ver: `setWebhook result: { ok: true, result: true, description: 'Webhook was set' }`

### Opção B: Via URL no navegador

Substitua os valores e acesse no navegador:

```
https://api.telegram.org/bot{SEU_TOKEN}/setWebhook?url={APP_URL}{WEBHOOK_SECRET}
```

**Exemplo:**
```
https://api.telegram.org/bot123456:ABC-DEF/setWebhook?url=https://meu-bot.vercel.app/tg-hook-seg123
```

Você deve ver:
```json
{"ok":true,"result":true,"description":"Webhook was set"}
```

## Passo 7️⃣: Testar o Bot

1. Abra o Telegram
2. Procure pelo username do seu bot (ex: `@meubotpix_bot`)
3. Envie `/start`
4. Você deve ver os botões de compra!

### Testar fluxo completo:

1. Clique em "Comprar Pack A"
2. O bot deve enviar:
   - QR Code PIX
   - Código Cópia & Cola
   - Instruções de pagamento
3. Envie qualquer foto como "comprovante"
4. Se configurou `OPERATOR_CHAT_ID`, você receberá notificação

## Passo 8️⃣: Validar e Entregar Conteúdo

Quando um cliente pagar de verdade:

1. Você receberá a notificação com o **TXID**
2. Para liberar o acesso, faça uma requisição:

```bash
curl -X POST https://seu-projeto.vercel.app/api/trigger-delivery \
  -H "Content-Type: application/json" \
  -H "x-trigger-secret: sua_senha_secreta" \
  -d '{
    "txid": "manual-1234567890",
    "action": "link"
  }'
```

3. O cliente receberá o link/arquivo automaticamente!

## 🎉 Pronto!

Seu bot está funcionando! Agora você pode:

- Personalizar mensagens em `src/bot.js`
- Adicionar mais produtos
- Integrar com banco de dados
- Implementar validação automática de comprovantes

## 🆘 Problemas Comuns

### Bot não responde
- Verifique se o webhook foi configurado: `https://api.telegram.org/bot{TOKEN}/getWebhookInfo`
- Confirme que as variáveis de ambiente estão corretas na Vercel
- Veja os logs: `vercel logs`

### QR Code não aparece
- Verifique se `MY_PIX_KEY` está configurada
- Teste localmente: `vercel dev`
- Veja logs de erro no console

### Comprovante não notifica
- Confirme que `OPERATOR_CHAT_ID` está correto
- Teste enviando mensagem direto pelo bot para o operador

### Entrega não funciona
- Verifique se o `txid` está correto
- Confirme o header `x-trigger-secret`
- Veja logs da API: `vercel logs api/trigger-delivery`

## 📞 Próximos Passos

1. **Implementar banco de dados** (Supabase é gratuito e fácil)
2. **Adicionar validação automática** de comprovantes (OCR)
3. **Criar painel admin** para gerenciar vendas
4. **Integrar com n8n** para automação completa
5. **Adicionar analytics** para acompanhar vendas

## 🔗 Links Úteis

- [Documentação Telegraf](https://telegraf.js.org/)
- [Documentação Vercel](https://vercel.com/docs)
- [API do Telegram](https://core.telegram.org/bots/api)
- [Especificação PIX](https://www.bcb.gov.br/estabilidadefinanceira/pix)

