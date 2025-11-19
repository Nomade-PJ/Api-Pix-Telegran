# 🔧 Correção: Erro com Chave PIX de Telefone

## 📋 Problema Identificado

Quando a chave PIX era configurada com número de telefone **formatado** (contendo caracteres especiais), o sistema gerava payloads PIX inválidos.

### Exemplos de chaves problemáticas:
- ❌ `+(55) 98 9 8540-0784` (com parênteses, espaços e hífens)
- ❌ `+55 (98) 98540-0784` (com espaços e parênteses)
- ❌ `(98) 9 8540-0784` (sem código do país)

### Sintomas:
1. **Chaves funcionando normalmente:**
   - ✅ Email: `exemplo@email.com`
   - ✅ CPF: `12345678900`
   - ✅ Chave aleatória (UUID): `6f2a2e5d-5308-4588-ad31-ee81a67807d6`
   - ✅ Telefone sem formatação: `98985400784`

2. **Chaves com erro:**
   - ❌ Telefone formatado: `+(55) 98 9 8540-0784`
   - Erro: QR Code inválido ou não reconhecido pelos apps de pagamento

## 🔍 Causa Raiz

O payload PIX (BR Code) segue o padrão **EMV** do Banco Central do Brasil. Para chaves de telefone, o formato correto é:
- **Formato aceito:** `+5598985400784` (apenas + e dígitos, sem espaços/parênteses/hífens)
- **Formato rejeitado:** `+(55) 98 9 8540-0784`

Os caracteres especiais quebram a estrutura do payload, tornando o QR Code inválido.

## ✅ Solução Implementada

### 1. Função de Sanitização de Chave PIX (`sanitizePixKey`)

Criada função que **detecta e normaliza** automaticamente qualquer tipo de chave PIX:

```javascript
// Arquivo: src/pix/manual.js

function sanitizePixKey(key) {
  // Detecta o tipo de chave e normaliza:
  
  // 1. TELEFONE (com caracteres especiais)
  //    Entrada: +(55) 98 9 8540-0784
  //    Saída:   +5598985400784
  
  // 2. EMAIL
  //    Entrada: Exemplo@Email.Com
  //    Saída:   exemplo@email.com
  
  // 3. CPF/CNPJ
  //    Entrada: 123.456.789-00
  //    Saída:   12345678900
  
  // 4. CHAVE ALEATÓRIA (UUID)
  //    Entrada: 6F2A2E5D-5308-4588-AD31-EE81A67807D6
  //    Saída:   6f2a2e5d-5308-4588-ad31-ee81a67807d6
}
```

### 2. Integração no Fluxo de Geração de Cobrança

A chave é sanitizada **antes** de gerar o payload PIX:

```javascript
// Buscar chave do banco
const rawKey = await db.getPixKey(); // Ex: "+(55) 98 9 8540-0784"

// Sanitizar
const key = sanitizePixKey(rawKey);  // Resultado: "+5598985400784"

// Gerar payload com chave válida
const copiaCola = createPixPayload(key, amount, txid);
```

### 3. Validação no Comando `/setpix`

Agora quando o admin configura a chave PIX, o sistema valida e mostra a normalização:

```
/setpix +(55) 98 9 8540-0784

✅ Chave PIX atualizada com sucesso!
🔑 Chave configurada: +(55) 98 9 8540-0784
🔧 Será normalizada para: +5598985400784
✅ Alteração PERMANENTE salva no banco de dados!
```

## 📊 Resultados no Banco de Dados

### Análise das transações existentes:

| Chave PIX | Quantidade | Status |
|-----------|------------|--------|
| `carlosbytech@gmail.com` | 14 | ✅ Válida |
| `canalstvoficial@gmail.com` | 9 | ✅ Válida |
| `98985400784` | 7 | ✅ Válida |
| `07559192386` | 3 | ✅ Válida |
| `+(55) 98 9 8540-0784` | 1 | ❌ **Inválida** (corrigida pelo sistema) |
| `6f2a2e5d-5308-4588-ad31-ee81a67807d6` | 1 | ✅ Válida |
| `josecarlosdev24h@gmail.com` | 1 | ✅ Válida |

## 🧪 Testes

### Cenário 1: Telefone com formatação completa
```
Entrada:  /setpix +(55) 98 9 8540-0784
Saída:    Chave normalizada para +5598985400784
Status:   ✅ CORRIGIDO
```

### Cenário 2: Telefone sem código de país
```
Entrada:  /setpix (98) 98540-0784
Saída:    Chave normalizada para +559898540784
Status:   ✅ CORRIGIDO
```

### Cenário 3: Telefone só com números
```
Entrada:  /setpix 98985400784
Saída:    Chave normalizada para +5598985400784
Status:   ✅ CORRIGIDO
```

### Cenário 4: Email (sem mudança)
```
Entrada:  /setpix Exemplo@Email.Com
Saída:    Chave normalizada para exemplo@email.com
Status:   ✅ OK
```

### Cenário 5: CPF com formatação
```
Entrada:  /setpix 123.456.789-00
Saída:    Chave normalizada para 12345678900
Status:   ✅ OK
```

### Cenário 6: Chave aleatória (UUID)
```
Entrada:  /setpix 6f2a2e5d-5308-4588-ad31-ee81a67807d6
Saída:    Sem normalização (já está no formato correto)
Status:   ✅ OK
```

## 📝 Arquivos Modificados

1. **`src/pix/manual.js`**
   - ✅ Adicionada função `sanitizePixKey()`
   - ✅ Integrada no `createManualCharge()`
   - ✅ Exportada para uso em outros módulos

2. **`src/admin.js`**
   - ✅ Validação de chave no comando `/setpix`
   - ✅ Feedback visual mostrando normalização
   - ✅ Mensagens de erro mais descritivas

## 🚀 Como Usar

### Para Admins:
Configure a chave PIX com **qualquer formato**:

```bash
/setpix +55 (98) 9 8540-0784
# ou
/setpix 98985400784
# ou
/setpix exemplo@email.com
```

O sistema automaticamente:
1. ✅ Valida o formato
2. ✅ Normaliza para o padrão PIX
3. ✅ Salva no banco de dados
4. ✅ Gera payloads válidos para todas as transações

### Para Usuários:
Nenhuma mudança! O processo de compra continua igual:
1. Clique no produto
2. Receba o QR Code PIX **válido**
3. Pague normalmente
4. Envie o comprovante

## 🎯 Benefícios

1. **✅ Flexibilidade:** Admin pode configurar telefone em qualquer formato
2. **✅ Segurança:** Validação rigorosa antes de salvar
3. **✅ Compatibilidade:** Payloads PIX sempre no formato correto
4. **✅ Transparência:** Mostra como a chave será normalizada
5. **✅ Retrocompatibilidade:** Chaves antigas continuam funcionando
6. **✅ Zero impacto:** Usuários não percebem a mudança

## 📞 Suporte

Se encontrar algum problema com chaves PIX:
1. Verifique se a chave está no formato correto usando `/setpix` sem argumentos
2. Reconfigure a chave com `/setpix [nova-chave]`
3. Teste gerando uma nova cobrança

---

**Status:** ✅ Implementado e Testado
**Data:** 19 de Novembro de 2025
**Versão:** 2.0 - Correção de Chave Telefone

