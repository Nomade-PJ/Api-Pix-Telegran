# 🤖 Bot Telegram PIX - Sistema Completo de Vendas

Bot Telegram profissional com sistema de pagamento PIX, análise automática de comprovantes (OCR), gestão de produtos digitais, media packs e assinaturas de grupos.

## 🚀 Funcionalidades Principais

### 💰 Sistema de Pagamentos
- ✅ Geração automática de QR Code PIX
- ✅ Payload Cópia & Cola (padrão BR Code)
- ✅ Análise automática de comprovantes via OCR
- ✅ Validação manual por administradores
- ✅ Suporte a imagens (JPG, PNG) e PDFs
- ✅ Notificações em tempo real
- ✅ Expiração automática de transações (30 minutos)

### 📦 Gestão de Produtos
- ✅ Produtos digitais (links ou arquivos ZIP)
- ✅ Media Packs (fotos/vídeos aleatórios)
- ✅ Preços variáveis para media packs
- ✅ Sistema de entrega automatizada
- ✅ Controle de estoque de mídia

### 👥 Sistema de Grupos
- ✅ Assinaturas mensais
- ✅ Controle automático de acesso
- ✅ Renovação de assinaturas
- ✅ Lembretes de expiração
- ✅ Remoção automática de membros expirados

### 🔐 Painel Administrativo
- ✅ Gerenciamento de produtos
- ✅ Aprovação/rejeição de comprovantes
- ✅ Estatísticas em tempo real
- ✅ Broadcast de mensagens
- ✅ Configuração de chave PIX
- ✅ Bloqueio por DDD
- ✅ Gerenciamento de usuários

### 🤖 Análise Automática (OCR)
- ✅ OCR.space API (gratuito)
- ✅ Detecção de valores
- ✅ Verificação de chave PIX
- ✅ Sistema de confiança (0-100%)
- ✅ Aprovação automática (≥70%)
- ✅ Rejeição automática (<40%)
- ✅ Cache de resultados

## 📋 Tecnologias

- **Backend:** Node.js + Telegraf
- **Banco de Dados:** Supabase (PostgreSQL)
- **Hospedagem:** Vercel (Serverless)
- **OCR:** OCR.space API
- **Pagamentos:** PIX (BR Code)

## 🛠️ Instalação

### 1. Clone o Repositório
```bash
git clone https://github.com/seu-usuario/Api-Pix-Telegran.git
cd Api-Pix-Telegran
```

### 2. Instale as Dependências
```bash
npm install
```

### 3. Configure o Supabase

#### 3.1. Crie um Projeto no Supabase
1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Anote a URL e a chave anônima

#### 3.2. Execute as Migrações SQL
Execute o seguinte SQL no SQL Editor do Supabase:

```sql
-- Tabela de usuários
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT UNIQUE NOT NULL,
  username TEXT,
  first_name TEXT,
  language_code TEXT DEFAULT 'pt-br',
  phone_number TEXT,
  is_admin BOOLEAN DEFAULT false,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de produtos
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  delivery_type TEXT DEFAULT 'link',
  delivery_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de transações
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txid TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES users(id),
  telegram_id BIGINT NOT NULL,
  product_id TEXT,
  media_pack_id TEXT,
  amount NUMERIC NOT NULL,
  pix_key TEXT NOT NULL,
  pix_payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  proof_file_id TEXT,
  proof_file_url TEXT,
  proof_received_at TIMESTAMPTZ,
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES users(id),
  delivered_at TIMESTAMPTZ,
  notes TEXT,
  ocr_result JSONB,
  ocr_confidence NUMERIC,
  ocr_analyzed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de configurações
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de grupos
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id BIGINT UNIQUE NOT NULL,
  group_name TEXT,
  group_link TEXT NOT NULL,
  subscription_price NUMERIC DEFAULT 30.00,
  subscription_days INTEGER DEFAULT 30,
  bot_username TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de membros de grupos
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  telegram_id BIGINT NOT NULL,
  group_id UUID REFERENCES groups(id),
  transaction_id UUID REFERENCES transactions(id),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'active',
  reminded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de media packs
CREATE TABLE media_packs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL,
  variable_prices JSONB DEFAULT '[]'::jsonb,
  items_per_delivery INTEGER DEFAULT 3,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de itens de mídia
CREATE TABLE media_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id TEXT REFERENCES media_packs(pack_id) NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_url TEXT,
  size_bytes BIGINT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de entregas de mídia
CREATE TABLE media_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id),
  user_id UUID REFERENCES users(id),
  pack_id TEXT REFERENCES media_packs(pack_id),
  media_item_id UUID REFERENCES media_items(id),
  delivered_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de DDDs bloqueados
CREATE TABLE blocked_area_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area_code TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar foreign key para media_pack_id em transactions
ALTER TABLE transactions 
ADD CONSTRAINT transactions_media_pack_id_fkey 
FOREIGN KEY (media_pack_id) 
REFERENCES media_packs(pack_id);
```

