# 🤖 Bot Telegram PIX - Sistema Completo de Vendas Digitais

> Sistema profissional de vendas via Telegram com pagamento PIX, análise automática de comprovantes (OCR) e gestão completa de produtos digitais, media packs e assinaturas.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green)](https://nodejs.org/)
[![Telegraf](https://img.shields.io/badge/Telegraf-4.15+-blue)](https://telegraf.js.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-orange)](https://supabase.com/)
[![Hostgator](https://img.shields.io/badge/Hostgator-Node.js-blue)](https://www.hostgator.com.br/)

---

## 📋 Índice

- [Funcionalidades](#-funcionalidades)
- [Demonstração](#-demonstração)
- [Instalação](#-instalação)
- [Configuração](#-configuração)
- [Uso](#-uso)
- [Comandos](#-comandos)
- [Arquitetura](#-arquitetura)
- [Segurança](#-segurança)
- [Troubleshooting](#-troubleshooting)

---

## ✨ Funcionalidades

### 💰 Sistema de Pagamentos PIX
- ✅ **QR Code automático** - Geração instantânea de QR Code PIX padrão BR Code
- ✅ **Cópia & Cola** - Payload PIX pronto para copiar
- ✅ **OCR Inteligente** - Análise automática de comprovantes (imagem e PDF)
- ✅ **Validação em 3 níveis**:
  - ≥70% confiança → Aprovação automática
  - 40-69% → Validação manual
  - <40% → Rejeição automática
- ✅ **Expiração automática** - Transações expiram em 30 minutos
- ✅ **Cache de análises** - Resultados OCR salvos para reuso

### 🛍️ Gestão de Produtos
- ✅ **Produtos digitais** - Links ou arquivos ZIP via Telegram
- ✅ **Media Packs** - Fotos/vídeos aleatórios com preços variáveis
- ✅ **Sistema de cupons** - Descontos personalizados por produto
- ✅ **Broadcast inteligente** - Mensagens associadas a produtos
- ✅ **Entrega automática** - Produto entregue imediatamente após aprovação

### 👥 Sistema de Grupos
- ✅ **Assinaturas mensais** - Controle de acesso por tempo
- ✅ **Gestão automática** - Adição e remoção de membros
- ✅ **Lembretes de expiração** - Notificações antes de expirar
- ✅ **Renovação fácil** - Comando `/renovar`

### 🔐 Painéis Administrativos

#### **Painel Admin** (`/admin`)
- Gerenciamento completo de produtos e grupos
- Aprovação/rejeição de comprovantes
- Estatísticas em tempo real
- Broadcast de mensagens
- Configuração de chave PIX
- Bloqueio por DDD
- Gerenciamento de cupons

#### **Painel Criador** (`/criador`)
- Estatísticas de vendas
- Broadcast com produtos
- Criação de cupons
- Interface simplificada e segura

### 🎟️ Sistema de Cupons (NOVO!)
- ✅ **Descontos personalizados** - 1-99% de desconto
- ✅ **Por produto** - Cupons específicos para cada produto
- ✅ **Limite de usos** - Controle de quantidade
- ✅ **Expiração** - Data de validade configurável
- ✅ **Estatísticas** - Acompanhamento de uso
- ✅ **Aplicação automática** - Desconto aplicado no checkout

### 📢 Broadcast Avançado (NOVO!)
- ✅ **Broadcast simples** - Mensagem para todos
- ✅ **Broadcast + Produto** - Associado a produto específico
- ✅ **Broadcast + Cupom** - Criar cupom e divulgar junto
- ✅ **Botões interativos** - Link direto para compra
- ✅ **Histórico de campanhas** - Todas as campanhas salvas

---

## 🎯 Demonstração

### Fluxo de Compra

```
1. Cliente usa /start → Vê produtos disponíveis
2. Clica no produto → Bot gera QR Code PIX
3. Cliente paga → Envia comprovante (foto ou PDF)
4. OCR analisa automaticamente:
   ✅ ≥70%: Aprovado e entregue automaticamente
   ⚠️ 40-69%: Admin valida manualmente
   ❌ <40%: Rejeitado automaticamente
5. Produto entregue instantaneamente
```

### Exemplo de Cupom

```
Admin cria cupom:
- Código: BLACKFRIDAY
- Desconto: 50%
- Produto: Pack Premium
- Usos: 100
- Expira em: 31/12/2025

Cliente usa:
- Produto: R$ 100,00
- Com cupom: R$ 50,00
- Economia: R$ 50,00 (50%)
```

---

## 🚀 Instalação

### 1. Requisitos
- Node.js 18+
- Conta Supabase (gratuita)
- Bot do Telegram (via @BotFather)
- Hospedagem Node.js (Hostgator, Vercel, Railway, etc)

### 2. Clone o Repositório
```bash
git clone https://github.com/seu-usuario/Api-Pix-Telegran.git
cd Api-Pix-Telegran
npm install
```

### 3. Configure o Supabase

#### 3.1. Crie um Projeto
1. Acesse [supabase.com](https://supabase.com)
2. Crie um novo projeto
3. Anote a URL e a chave anônima

#### 3.2. Execute as Migrações
No SQL Editor do Supabase, execute:

```sql
-- Execute os scripts SQL na seguinte ordem:
-- 1. Tabelas principais (users, products, transactions, etc)
-- 2. Tabelas de cupons e broadcasts (coupons, coupon_usage, broadcast_campaigns)

-- Veja o arquivo completo de migração no repositório: /docs/migrations.sql
```

### 4. Configure Variáveis de Ambiente

Crie `.env` na raiz:

```env
# Telegram
TELEGRAM_BOT_TOKEN=seu_token_do_botfather
TELEGRAM_WEBHOOK_SECRET=/webhook-secreto-unico

# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua_chave_anonima

# URL do seu app hospedado
APP_URL=https://seu-dominio.com.br

# OCR (opcional - usa chave gratuita padrão)
OCR_SPACE_API_KEY=K87899643688957
```

### 5. Deploy na Hospedagem

**Opção A: Hostgator (Node.js)**
```bash
# 1. Faça upload dos arquivos via FTP ou Git
# 2. Configure as variáveis de ambiente no painel
# 3. Execute: npm install && npm start
```

**Opção B: Vercel (Serverless)**

```bash
# Via CLI
npm i -g vercel
vercel --prod

# Ou conecte via GitHub no painel da Vercel
```

**Opção C: Railway, Render, etc**
```bash
# Siga a documentação específica da plataforma
# Todas suportam Node.js 18+
```

### 6. Configure o Webhook

```bash
curl -X POST "https://api.telegram.org/bot{SEU_TOKEN}/setWebhook?url=https://seu-dominio.com.br/webhook-secreto-unico"
```

### 7. Torne-se Admin

No SQL Editor do Supabase:

```sql
-- Primeiro, use o bot uma vez para criar seu usuário
-- Depois execute:
UPDATE users 
SET is_admin = true 
WHERE telegram_id = SEU_TELEGRAM_ID;
```

---

## ⚙️ Configuração

### Chave PIX
```
/setpix sua_chave_pix
```

### Link de Suporte
```
/setsuporte https://t.me/seusuporte
```

### Criar Produto
```
/novoproduto
→ Siga o assistente interativo
```

### Criar Cupom
```
/admin → 🎟️ Cupons → ➕ Novo Cupom
ou
/criador → 🎟️ Cupons → ➕ Novo Cupom
```

### Broadcast
```
/admin → 📢 Broadcast
ou
/criador → 📢 Broadcast → Escolha o tipo
```

---

## 📖 Comandos

### 👤 Usuários
| Comando | Descrição |
|---------|-----------|
| `/start` | Menu principal com produtos |
| `/renovar` | Renovar assinatura de grupo |

### 🔐 Admin
| Comando | Descrição |
|---------|-----------|
| `/admin` | Painel administrativo completo |
| `/produtos` | Listar todos os produtos |
| `/novoproduto` | Criar novo produto |
| `/setpix [chave]` | Configurar chave PIX |
| `/broadcast [mensagem]` | Enviar mensagem em massa |
| `/ddds` | Gerenciar DDDs bloqueados |
| `/novogrupo` | Cadastrar grupo de assinatura |

### 👑 Criador
| Comando | Descrição |
|---------|-----------|
| `/criador` | Painel do criador |

---

## 🏗️ Arquitetura

### Stack Tecnológica
```
┌─────────────────────────────────────────┐
│           Frontend (Telegram)           │
├─────────────────────────────────────────┤
│   Bot Engine (Telegraf + Node.js)      │
├─────────────────────────────────────────┤
│   Backend (Node.js + Supabase)         │
├─────────────────────────────────────────┤
│   Database (Supabase PostgreSQL)       │
├─────────────────────────────────────────┤
│   OCR Service (OCR.space API)          │
└─────────────────────────────────────────┘
```

### Estrutura do Banco de Dados

#### Tabelas Principais
- `users` - Usuários do bot
- `products` - Produtos digitais
- `transactions` - Transações PIX
- `settings` - Configurações globais
- `groups` - Grupos de assinatura
- `group_members` - Membros dos grupos

#### Sistema de Cupons (NOVO!)
- `coupons` - Cupons de desconto
- `coupon_usage` - Histórico de uso
- `broadcast_campaigns` - Campanhas de marketing

#### Sistema de Mídia
- `media_packs` - Packs de fotos/vídeos
- `media_items` - Itens individuais
- `media_deliveries` - Histórico de entregas

#### Segurança
- `blocked_area_codes` - DDDs bloqueados

---

## 🔒 Segurança

### Implementações
- ✅ **Webhook com secret path** - URL única e secreta
- ✅ **Validação de admin** - Baseada em banco de dados
- ✅ **Bloqueio por DDD** - Restrição geográfica
- ✅ **Expiração de transações** - Limite de 30 minutos
- ✅ **Rate limiting** - Proteção contra spam e abuse
- ✅ **Sanitização de dados** - Todas as entradas validadas
- ✅ **Painel do criador seguro** - Sem acesso a dados sensíveis

### Boas Práticas
```bash
# NUNCA commite .env
echo ".env" >> .gitignore

# Use variáveis de ambiente na sua hospedagem
# Não exponha chaves em código

# Webhook secret único por deploy
TELEGRAM_WEBHOOK_SECRET=/webhook-$(openssl rand -hex 16)
```

---

## 🧪 Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Executar localmente
npm run dev

# Expor local via ngrok
ngrok http 3000

# Configurar webhook local
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://seu-ngrok.ngrok.io/webhook-secreto"
```

---

## 🐛 Troubleshooting

### Webhook não funciona
```bash
# Verificar status
curl https://api.telegram.org/bot{TOKEN}/getWebhookInfo

# Resetar webhook
curl -X POST "https://api.telegram.org/bot{TOKEN}/deleteWebhook"
curl -X POST "https://api.telegram.org/bot{TOKEN}/setWebhook?url=..."
```

### OCR não funciona
- ✅ Verifique se a API Key está configurada
- ✅ Teste com imagens de alta qualidade (mínimo 300 DPI)
- ✅ Verifique os logs do servidor

### Produtos não aparecem
```sql
-- Verificar produtos ativos
SELECT * FROM products WHERE is_active = true;

-- Reativar produto
UPDATE products SET is_active = true WHERE product_id = 'seu_produto';
```

### Cupons não funcionam
```sql
-- Verificar cupons ativos
SELECT * FROM coupons WHERE is_active = true AND code = 'SEU_CUPOM';

-- Ver estatísticas de uso
SELECT 
  c.code,
  c.discount_percentage,
  COUNT(cu.id) as total_uses,
  SUM(cu.discount_amount) as total_discount
FROM coupons c
LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
WHERE c.code = 'SEU_CUPOM'
GROUP BY c.id;
```

---

## 📊 Estatísticas e Métricas

### Dashboard Admin
- Total de usuários cadastrados
- Transações (pendentes, aprovadas, rejeitadas)
- Vendas totais e ticket médio
- Taxa de conversão
- Produtos mais vendidos

### Dashboard Criador
- Estatísticas de vendas (apenas aprovadas)
- Performance de cupons
- Campanhas de broadcast
- Produtos mais populares

---

## 🚀 Roadmap

- [x] Sistema de cupons de desconto
- [x] Broadcast associado a produtos
- [x] Painel do criador melhorado
- [ ] Dashboard web para administração
- [ ] Integração com API de pagamento automático (Mercado Pago, etc)
- [ ] Relatórios de vendas em PDF
- [ ] Multi-idioma (EN, ES)
- [ ] Sistema de afiliados
- [ ] Webhooks para integrações externas
- [ ] Analytics avançado (Google Analytics, Mixpanel)

---

## 📄 Licença

Este projeto é fornecido como está, sem garantias.

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📞 Suporte

- 📚 [Documentação Telegraf](https://telegraf.js.org/)
- 🗄️ [Documentação Supabase](https://supabase.com/docs)
- 🌐 [Hostgator Node.js](https://www.hostgator.com.br/)
- 💳 [Especificação PIX](https://www.bcb.gov.br/estabilidadefinanceira/pix)

---

## ⭐ Features Destacadas

### 🎟️ Sistema de Cupons
```javascript
// Exemplo de criação de cupom
{
  code: "BLACKFRIDAY",
  discount_percentage: 50,
  product_id: "pack_premium",
  max_uses: 100,
  expires_at: "2025-12-31"
}

// Aplicação automática no checkout
Preço original: R$ 100,00
Com cupom (50%): R$ 50,00
Economia: R$ 50,00
```

### 📢 Broadcast Inteligente
```javascript
// Broadcast com produto
{
  type: "product",
  message: "🔥 BLACK FRIDAY! 90% OFF!",
  product_id: "pack_premium",
  button: "🛍️ Comprar Agora"
}

// Resultado: Mensagem + Botão de compra direto
```

### 🤖 OCR Automático
```javascript
// Análise automática de comprovantes
{
  confidence: 85,    // Confiança: 85%
  isValid: true,     // Comprovante válido
  action: "approve"  // Aprovação automática
}
```

---

<p align="center">
  <strong>Desenvolvido com ❤️ para facilitar vendas via Telegram</strong>
</p>

<p align="center">
  <sub>Se este projeto te ajudou, considere dar uma ⭐</sub>
</p>
