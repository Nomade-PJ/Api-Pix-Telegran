# 📦 Solução: Entrega de Pastas do Supabase Storage DIRETO no Telegram

## 🎯 Objetivo

Criar um sistema onde produtos podem ser vinculados a **pastas no Supabase Storage**, e quando o usuário comprar e for aprovado (automático ou pelo Admin), receber a pasta **DIRETO no chat do Telegram como arquivo ZIP**. Quando o usuário baixar do Telegram, ele já poderá abrir diretamente as fotos/vídeos sem precisar descompactar manualmente.

---

## 📊 Análise da Situação Atual

### ✅ **O que já temos:**
1. **Sistema de Media Packs** - Entrega arquivos individuais (fotos/vídeos) pelo Telegram
2. **Sistema de Produtos** - Entrega links ou arquivos individuais via `deliverFile()` que usa `tg.sendDocument()`
3. **Supabase Storage** - Bucket `media-packs` com pastas organizadas
4. **Tabela `products`** - Campos `delivery_type` e `delivery_url`
5. **Função `deliverFile()`** - Já envia arquivos diretamente no chat via `tg.sendDocument()`

### ❌ **Limitações do Supabase Storage:**
1. **Não há download direto de pasta** - O Supabase Storage não permite baixar uma pasta inteira diretamente
2. **Sem ZIP automático** - Não existe funcionalidade nativa para criar ZIP de pastas
3. **Apenas links de arquivos individuais** - Cada arquivo precisa de um link único

### ✅ **Como o Telegram Funciona:**
- O Telegram permite enviar arquivos ZIP diretamente no chat usando `sendDocument()`
- Quando o usuário baixa no celular (Android/iOS), o sistema operacional **descompacta automaticamente** na galeria
- No computador, ele pode descompactar com um clique
- **Não precisa de link externo!** - O arquivo fica no chat do Telegram

---

## 💡 Solução Única e Correta

### **Como Funciona:**

1. **Usuário clica no produto** (ex: "Packs da Val")
2. **Sistema gera QR Code PIX** (já funciona)
3. **Usuário paga** e envia comprovante
4. **Sistema aprova** (automático ou admin)
5. **Bot lista todos os arquivos da pasta** no Supabase Storage
6. **API gera ZIP dinamicamente** (baixa arquivos + cria ZIP)
7. **Bot envia ZIP DIRETO no chat** usando `tg.sendDocument()`
8. **Usuário baixa do Telegram** e as fotos aparecem direto na galeria!

---

## 🚀 Implementação Técnica

### **Arquitetura:**

```
Cliente paga → Aprovação → Bot chama API Vercel → 
API lista arquivos da pasta → Baixa todos os arquivos → 
Gera ZIP → Retorna buffer → Bot envia ZIP via sendDocument() → 
Cliente recebe no chat e baixa!
```

### **Por que API Vercel (e não Edge Function)?**

✅ **Vantagens:**
- Controle total do código Node.js
- Pode usar bibliotecas como `archiver` para ZIP
- Já temos estrutura na Vercel
- Melhor para processar arquivos grandes

⚠️ **Limitações a considerar:**
- Vercel tem timeout de 10s (plano gratuito) ou 60s (pro)
- Limite de memória: 1GB (plano gratuito)
- **Recomendação:** Pastas com até ~50 arquivos funcionam bem

---

## 📋 Passos de Implementação

### **Passo 1: Adicionar Campos no Banco de Dados**

```sql
-- Adicionar campos para vincular produto a pasta do Storage
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS storage_bucket TEXT DEFAULT 'media-packs',
ADD COLUMN IF NOT EXISTS storage_folder_path TEXT;

-- Exemplo: Vincular produto "Packs da Val" a pasta "packs_da_val"
UPDATE products
SET 
  storage_bucket = 'media-packs',
  storage_folder_path = 'packs_da_val',
  delivery_type = 'folder_zip'
WHERE product_id = 'packsdaval';
```

**Campos:**
- `storage_bucket`: Nome do bucket no Supabase (padrão: `media-packs`)
- `storage_folder_path`: Caminho da pasta dentro do bucket (ex: `packs_da_val` ou `pacote_premium`)
- `delivery_type`: Tipo de entrega → usar `folder_zip` para pastas

