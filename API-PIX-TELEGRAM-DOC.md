# 📋 Documentação Completa — API PIX Telegram Bot
**Organização:** Comandeja | **Projeto:** Telegram Bot API  
**Supabase Project ID:** `quiguiyvbtgyqurocawk` — Região: `sa-east-1` (São Paulo)  
**Status:** 🟢 ACTIVE_HEALTHY

---

## 🧩 Visão Geral do Projeto

O **API PIX Telegram** é um bot de vendas automatizado hospedado na **Vercel**, integrado ao **Telegram** via biblioteca `telegraf` e ao banco de dados **Supabase (PostgreSQL)**. Ele permite que usuários comprem produtos digitais, packs de mídia e assinaturas de grupos pagos via **PIX manual**, com validação humana por admins e entrega automática após aprovação.

### Stack Tecnológica
| Componente | Tecnologia |
|---|---|
| Runtime | Node.js ≥ 18.x |
| Bot Telegram | Telegraf v4.12 |
| Banco de Dados | Supabase (PostgreSQL 17) |
| Hospedagem | Vercel (Serverless) |
| Pagamento | PIX Manual (sem API bancária) |
| Geração de QR | `qrcode` npm |

---

## 🏗️ Arquitetura do Projeto

```
Api-Pix-Telegran-main/
│
├── src/
│   ├── bot.js              ← Ponto de entrada principal do bot
│   ├── database.js         ← Todas as operações com o Supabase
│   ├── admin.js            ← Painel administrativo
│   ├── creator.js          ← Painel do criador (acesso limitado)
│   ├── deliver.js          ← Lógica de entrega de produtos
│   ├── groupControl.js     ← Controle de membros em grupos pagos
│   ├── proofAnalyzer.js    ← Análise OCR de comprovantes PIX
│   ├── cache.js            ← Cache em memória (TTL 30s)
│   │
│   ├── pix/
│   │   └── manual.js       ← Geração de PIX Copia e Cola + QR Code
│   │
│   └── jobs/
│       ├── expireTransactions.js     ← Expira transações pendentes (30min)
│       ├── updateBotDescription.js   ← Atualiza descrição automática do bot
│       ├── backupDatabase.js         ← Backup automático do banco
│       └── sendPaymentReminders.js   ← Lembretes de pagamento (15min)
│
├── scripts/
│   └── send_media_delivery.js ← Script de entrega de mídia
│
├── package.json
└── vercel.json
```

---

## 🔄 Fluxo Principal de Vendas

```
Usuário inicia /start
        │
        ▼
Verificação de bloqueio (is_blocked)
        │
        ▼
Seleção de produto / pack / grupo
        │
        ▼
Geração do PIX (chave + QR Code + Copia e Cola)
        │
        ▼
Usuário paga e envia comprovante (foto)
        │
        ▼
proofAnalyzer.js → OCR do comprovante
  → Verificação de duplicatas (proof_hash)
  → Score de confiança do usuário (trusted_users)
        │
        ▼
Admin recebe notificação → Valida ou Rejeita
        │
        ▼
deliver.js → Entrega automática
  ├── Produto (link)
  ├── Media Pack (arquivos aleatórios)
  └── Grupo (link de convite)
        │
        ▼
Transação marcada como 'delivered'
```

---

## 👥 Perfis de Usuário

| Perfil | Coluna | Acesso |
|---|---|---|
| **Usuário comum** | `is_blocked = false` | Comprar produtos |
| **Bloqueado** | `is_blocked = true` | Sem acesso ao bot |
| **Criador** | `is_creator = true` | Painel limitado (`/criador`) |
| **Admin** | `is_admin = true` | Painel completo |

---

## 🗄️ Banco de Dados — Estrutura Completa

### Métricas Atuais (via MCP Supabase)
| Tabela | Registros |
|---|---|
| `users` | **8.025** |
| `transactions` | **15.136** |
| `broadcast_recipients` | 1.000 |
| `trusted_users` | 284 |
| `media_items` | 87 |
| `media_deliveries` | 194 |
| `support_tickets` | 55 |
| `group_members` | 128 |
| `coupons` | 10 |
| `auto_responses` | 10 |
| `settings` | 20 |
| `products` | 3 |
| `groups` | 1 |
| `media_packs` | 1 |

---

### 📊 Tabelas Detalhadas

#### `users` — Usuários do Bot
Armazena todos que interagiram com o bot.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador interno |
| `telegram_id` | bigint (UNIQUE) | ID do Telegram |
| `username` | text | @username |
| `first_name` | text | Nome |
| `language_code` | text | Idioma (padrão: pt-br) |
| `is_admin` | boolean | Acesso admin |
| `is_creator` | boolean | Acesso criador |
| `is_blocked` | boolean | Bloqueado individualmente |
| `phone_number` | text | Telefone (para filtro DDD) |

