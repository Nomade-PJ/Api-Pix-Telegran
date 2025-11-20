# 🔑 Como Configurar a Chave API da OpenAI

## ✅ Chave Criada com Sucesso!

Sua chave API da OpenAI foi criada. Agora você precisa configurá-la na Vercel para que o sistema use a análise automática mais precisa.

## 📋 Passo a Passo

### 1. Acesse o Painel da Vercel

1. Acesse: https://vercel.com
2. Faça login na sua conta
3. Selecione o projeto: **api-pix-telegran**

### 2. Adicione a Variável de Ambiente

1. No menu do projeto, clique em **Settings**
2. No menu lateral, clique em **Environment Variables**
3. Clique em **Add New**
4. Preencha:
   - **Name:** `OPENAI_API_KEY`
   - **Value:** Cole sua chave API (a que você acabou de criar)
   - **Environment:** Selecione **Production**, **Preview** e **Development** (ou apenas Production se preferir)
5. Clique em **Save**

### 3. Faça o Redeploy (Importante!)

Após adicionar a variável de ambiente:

1. Vá para a aba **Deployments**
2. Clique nos **3 pontos** do último deployment
3. Selecione **Redeploy**
4. Aguarde o deploy concluir

## ✅ Pronto!

Agora o sistema vai usar a OpenAI como primeiro método de análise, que é o mais preciso!

## 🔄 Ordem de Análise (com OpenAI configurada):

1. ✅ **OpenAI Vision API** (mais preciso) - **AGORA ATIVO!**
2. 📄 pdf-parse (gratuito, para PDFs com texto)
3. 🔬 Tesseract.js (gratuito, OCR local)
4. 📄 OCR.space (gratuito com limites)
5. ⚠️ Validação manual (se todos falharem)

## 🔒 Segurança

⚠️ **IMPORTANTE:** 
- Nunca compartilhe sua chave API
- Não commite a chave no GitHub
- Mantenha-a apenas nas variáveis de ambiente da Vercel

## 💰 Custos

A OpenAI cobra por uso. Para comprovantes PIX:
- **GPT-4o-mini:** ~$0.01 por análise
- **Limite gratuito:** $5 de crédito inicial (suficiente para ~500 análises)

## 🆘 Problemas?

Se a análise não funcionar:
1. Verifique se a variável está configurada corretamente
2. Verifique se fez o redeploy após adicionar a variável
3. Verifique os logs no Vercel para ver erros específicos
4. O sistema automaticamente usa métodos gratuitos se a OpenAI falhar

