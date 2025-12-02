# 🔧 CORREÇÃO: Comprovante de Grupo não Enviado ao Admin

## 📋 Problema Identificado

Quando um usuário enviava um comprovante de pagamento para um grupo (ex: "Privadinho da Val"), o comprovante **não estava sendo enviado corretamente ao admin** para aprovação.

### Causa Raiz

1. **Transações de grupo não usavam `group_id`**: As transações eram criadas com `productId` no formato `group_${group.group_id}` em vez de usar o campo `group_id` (UUID interno) diretamente.

2. **Função `notifyAdmins` não identificava grupos**: A função que envia comprovantes aos admins não verificava se a transação era de um grupo, então não buscava e exibia o nome do grupo corretamente.

3. **`transactionData` não incluía `group_id`**: Quando o comprovante era processado, o `group_id` não estava sendo passado no objeto `transactionData`, causando falhas na identificação.

---

## ✅ Correções Implementadas

### 1. **Criação de Transação de Grupo** (`src/bot.js` linha ~1515)

**ANTES:**
```javascript
await db.createTransaction({
  txid,
  userId: user.id,
  telegramId: ctx.chat.id,
  productId,  // ❌ Usando productId no formato antigo
  amount,
  pixKey: charge.key,
  pixPayload: charge.copiaCola
});
```

**DEPOIS:**
```javascript
await db.createTransaction({
  txid,
  userId: user.id,
  telegramId: ctx.chat.id,
  groupId: group.id,  // ✅ Usando UUID interno do grupo
  amount,
  pixKey: charge.key,
  pixPayload: charge.copiaCola
});
```

### 2. **Função `notifyAdmins` - Identificação de Grupos** (`src/bot.js` linha ~567)

**Adicionada verificação prioritária para grupos:**

```javascript
// 🆕 PRIMEIRO: Verificar se é grupo (prioridade)
if (transaction.group_id) {
  console.log(`👥 [NOTIFY] Transação é de grupo (group_id: ${transaction.group_id})`);
  try {
    const { data: groupData, error: groupError } = await db.supabase
      .from('groups')
      .select('group_name, group_id')
      .eq('id', transaction.group_id)
      .single();
    
    if (!groupError && groupData) {
      productName = groupData.group_name || `Grupo ${groupData.group_id}` || 'Grupo';
      console.log(`✅ [NOTIFY] Grupo encontrado: ${productName}`);
    }
  } catch (groupErr) {
    console.error('Erro ao buscar grupo:', groupErr);
    productName = 'Grupo (erro ao buscar)';
  }
}
```

**Compatibilidade com formato antigo:**
- Se `product_id` começar com `group_`, ainda tenta buscar o grupo
- Garante retrocompatibilidade com transações antigas

### 3. **Inclusão de `group_id` em `transactionData`** (`src/bot.js` linha ~725)

**Adicionado:**
```javascript
const transactionData = {
  txid: transaction.txid,
  amount: transaction.amount,
  pix_key: transaction.pix_key,
  pix_payload: transaction.pix_payload || transaction.pixPayload,
  product_id: transaction.product_id,
  media_pack_id: transaction.media_pack_id,
  group_id: transaction.group_id, // 🆕 Incluído
  user_id: transaction.user_id
};
```

### 4. **Mensagem de Notificação Melhorada** (`src/bot.js` linha ~642)

**Adicionado label específico para grupos:**
```javascript
// 🆕 Detectar se é grupo para mensagem especial
const isGroupTransaction = transaction.group_id || 
                          (transaction.product_id && transaction.product_id.startsWith('group_'));
const productLabel = isGroupTransaction ? '👥 Grupo' : '📦 Produto';

const caption = `...
${productLabel}: ${productName}
...`;
```

### 5. **Identificação de Grupos na Análise Automática** (`src/bot.js` linha ~820)

**Adicionada verificação de grupos também na análise automática OCR**, garantindo que mesmo em aprovação automática, o grupo seja identificado corretamente.

---

## 🎯 Resultado

Agora, quando um usuário envia um comprovante de pagamento para um grupo:

1. ✅ O comprovante é **enviado imediatamente ao admin** com a foto/documento
2. ✅ A mensagem mostra claramente que é um **👥 Grupo** (não "📦 Produto")
3. ✅ O **nome do grupo** é exibido corretamente (ex: "Privadinho da Val")
4. ✅ Os **botões de aprovação/rejeição** aparecem corretamente
5. ✅ Compatibilidade com transações antigas mantida (formato `group_${id}`)

---

## 📊 Fluxo Corrigido

```
1. Usuário clica em "Privadinho da Val" → subscribe:group_telegram_id
2. Bot cria transação COM group_id (UUID interno)
3. Usuário paga e envia comprovante
4. Bot salva comprovante no banco
5. Bot identifica que é grupo (group_id presente)
6. Bot busca nome do grupo no banco
7. Bot envia comprovante ao admin COM:
   - Foto/documento anexado
   - Mensagem: "👥 Grupo: Privadinho da Val"
   - Botões: ✅ Aprovar | ❌ Rejeitar
8. Admin aprova → Usuário é adicionado ao grupo
```

---

## 🔍 Logs Adicionados

Para facilitar debug futuro, foram adicionados logs:

```javascript
console.log(`📋 [HANDLER] Detalhes da transação:`, {
  txid: transaction.txid,
  product_id: transaction.product_id,
  media_pack_id: transaction.media_pack_id,
  group_id: transaction.group_id, // 🆕
  amount: transaction.amount
});

console.log(`👥 [NOTIFY] Transação é de grupo (group_id: ${transaction.group_id})`);
console.log(`✅ [NOTIFY] Grupo encontrado: ${productName}`);
```

---

## ✅ Teste Recomendado

1. Criar/verificar que existe um grupo cadastrado
2. Fazer uma compra de grupo como usuário
3. Enviar um comprovante (foto ou PDF)
4. Verificar que o admin recebe:
   - ✅ Comprovante anexado (foto ou documento)
   - ✅ Mensagem com "👥 Grupo: [Nome do Grupo]"
   - ✅ Botões de aprovação/rejeição funcionando

---

**Data da Correção:** 2025-01-27  
**Arquivo Modificado:** `src/bot.js`  
**Linhas Afetadas:** ~567-633, ~725-733, ~820-839, ~1515-1523, ~642-651

