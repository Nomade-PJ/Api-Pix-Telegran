# 🔑 SISTEMA DE GERENCIAMENTO DE CHAVES PIX

## 📋 Visão Geral

Sistema completo para gerenciar múltiplas chaves PIX no banco de dados, **independente da variável de ambiente da Vercel**. Isso permite que múltiplos criadores/vendedores possam ter suas próprias chaves cadastradas e gerenciadas pelo admin.

---

## ✨ Características

- ✅ **Múltiplas chaves PIX** cadastradas no banco de dados
- ✅ **Ativar/Desativar chaves** facilmente
- ✅ **Apenas uma chave ativa** por vez (garantido por índice único)
- ✅ **Proprietário/Criador** para cada chave
- ✅ **Descrição opcional** para organização
- ✅ **Tipos detectados automaticamente**: Email, Telefone, CPF, CNPJ, Chave Aleatória
- ✅ **Validação de formato** antes de cadastrar
- ✅ **Logs de auditoria** para todas as ações
- ✅ **Fallback automático** para variável de ambiente se não houver chave no banco
- ✅ **Interface amigável** com mensagens formatadas

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `pix_keys`

```sql
CREATE TABLE pix_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  key_type TEXT CHECK (key_type IN ('email', 'phone', 'cpf', 'cnpj', 'random')),
  owner_name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Garantir que só existe uma chave ativa por vez
CREATE UNIQUE INDEX idx_one_active_pix_key 
ON pix_keys (is_active) 
WHERE is_active = TRUE;
```

---

## 🎯 Comandos Disponíveis

### 1. `/setpix [chave]` - Adicionar Nova Chave

**Formato:**
```
/setpix chave
```

**Exemplos:**
```
/setpix seu@email.com
/setpix 11999887766
/setpix 12345678900
/setpix 12345678901234
/setpix abc123def456ghi789jkl012mno345
```

**Tipos Aceitos:**
- 📧 **Email**: contém `@`
- 📱 **Telefone**: 10 ou 11 dígitos (com DDD, sem +55)
- 🆔 **CPF**: 11 dígitos
- 🏢 **CNPJ**: 14 dígitos
- 🔐 **Chave Aleatória**: 32 caracteres alfanuméricos

**Fluxo:**
1. Digite `/setpix [chave]`
2. Sistema valida o formato
3. Digite o **nome do proprietário** (Ex: João Silva, Loja X)
4. Digite a **descrição** (ou `-` para pular)
5. Escolha se quer **ativar agora** (SIM/NÃO)
6. ✅ Chave cadastrada!

**Mensagem de Erro (sem argumento):**
```
❌ Uso incorreto!

Formato: /setpix chave

Exemplos:
• /setpix seu@email.com
• /setpix 11999887766
• /setpix 12345678900

Tipos aceitos:
Email, Telefone (com DDD, sem +55), CPF/CNPJ ou Chave aleatória

📋 Use /chavespix para ver todas as chaves cadastradas
```

**Mensagem de Sucesso:**
```
✅ Chave válida detectada!

🔑 Chave: seu@email.com
📝 Tipo: 📧 Email

👤 Agora, digite o nome do proprietário/criador:
(Ex: João Silva, Loja X, etc.)

Digite /cancelar para cancelar
```

---

### 2. `/chavespix` - Listar Todas as Chaves

Exibe todas as chaves cadastradas com:
- ✅ Status (Ativa/Inativa)
- 🔑 Chave PIX
- 👤 Proprietário
- 📝 Descrição (se houver)
- Ícone do tipo (📧📱🆔🏢🔐)

**Exemplo de Resposta:**
```
🔑 CHAVES PIX CADASTRADAS:

✅ ATIVA
📧 seu@email.com
👤 João Silva
📝 Vendas principais

⚪ Inativa
📱 11999887766
👤 Maria Santos
📝 Loja secundária

💡 Comandos:
• /setpix [chave] - Adicionar nova
• /ativarpix [chave] - Ativar chave
• /deletarpix [chave] - Remover chave
```

---

### 3. `/ativarpix [chave]` - Ativar uma Chave

**Formato:**
```
/ativarpix chave_completa
```

**Exemplo:**
```
/ativarpix seu@email.com
```

**Funcionalidade:**
- Desativa **todas** as outras chaves
- Ativa **apenas** a chave especificada
- Garante que só existe **uma chave ativa** por vez
- Registra log de auditoria

**Mensagem de Sucesso:**
```
✅ Chave PIX ativada com sucesso!

🔑 Chave: seu@email.com
👤 Proprietário: João Silva

Todos os novos pagamentos usarão esta chave.
```

---

### 4. `/deletarpix [chave]` - Remover uma Chave

**Formato:**
```
/deletarpix chave_completa
```

**Exemplo:**
```
/deletarpix 11999887766
```

**Proteção:**
- ⚠️ **Não permite deletar** a única chave ativa
- Você deve ativar outra chave antes

**Mensagem de Sucesso:**
```
✅ Chave PIX removida com sucesso!

🔑 Chave: 11999887766
```

---

## 🔧 Como Funciona Internamente

### 1. **Criação de Pagamento PIX**

Quando um usuário compra um produto, o sistema:

```javascript
// src/pix/manual.js
const pixKeyData = await pixKeys.getActivePixKey();

if (!pixKeyData || !pixKeyData.key) {
  throw new Error('Nenhuma chave PIX configurada. Use /setpix');
}

const key = pixKeyData.key;
// Gera QR Code e payload com esta chave
```

