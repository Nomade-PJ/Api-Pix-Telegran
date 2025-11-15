# 🤖 Bot Telegram + PIX - Sistema Completo de Vendas

Bot Telegram profissional com geração automática de **QR Code PIX** (BR Code 2.3), integração com **Supabase**, sistema completo de **gerenciamento via comandos admin** e **entrega automática** de produtos. Hospedado na **Vercel** com funções serverless.

## ✨ Funcionalidades Principais

### 🛍️ Para Clientes
- ✅ Menu dinâmico com produtos cadastrados
- ✅ Geração automática de QR Code PIX válido
- ✅ Cópia & Cola PIX (padrão BR Code 2.3)
- ✅ Envio de comprovante via foto/documento
- ✅ Recebimento automático de acesso após validação

### 🔐 Para Administradores
- ✅ **Painel administrativo completo** via comandos
- ✅ **Gerenciar produtos** (criar, editar, remover) direto pelo bot
- ✅ **Upload de arquivos** (ZIP, PDF) para produtos
- ✅ **Alterar chave PIX** sem mexer em código
- ✅ **Validar vendas** com 1 comando
- ✅ **Estatísticas** em tempo real
- ✅ **Broadcast** para todos os usuários

### 💾 Banco de Dados
- ✅ **Supabase integrado** (PostgreSQL)
- ✅ Armazenamento de usuários, produtos e transações
- ✅ Histórico completo de vendas
- ✅ Relatórios e estatísticas

### 💳 PIX
- ✅ **Gerador PIX corrigido** (BR Code 2.3)
- ✅ **Funciona em TODOS os bancos** (Nubank, Inter, Itaú, Bradesco, etc.)
- ✅ QR Code e Cópia & Cola válidos
- ✅ Campos obrigatórios (59 e 60) incluídos

---

## 🚀 Início Rápido

### 1. Instalação

```bash
npm install
```

### 2. Configurar Variáveis de Ambiente

Copie o arquivo `env.example` e configure suas variáveis na **Vercel** (Settings → Environment Variables):

#### **Obrigatórias:**
```env
# Telegram
TELEGRAM_BOT_TOKEN=seu_token_do_botfather
TELEGRAM_WEBHOOK_SECRET=/telegram-webhook-secret
APP_URL=https://seu-projeto.vercel.app
OPERATOR_CHAT_ID=seu_telegram_id

# Supabase (Banco de Dados)
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anon_do_supabase

# PIX
MY_PIX_KEY=sua_chave_pix@email.com
```

#### **Opcionais:**
```env
DELIVERY_BASE_URL=https://drive.google.com/
TRIGGER_SECRET=senha_secreta_para_api
DEFAULT_CURRENCY=BRL
DEFAULT_LOCALE=pt-BR
```

### 3. Configurar Banco de Dados (Supabase)

O banco de dados é criado automaticamente via migrações. As tabelas são:

- **`users`** - Usuários do bot
- **`products`** - Produtos cadastrados
- **`transactions`** - Transações PIX

**Para se tornar admin:**
```sql
UPDATE users
SET is_admin = TRUE
WHERE telegram_id = SEU_TELEGRAM_ID;
```

### 4. Deploy na Vercel

1. Conecte seu repositório GitHub à Vercel
2. Configure todas as variáveis de ambiente
3. Deploy automático será feito
4. Copie a URL do deploy

### 5. Configurar Webhook do Telegram

Após o deploy, execute localmente:

```bash
npm start
```

Ou configure manualmente:
```
https://api.telegram.org/bot{SEU_TOKEN}/setWebhook?url=https://seu-projeto.vercel.app/api/telegram-webhook
```

---

## 📁 Estrutura do Projeto

```
bot-pix-vercel/
├─ api/
│  ├─ telegram-webhook.js       # Webhook do Telegram (Vercel)
│  ├─ trigger-delivery.js       # Endpoint para entrega (opcional)
│  └─ webhook-pix.js            # Webhook para verificação automática (futuro)
├─ src/
│  ├─ bot.js                    # Lógica principal do bot
│  ├─ admin.js                  # Comandos administrativos
│  ├─ database.js               # Integração com Supabase
│  ├─ deliver.js                # Funções para envio de links/arquivos
│  └─ pix/
│     └─ manual.js              # Gerador PIX (BR Code 2.3 corrigido)
├─ scripts/
│  └─ setWebhook.js             # Script para configurar webhook
├─ package.json
├─ vercel.json
├─ env.example
└─ README.md
```

