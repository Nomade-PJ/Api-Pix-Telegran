# 📦 CONFIGURAR ENTREGA DE CONTEÚDO

## 🎯 **OPÇÕES PARA ENTREGAR CONTEÚDO AOS CLIENTES**

---

## **OPÇÃO 1: Google Drive (Mais Fácil)**

### **Passo 1: Fazer Upload**
1. Acesse: https://drive.google.com
2. Clique em "Novo" → "Upload de arquivo"
3. Faça upload do seu conteúdo (ZIP, PDF, etc.)

### **Passo 2: Obter Link Público**
1. Clique com botão direito no arquivo
2. "Compartilhar"
3. Mude para **"Qualquer pessoa com o link"**
4. Copie o link

### **Passo 3: Configurar no Supabase**

Execute no **SQL Editor** do Supabase:

```sql
-- Atualizar link do Pack A
UPDATE products
SET delivery_url = 'https://drive.google.com/file/d/SEU_ID_AQUI/view?usp=sharing'
WHERE product_id = 'packA';

-- Atualizar link do Pack B
UPDATE products
SET delivery_url = 'https://drive.google.com/file/d/SEU_ID_AQUI/view?usp=sharing'
WHERE product_id = 'packB';
```

---

## **OPÇÃO 2: Supabase Storage (Recomendado)**

### **Vantagens:**
✅ Tudo no mesmo lugar
✅ Links privados e seguros
✅ Controle total
✅ Gratuito até 1GB

### **Passo 1: Criar Bucket**

Execute no **SQL Editor** do Supabase:

```sql
-- Criar bucket para produtos
INSERT INTO storage.buckets (id, name, public)
VALUES ('produtos', 'produtos', true);
```

### **Passo 2: Upload via Dashboard**

1. Acesse: https://supabase.com/dashboard/project/quiguiyvbtgyqurocawk/storage/buckets
2. Clique em **"produtos"**
3. Clique em **"Upload file"**
4. Faça upload dos arquivos:
   - `packA.zip`
   - `packB.zip`

### **Passo 3: Obter URL e Configurar**

As URLs ficarão assim:
```
https://quiguiyvbtgyqurocawk.supabase.co/storage/v1/object/public/produtos/packA.zip
```

Execute no SQL Editor:

```sql
-- Atualizar URLs dos produtos
UPDATE products
SET delivery_url = 'https://quiguiyvbtgyqurocawk.supabase.co/storage/v1/object/public/produtos/packA.zip'
WHERE product_id = 'packA';

UPDATE products
SET delivery_url = 'https://quiguiyvbtgyqurocawk.supabase.co/storage/v1/object/public/produtos/packB.zip'
WHERE product_id = 'packB';
```

---

## **OPÇÃO 3: Mega.nz**

### **Vantagens:**
✅ 20GB grátis
✅ Links diretos
✅ Sem limite de downloads

### **Como usar:**
1. Acesse: https://mega.nz
2. Faça upload do arquivo
3. Clique com botão direito → "Obter link"
4. Configure no Supabase (mesmo SQL das opções acima)

---

## **OPÇÃO 4: Telegram (Para Arquivos Pequenos)**

### **Enviar arquivo diretamente pelo Telegram:**

Modifique `src/deliver.js`:

```javascript
async function deliverFile(chatId, fileUrl, filename = 'pack.zip') {
  // Se for URL do Telegram (file_id), envia direto
  if (fileUrl.startsWith('file_id:')) {
    const fileId = fileUrl.replace('file_id:', '');
    return tg.sendDocument(chatId, fileId);
  }
  
  // Senão, envia via URL
  return tg.sendDocument(chatId, { url: fileUrl }, { filename });
}
```

**Configure no Supabase:**
```sql
UPDATE products
SET delivery_type = 'file',
    delivery_url = 'file_id:BAACAgEAAxkBAAID...'
WHERE product_id = 'packA';
```

---

## 🎯 **TESTAR ENTREGA**

Depois de configurar, faça um teste:

1. **Compre algo no bot**
2. **Envie uma foto (comprovante fake)**
3. **Use `/validar_[txid]`**
4. **Cliente deve receber o link/arquivo!**

---

## 🔍 **VER CONFIGURAÇÃO ATUAL**

Execute no Supabase SQL Editor:

```sql
SELECT product_id, name, price, delivery_type, delivery_url
FROM products;
```

---

## 📝 **EXEMPLO COMPLETO**

### **1. Upload no Google Drive**
- Arquivo: `Pack_A_Premium.zip`
- Link: `https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I/view?usp=sharing`

### **2. Configurar no Supabase**
```sql
UPDATE products
SET delivery_url = 'https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I/view?usp=sharing'
WHERE product_id = 'packA';
```

### **3. Testar**
- Cliente compra
- Você valida: `/validar_M87588057GRGV`
- Cliente recebe:
```
✅ Pagamento Confirmado!

Seu acesso ao Pack A foi liberado!

Acesse aqui:
https://drive.google.com/file/d/1A2B3C4D5E6F7G8H9I/view?usp=sharing
```

---

## 🚀 **RECOMENDAÇÃO**

Use **Google Drive** ou **Supabase Storage** para começar.

São as opções mais confiáveis e profissionais!

---

## ⚙️ **CONFIGURAÇÃO RÁPIDA (Google Drive)**

```sql
-- Pack A
UPDATE products
SET delivery_url = 'SEU_LINK_DO_DRIVE_PACK_A'
WHERE product_id = 'packA';

-- Pack B
UPDATE products
SET delivery_url = 'SEU_LINK_DO_DRIVE_PACK_B'
WHERE product_id = 'packB';
```

**Pronto! Agora ao validar, o cliente recebe o link automaticamente!**

