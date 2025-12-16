# 📊 Sistema de Monitoramento e Estatísticas

## 🎯 Visão Geral

Sistema completo de monitoramento em tempo real para o Bot Telegram com views SQL otimizadas e funções JavaScript prontas para uso.

---

## 📈 Views Disponíveis

### 1. `v_bot_statistics` - Estatísticas Gerais

Retorna estatísticas completas do bot em tempo real.

**Campos:**
```sql
- total_users: Total de usuários cadastrados
- total_admins: Total de administradores
- total_creators: Total de criadores
- total_blocked: Total de usuários bloqueados
- total_transactions: Total de transações
- total_delivered: Transações entregues
- total_validated: Transações validadas
- total_pending: Transações pendentes
- total_proof_sent: Comprovantes enviados
- total_expired: Transações expiradas
- total_cancelled: Transações canceladas
- total_revenue: Receita total (R$)
- today_revenue: Receita de hoje (R$)
- month_revenue: Receita do mês (R$)
- active_products: Produtos ativos
- active_media_packs: Media packs ativos
- active_groups: Grupos ativos
- active_group_members: Membros ativos em grupos
- open_tickets: Tickets abertos
- in_progress_tickets: Tickets em andamento
```

**Exemplo de uso:**
```sql
SELECT * FROM v_bot_statistics;
```

**Função JavaScript:**
```javascript
const stats = await db.getBotStatistics();
console.log(`Receita hoje: R$ ${stats.today_revenue}`);
console.log(`Transações pendentes: ${stats.total_pending}`);
```

---

### 2. `v_conversion_metrics` - Taxa de Conversão

Retorna métricas diárias de conversão dos últimos 30 dias.

**Campos:**
```sql
- date: Data
- total_transactions: Total de transações do dia
- pending: Transações pendentes
- proof_sent: Comprovantes enviados
- validated: Transações validadas
- delivered: Transações entregues
- cancelled: Transações canceladas
- expired: Transações expiradas
- conversion_rate: Taxa de conversão (%) - delivered/total
- proof_rate: Taxa de comprovantes (%) - proof_sent/total
- validation_rate: Taxa de validação (%) - validated/proof_sent
- daily_revenue: Receita do dia (R$)
```

**Exemplo de uso:**
```sql
-- Ver últimos 7 dias
SELECT * FROM v_conversion_metrics LIMIT 7;

-- Ver apenas dias com conversão > 5%
SELECT * FROM v_conversion_metrics 
WHERE conversion_rate > 5 
ORDER BY date DESC;
```

**Função JavaScript:**
```javascript
// Últimos 7 dias
const metrics = await db.getConversionMetrics(7);
metrics.forEach(m => {
  console.log(`${m.date}: ${m.conversion_rate}% conversão - R$ ${m.daily_revenue}`);
});

// Resumo semanal
const summary = await db.getConversionSummary();
console.log(`Taxa média de conversão: ${summary.avgConversionRate}%`);
console.log(`Receita total (7 dias): R$ ${summary.totalRevenue}`);
```

---

### 3. `v_product_performance` - Performance por Produto

Retorna performance de cada produto nos últimos 30 dias.

**Campos:**
```sql
- product_name: Nome do produto/grupo
- product_id: ID do produto
- product_type: Tipo (product, media_pack, group)
- total_transactions: Total de transações
- delivered_count: Entregas concluídas
- pending_count: Transações pendentes
- total_revenue: Receita total (R$)
- conversion_rate: Taxa de conversão (%)
```

**Exemplo de uso:**
```sql
-- Top 5 produtos por receita
SELECT * FROM v_product_performance 
ORDER BY total_revenue DESC 
LIMIT 5;

-- Produtos com baixa conversão (<5%)
SELECT * FROM v_product_performance 
WHERE conversion_rate < 5 
ORDER BY conversion_rate ASC;
```

**Função JavaScript:**
```javascript
const products = await db.getProductPerformance();
products.forEach(p => {
  console.log(`${p.product_name}: R$ ${p.total_revenue} (${p.conversion_rate}%)`);
});
```

---

### 4. `v_processing_times` - Tempos de Processamento

Retorna tempo médio de processamento em cada etapa.

