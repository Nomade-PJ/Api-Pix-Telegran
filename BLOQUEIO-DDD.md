# 🚫 Sistema de Bloqueio por DDD

## 📋 Visão Geral

Sistema que bloqueia novos usuários de determinadas regiões (DDDs) enquanto mantém usuários existentes ativos.

## 🎯 DDDs Bloqueados

### Maranhão
- **98** - Região não atendida
- **99** - Região não atendida

### Piauí
- **86** - Região não atendida
- **89** - Região não atendida

## ⚙️ Como Funciona

### Para Usuários Existentes ✅
- **Não são afetados** - continuam com acesso total
- Podem usar o bot normalmente
- Não precisam compartilhar telefone

### Para Novos Usuários 📱

#### 1. Primeiro Acesso
Quando um novo usuário envia `/start`:
```
📱 Bem-vindo!

Para acessar nossos produtos, precisamos verificar sua região.

Por favor, compartilhe seu número de telefone usando o botão abaixo:

[📱 Compartilhar Telefone]
```

#### 2. Verificação de DDD

**Se DDD está BLOQUEADO (98, 99, 86, 89):**
```
⚠️ Serviço Temporariamente Indisponível

No momento, não conseguimos processar seu acesso.

Estamos trabalhando para expandir nosso atendimento em breve!
```

**Se DDD está PERMITIDO:**
```
✅ Verificação Concluída!

Seu acesso foi liberado! Use /start para ver nossos produtos.
```

## 🔧 Comandos Admin

### Listar DDDs Bloqueados
```
/ddds
```

Retorna:
```
🚫 DDDs BLOQUEADOS

📍 98 - Maranhão
   └ Região não atendida
📍 99 - Maranhão
   └ Região não atendida
📍 86 - Piauí
   └ Região não atendida
📍 89 - Piauí
   └ Região não atendida

Comandos:
➕ /addddd <DDD> <Estado> <Motivo> - Bloquear DDD
➖ /removeddd <DDD> - Desbloquear DDD
```

### Adicionar DDD Bloqueado
```
/addddd <DDD> <Estado> [Motivo]
```

**Exemplos:**
```
/addddd 11 São Paulo Região não atendida
/addddd 21 Rio de Janeiro Expansão em breve
/addddd 85 Ceará
```

### Remover DDD Bloqueado
```
/removeddd <DDD>
```

**Exemplos:**
```
/removeddd 98
/removeddd 86
```

## 🗃️ Banco de Dados

### Tabela: `blocked_area_codes`

```sql
CREATE TABLE blocked_area_codes (
  id UUID PRIMARY KEY,
  area_code TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Tabela: `users` (modificada)

```sql
ALTER TABLE users ADD COLUMN phone_number TEXT;
```

## 🔍 Extração de DDD

A função `extractAreaCode()` suporta vários formatos:

| Formato | Exemplo | DDD Extraído |
|---------|---------|--------------|
| Internacional | 5511999999999 | 11 |
| Nacional | 11999999999 | 11 |
| Formatado | (11) 99999-9999 | 11 |
| Com espaços | 11 9 9999 9999 | 11 |

## 📊 Logs

### Console Logs

**Novo usuário verificado:**
```
🔍 [DDD-CHECK] Novo usuário - DDD: 98, Telefone: 5598991234567
🚫 [DDD-BLOCKED] DDD 98 bloqueado - Usuário: 123456789
```

**DDD permitido:**
```
📞 [CONTACT] Contato recebido - User: 123456789, Phone: 5511999999999, DDD: 11
✅ [DDD-ALLOWED] DDD 11 permitido - Usuário: 123456789 criado
```

## 🛡️ Segurança

1. ✅ Usuários não podem burlar compartilhando contato de outra pessoa
   - Sistema valida que o `user_id` do contato corresponde ao usuário
   
2. ✅ DDDs são validados (apenas 2 dígitos numéricos)

3. ✅ Telefones são armazenados de forma segura

4. ✅ Usuários existentes nunca são afetados

## 📝 Notas Importantes

### ⚠️ Limitações do Telegram

- O Telegram **não fornece** o telefone do usuário automaticamente
- O usuário **deve compartilhar** manualmente
- O bot **não pode** acessar o número sem permissão

### ✅ Usuários Existentes

Qualquer usuário que já existe na tabela `users` **não precisa** compartilhar telefone e tem acesso total, independente do DDD.

### 🔄 Manutenção

Para verificar quantos usuários existem por região:

```sql
SELECT 
  SUBSTRING(phone_number FROM 3 FOR 2) as ddd,
  COUNT(*) as total
FROM users
WHERE phone_number IS NOT NULL
GROUP BY ddd
ORDER BY total DESC;
```

## 🚀 Deploy

As alterações foram aplicadas automaticamente:

1. ✅ Migração SQL executada
2. ✅ Tabela `blocked_area_codes` criada
3. ✅ DDDs 98, 99, 86, 89 inseridos
4. ✅ Código atualizado no GitHub
5. ✅ Deploy automático via Vercel

## 📞 Suporte

Se um usuário reportar problema:

1. Verificar se o usuário já existe no banco
2. Verificar o DDD do telefone
3. Se necessário, usar `/removeddd` para desbloquear
4. Ou adicionar manualmente o usuário no banco

---

**Status:** ✅ Ativo  
**Versão:** 1.0  
**Última atualização:** 22/11/2025

