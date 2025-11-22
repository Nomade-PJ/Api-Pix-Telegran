# 📸 Sistema de Media Packs - Guia Completo

## 🎯 O que é um Media Pack?

Um **Media Pack** é um produto especial que entrega **fotos/vídeos aleatórios** para o cliente a cada compra.

### ✨ Características:
- 📦 Pool de mídias (ex: 12 fotos/vídeos)
- 🎲 Entrega aleatória (ex: 3 itens por compra)
- 🔄 Itens diferentes a cada compra
- 📊 Sistema anti-repetição inteligente
- 💾 Armazenamento no Supabase Storage

---

## 🗄️ Estrutura do Banco de Dados

### Tabelas criadas:

#### 1. **`media_packs`** - Packs de mídia
```sql
- pack_id (text, único) - ID do pack
- name (text) - Nome do pack
- description (text) - Descrição
- price (numeric) - Preço
- items_per_delivery (integer) - Quantos itens enviar (padrão: 3)
- is_active (boolean) - Ativo/Inativo
```

#### 2. **`media_items`** - Itens individuais de mídia
```sql
- pack_id (text) - Referência ao pack
- file_name (text) - Nome do arquivo
- file_url (text) - URL do arquivo no Supabase Storage
- file_type (text) - 'photo' ou 'video'
- storage_path (text) - Caminho no storage
- thumbnail_url (text) - URL da miniatura
- size_bytes (bigint) - Tamanho do arquivo
- is_active (boolean) - Ativo/Inativo
```

#### 3. **`media_deliveries`** - Histórico de entregas
```sql
- transaction_id (uuid) - Referência à transação
- user_id (uuid) - Referência ao usuário
- pack_id (text) - Referência ao pack
- media_item_id (uuid) - Referência ao item entregue
- delivered_at (timestamptz) - Data/hora da entrega
```

---

## 🚀 Como Funciona

### 1. **Fluxo de Compra:**

```
Cliente clica no pack → Gera QR Code PIX → Cliente paga → 
Envia comprovante → Admin aprova → Sistema entrega 3 itens aleatórios
```

### 2. **Algoritmo de Seleção Aleatória:**

```javascript
1. Buscar todos os itens já entregues para este usuário
2. Filtrar itens NÃO entregues
3. Se todos foram entregues → RESETAR e usar todos os itens
4. Embaralhar itens disponíveis
5. Selecionar N itens (padrão: 3)
6. Enviar para o cliente
7. Registrar entrega no histórico
```

---

## 📱 Interface do Cliente

### Menu Principal (`/start`):
```
👋 Olá! Bem-vindo ao Bot da Val 🌶️🔥

Escolha uma opção abaixo:

[💎 Packs da Val 🌶️🔥 (R$59.90)]  ← Produto normal
[📸 Pack de Fotos Premium (R$29.90)]  ← NOVO! Media Pack
[👥 Entrar no grupo (R$30.00/mês)]
[💬 Suporte]
```

### Após compra aprovada:
```
✅ PAGAMENTO CONFIRMADO!

📸 Pack de Fotos Premium

Enviando 3 itens aleatórios...

📸 [foto1.jpg]
📸 [foto2.jpg]
🎥 [video1.mp4]

🎉 Entrega completa!

✅ 3 itens enviados com sucesso!

💡 Dica: A cada compra você receberá itens diferentes!

📊 Total de itens no pack: 12
```

---

## 🔧 Como Configurar (Administrador)

### Opção 1: Via Supabase Dashboard (RECOMENDADO)

#### **Passo 1: Criar o Pack**

1. Acesse: **Supabase Dashboard** → **Table Editor** → **media_packs**
2. Clique em **Insert** → **Insert row**
3. Preencha:
   ```
   pack_id: "pack_premium"
   name: "Pack de Fotos Premium"
   description: "3 fotos aleatórias de alta qualidade"
   price: 29.90
   items_per_delivery: 3
   is_active: true
   ```