**Campos:**
```sql
- date: Data
- total_transactions: Total de transações
- avg_minutes_to_proof: Tempo médio até comprovante (minutos)
- avg_minutes_to_validation: Tempo médio até validação (minutos)
- avg_minutes_to_delivery: Tempo médio até entrega (minutos)
- avg_minutes_total: Tempo total médio (minutos)
```

**Exemplo de uso:**
```sql
-- Ver últimos 7 dias
SELECT 
  date,
  ROUND(avg_minutes_to_proof::numeric, 2) as minutos_comprovante,
  ROUND(avg_minutes_to_validation::numeric, 2) as minutos_validacao,
  ROUND(avg_minutes_total::numeric, 2) as minutos_total
FROM v_processing_times 
LIMIT 7;
```

**Função JavaScript:**
```javascript
const times = await db.getProcessingTimes();
times.forEach(t => {
  console.log(`${t.date}: ${t.avg_minutes_total?.toFixed(2)} min total`);
});
```

---

### 5. `v_top_customers` - Top Clientes

Retorna os 50 melhores clientes (maiores compradores) dos últimos 90 dias.

**Campos:**
```sql
- telegram_id: ID do Telegram
- first_name: Nome
- username: Username
- total_purchases: Total de compras
- total_spent: Total gasto (R$)
- last_purchase_date: Data da última compra
- successful_purchases: Compras bem-sucedidas
- cancelled_purchases: Compras canceladas
```

**Exemplo de uso:**
```sql
-- Top 10 clientes
SELECT * FROM v_top_customers LIMIT 10;

-- Clientes que gastaram mais de R$ 100
SELECT * FROM v_top_customers 
WHERE total_spent > 100 
ORDER BY total_spent DESC;
```

**Função JavaScript:**
```javascript
const topClients = await db.getTopCustomers(10);
topClients.forEach((client, index) => {
  console.log(`${index + 1}. ${client.first_name}: R$ ${client.total_spent}`);
});
```

---

## 🔧 Otimizações Implementadas

### ✅ Índices Removidos (16)
Índices não utilizados que foram removidos para economizar espaço:
- `idx_transactions_ocr_analyzed_at`
- `idx_transactions_group_id`
- `idx_products_is_active`
- `idx_coupons_code`, `idx_coupons_is_active`, `idx_coupons_expires_at`
- `idx_coupon_usage_coupon_id`
- `idx_broadcast_campaigns_status`
- `idx_contracts_*` (3 índices)
- `idx_users_phone_number`
- `idx_groups_group_id`
- `idx_group_members_group_telegram`
- `idx_support_tickets_user_id`
- `idx_auto_responses_keyword`

### ✅ Índices Adicionados (18)
Índices criados em foreign keys mais usadas:

**Transactions (mais importante):**
- `idx_transactions_user_id`
- `idx_transactions_validated_by`
- `idx_transactions_media_pack_id`

**Group Members:**
- `idx_group_members_user_id`
- `idx_group_members_transaction_id`
- `idx_group_members_status_expires`

**Media Deliveries:**
- `idx_media_deliveries_user_pack`
- `idx_media_deliveries_media_item_id`

**Outros:**
- `idx_coupon_usage_transaction_id`
- `idx_broadcast_*` (3 índices)
- `idx_coupons_*` (2 índices)
- `idx_support_*` (2 índices)
- `idx_settings_updated_by`
- `idx_trusted_users_user_id`

---

## 📊 Exemplos de Relatórios

### Relatório Diário
```javascript
const stats = await db.getBotStatistics();
const conversion = await db.getConversionSummary();

console.log(`
📊 RELATÓRIO DIÁRIO

💰 Receita:
   - Hoje: R$ ${stats.today_revenue}
   - Este mês: R$ ${stats.month_revenue}
   - Total: R$ ${stats.total_revenue}

📦 Transações:
   - Entregues: ${stats.total_delivered}
   - Pendentes: ${stats.total_pending}
   - Validadas: ${stats.total_validated}

📈 Conversão (7 dias):
   - Taxa média: ${conversion.avgConversionRate}%
   - Taxa de comprovantes: ${conversion.avgProofRate}%
   - Taxa de validação: ${conversion.avgValidationRate}%

