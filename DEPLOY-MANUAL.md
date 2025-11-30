# 🚀 Deploy Manual - Instruções

O bot não está respondendo porque provavelmente o deploy na Vercel não foi atualizado automaticamente.

## ✅ Soluções

### Opção 1: Forçar Re-deploy na Vercel (Recomendado)

1. Acesse: https://vercel.com/dashboard
2. Selecione o projeto `api-pix-telegran`
3. Vá em **"Deployments"**
4. Clique nos 3 pontinhos do último deploy
5. Selecione **"Redeploy"**
6. ✅ Aguarde 1-2 minutos para finalizar

### Opção 2: Deploy via CLI

```bash
# Instalar Vercel CLI (se não tiver)
npm i -g vercel

# Fazer deploy
vercel --prod
```

### Opção 3: Trigger via Git (Push vazio)

```bash
git commit --allow-empty -m "trigger: force redeploy"
git push
```

## 🔍 Verificar se o Deploy Funcionou

Após o deploy, teste o bot no Telegram:
- `/start` - Deve mostrar os produtos
- `/admin` - Deve abrir o painel (se você for admin)
- `/criador` - Deve abrir o painel do criador

## ⚠️ Se ainda não funcionar

1. Verifique se o webhook está configurado:
```bash
curl "https://api.telegram.org/bot{SEU_TOKEN}/getWebhookInfo"
```

2. Se necessário, reconfigure o webhook:
```bash
curl -X POST "https://api.telegram.org/bot{SEU_TOKEN}/setWebhook?url=https://api-pix-telegran.vercel.app/webhook-secreto-aleatorio"
```

## 📝 Notas

- O código está 100% correto e atualizado no GitHub
- O banco de dados Supabase está funcionando perfeitamente
- Produtos estão ativos e configurados
- O problema é apenas o deploy que não atualizou

---

**Depois de fazer o re-deploy, o bot voltará a funcionar normalmente!** ✅