4. Salve

#### **Passo 2: Upload de Mídias no Supabase Storage**

1. Acesse: **Supabase Dashboard** → **Storage**
2. Crie um bucket: **`media-packs`**
3. Configure como **Público** (para URLs funcionarem)
4. Faça upload das fotos/vídeos:
   ```
   media-packs/
     ├── pack_premium/
     │   ├── foto1.jpg
     │   ├── foto2.jpg
     │   ├── foto3.jpg
     │   ├── foto4.jpg
     │   ├── ... (até 12 itens)
     ```

#### **Passo 3: Registrar os Itens**

1. Acesse: **Table Editor** → **media_items**
2. Para cada foto/vídeo, **Insert row**:
   ```
   pack_id: "pack_premium"
   file_name: "foto1.jpg"
   file_url: "https://[seu-projeto].supabase.co/storage/v1/object/public/media-packs/pack_premium/foto1.jpg"
   file_type: "photo"  (ou "video")
   storage_path: "media-packs/pack_premium/foto1.jpg"
   is_active: true
   ```
3. Repita para todas as 12 mídias

---

### Opção 2: Via SQL (RÁPIDO)

Execute no **SQL Editor** do Supabase:

```sql
-- 1. Criar o pack
INSERT INTO media_packs (pack_id, name, description, price, items_per_delivery)
VALUES ('pack_premium', 'Pack de Fotos Premium', '3 fotos aleatórias de alta qualidade', 29.90, 3);

-- 2. Adicionar itens (repita para cada mídia)
INSERT INTO media_items (pack_id, file_name, file_url, file_type, storage_path)
VALUES 
  ('pack_premium', 'foto1.jpg', 'https://[seu-projeto].supabase.co/storage/v1/object/public/media-packs/pack_premium/foto1.jpg', 'photo', 'media-packs/pack_premium/foto1.jpg'),
  ('pack_premium', 'foto2.jpg', 'https://[seu-projeto].supabase.co/storage/v1/object/public/media-packs/pack_premium/foto2.jpg', 'photo', 'media-packs/pack_premium/foto2.jpg'),
  ('pack_premium', 'foto3.jpg', 'https://[seu-projeto].supabase.co/storage/v1/object/public/media-packs/pack_premium/foto3.jpg', 'photo', 'media-packs/pack_premium/foto3.jpg'),
  -- ... adicione todas as 12 mídias aqui
  ('pack_premium', 'foto12.jpg', 'https://[seu-projeto].supabase.co/storage/v1/object/public/media-packs/pack_premium/foto12.jpg', 'photo', 'media-packs/pack_premium/foto12.jpg');
```

---

## 📊 Consultas Úteis

### Ver todos os packs e quantidade de itens:
```sql
SELECT 
  mp.pack_id,
  mp.name,
  mp.price,
  mp.is_active,
  COUNT(mi.id) as total_items
FROM media_packs mp
LEFT JOIN media_items mi ON mi.pack_id = mp.pack_id
GROUP BY mp.pack_id, mp.name, mp.price, mp.is_active
ORDER BY mp.created_at DESC;
```

### Ver histórico de entregas de um usuário:
```sql
SELECT 
  u.first_name,
  mp.name as pack_name,
  mi.file_name,
  md.delivered_at
FROM media_deliveries md
JOIN users u ON u.id = md.user_id
JOIN media_packs mp ON mp.pack_id = md.pack_id
JOIN media_items mi ON mi.id = md.media_item_id
WHERE u.telegram_id = [ID_DO_USUARIO]
ORDER BY md.delivered_at DESC;
```

### Limpar histórico de entregas (resetar para um usuário):
```sql
DELETE FROM media_deliveries
WHERE user_id = (SELECT id FROM users WHERE telegram_id = [ID_DO_USUARIO])
  AND pack_id = 'pack_premium';
```