---

### **Passo 2: Criar API Endpoint na Vercel**

Criar arquivo: `api/generate-folder-zip.js`

**Responsabilidades:**
1. Receber `productId` e `folderPath` via POST
2. Listar todos os arquivos da pasta no Supabase Storage
3. Baixar todos os arquivos
4. Criar ZIP usando biblioteca `archiver`
5. Retornar o ZIP como buffer/stream
6. Bot usa esse buffer para enviar via `sendDocument()`

**Bibliotecas necessárias:**
- `archiver` - Para criar ZIP
- `axios` ou `fetch` - Para baixar arquivos do Storage
- `@supabase/supabase-js` - Para listar arquivos

---

### **Passo 3: Modificar `deliverContent()` em `src/deliver.js`**

Adicionar nova função:

```javascript
async function deliverFolderAsZip(chatId, product, db) {
  try {
    console.log(`📦 [DELIVER] Gerando ZIP da pasta: ${product.storage_folder_path}`);
    
    // 1. Chamar API para gerar ZIP
    const apiUrl = `${process.env.VERCEL_URL || 'https://seu-app.vercel.app'}/api/generate-folder-zip`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.API_SECRET_KEY}` // Segurança
      },
      body: JSON.stringify({
        bucket: product.storage_bucket || 'media-packs',
        folderPath: product.storage_folder_path,
        productId: product.product_id
      })
    });
    
    if (!response.ok) {
      throw new Error(`Erro ao gerar ZIP: ${response.statusText}`);
    }
    
    // 2. Receber ZIP como buffer
    const zipBuffer = Buffer.from(await response.arrayBuffer());
    
    // 3. Enviar ZIP DIRETO no chat do Telegram
    const filename = `${product.product_id}_${Date.now()}.zip`;
    
    await tg.sendDocument(chatId, {
      source: zipBuffer,
      filename: filename
    }, {
      caption: `✅ *PAGAMENTO CONFIRMADO!*\n\n📦 *${product.name}*\n\n📄 Aqui está sua pasta completa!\n\n💡 *Dica:* Ao baixar, as fotos aparecerão direto na galeria!`
    });
    
    console.log(`✅ [DELIVER] ZIP enviado com sucesso!`);
    return true;
    
  } catch (err) {
    console.error(`❌ [DELIVER] Erro ao entregar pasta:`, err.message);
    throw err;
  }
}
```

**Modificar `deliverContent()`:**

```javascript
async function deliverContent(chatId, product, caption = '✅ **Pagamento Confirmado!**') {
  // Verificar se é entrega de pasta
  if (product.delivery_type === 'folder_zip' && product.storage_folder_path) {
    await tg.sendMessage(chatId, `${caption}\n\n📦 *${product.name}*\n\n⏳ Gerando sua pasta...`, {
      parse_mode: 'Markdown'
    });
    return deliverFolderAsZip(chatId, product, db);
  }
  
  // ... resto do código atual (link, file, etc)
}
```

---

### **Passo 4: Modificar Fluxo de Aprovação**

Em `src/bot.js` (aprovação automática) e `src/admin.js` (aprovação manual):

Adicionar verificação antes de chamar `deliverContent()`:

```javascript
// Verificar se produto tem pasta vinculada
if (product.delivery_type === 'folder_zip' && product.storage_folder_path) {
  await deliver.deliverFolderAsZip(userChatId, product, db);
} else {
  await deliver.deliverContent(userChatId, product);
}
```

---

## 📁 Estrutura no Supabase Storage

**Organização recomendada:**

```
Bucket: media-packs
├── packs_da_val/
│   ├── foto1.jpg
│   ├── foto2.jpg
│   ├── foto3.jpg
│   ├── video1.mp4
│   └── ...
├── pacote_premium/
│   ├── img1.jpg
│   └── ...
└── outro_pack/
    └── ...