---

#### `transactions` — Transações PIX
Núcleo do sistema. Registra cada cobrança gerada.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | UUID (PK) | Identificador interno |
| `txid` | text (UNIQUE) | ID único da transação |
| `user_id` | UUID (FK → users) | Usuário comprador |
| `telegram_id` | bigint | ID Telegram (redundante para performance) |
| `product_id` | text | Produto comprado (se aplicável) |
| `media_pack_id` | text | Pack de mídia (se aplicável) |
| `group_id` | UUID | Grupo de assinatura (se aplicável) |
| `amount` | numeric | Valor pago |
| `pix_key` | text | Chave PIX utilizada |
| `pix_payload` | text | Payload completo do PIX |
| `status` | text | Ver ciclo de vida abaixo |
| `proof_file_id` | text | File ID do comprovante no Telegram |
| `proof_hash` | text | Hash SHA256 anti-fraude |
| `ocr_result` | jsonb | Resultado da análise OCR |
| `ocr_confidence` | numeric | Confiança da análise (0-100%) |
| `coupon_id` | UUID | Cupom aplicado |

**Ciclo de vida do status:**
```
pending → proof_sent → validated → delivered
                    ↘ rejected
pending → expired (após 30 minutos sem comprovante)
delivered → cancelled (reversão pelo admin)
```

---

#### `products` — Produtos Digitais
| Coluna | Tipo | Descrição |
|---|---|---|
| `product_id` | text (UNIQUE) | Slug do produto |
| `name` | text | Nome exibido |
| `description` | text | Descrição |
| `price` | numeric | Preço em R$ |
| `delivery_type` | text | `link` (único tipo atual) |
| `delivery_url` | text | URL entregue após pagamento |
| `is_active` | boolean | Disponível para venda |

---

#### `media_packs` — Packs de Mídia
Venda de conteúdo digital (fotos/vídeos) com entrega aleatória.

| Coluna | Tipo | Descrição |
|---|---|---|
| `pack_id` | text (UNIQUE) | Identificador do pack |
| `name` | text | Nome |
| `price` | numeric | Preço base |
| `items_per_delivery` | integer | Quantidade entregue por compra (padrão: 3) |
| `variable_prices` | jsonb | Preços variáveis por quantidade |

---

#### `media_items` — Itens de Mídia
87 arquivos cadastrados no sistema.

| Coluna | Tipo | Descrição |
|---|---|---|
| `pack_id` | text (FK) | Pack ao qual pertence |
| `file_name` | text | Nome do arquivo |
| `file_url` | text | URL de acesso |
| `file_type` | text | Tipo (foto/vídeo) |
| `storage_path` | text | Caminho no Supabase Storage |

---

#### `media_deliveries` — Histórico de Entregas
Evita repetição de itens já entregues para o mesmo usuário.

| Coluna | Tipo | Descrição |
|---|---|---|
| `transaction_id` | UUID | Transação origem |
| `user_id` | UUID | Usuário que recebeu |
| `pack_id` | text | Pack entregue |
| `media_item_id` | UUID | Item específico entregue |

---

#### `groups` — Grupos Pagos
| Coluna | Tipo | Descrição |
|---|---|---|
| `group_id` | bigint (UNIQUE) | ID do grupo no Telegram |
| `group_name` | text | Nome |
| `group_link` | text | Link de convite |
| `subscription_price` | numeric | Preço (padrão: R$30) |
| `subscription_days` | integer | Duração (padrão: 30 dias) |
| `plans` | jsonb | Planos múltiplos de assinatura |

---

#### `group_members` — Membros de Grupos
128 assinaturas registradas.

| Coluna | Tipo | Descrição |
|---|---|---|
| `telegram_id` | bigint | Membro |
| `group_id` | UUID | Grupo |
| `expires_at` | timestamptz | Data de expiração |
| `status` | text | `active` / `expired` |
| `reminded_at` | timestamptz | Última notificação de vencimento |
| `processing_lock` | timestamptz | Lock anti-duplicidade |

---

#### `trusted_users` — Sistema de Confiança
284 usuários com pontuação de confiança. Score dinâmico de 0-100 baseado em histórico de aprovações/rejeições.

| Coluna | Tipo | Descrição |
|---|---|---|
| `trust_score` | numeric | Score de 0 a 100 (padrão: 100) |
| `approved_transactions` | integer | Quantas foram aprovadas |
| `rejected_transactions` | integer | Quantas foram rejeitadas |
| `auto_approve_threshold` | numeric | Limiar para aprovação automática |