👥 Usuários:
   - Total: ${stats.total_users}
   - Bloqueados: ${stats.total_blocked}

🎫 Suporte:
   - Tickets abertos: ${stats.open_tickets}
   - Em andamento: ${stats.in_progress_tickets}
`);
```

### Relatório de Performance
```javascript
const products = await db.getProductPerformance();

console.log('📦 PERFORMANCE DE PRODUTOS:\n');
products.forEach((p, i) => {
  console.log(`${i + 1}. ${p.product_name}`);
  console.log(`   💰 Receita: R$ ${p.total_revenue}`);
  console.log(`   📊 Conversão: ${p.conversion_rate}%`);
  console.log(`   ✅ Entregues: ${p.delivered_count}/${p.total_transactions}`);
  console.log('');
});
```

### Relatório de Tempos
```javascript
const times = await db.getProcessingTimes();

console.log('⏱️ TEMPOS MÉDIOS DE PROCESSAMENTO:\n');
times.slice(0, 7).forEach(t => {
  console.log(`${t.date}:`);
  console.log(`   📸 Até comprovante: ${t.avg_minutes_to_proof?.toFixed(1)} min`);
  console.log(`   ✅ Até validação: ${t.avg_minutes_to_validation?.toFixed(1)} min`);
  console.log(`   🚀 Total: ${t.avg_minutes_total?.toFixed(1)} min`);
  console.log('');
});
```

---

## 🔍 Queries Úteis

### Ver receita por dia do mês
```sql
SELECT 
  DATE(created_at) as dia,
  COUNT(*) FILTER (WHERE status = 'delivered') as entregas,
  SUM(amount) FILTER (WHERE status = 'delivered') as receita
FROM transactions
WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY DATE(created_at)
ORDER BY dia DESC;
```

### Ver produtos mais vendidos do mês
```sql
SELECT 
  p.name,
  COUNT(*) as vendas,
  SUM(t.amount) as receita_total
FROM transactions t
JOIN products p ON t.product_id = p.product_id
WHERE t.status = 'delivered'
  AND t.created_at >= DATE_TRUNC('month', CURRENT_DATE)
GROUP BY p.name
ORDER BY receita_total DESC;
```

### Taxa de cancelamento por motivo
```sql
SELECT 
  notes as motivo,
  COUNT(*) as total,
  ROUND((COUNT(*)::numeric / (SELECT COUNT(*) FROM transactions WHERE status = 'cancelled') * 100), 2) as porcentagem
FROM transactions
WHERE status = 'cancelled'
  AND notes IS NOT NULL
GROUP BY notes
ORDER BY total DESC;
```

---

## 🚀 Como Usar no Admin

As funções estão disponíveis globalmente via `db`:

```javascript
// No admin.js
bot.action('admin_analytics', async (ctx) => {
  const stats = await db.getBotStatistics();
  const conversion = await db.getConversionSummary();
  
  const message = `📊 *ANALYTICS*

💰 Receita de hoje: R$ ${stats.today_revenue}
📊 Conversão (7d): ${conversion.avgConversionRate}%
📦 Pendentes: ${stats.total_pending}
✅ Entregues hoje: ${stats.total_delivered}`;

  return ctx.reply(message, { parse_mode: 'Markdown' });
});
```

---

## ✅ Sistema de Backup

O sistema de backup automático já está configurado no arquivo `src/jobs/backupDatabase.js`:

- **Frequência:** Diário às 3h da manhã
- **Retenção:** Últimas 7 cópias
- **Local:** Supabase (backup nativo)

---

## 📋 Checklist de Monitoramento

✅ Estatísticas gerais em tempo real
✅ Taxa de conversão diária/semanal/mensal
✅ Performance por produto
✅ Tempos médios de processamento
✅ Top clientes/compradores
✅ Índices otimizados (removidos 16, adicionados 18)
✅ Sistema de backup automático
✅ Views SQL prontas
✅ Funções JavaScript documentadas

---

## 🎯 Métricas Importantes

**Taxa de Conversão Ideal:** > 5%
**Tempo Ideal de Entrega:** < 30 minutos
**Taxa de Comprovantes:** > 70%
**Taxa de Validação:** > 85%

---

Criado em: 16/12/2025
Versão: 1.0.0

