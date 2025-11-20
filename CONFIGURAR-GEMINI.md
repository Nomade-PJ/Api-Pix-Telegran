# 🚀 Como Configurar Google Gemini (GRATUITO)

## 📋 Passo a Passo Completo

### 1. Obter API Key do Google Gemini

1. **Acesse:** https://aistudio.google.com
2. **Faça login** com sua conta Google
3. **Clique em "Get API key"** (no canto inferior esquerdo ou no menu)
4. **Crie um novo projeto** ou selecione um existente
5. **Copie a API Key** gerada
   - Formato: `AIzaSy...` (começa com AIzaSy)

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

## 💰 Custos

- **Google Gemini:** 100% GRATUITO
- **Limite:** 15 requisições por minuto (suficiente para uso normal)
- **Sem custos ocultos**

## 🎯 Vantagens do Gemini

- ✅ Gratuito
- ✅ Precisão similar ao GPT-4o-mini
- ✅ Suporta PDFs e imagens
- ✅ Rápido
- ✅ API key gratuita e fácil de obter

