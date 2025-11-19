# 🤖 Verificação Automática de Pagamento PIX

## Como Funcionar

Agora o bot suporta verificação **MANUAL** e **AUTOMÁTICA** de pagamentos!

---

## ✅ **MODO ATUAL: MANUAL (Já Funciona!)**

1. Cliente clica em "Comprar"
2. Bot gera QR Code PIX
3. Cliente paga e envia comprovante
4. **VOCÊ valida** e chama a API para liberar
5. Cliente recebe o acesso

---

## 🚀 **MODO AUTOMÁTICO (Nova Funcionalidade)**

Para ativar verificação automática, você precisa de um **PSP (Provedor de Pagamento)**:

### **Opções de PSP:**

1. **Mercado Pago** (Recomendado - Gratuito para começar)
2. **PagSeguro**
3. **Gerencianet (Efi Pay)**
4. **Asaas**
5. **Banco do Brasil / Bradesco / Itaú** (API PIX própria)

---

## 📋 **PASSO A PASSO - MERCADO PAGO (Exemplo)**

### **1. Criar Conta no Mercado Pago**
- Acesse: https://www.mercadopago.com.br
- Crie uma conta empresarial (grátis)

### **2. Obter Credenciais**
1. Entre em **Seu Negócio** → **Configurações** → **Credenciais**
2. Copie:
   - `Access Token` (produção)
   - `Public Key`

### **3. Configurar Webhook**
1. No Mercado Pago: **Webhooks** → **Adicionar**
2. URL do webhook: `https://api-pix-telegran.vercel.app/api/webhook-pix`
3. Eventos: Selecione **"Pagamentos"**

### **4. Adicionar Variáveis na Vercel**
```
MERCADOPAGO_ACCESS_TOKEN=seu_access_token_aqui
PIX_WEBHOOK_SECRET=senha_secreta_webhook
```

### **5. Modificar o Código**

Em `src/pix/manual.js`, substitua a função `createManualCharge` para usar Mercado Pago:

```javascript
const axios = require('axios');

async function createManualCharge({ amount, productId }) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  
  // Criar pagamento no Mercado Pago
  const response = await axios.post(
    'https://api.mercadopago.com/v1/payments',
    {
      transaction_amount: parseFloat(amount),
      description: `Compra de ${productId}`,
      payment_method_id: 'pix',
      payer: {
        email: 'cliente@exemplo.com'
      },
      external_reference: productId
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const qrCode = response.data.point_of_interaction.transaction_data.qr_code;
  const qrCodeBase64 = response.data.point_of_interaction.transaction_data.qr_code_base64;
  const txid = response.data.id;

  return {
    mode: 'automatic',
    charge: {
      txid: txid.toString(),
      key: process.env.MY_PIX_KEY,
      amount,
      copiaCola: qrCode,
      qrcodeBuffer: Buffer.from(qrCodeBase64, 'base64')
    }
  };
}
```

---

## 🔄 **COMO FUNCIONA O AUTOMÁTICO:**

1. Cliente clica em "Comprar"
2. Bot gera cobrança no **Mercado Pago**
3. Cliente paga via PIX
4. **Mercado Pago detecta o pagamento**
5. Mercado Pago chama o webhook: `/api/webhook-pix`
6. **Bot libera acesso AUTOMATICAMENTE**
7. Cliente recebe o link/arquivo imediatamente!

---

## ⏱️ **COMPARAÇÃO:**

| Aspecto | Manual | Automático |
|---------|--------|------------|
| **Velocidade** | 5-30 min | Instantâneo (segundos) |
| **Trabalho** | Você valida cada compra | Totalmente automático |
| **Custo** | Grátis | Taxa do PSP (~1-2%) |
| **Segurança** | Alta | Muito Alta |
| **Escalabilidade** | Limitada | Ilimitada |

---

## 💰 **CUSTOS DOS PSPs:**

- **Mercado Pago:** ~1,99% por transação PIX
- **PagSeguro:** ~1,99% por transação
- **Gerencianet:** A partir de 0,99%
- **Asaas:** R$ 0,80 por PIX recebido

---

## 🎯 **RECOMENDAÇÃO:**

### **Para começar (até 100 vendas/mês):**
✅ Use o **modo manual** (atual)
- Grátis
- Funcional
- Você controla tudo

### **Para escalar (100+ vendas/mês):**
✅ Migre para **Mercado Pago** ou **Gerencianet**
- Automatizado
- Rápido
- Confiável

---

## 📞 **PRECISA DE AJUDA PARA CONFIGURAR?**

1. Me diga qual PSP você quer usar
2. Eu te ajudo a integrar completamente!

---

## 🔗 **LINKS ÚTEIS:**

- [Mercado Pago - Documentação PIX](https://www.mercadopago.com.br/developers/pt/docs/checkout-api/integration-configuration/integrate-with-pix)
- [Gerencianet - API PIX](https://dev.gerencianet.com.br/docs/api-pix-endpoints)
- [PagSeguro - PIX](https://dev.pagseguro.uol.com.br/reference/pix-intro)

---

**Por enquanto, seu bot está no modo MANUAL e funcionando perfeitamente!** ✅

