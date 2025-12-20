# 🎁 Guia: Broadcast + Produto + Cupom

## 📋 Visão Geral

Esta funcionalidade permite que criadores enviem broadcasts promocionais com descontos automáticos aplicados para usuários que recebem a mensagem, enquanto novos usuários podem usar cupons manualmente.

## ✨ Características

### Para Usuários que Recebem o Broadcast:
- ✅ Desconto aplicado **automaticamente** no momento da compra
- 💰 Veem o preço com desconto direto no QR Code PIX
- 🎟️ Recebem o código do cupom para compartilhar
- 🚀 Processo de compra simplificado (sem precisar digitar cupom)

### Para Novos Usuários:
- 🎟️ Podem inserir o cupom manualmente
- 💬 Sistema pergunta se têm cupom antes de gerar o PIX
- ✅ Validação automática do cupom
- 📊 Limite de usos e data de expiração respeitados

## 🚀 Como Usar

### 1. Ativar a Funcionalidade (Admin)

```bash
/broadcast_config
```

No painel que aparecer, clique em **✅ Ativar**.

### 2. Criar um Broadcast com Cupom (Criador)

1. Use o comando `/criador` ou `/start` (se for o primeiro criador)
2. Clique em **📢 Broadcast**
3. Selecione **🎁 Broadcast + Produto + Cupom**

### 3. Fluxo de Criação

#### Passo 1: Selecionar Produtos
- Escolha um ou mais produtos que terão desconto
- Clique nos produtos para adicionar/remover da seleção
- ✅ Produtos selecionados ficam marcados
- Clique em **✅ Continuar** quando terminar

#### Passo 2: Definir Descontos
- Para cada produto selecionado, digite a porcentagem de desconto
- Exemplo: `20` para 20% OFF
- O sistema mostra o resumo com preços originais e com desconto

#### Passo 3: Criar Código do Cupom
- Digite um código único para o cupom
- Exemplo: `BLACKFRIDAY`, `NATAL20`, `PROMO50`
- Este código será usado por novos usuários

#### Passo 4: Escrever Mensagem
- Escreva a mensagem promocional
- Mencione os produtos e descontos
- O cupom será adicionado automaticamente ao final

#### Passo 5: Confirmar e Enviar
- Revise todas as informações
- Clique em **✅ Confirmar e Enviar**
- O sistema irá:
  - Criar cupons automáticos para cada produto
  - Criar cupom manual para novos usuários
  - Registrar todos os destinatários
  - Enviar o broadcast

## 🔧 Funcionalidades Técnicas

### Sistema de Cupons Duplos

Para cada produto, o sistema cria **2 cupons**:

1. **Cupom Automático** (`AUTO_CODIGO_PRODUTO_ID`)
   - Aplicado automaticamente para quem recebeu o broadcast
   - Invisível para o usuário
   - `is_broadcast_coupon = true`

2. **Cupom Manual** (código digitado pelo criador)
   - Usado por novos usuários
   - Visível e compartilhável
   - `is_broadcast_coupon = false`

### Rastreamento de Destinatários

A tabela `broadcast_recipients` registra:
- Quem recebeu cada broadcast
- Data de recebimento
- Campanha associada

Isso permite aplicar o desconto automático apenas para quem realmente recebeu a mensagem.

### Validação de Cupons

O sistema valida automaticamente:
- ✅ Cupom ativo
- ✅ Produto correto
- ✅ Limite de usos não excedido
- ✅ Data de expiração válida

## 📊 Gerenciamento

### Ver Cupons Ativos

```bash
/broadcast_config
```

Clique em **📋 Ver Cupons Ativos** para ver todos os cupons em uso.

### Limpar Destinatários Antigos

```bash
/broadcast_config
```

Clique em **🗑️ Limpar Destinatários Antigos** para remover registros com mais de 30 dias.

Isso ajuda a manter o banco de dados limpo e evita que usuários tenham descontos eternos.

## 🎯 Exemplos de Uso

### Exemplo 1: Black Friday

```
🔥 BLACK FRIDAY 90% OFF! 🔥

Aproveite descontos incríveis:
• Pack Premium - De R$ 50,00 por R$ 5,00 (90% OFF)
• Pack VIP - De R$ 100,00 por R$ 10,00 (90% OFF)

Promoção válida apenas HOJE!
Não perca essa chance! 🎉

Use o cupom: BLACKFRIDAY
```

### Exemplo 2: Natal

```
🎄 PROMOÇÃO DE NATAL 🎄

Presentes especiais com desconto:
• Pack Natalino - 50% OFF
• Pack Ano Novo - 40% OFF

Aproveite enquanto dura!

Cupom: NATAL20
```

### Exemplo 3: Lançamento

```
🚀 LANÇAMENTO EXCLUSIVO! 🚀

Novo pack disponível com desconto especial:
• Pack Exclusivo - 30% OFF

Apenas para os primeiros 100 clientes!

Cupom: LANCAMENTO30
```

## ⚙️ Configurações Avançadas

### Desativar Temporariamente

Se precisar desativar a funcionalidade temporariamente:

```bash
/broadcast_config
```

Clique em **❌ Desativar**. A opção não aparecerá mais no menu de broadcast.

### Reativar

Use o mesmo comando e clique em **✅ Ativar**.

## 🗄️ Migração do Banco de Dados

Execute o arquivo `migration_broadcast_coupon.sql` no SQL Editor do Supabase para criar as tabelas necessárias:

```sql
-- Tabelas criadas:
- broadcast_recipients (rastreamento de destinatários)

-- Colunas adicionadas:
- coupons.is_broadcast_coupon (tipo de cupom)
- transactions.coupon_id (cupom aplicado)

-- Configurações:
- broadcast_coupon_enabled (ativar/desativar)
```

## 📈 Métricas e Análises

O sistema cria automaticamente uma view `broadcast_coupon_stats` com:
- Número de destinatários
- Transações geradas
- Receita total
- Cupons utilizados

Acesse via SQL Editor:

```sql
SELECT * FROM broadcast_coupon_stats;
```

## 🔒 Segurança

- ✅ Apenas criadores podem enviar broadcasts
- ✅ Apenas admins podem ativar/desativar a funcionalidade
- ✅ Cupons têm limite de usos
- ✅ Validação de expiração automática
- ✅ Rastreamento de uso para evitar fraudes

## 🐛 Troubleshooting

### Cupom não está sendo aplicado automaticamente

1. Verifique se o usuário está na tabela `broadcast_recipients`
2. Confirme que o cupom automático está ativo (`is_broadcast_coupon = true`)
3. Verifique se o produto está correto

### Novos usuários não conseguem usar o cupom

1. Verifique se o cupom manual foi criado (`is_broadcast_coupon = false`)
2. Confirme que o cupom está ativo
3. Verifique limite de usos e data de expiração

### Broadcast não está enviando

1. Verifique se há usuários desbloqueados no sistema
2. Confirme que a funcionalidade está ativada
3. Verifique os logs do servidor

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do servidor
2. Execute `/broadcast_config` para ver o status
3. Consulte a documentação do Supabase

---

**Desenvolvido com ❤️ para melhorar suas vendas!**