---

#### `blocked_area_codes` — DDDs Bloqueados
Filtra usuários por DDD do telefone informado.

| Coluna | Tipo | Descrição |
|---|---|---|
| `area_code` | text (UNIQUE) | DDD (ex: "98", "86") |
| `state` | text | Estado correspondente |
| `reason` | text | Motivo do bloqueio |

---

#### `coupons` — Cupons de Desconto
10 cupons cadastrados, com suporte a cupons automáticos de broadcast.

| Coluna | Tipo | Descrição |
|---|---|---|
| `code` | text (UNIQUE) | Código do cupom |
| `discount_percentage` | numeric | % de desconto (1-100) |
| `product_id` | text | Produto específico (opcional) |
| `max_uses` | integer | Limite de usos |
| `current_uses` | integer | Usos realizados |
| `is_broadcast_coupon` | boolean | Gerado por campanha de broadcast |

---

#### `broadcast_campaigns` — Campanhas de Disparo
| Coluna | Tipo | Descrição |
|---|---|---|
| `name` | text | Nome da campanha |
| `message` | text | Mensagem enviada |
| `target_audience` | text | `all` / `buyers` |
| `sent_count` | integer | Enviados com sucesso |
| `failed_count` | integer | Falhas |
| `status` | text | `draft` / `sent` |
| `coupon_code` | text | Cupom anexado (opcional) |

---

#### `settings` — Configurações Gerais
20 configurações armazenadas. Principal uso: chave PIX configurável dinamicamente pelo admin sem redeploy.

---

#### `support_tickets` — Tickets de Suporte
55 tickets com sistema completo de numeração (`TKT-YYYYMMDD-XXXX`), prioridades e atribuição a admins.

---

#### `auto_responses` — Respostas Automáticas
10 respostas automáticas por palavra-chave, com controle de prioridade e contador de uso.

---

#### `contracts` — Contratos Digitais
Registro de contratos com dados legais: IP, User Agent, data de assinatura.

---

#### `proof_patterns` — Padrões de Comprovantes (ML)
Sistema de aprendizado para validação automática de comprovantes PIX. Aprende com aprovações e rejeições.

---

## ⚙️ Jobs Automáticos

| Job | Intervalo | Função |
|---|---|---|
| `expireTransactions` | Contínuo | Expira transações sem comprovante após 30 min |
| `sendPaymentReminders` | 15 min | Lembra usuário de enviar comprovante |
| `updateBotDescription` | Periódico | Mantém descrição do bot atualizada |
| `backupDatabase` | Periódico | Backup automático |

---

## 🛡️ Recursos de Segurança

1. **Bloqueio por DDD** — Filtra usuários de estados específicos pelo número de telefone
2. **Bloqueio individual** — `is_blocked = true` impede qualquer interação
3. **Anti-fraude por hash** — Comprovante duplicado é detectado via SHA256 (`proof_hash`)
4. **OCR de comprovantes** — Análise automática de imagens para validar autenticidade
5. **Sistema de confiança** — Score dinâmico por usuário, com aprovação automática para confiáveis
6. **Lock anti-duplicidade** — `processing_lock` nos membros de grupo evita processamento paralelo

---

## 📈 Estatísticas do Sistema (via Views)

O banco possui views analíticas prontas:

- `v_bot_statistics` — Estatísticas gerais em tempo real
- `v_conversion_metrics` — Métricas diárias de conversão
- `v_product_performance` — Performance por produto
- `v_processing_times` — Tempos médios de validação
- `v_top_customers` — Maiores compradores

---

## 🔧 Variáveis de Ambiente Necessárias

```env
TELEGRAM_BOT_TOKEN=        # Token do bot via @BotFather
SUPABASE_URL=              # URL do projeto Supabase
SUPABASE_ANON_KEY=         # Chave anônima do Supabase
MY_PIX_KEY=                # Chave PIX fallback (sobrescrita pelo settings)
```

---

## 📌 Observações Importantes

- **RLS desabilitado** em todas as tabelas — o controle de acesso é feito pela aplicação
- **Timezone Brasil (UTC-3)** — todas as funções de estatísticas calculam corretamente com `America/Sao_Paulo`
- **Retry automático** — funções críticas do banco (cancelamento, expiração) possuem 3 tentativas com backoff exponencial em erros de conexão
- **Cache em memória** — estatísticas são cacheadas por 30 segundos para reduzir queries repetidas
- **Dois criadores** configurados hardcoded no `bot.js` (IDs: `7147424680` e `6668959779`)

---

*Documentação gerada em 18/02/2026 com base na análise do código-fonte e dados reais do banco via MCP Supabase.*