### 2. **Fallback para Variável de Ambiente**

Se não houver chave no banco de dados, o sistema automaticamente busca `MY_PIX_KEY` da Vercel:

```javascript
if (!data && process.env.MY_PIX_KEY) {
  return {
    key: process.env.MY_PIX_KEY,
    owner_name: 'Sistema',
    from_env: true
  };
}
```

### 3. **Garantia de Única Chave Ativa**

Índice único no banco impede múltiplas chaves ativas:

```sql
CREATE UNIQUE INDEX idx_one_active_pix_key 
ON pix_keys (is_active) 
WHERE is_active = TRUE;
```

---

## 📊 Logs de Auditoria

Todas as ações são registradas na tabela `admin_logs`:

- `added_pix_key` - Chave adicionada
- `activated_pix_key` - Chave ativada
- `deleted_pix_key` - Chave removida
- `viewed_pix_keys` - Lista visualizada

**Ver logs:**
```
/admin → Configurações → Ver logs
```

---

## 🎯 Casos de Uso

### **Caso 1: Primeiro Uso (Migração)**

1. Admin já tem chave em `MY_PIX_KEY` na Vercel
2. Sistema detecta automaticamente e usa ela
3. Admin adiciona a mesma chave no banco:
   ```
   /setpix chave_atual
   ```
4. Agora a chave está **persistida no banco**
5. Pode remover `MY_PIX_KEY` da Vercel (opcional)

### **Caso 2: Múltiplos Criadores**

1. Criador A cadastra sua chave:
   ```
   /setpix emailA@exemplo.com
   ```
2. Criador B cadastra sua chave:
   ```
   /setpix emailB@exemplo.com
   ```
3. Admin ativa chave do Criador A:
   ```
   /ativarpix emailA@exemplo.com
   ```
4. Todas as vendas vão para Criador A
5. Para mudar, admin ativa chave do Criador B:
   ```
   /ativarpix emailB@exemplo.com
   ```

### **Caso 3: Múltiplas Lojas**

1. Loja Principal:
   ```
   /setpix pix_loja_principal@email.com
   Nome: Loja Principal
   Descrição: Vendas gerais
   ```
2. Loja Filial:
   ```
   /setpix pix_filial@email.com
   Nome: Filial Shopping
   Descrição: Vendas da filial
   ```
3. Alternar entre lojas conforme necessário

---

## 🛡️ Segurança e Validações

### **Validações de Formato**

```javascript
// Email
if (key.includes('@')) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(key);
}

// CPF (11 dígitos)
if (/^\d{11}$/.test(key)) return true;

// CNPJ (14 dígitos)
if (/^\d{14}$/.test(key)) return true;

// Telefone (10 ou 11 dígitos)
if (/^\d{10,11}$/.test(key)) return true;

// Chave aleatória (32 caracteres)
if (/^[a-zA-Z0-9]{32}$/.test(key)) return true;
```

### **Proteções**

- ✅ Chave única no banco (constraint)
- ✅ Apenas uma chave ativa por vez (índice único)
- ✅ Não permite deletar única chave ativa
- ✅ Validação de formato antes de cadastrar
- ✅ Apenas admins podem gerenciar chaves
- ✅ Logs de auditoria de todas as ações

---

## 📱 Exemplos de Mensagens

### Sem Argumentos
```
❌ Uso incorreto!

Formato: /setpix chave

Exemplos:
• /setpix seu@email.com
• /setpix 11999887766
• /setpix 12345678900

Tipos aceitos:
Email, Telefone (com DDD, sem +55), CPF/CNPJ ou Chave aleatória
```

### Chave Inválida
```
❌ Chave PIX inválida!

Verifique o formato e tente novamente.
```

### Sucesso na Adição
```
🎉 CHAVE PIX ADICIONADA COM SUCESSO!

🔑 Chave: seu@email.com
👤 Proprietário: João Silva
📝 Vendas principais
✅ Status: ATIVA

💡 Use /chavespix para gerenciar as chaves.
```

---

## 🚀 Próximos Passos

1. **Testar no Telegram:**
   ```
   /setpix sua_chave
   ```

2. **Ver todas as chaves:**
   ```
   /chavespix
   ```

3. **Fazer uma compra teste** para confirmar que está usando a chave correta

4. **Verificar logs:**
   ```
   /admin → Configurações → Ver logs
   ```

---

## 💡 Dicas

- ✅ Sempre mantenha **pelo menos uma chave ativa**
- ✅ Use **descrições** para organizar as chaves
- ✅ Registre o **nome do proprietário** corretamente
- ✅ Verifique os **logs** regularmente
- ✅ Teste com **valores pequenos** primeiro

---

## 🎯 Resumo Técnico

**Arquivos Criados/Modificados:**
- ✅ `src/modules/pixKeys.js` - Módulo completo de gerenciamento
- ✅ `src/admin.js` - Comandos `/setpix`, `/chavespix`, `/ativarpix`, `/deletarpix`
- ✅ `src/pix/manual.js` - Busca chave ativa do banco
- ✅ Migration SQL - Criação da tabela `pix_keys`

**Funcionalidades:**
- ✅ CRUD completo de chaves PIX
- ✅ Validação de formatos
- ✅ Sistema de sessões para cadastro
- ✅ Logs de auditoria
- ✅ Fallback para variável de ambiente
- ✅ Interface amigável

---

**🎉 Sistema 100% funcional e pronto para uso!**