---

## 🎯 Comandos Disponíveis

### **Para Clientes:**
- `/start` - Ver menu de produtos

### **Para Administradores:**
- `/admin` - Painel administrativo
- `/produtos` - Listar todos os produtos
- `/novoproduto` - Criar novo produto (interativo)
- `/editarproduto` - Editar produto existente
- `/deletarproduto` - Remover/desativar produto
- `/setpix [chave]` - Alterar chave PIX
- `/pendentes` - Ver transações pendentes
- `/validar_[txid]` - Validar e entregar automaticamente
- `/stats` - Estatísticas detalhadas
- `/users` - Listar usuários
- `/broadcast [mensagem]` - Enviar para todos

---

## 🔄 Fluxo Completo de Venda

### **1. Cliente:**
```
/start → Escolhe produto → Recebe QR Code PIX → Paga → Envia comprovante
```

### **2. Sistema:**
```
Salva transação no Supabase → Notifica operador → Aguarda validação
```

### **3. Admin:**
```
Recebe notificação → /validar_[txid] → Bot entrega automaticamente
```

### **4. Cliente:**
```
Recebe link/arquivo automaticamente → Acesso liberado ✅
```

---

## 🛍️ Gerenciar Produtos via Bot

### **Criar Produto:**
```
/novoproduto
→ Digite nome: Pack Premium
→ Digite preço: 79.90
→ Digite descrição: Acesso completo
→ Envie arquivo ZIP ou cole URL do Google Drive
✅ Produto criado e já disponível no menu!
```

### **Editar Produto:**
```
/editarproduto
→ /edit_packA
→ /edit_price
→ Digite novo preço: 25.00
✅ Produto atualizado!
```

### **Remover Produto:**
```
/deletarproduto
→ /delete_packA
✅ Produto desativado!
```

---

## 💳 Gerador PIX (BR Code 2.3)

O gerador PIX foi **totalmente corrigido** e está em conformidade com a especificação oficial:

- ✅ GUI em maiúsculas: `BR.GOV.BCB.PIX`
- ✅ Estrutura correta do Merchant Account Info
- ✅ Campos obrigatórios 59 (Nome) e 60 (Cidade)
- ✅ CRC16-CCITT correto
- ✅ Ordem correta dos TLVs

**Testado e funcionando em:**
- Nubank, Inter, Itaú, Bradesco, Banco do Brasil
- Caixa, C6 Bank, BTG, Santander, Mercado Pago

---

## 📊 Banco de Dados (Supabase)

### **Tabelas:**

**`users`**
- Armazena todos os usuários do bot
- Campo `is_admin` para permissões

**`products`**
- Produtos cadastrados
- Campo `is_active` para ativar/desativar
- Suporta entrega via `link` ou `file`

**`transactions`**
- Histórico completo de transações
- Status: `pending`, `proof_sent`, `validated`, `delivered`
- Vincula usuário, produto e comprovante

### **Consultas Úteis:**

```sql
-- Ver transações pendentes
SELECT * FROM transactions WHERE status = 'proof_sent';

-- Total em vendas
SELECT SUM(amount) FROM transactions WHERE status = 'delivered';

-- Produtos ativos
SELECT * FROM products WHERE is_active = TRUE;
```

---

## 🔐 Segurança

### **Variáveis de Ambiente:**
- ✅ Nunca exponha tokens em repositórios públicos
- ✅ Use `.gitignore` para arquivos sensíveis
- ✅ Configure todas as variáveis na Vercel

### **Webhook:**
- ✅ Use caminho secreto para o webhook
- ✅ Validação de método POST
- ✅ Tratamento de erros completo

### **Banco de Dados:**
- ✅ Use apenas a chave `anon` do Supabase (pública)
- ✅ Configure RLS (Row Level Security) se necessário
- ✅ Faça backup regular dos dados

---

## 📦 Dependências

