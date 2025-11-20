# 🚀 Como Configurar Google Gemini (GRATUITO)

## 📋 Passo a Passo Completo

### 1. Obter API Key do Google Gemini

1. **Acesse:** https://aistudio.google.com
2. **Faça login** com sua conta Google
3. **Clique em "Get API key"** (no canto inferior esquerdo ou no menu)
4. **Crie um novo projeto** ou selecione um existente
5. ⚠️ **Se solicitado:** Configure conta de faturamento no Google Cloud (mas não será cobrado dentro dos limites gratuitos)
6. **Copie a API Key** gerada
   - Formato: `AIzaSy...` (começa com AIzaSy)

⚠️ **Nota:** Se você não quiser configurar método de pagamento, pode usar apenas o OCR.space (já configurado e 100% gratuito sem necessidade de pagamento).

### 2. Adicionar no Código

A API key será adicionada automaticamente quando você configurar na Vercel (veja passo 3).

### 3. Configurar na Vercel

1. **Acesse:** https://vercel.com
2. **Selecione o projeto:** api-pix-telegran
3. **Vá em:** Settings → Environment Variables
4. **Adicione:**
   - **Name:** `GEMINI_API_KEY`
   - **Value:** `AlzaSyBa4c1rNDqm6WZW2pUaaRffvq2Iqqoz8PA` (sua chave)
   - **Environment:** Selecione Production, Preview e Development
5. **Clique em Save**

⚠️ **IMPORTANTE:** Guarde sua chave em local seguro! Você não poderá vê-la novamente depois.

### 4. Fazer Redeploy

1. Vá em **Deployments**
2. Clique nos **3 pontos** do último deployment
3. Selecione **Redeploy**
4. Aguarde concluir

## ✅ Pronto!

O Google Gemini será usado automaticamente como método de análise, oferecendo precisão similar ao GPT-4o-mini, mas **100% GRATUITO**!

## 🔄 Ordem de Análise:

1. ⭐ **Google Gemini** - **GRATUITO** ⭐ (se configurada)
2. 📄 **OCR.space (upload direto)** - gratuito
3. 📄 **OCR.space (URL)** - fallback gratuito
4. ⚠️ Validação manual

## 💰 Custos e Método de Pagamento

⚠️ **IMPORTANTE:** A API do Google Gemini requer uma conta de faturamento no Google Cloud, MAS:
- ✅ **Você NÃO será cobrado** se ficar dentro dos limites gratuitos
- ✅ **Crédito gratuito:** Geralmente há um crédito inicial (ex: $300) que cobre uso normal
- ✅ **Limite gratuito:** 15 requisições por minuto (suficiente para uso normal)
- ⚠️ **Método de pagamento:** Pode ser solicitado para criar a conta de faturamento, mas não será cobrado se não ultrapassar os limites gratuitos

### Como configurar conta de faturamento (se necessário):

1. Acesse: https://console.cloud.google.com
2. Selecione seu projeto (ou crie um novo)
3. Vá em **Faturamento** → **Criar conta**
4. Adicione método de pagamento (cartão de crédito)
5. ⚠️ **IMPORTANTE:** Configure alertas de orçamento para evitar cobranças inesperadas
6. O Google oferece crédito gratuito inicial que cobre uso normal

### Alternativa SEM método de pagamento:

Se você não quiser configurar método de pagamento, o sistema funciona perfeitamente apenas com:
- ✅ **OCR.space** (100% gratuito, sem API key obrigatória)
- ✅ **Validação manual** (admin aprova/rejeita)

## 🎯 Vantagens do Gemini

- ✅ Gratuito
- ✅ Precisão similar ao GPT-4o-mini
- ✅ Suporta PDFs e imagens
- ✅ Rápido
- ✅ API key gratuita e fácil de obter

