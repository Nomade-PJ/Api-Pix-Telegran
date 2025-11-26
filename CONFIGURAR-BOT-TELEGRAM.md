# 🔧 Como Configurar o Bot no Telegram

## 📋 Passo a Passo para Adicionar o Bot ao Grupo/Canal

### 1️⃣ **Criar o Grupo/Canal no Telegram**

1. Abra o Telegram
2. Clique em **"Nova conversa"** → **"Novo grupo"** ou **"Novo canal"**
3. Dê um nome (ex: "Grupo Privado 🔞")
4. Configure como **PRIVADO**
5. Anote o **ID do grupo** (será necessário)

### 2️⃣ **Obter o ID do Grupo**

**Método 1: Via Bot @userinfobot**
1. Adicione o bot `@userinfobot` ao seu grupo
2. O bot mostrará o ID do grupo (ex: `-1001234567890`)
3. **Copie esse ID** (número negativo)

**Método 2: Via URL do Telegram**
1. No grupo, clique em **"Informações"** → **"Adicionar membros"**
2. Crie um link de convite
3. O ID pode ser extraído da URL

### 3️⃣ **Adicionar o Bot ao Grupo**

1. No grupo, clique em **"Informações"** (ícone de ⓘ)
2. Clique em **"Administradores"** → **"Adicionar administrador"**
3. Procure pelo seu bot (ex: `@Vipsdaval`)
4. **IMPORTANTE:** Dê as seguintes permissões:
   - ✅ **Banir usuários** (necessário para remover expirados)
   - ✅ **Adicionar novos membros** (necessário para adicionar após pagamento)
   - ✅ **Excluir mensagens** (opcional, mas recomendado)
   - ❌ **Alterar informações do grupo** (não necessário)
   - ❌ **Postar mensagens** (não necessário)

### 4️⃣ **Configurar o Bot no Sistema**

#### Via Painel Admin:

1. Abra o bot no Telegram
2. Digite `/admin`
3. Clique em **"Gerenciar Grupos"**
4. Clique em **"Novo Grupo"**
5. Preencha:
   - **ID do Grupo:** `-1001234567890` (o ID que você copiou)
   - **Nome:** `Grupo Privado 🔞`
   - **Link:** `https://t.me/+ABC123xyz` (link de convite do grupo)
   - **Preço:** `30.00` (ou o valor desejado)
   - **Duração:** `30` (dias)

#### Via Comando Direto:

```
/novogrupo
```

Siga as instruções do bot.

### 5️⃣ **Verificar se Funcionou**

1. Teste comprando uma assinatura
2. Após pagamento e aprovação, você deve ser adicionado automaticamente
3. Verifique se recebeu a mensagem de confirmação

## ⚠️ Problemas Comuns

### ❌ "Bot não tem permissão para adicionar membros"

**Solução:**
1. Vá em **"Informações do grupo"** → **"Administradores"**
2. Clique no seu bot
3. Ative **"Adicionar novos membros"**
4. Salve

### ❌ "Bot não consegue remover usuários expirados"

**Solução:**
1. Vá em **"Informações do grupo"** → **"Administradores"**
2. Clique no seu bot
3. Ative **"Banir usuários"**
4. Salve

### ❌ "ID do grupo não funciona"

**Verifique:**
- O ID deve ser um número **negativo** (ex: `-1001234567890`)
- O bot deve estar **adicionado ao grupo**
- O bot deve ser **administrador**

## 🔐 Permissões Necessárias

| Permissão | Necessária? | Para quê? |
|-----------|-------------|-----------|
| Banir usuários | ✅ **SIM** | Remover membros expirados |
| Adicionar membros | ✅ **SIM** | Adicionar após pagamento |
| Excluir mensagens | ⚠️ Opcional | Limpeza automática |
| Alterar informações | ❌ Não | Não usado |
| Postar mensagens | ❌ Não | Não usado |

## 📝 Checklist Final

- [ ] Grupo criado e configurado como privado
- [ ] ID do grupo anotado (número negativo)
- [ ] Bot adicionado ao grupo
- [ ] Bot configurado como administrador
- [ ] Permissões corretas ativadas
- [ ] Grupo cadastrado no sistema via `/admin`
- [ ] Teste de compra realizado
- [ ] Usuário adicionado automaticamente após pagamento

## 🎯 Próximos Passos

Após configurar:
1. O bot **removerá automaticamente** usuários após 30 dias
2. O bot **enviará QR Code** de renovação automaticamente
3. O bot **adicionará automaticamente** após aprovação do pagamento
4. O sistema roda **24/7** sem intervenção manual

---

**Última atualização:** 26/11/2025