---

## 🎯 Exemplo Completo

### Cenário: Pack com 12 fotos, entrega 3 por compra

#### Primeira compra:
```
✅ Cliente recebe: foto1.jpg, foto5.jpg, foto9.jpg
📊 Histórico: 3 itens entregues
```

#### Segunda compra:
```
✅ Cliente recebe: foto2.jpg, foto7.jpg, foto11.jpg
📊 Histórico: 6 itens entregues
```

#### Terceira compra:
```
✅ Cliente recebe: foto3.jpg, foto8.jpg, foto12.jpg
📊 Histórico: 9 itens entregues
```

#### Quarta compra:
```
✅ Cliente recebe: foto4.jpg, foto6.jpg, foto10.jpg
📊 Histórico: 12 itens entregues (COMPLETO)
```

#### Quinta compra:
```
🔄 RESETAR histórico (todos já foram entregues)
✅ Cliente recebe: foto7.jpg, foto2.jpg, foto11.jpg (novamente, aleatório)
📊 Histórico: 3 itens entregues (recomeçou)
```

---

## 🔐 Segurança

### Supabase Storage Policies:

```sql
-- Permitir leitura pública (para o bot enviar as mídias)
CREATE POLICY "Public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'media-packs');

-- Permitir apenas admins fazerem upload
CREATE POLICY "Admin upload access"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'media-packs' AND
  auth.uid() IN (SELECT id FROM users WHERE is_admin = true)
);
```

---

## 📈 Estatísticas

### Dashboard Admin:
```
📊 MEDIA PACK: Pack Premium
━━━━━━━━━━━━━━━━━━━━━

💰 Preço: R$ 29,90
📦 Itens por entrega: 3
📊 Total de itens: 12

📈 Estatísticas:
✅ Vendas: 15
👥 Clientes únicos: 8
📤 Total de itens entregues: 45
```

---

## ⚙️ Configurações Avançadas

### Alterar quantidade de itens por entrega:
```sql
UPDATE media_packs
SET items_per_delivery = 5  -- Entregar 5 itens em vez de 3
WHERE pack_id = 'pack_premium';
```

### Desativar/Ativar pack:
```sql
UPDATE media_packs
SET is_active = false  -- Desativar
WHERE pack_id = 'pack_premium';
```

### Remover item específico:
```sql
UPDATE media_items
SET is_active = false  -- Desativar (não deletar)
WHERE pack_id = 'pack_premium' AND file_name = 'foto5.jpg';
```

---

## 🎨 Customizações

### Adicionar vídeos:
```sql
INSERT INTO media_items (pack_id, file_name, file_url, file_type, storage_path)
VALUES ('pack_premium', 'video1.mp4', 'https://...supabase.co/.../video1.mp4', 'video', 'media-packs/pack_premium/video1.mp4');
```

### Mix de fotos e vídeos:
```
Pack Premium:
├── 8 fotos
└── 4 vídeos
= 12 itens no total

A cada compra: 3 itens aleatórios (pode ser mix de fotos e vídeos)
```

---

## 🚨 Troubleshooting

### Problema: "Pack sem itens cadastrados"
**Solução:** Adicione itens na tabela `media_items`

### Problema: "Erro ao enviar mídias"
**Solução:** Verifique se as URLs do Supabase Storage estão corretas e públicas

### Problema: "Cliente sempre recebe os mesmos itens"
**Solução:** Verifique a tabela `media_deliveries` e limpe se necessário

### Problema: "Vídeo não envia"
**Solução:** Verifique se o `file_type` está como `'video'` (não `'mp4'`)

---

## 📞 Suporte

Para dúvidas ou problemas, consulte:
- 📊 Logs do Supabase
- 📝 Documentação do Telegraf
- 💬 Suporte do bot

---

*Sistema desenvolvido com ❤️ e ☕*
*Versão: 1.0.0*