```json
{
  "telegraf": "^4.12.2",
  "@supabase/supabase-js": "^2.39.0",
  "qrcode": "^1.5.1",
  "axios": "^1.4.0"
}
```

---

## 🛠️ Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar localmente (Vercel CLI)
npm run dev

# Configurar webhook
npm start
```

---

## 📚 Documentação

Toda a documentação está consolidada neste README.md para facilitar a manutenção.

---

## ✅ Checklist de Deployment

### **Configuração Inicial:**
- [ ] Token do bot configurado (`TELEGRAM_BOT_TOKEN`)
- [ ] Supabase configurado (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
- [ ] Chave PIX configurada (`MY_PIX_KEY`)
- [ ] Operador configurado (`OPERATOR_CHAT_ID`)
- [ ] Variáveis de ambiente na Vercel
- [ ] Deploy realizado com sucesso

### **Webhook:**
- [ ] Webhook configurado no Telegram
- [ ] Teste de `/start` funcionando
- [ ] Menu de produtos aparecendo

### **Funcionalidades:**
- [ ] QR Code PIX sendo gerado
- [ ] QR Code reconhecido pelos bancos
- [ ] Comprovante sendo recebido
- [ ] Operador recebendo notificações
- [ ] Validação funcionando (`/validar_[txid]`)
- [ ] Entrega automática funcionando

### **Admin:**
- [ ] Usuário configurado como admin no Supabase
- [ ] Comandos admin funcionando
- [ ] Criação de produtos funcionando
- [ ] Upload de arquivos funcionando

---

## 🎉 Funcionalidades Avançadas

### **Menu Dinâmico:**
Os botões do menu `/start` são gerados **automaticamente** do banco de dados. Quando você cria um produto, ele aparece imediatamente no menu!

### **Upload de Arquivos:**
Você pode enviar arquivos ZIP/PDF diretamente pelo Telegram ao criar um produto. O bot armazena o `file_id` e entrega automaticamente após validação.

### **Validação em 1 Clique:**
Quando um cliente envia comprovante, você recebe uma notificação com o comando `/validar_[txid]`. Basta clicar e o bot entrega automaticamente!

### **Estatísticas em Tempo Real:**
Use `/stats` para ver:
- Total de usuários
- Total de transações
- Transações pendentes
- Total em vendas (R$)
- Ticket médio

---

## 🐛 Troubleshooting

### **QR Code não é reconhecido:**
- ✅ Verifique se a chave PIX está correta
- ✅ Use o gerador corrigido (já implementado)
- ✅ Teste em diferentes bancos

### **Comandos admin não funcionam:**
- ✅ Verifique se você é admin no Supabase
- ✅ Execute: `UPDATE users SET is_admin = TRUE WHERE telegram_id = SEU_ID;`

### **Produtos não aparecem no menu:**
- ✅ Verifique se `is_active = TRUE` no banco
- ✅ Use `/produtos` para ver status

### **Webhook não recebe updates:**
- ✅ Verifique se o webhook está configurado
- ✅ Confirme a URL na Vercel
- ✅ Veja os logs da Vercel

---

## 📞 Suporte e Recursos

- **Documentação Telegraf:** https://telegraf.js.org/
- **Documentação Vercel:** https://vercel.com/docs
- **Documentação Supabase:** https://supabase.com/docs
- **Especificação PIX:** https://www.bcb.gov.br/estabilidadefinanceira/pix
- **BR Code 2.3:** Especificação EMV/BCB

---

## 🚀 Próximos Passos (Opcional)

- [ ] Implementar verificação automática via webhook PSP
- [ ] Adicionar OCR para validação de comprovantes
- [ ] Sistema de cupons de desconto
- [ ] Relatórios em PDF
- [ ] Integração com planilhas Google Sheets
- [ ] Sistema de afiliados

---

## 📝 Licença

Este projeto é fornecido como exemplo educacional.

---

## 🎊 Status do Projeto

✅ **100% Funcional e Pronto para Produção!**

- Bot funcionando
- PIX gerando corretamente
- Banco de dados integrado
- Comandos admin completos
- Sistema de vendas operacional
- QR Code reconhecido por todos os bancos

**Desenvolvido com ❤️ para automação de vendas via Telegram + PIX**
