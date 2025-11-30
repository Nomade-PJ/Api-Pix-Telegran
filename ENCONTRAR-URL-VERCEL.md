# 🔍 DESCOBRIR URL CORRETA DA VERCEL

## Problema Identificado

A URL `api-pix-telegran.vercel.app` está retornando **404 (Not Found)**.

Isso acontece quando:
- O projeto não foi deployado
- O nome do projeto na Vercel é diferente
- O domínio mudou

## ✅ Solução: Encontrar a URL Correta

### Passo 1: Na Vercel Dashboard

1. Acesse: https://vercel.com/dashboard
2. Procure pelo projeto (pode estar com nome diferente)
3. Clique no projeto
4. Na tela principal, você verá a **URL do projeto** (ex: `seu-projeto-hash123.vercel.app`)
5. **COPIE essa URL**

### Passo 2: Teste a URL

Cole no navegador:
```
https://SUA-URL-COPIADA.vercel.app/webhook-secreto-aleatorio
```

**Deve retornar:**
```json
{"error": "Method Not Allowed"}
```

Isso está CORRETO! Significa que o webhook existe, só precisa do POST do Telegram.

### Passo 3: Configurar Webhook com URL Correta

Cole no navegador (substitua os valores):
```
https://api.telegram.org/bot{SEU_TOKEN}/setWebhook?url=https://{URL_CORRETA}/webhook-secreto-aleatorio
```

## 🎯 Se o projeto NÃO aparece na Vercel

### Opção A: Import via GitHub

1. Na Vercel: **Add New → Project**
2. Selecione o repositório `Api-Pix-Telegran`
3. Configure as Environment Variables:
   - `TELEGRAM_BOT_TOKEN`
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `APP_URL` (deixe em branco por enquanto)
4. **Deploy**
5. Após deploy, copie a URL gerada

### Opção B: Deploy via CLI

```bash
# No terminal do projeto
npm i -g vercel
vercel login
vercel --prod
```

Vai perguntar várias coisas, apenas aperte ENTER para aceitar os padrões.
No final, mostrará a URL do projeto.

## 📝 URLs que você pode ter

A Vercel gera URLs assim:
- `api-pix-telegran.vercel.app` (nome customizado)
- `api-pix-telegran-git-main-seuuser.vercel.app` (branch)
- `api-pix-telegran-hash123.vercel.app` (deployment específico)

**Use a URL principal** (primeira).

## ✅ Checklist Final

- [ ] Descobri a URL correta na Vercel
- [ ] Testei a URL acessando `/webhook-secreto-aleatorio`
- [ ] Configurei o webhook do Telegram com URL correta
- [ ] Testei `/start` no Telegram
- [ ] Bot respondeu! 🎉

---

**💡 Dica:** Se aparecer erro 404, o projeto não está deployado. Faça o deploy primeiro!