### 4. Configure as Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Telegram Bot
TELEGRAM_BOT_TOKEN=seu_token_aqui
TELEGRAM_WEBHOOK_SECRET=/webhook-secreto-aleatorio

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima_aqui

# Vercel
APP_URL=https://seu-projeto.vercel.app

# OCR (Opcional - usa chave gratuita padrão)
OCR_SPACE_API_KEY=K87899643688957
```

### 5. Deploy na Vercel

#### 5.1. Conecte o Repositório
1. Acesse [vercel.com](https://vercel.com)
2. Importe seu repositório
3. Configure as variáveis de ambiente

#### 5.2. Configure o Webhook do Telegram
Após o deploy, execute:

```bash
curl -X POST "https://api.telegram.org/bot{SEU_TOKEN}/setWebhook?url=https://seu-projeto.vercel.app/webhook-secreto-aleatorio"
```

### 6. Configure o Bot

#### 6.1. Torne-se Admin
Execute no SQL Editor do Supabase:

```sql
UPDATE users 
SET is_admin = true 
WHERE telegram_id = SEU_TELEGRAM_ID;
```

#### 6.2. Configure a Chave PIX
No Telegram, envie:
```
/setpix sua_chave_pix_aqui
```

## 📖 Comandos do Bot

### Usuários
- `/start` - Menu principal
- `/renovar` - Renovar assinatura de grupo

### Administradores
- `/admin` - Painel administrativo
- `/produtos` - Listar produtos
- `/novoproduto` - Criar produto
- `/editarproduto` - Editar produto
- `/deletarproduto` - Deletar produto
- `/setpix [chave]` - Configurar chave PIX
- `/setsuporte [link]` - Configurar link de suporte
- `/pendentes` - Ver transações pendentes
- `/stats` - Estatísticas
- `/users` - Listar usuários
- `/broadcast [mensagem]` - Enviar mensagem em massa
- `/ddds` - Gerenciar DDDs bloqueados
- `/addddd [ddd] [estado] [motivo]` - Bloquear DDD
- `/removeddd [ddd]` - Desbloquear DDD
- `/novogrupo` - Cadastrar grupo
- `/editargrupo` - Editar grupo
- `/deletargrupo` - Deletar grupo

## 🔄 Fluxo de Compra

1. **Cliente:** Usa `/start` e escolhe um produto
2. **Bot:** Gera QR Code PIX + Cópia & Cola
3. **Cliente:** Realiza pagamento e envia comprovante
4. **Bot:** Analisa automaticamente via OCR
   - ✅ **≥70% confiança:** Aprovação automática
   - ⚠️ **40-69% confiança:** Validação manual
   - ❌ **<40% confiança:** Rejeição automática
5. **Admin:** Valida manualmente se necessário
6. **Bot:** Entrega produto automaticamente

## 📊 Estrutura do Banco de Dados

### Tabelas Principais
- `users` - Usuários do bot
- `products` - Produtos digitais
- `transactions` - Transações PIX
- `settings` - Configurações do bot
- `groups` - Grupos de assinatura
- `group_members` - Membros dos grupos
- `media_packs` - Packs de mídia
- `media_items` - Itens de mídia individuais
- `media_deliveries` - Histórico de entregas
- `blocked_area_codes` - DDDs bloqueados

## 🔐 Segurança

- ✅ Webhook com secret path
- ✅ Validação de admin por banco de dados
- ✅ Bloqueio por DDD
- ✅ Expiração automática de transações
- ✅ Rate limiting via Vercel
- ✅ Sanitização de chaves PIX
- ✅ Validação de comprovantes

## 📝 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Executar em modo dev (Vercel Dev)
npm run dev

# Configurar webhook local (ngrok)
ngrok http 3000
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://seu-ngrok.ngrok.io/webhook-secreto"
```

## 🐛 Troubleshooting

### Webhook não funciona
- Verifique se o webhook está configurado: `https://api.telegram.org/bot{TOKEN}/getWebhookInfo`
- Verifique os logs na Vercel
- Teste o endpoint manualmente

### OCR não funciona
- Verifique se a API Key está configurada
- Teste com imagens de alta qualidade
- Verifique os logs do OCR

### Produtos não aparecem
- Verifique se `is_active = true`
- Verifique se há produtos cadastrados
- Verifique os logs do bot

## 📞 Suporte

Para dúvidas ou problemas:
- [Documentação Telegraf](https://telegraf.js.org/)
- [Documentação Supabase](https://supabase.com/docs)
- [Documentação Vercel](https://vercel.com/docs)
- [Especificação PIX](https://www.bcb.gov.br/estabilidadefinanceira/pix)

## 📄 Licença

Este projeto é fornecido como está, sem garantias.

## 🎯 Roadmap

- [ ] Integração com APIs de pagamento automático
- [ ] Dashboard web para administração
- [ ] Relatórios de vendas
- [ ] Sistema de cupons de desconto
- [ ] Multi-idioma
- [ ] Webhooks para integrações externas

---

**Desenvolvido com ❤️ para facilitar vendas via Telegram**
