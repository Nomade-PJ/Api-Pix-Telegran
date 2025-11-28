# 👑 Painel do Criador - Configuração

## 📋 O Que É?

O **Painel do Criador** é um painel administrativo com **acesso limitado** comparado ao painel de Admin completo.

### ✅ **O Criador Pode:**
- 📊 Ver **Estatísticas** em tempo real
- 👤 Ver **Usuários** cadastrados
- 📢 Fazer **Broadcast** (enviar mensagens para todos)
- ⏳ Ver **Transações Pendentes**

### ❌ **O Criador NÃO Pode:**
- Criar/Editar/Deletar produtos
- Gerenciar grupos
- Alterar chave PIX
- Aprovar/Rejeitar transações manualmente
- Ver configurações do sistema

---

## 🔧 Como Configurar

### Opção 1: Automático (Recomendado)

O usuário será marcado automaticamente como criador quando:
1. Interagir com o bot pela primeira vez
2. Tiver o Telegram ID: `7147424680`

**O sistema já está configurado para isso!** ✅

### Opção 2: Manual (Via SQL)

Se precisar configurar manualmente:

```sql
-- Marcar usuário como criador
UPDATE users 
SET is_creator = true 
WHERE telegram_id = 7147424680;

-- Verificar
SELECT 
  telegram_id,
  first_name,
  is_admin,
  is_creator
FROM users
WHERE telegram_id = 7147424680;
```

### Opção 3: Via Admin

Um admin pode configurar adicionando um comando no futuro (não implementado ainda).

---

## 📱 Como Usar

### 1. **Acessar o Painel**

No bot do Telegram, digite:
```
/criador
```

### 2. **Painel Principal**

```
👑 PAINEL DO CRIADOR

📊 ESTATÍSTICAS EM TEMPO REAL

💳 Transações: 22
⏳ Pendentes: 0
💰 Vendas: R$ 393.80
✅ Aprovadas: 18
❌ Rejeitadas: 0

📅 Hoje:
💰 Vendas: R$ 50.00
📦 Transações: 5

━━━━━━━━━━━━━━━━━━━━━━━━

Selecione uma opção abaixo:

[ 📊 Estatísticas ]
[ 👤 Usuários ]
[ 📢 Broadcast ]
[ ⏳ Pendentes ]
[ 🔄 Atualizar ]
```

---

## 🎯 Funcionalidades

### 📊 **Estatísticas**

Mostra:
- Total de transações
- Transações pendentes
- Vendas totais
- Vendas de hoje
- Transações aprovadas/rejeitadas

**Botão:** `📊 Estatísticas`

---

### 👤 **Usuários**

Lista os últimos 50 usuários cadastrados:
- Nome
- Username (@)
- Telegram ID
- Data de cadastro

**Botão:** `👤 Usuários`

---

### 📢 **Broadcast**

Enviar mensagem para **TODOS** os usuários:

1. Clique em `📢 Broadcast`
2. Digite a mensagem que deseja enviar
3. Confirme o envio
4. Aguarde processamento

**Atenção:** A mensagem será enviada para **TODOS** os usuários cadastrados!

**Botão:** `📢 Broadcast`

---

### ⏳ **Pendentes**

Ver transações pendentes de aprovação:
- Valor
- Usuário (ID)
- Produto/Pack
- TXID
- Tempo restante até expiração

**Botão:** `⏳ Pendentes`

---

## 🔒 Segurança

### Permissões

- ✅ Criador só pode **VER** informações
- ✅ Criador pode **ENVIAR** broadcasts
- ❌ Criador **NÃO pode** modificar produtos
- ❌ Criador **NÃO pode** aprovar transações
- ❌ Criador **NÃO pode** alterar configurações

### Verificação

O sistema verifica `is_creator = true` em cada comando.

---

## 📝 IDs Configurados

**Criador:**
- Telegram ID: `7147424680`
- Telefone: `+55 98 98559 1454`

O sistema marca automaticamente quando o usuário interagir com o bot.

---

## 🔄 Atualização

Para atualizar as informações do painel:

1. Clique em `🔄 Atualizar`
2. Ou use `/criador` novamente

Os dados são buscados em tempo real do banco de dados.

---

## 🚀 Próximas Melhorias (Futuro)

- [ ] Poder configurar outros criadores via painel admin
- [ ] Estatísticas mais detalhadas (gráficos)
- [ ] Filtros de busca de usuários
- [ ] Agendar broadcasts
- [ ] Broadcast segmentado (por grupo)

---

**Última atualização:** 26/11/2025

