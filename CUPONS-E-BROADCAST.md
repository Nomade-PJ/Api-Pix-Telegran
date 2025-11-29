# 🎟️ Sistema de Cupons e Broadcast Avançado

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Sistema de Cupons](#sistema-de-cupons)
- [Broadcast Avançado](#broadcast-avançado)
- [Exemplos de Uso](#exemplos-de-uso)
- [API do Banco de Dados](#api-do-banco-de-dados)

---

## Visão Geral

Este documento descreve as novas funcionalidades implementadas no bot:

1. **Sistema de Cupons** - Descontos personalizados para produtos
2. **Broadcast Avançado** - Mensagens associadas a produtos e cupons

---

## Sistema de Cupons

### Como Funciona

Os cupons permitem criar descontos personalizados para produtos específicos. Cada cupom possui:

- **Código único** - Ex: BLACKFRIDAY, NATAL20
- **Porcentagem de desconto** - 1-99%
- **Produto associado** - Produto ou Media Pack específico
- **Limite de usos** - Quantidade máxima de vezes que pode ser usado (opcional)
- **Data de expiração** - Validade do cupom (opcional)

### Criando um Cupom

#### Via Painel Criador
```
1. Use /criador
2. Clique em "🎟️ Cupons"
3. Clique em "➕ Novo Cupom"
4. Selecione o produto
5. Siga o assistente:
   - Digite o código (ex: BLACKFRIDAY)
   - Digite a porcentagem (ex: 50)
   - Digite o máximo de usos (ex: 100 ou 0 para ilimitado)
   - Digite a data de expiração (ex: 31/12/2025 ou 0 para nunca)
```

#### Via Painel Admin
```
1. Use /admin
2. Clique em "🎟️ Cupons"
3. Visualize todos os cupons do sistema
4. Para criar, use o /criador (cupons são associados ao criador)
```

### Estrutura no Banco de Dados

```sql
-- Tabela de cupons
CREATE TABLE coupons (
  id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_percentage NUMERIC NOT NULL,
  product_id TEXT REFERENCES products(product_id),
  media_pack_id TEXT REFERENCES media_packs(pack_id),
  max_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de uso
CREATE TABLE coupon_usage (
  id UUID PRIMARY KEY,
  coupon_id UUID REFERENCES coupons(id),
  user_id UUID REFERENCES users(id),
  transaction_id UUID REFERENCES transactions(id),
  discount_amount NUMERIC NOT NULL,
  used_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Validação de Cupom

O sistema valida automaticamente:
- ✅ Código existe e está ativo
- ✅ Não excedeu o limite de usos
- ✅ Não está expirado
- ✅ É válido para o produto sendo comprado

### Aplicação Automática

Quando um cliente usa um cupom:

1. **Verifica validade** - Código ativo, não expirado, tem usos disponíveis
2. **Calcula desconto** - Aplica porcentagem ao preço original
3. **Gera QR Code PIX** - Com o valor já descontado
4. **Registra uso** - Incrementa contador e salva na tabela `coupon_usage`

---

## Broadcast Avançado

### Tipos de Broadcast

#### 1. Broadcast Simples
Envia uma mensagem para todos os usuários.

```
Fluxo:
1. Criador/Admin → Broadcast → Simples
2. Digite a mensagem
3. Confirma
4. Enviado para todos
```

#### 2. Broadcast com Produto
Envia uma mensagem associada a um produto específico, com botão de compra.

```
Fluxo:
1. Criador/Admin → Broadcast → Com Produto
2. Seleciona o produto
3. Digite a mensagem promocional
4. Confirma
5. Enviado com botão "🛍️ Comprar [Produto]"
```

**Exemplo de mensagem:**
```
🔥 BLACK FRIDAY 90% OFF!

Pack Premium por apenas R$ 29,90!

Promoção válida apenas hoje! 🎉

[Botão: 🛍️ Comprar Pack Premium]
```

#### 3. Broadcast com Cupom
Cria um cupom e divulga simultaneamente.

```
Fluxo:
1. Criador/Admin → Broadcast → Com Cupom
2. Cria o cupom (mesmo fluxo de criação)
3. Digite a mensagem promocional
4. Cupom é divulgado automaticamente
```

**Exemplo de mensagem:**
```
🎟️ CUPOM ESPECIAL: BLACKFRIDAY

50% de desconto no Pack Premium!

Código: BLACKFRIDAY
Válido até: 31/12/2025
Usos: 100 disponíveis

[Botão: 🛍️ Usar Cupom]
```

### Estrutura no Banco de Dados

```sql
-- Campanhas de broadcast
CREATE TABLE broadcast_campaigns (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  message TEXT NOT NULL,
  product_id TEXT REFERENCES products(product_id),
  media_pack_id TEXT REFERENCES media_packs(pack_id),
  coupon_code TEXT REFERENCES coupons(code),
  target_audience TEXT DEFAULT 'all',
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Histórico de Campanhas

Todas as campanhas são salvas no banco para análise posterior:
- Mensagem enviada
- Produto/cupom associado
- Quantidade de envios (sucesso e falhas)
- Data e horário de envio
- Criador da campanha

---

## Exemplos de Uso

### Exemplo 1: Cupom de Desconto Simples

```javascript
// Criar cupom
Código: PRIMEIRACOMPRA
Desconto: 20%
Produto: Pack Básico (R$ 50,00)
Usos: Ilimitado
Expira: Nunca

// Resultado
Cliente usa código: PRIMEIRACOMPRA
Preço original: R$ 50,00
Preço com desconto: R$ 40,00
Economia: R$ 10,00 (20%)
```

### Exemplo 2: Cupom de Black Friday

```javascript
// Criar cupom
Código: BLACKFRIDAY
Desconto: 90%
Produto: Pack Premium (R$ 299,00)
Usos: 100
Expira: 27/11/2025

// Resultado
Cliente usa código: BLACKFRIDAY
Preço original: R$ 299,00
Preço com desconto: R$ 29,90
Economia: R$ 269,10 (90%)

// Status após 50 usos
Usos: 50/100
Status: Ativo
Restam: 50 cupons
```

### Exemplo 3: Broadcast com Produto

```javascript
// Configurar broadcast
Tipo: Com Produto
Produto: Pack Premium
Mensagem: "🔥 Promoção Relâmpago! Pack Premium com 70% OFF!"

// Resultado
- Enviado para: 500 usuários
- Sucesso: 495
- Falhas: 5
- Com botão: "🛍️ Comprar Pack Premium"
- Cliques estimados: 120 (24% taxa de conversão)
```

### Exemplo 4: Combinar Cupom + Broadcast

```javascript
// Passo 1: Criar cupom
Código: NATAL20
Desconto: 20%
Produto: Todos os packs
Usos: 200
Expira: 25/12/2025

// Passo 2: Criar broadcast com cupom
Mensagem: "🎄 ESPECIAL DE NATAL! Use o cupom NATAL20 e ganhe 20% OFF!"

// Resultado
- Cupom criado e ativo
- Broadcast enviado para 500 usuários
- 180 cupons usados em 3 dias
- Taxa de conversão: 36%
- Receita: R$ 14.400,00 (com desconto)
- Desconto total concedido: R$ 3.600,00
```

---

## API do Banco de Dados

### Funções Úteis

#### Criar Cupom
```javascript
const { data, error } = await db.supabase
  .from('coupons')
  .insert([{
    code: 'BLACKFRIDAY',
    discount_percentage: 50,
    product_id: 'pack_premium',
    max_uses: 100,
    expires_at: '2025-12-31T23:59:59Z',
    created_by: user.id
  }])
  .select()
  .single();
```

#### Validar Cupom
```javascript
const { data: coupon, error } = await db.supabase
  .from('coupons')
  .select('*')
  .eq('code', 'BLACKFRIDAY')
  .eq('is_active', true)
  .single();

// Verificar se é válido
const isValid = 
  coupon &&
  coupon.is_active &&
  coupon.current_uses < (coupon.max_uses || Infinity) &&
  (!coupon.expires_at || new Date(coupon.expires_at) > new Date());
```

#### Aplicar Cupom
```javascript
// Calcular desconto
const originalPrice = 100.00;
const discountPercentage = coupon.discount_percentage;
const discountAmount = originalPrice * (discountPercentage / 100);
const finalPrice = originalPrice - discountAmount;

// Incrementar contador
await db.supabase
  .from('coupons')
  .update({ current_uses: coupon.current_uses + 1 })
  .eq('id', coupon.id);

// Registrar uso
await db.supabase
  .from('coupon_usage')
  .insert([{
    coupon_id: coupon.id,
    user_id: user.id,
    transaction_id: transaction.id,
    discount_amount: discountAmount
  }]);
```

#### Criar Campanha de Broadcast
```javascript
const { data: campaign, error } = await db.supabase
  .from('broadcast_campaigns')
  .insert([{
    name: 'Black Friday 2025',
    message: '🔥 90% OFF!',
    product_id: 'pack_premium',
    coupon_code: 'BLACKFRIDAY',
    target_audience: 'all',
    status: 'sending',
    created_by: user.id
  }])
  .select()
  .single();
```

#### Atualizar Status da Campanha
```javascript
await db.supabase
  .from('broadcast_campaigns')
  .update({
    sent_count: 495,
    failed_count: 5,
    status: 'sent',
    sent_at: new Date().toISOString()
  })
  .eq('id', campaign.id);
```

---

## Estatísticas e Relatórios

### Estatísticas de Cupons

```sql
-- Cupons mais usados
SELECT 
  c.code,
  c.discount_percentage,
  COUNT(cu.id) as total_uses,
  SUM(cu.discount_amount) as total_discount
FROM coupons c
LEFT JOIN coupon_usage cu ON c.id = cu.coupon_id
GROUP BY c.id
ORDER BY total_uses DESC
LIMIT 10;

-- Cupons expirados
SELECT * FROM coupons
WHERE expires_at < NOW() AND is_active = true;

-- Cupons esgotados
SELECT * FROM coupons
WHERE current_uses >= max_uses AND is_active = true;
```

### Estatísticas de Broadcast

```sql
-- Campanhas mais eficazes
SELECT 
  name,
  sent_count,
  failed_count,
  sent_at,
  (sent_count::float / (sent_count + failed_count)) * 100 as success_rate
FROM broadcast_campaigns
WHERE status = 'sent'
ORDER BY sent_count DESC
LIMIT 10;

-- Campanhas por criador
SELECT 
  u.first_name,
  COUNT(bc.id) as total_campaigns,
  SUM(bc.sent_count) as total_sent
FROM broadcast_campaigns bc
JOIN users u ON bc.created_by = u.id
GROUP BY u.id
ORDER BY total_campaigns DESC;
```

---

## Melhores Práticas

### Para Cupons

1. **Códigos claros** - Use códigos fáceis de lembrar (BLACKFRIDAY, NATAL20)
2. **Descontos estratégicos** - Não ofereça sempre 90%, varie (10%, 20%, 50%)
3. **Limite de usos** - Para promoções especiais, limite a quantidade
4. **Expiração** - Sempre defina uma data de expiração (cria urgência)
5. **Monitore uso** - Acompanhe estatísticas para ajustar estratégia

### Para Broadcast

1. **Horários estratégicos** - Envie em horários de pico (19h-22h)
2. **Mensagens curtas** - Seja direto e objetivo
3. **Call-to-action claro** - "Compre agora", "Use o cupom", etc
4. **Não abuse** - Máximo 2-3 broadcasts por semana
5. **Teste A/B** - Varie mensagens e veja o que funciona melhor

### Para Combinação Cupom + Broadcast

1. **Crie primeiro o cupom** - Valide que está ativo antes de divulgar
2. **Divulgue múltiplas vezes** - 3 dias antes, 1 dia antes, último dia
3. **Lembrete de expiração** - Envie alerta quando estiver próximo de expirar
4. **Acompanhe métricas** - Taxa de uso, conversão, receita gerada

---

## Troubleshooting

### Cupom não funciona

```sql
-- Verificar cupom
SELECT * FROM coupons WHERE code = 'SEU_CUPOM';

-- Verificar se está ativo
UPDATE coupons SET is_active = true WHERE code = 'SEU_CUPOM';

-- Verificar usos
SELECT current_uses, max_uses FROM coupons WHERE code = 'SEU_CUPOM';
```

### Broadcast não enviou

```javascript
// Verificar logs na Vercel
// Verificar se há usuários ativos
const users = await db.getRecentUsers(10000);
console.log('Total de usuários:', users.length);

// Verificar se campanha foi salva
const { data } = await db.supabase
  .from('broadcast_campaigns')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(1);
```

### Cupons duplicados

```sql
-- Encontrar cupons duplicados
SELECT code, COUNT(*) 
FROM coupons 
GROUP BY code 
HAVING COUNT(*) > 1;

-- Desativar duplicatas (manter apenas o mais recente)
WITH ranked AS (
  SELECT id, code, ROW_NUMBER() OVER (PARTITION BY code ORDER BY created_at DESC) as rn
  FROM coupons
)
UPDATE coupons SET is_active = false
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);
```

---

## Roadmap Futuro

- [ ] Cupons para múltiplos produtos
- [ ] Cupons progressivos (10% no 1º, 15% no 2º, 20% no 3º)
- [ ] Cupons de frete grátis
- [ ] Broadcast agendado (enviar em data/hora específica)
- [ ] Segmentação de audiência (apenas compradores, apenas novos, etc)
- [ ] A/B testing de broadcasts
- [ ] Relatórios em PDF
- [ ] Dashboard web para análise visual

---

**Desenvolvido com ❤️ para potencializar vendas via Telegram**

