# 🤖 Bot Telegram PIX - Sistema de Grupos Pagos

Sistema completo de vendas via Telegram com pagamento PIX e gestão automática de grupos pagos.

---

## 🚀 CONFIGURAÇÃO RÁPIDA

### 1. Variáveis de Ambiente na Vercel

Configure as seguintes variáveis em: **Settings → Environment Variables**

```env
# Telegram
TELEGRAM_BOT_TOKEN=seu_token
TELEGRAM_WEBHOOK_SECRET=/webhook-secreto-aleatorio

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave

# Secrets para Cron Job (gerar senha aleatória forte)
CRON_SECRET=senha_aleatoria_32_caracteres
```

**Gerar CRON_SECRET:**
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

---

### 2. Configurar Cron Job (Expiração Automática)

**Usar:** [cron-job.org](https://cron-job.org) (gratuito)

| Campo | Valor |
|-------|-------|
| **URL** | `https://seu-projeto.vercel.app/api/jobs/expire-members` |
| **Schedule** | Every 30 minutes |
| **Method** | POST |
| **Headers** | `x-cron-secret: SEU_CRON_SECRET` |

---

### 3. Testar

```bash
# Testar endpoint (deve retornar estatísticas)
curl -X POST \
  https://seu-projeto.vercel.app/api/jobs/expire-members \
  -H "x-cron-secret: SEU_CRON_SECRET"
```

---

## ✅ O QUE FOI IMPLEMENTADO

### Sistema de Expiração Automática
- ✅ Remoção automática de membros expirados (após 1 dia)
- ✅ Lembretes automáticos (3 dias antes + urgente no dia)
- ✅ QR Code de renovação enviado automaticamente
- ✅ Lock distribuído (evita processamento duplicado)
- ✅ Logs estruturados para monitoramento

### Banco de Dados
- ✅ Campo `processing_lock` adicionado (via migration)
- ✅ Índice de performance criado
- ✅ Sistema de verificação dupla (evita remover usuários com renovação pendente)

### Endpoints
- ✅ `/api/jobs/expire-members` - Cron job de expiração (POST/GET)
- ✅ Autenticação via header `x-cron-secret`
- ✅ Retorna estatísticas de execução

---

## 🔍 MONITORAMENTO

Execute no Supabase para validar sistema:

```sql
-- Deve retornar 0 se sistema está funcionando
SELECT COUNT(*) 
FROM group_members
WHERE status = 'active' 
  AND expires_at < NOW() - INTERVAL '1 day';
```

---

## 📊 COMO FUNCIONA

1. **Cron job executa a cada 30 minutos**
2. **Busca membros expirados há mais de 1 dia**
3. **Verifica se há renovação pendente/aprovada**
4. **Remove do grupo Telegram**
5. **Marca como expirado no banco**
6. **Envia QR Code de renovação**

---

## ⚠️ IMPORTANTE

### Permissões do Bot
O bot precisa ser **administrador** do grupo com permissão de **"Banir usuários"**

### Primeira Execução
Na primeira execução, o job processará TODOS os membros expirados acumulados (pode levar alguns minutos)

### Renovações
Quando um usuário renova a assinatura e o pagamento é aprovado, o sistema:
- ✅ Estende automaticamente a data de expiração (+30 dias)
- ✅ Reseta o contador de lembretes
- ✅ Mantém o usuário no grupo

---

## 🆘 TROUBLESHOOTING

### Erro 401 (Unauthorized)
- Verifique se `CRON_SECRET` está configurado na Vercel
- Confirme que o header é `x-cron-secret` (minúsculas)
- Faça redeploy após adicionar variáveis

### Membros não são removidos
- Verifique se bot é administrador do grupo
- Confirme permissão "Banir usuários"
- Veja logs da Vercel para identificar erros

### Timeout
- Aumente timeout no cron job para 60s
- Ou reduza frequência para 1 hora

---

## 📱 COMANDOS DO BOT

### Usuários
- `/start` - Menu principal
- `/renovar` - Renovar assinatura

### Admin
- `/admin` - Painel administrativo
- `/produtos` - Gerenciar produtos
- `/novogrupo` - Cadastrar grupo

---

## 🔐 SEGURANÇA

- ✅ Autenticação por secret
- ✅ Lock distribuído
- ✅ Validação dupla antes de remover
- ✅ Logs de todas operações

---

## 📦 STACK

- **Backend:** Node.js 18+ com Telegraf
- **Banco:** Supabase (PostgreSQL)
- **Deploy:** Vercel Serverless
- **Cron:** Serviço externo (cron-job.org)

---

**Versão:** 2.0.0  
**Status:** ✅ Produção