```

**Regras:**
- Cada pasta = um produto
- Pode ter fotos (.jpg, .png) e vídeos (.mp4, .mov)
- Sem subpastas dentro da pasta do produto (tudo na raiz da pasta)

---

## ⚙️ Configuração Necessária

### **1. Variáveis de Ambiente (Vercel):**

```
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=eyJ...
API_SECRET_KEY=chave-secreta-para-proteger-endpoint
```

### **2. Instalar Dependências:**

```bash
npm install archiver form-data
```

### **3. Configurar Bucket no Supabase:**

- Bucket precisa ser **público** para URLs funcionarem
- Ou usar `SUPABASE_SERVICE_ROLE_KEY` para acesso privado

---

## 🎯 Fluxo Completo do Usuário

1. **Usuário clica em "Packs da Val"** → Vê botão de comprar
2. **Clica em comprar** → Gera QR Code PIX
3. **Paga e envia comprovante** → Aguarda aprovação
4. **Sistema aprova** → Bot começa a processar
5. **Bot envia mensagem:** "⏳ Gerando sua pasta..."
6. **Bot lista arquivos da pasta** → Baixa todos → Gera ZIP
7. **Bot envia ZIP no chat:** "✅ PAGAMENTO CONFIRMADO! 📦 Packs da Val 📄 Aqui está sua pasta completa!"
8. **Usuário clica no arquivo ZIP** → Telegram baixa
9. **No celular:** Sistema descompacta automaticamente → Fotos aparecem na galeria
10. **No computador:** Pode descompactar com um clique

---

## ✅ Vantagens desta Solução

- ✅ **Arquivo vem direto no chat** - Não precisa clicar em link externo
- ✅ **Telegram descompacta automaticamente** no celular
- ✅ **Sempre atualizado** - ZIP gerado dinamicamente com arquivos atuais
- ✅ **Não ocupa espaço extra** no Storage (ZIP é gerado sob demanda)
- ✅ **Seguro** - Apenas clientes que pagaram recebem o ZIP
- ✅ **Funciona offline** - Arquivo fica salvo no chat do Telegram

---

## ⚠️ Limitações e Considerações

### **Limites da Vercel:**
- **Timeout:** 10s (free) ou 60s (pro) - Pastas muito grandes podem falhar
- **Memória:** 1GB (free) - Recomendado: até ~50 arquivos por pasta
- **Tamanho máximo:** Telegram aceita até 2GB por arquivo

### **Recomendações:**
- Para pastas grandes (>50 arquivos): Considere dividir em múltiplos produtos
- Para pastas muito grandes: Pré-gerar ZIP e armazenar no Storage (com atualização manual)
- Monitorar logs para identificar problemas de performance

---

## 🔐 Segurança

1. **Proteger endpoint `/api/generate-folder-zip`:**
   - Validar token de autenticação
   - Verificar se usuário realmente comprou o produto
   - Rate limiting para evitar abuso

2. **Bucket Storage:**
   - Pode manter público (apenas leitura)
   - Ou usar Service Role Key para acesso privado

---

## 📝 Próximos Passos (Checklist)

1. **Banco de Dados:**
   - [ ] Adicionar campos `storage_bucket` e `storage_folder_path` na tabela `products`
   - [ ] Vincular produtos existentes a suas pastas

2. **API Vercel:**
   - [ ] Criar arquivo `api/generate-folder-zip.js`
   - [ ] Instalar dependências (`archiver`)
   - [ ] Testar geração de ZIP localmente

3. **Código do Bot:**
   - [ ] Adicionar função `deliverFolderAsZip()` em `src/deliver.js`
   - [ ] Modificar `deliverContent()` para detectar `delivery_type === 'folder_zip'`
   - [ ] Atualizar fluxo de aprovação em `src/bot.js` e `src/admin.js`

4. **Testes:**
   - [ ] Testar com pasta pequena (3-5 arquivos)
   - [ ] Testar com pasta média (10-20 arquivos)
   - [ ] Verificar se ZIP é gerado corretamente
   - [ ] Verificar se arquivo chega no chat do Telegram
   - [ ] Testar download no celular (descompactação automática)

5. **Documentação:**
   - [ ] Documentar como vincular novos produtos a pastas
   - [ ] Criar guia para admin adicionar pastas no Storage

---

## 🎉 Resultado Final

**O usuário receberá a pasta completa como arquivo ZIP DIRETO no chat do Telegram, sem precisar clicar em links externos ou descompactar manualmente!**

---

*Documento atualizado em: 22/11/2025*  
*Versão: 2.0.0 - Solução Única e Correta*
