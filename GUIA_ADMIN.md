# 📚 GUIA DO ADMINISTRADOR - Bot PIX Telegram v2.0

## 🎯 Índice

1. [Acesso ao Painel Admin](#acesso-ao-painel-admin)
2. [Painel Principal](#painel-principal)
3. [Gerenciar Vendas](#gerenciar-vendas)
4. [Gerenciar Produtos](#gerenciar-produtos)
5. [Sistema de Cupons](#sistema-de-cupons)
6. [Relatórios](#relatórios)
7. [Avaliações](#avaliações)
8. [Backup e Exportações](#backup-e-exportações)
9. [Modo Manutenção](#modo-manutenção)
10. [Dicas e Boas Práticas](#dicas-e-boas-práticas)

---

## 🔐 Acesso ao Painel Admin

### Como se tornar Admin

1. Acesse o Supabase (seu banco de dados)
2. Vá em "Table Editor" → `users`
3. Encontre seu usuário pelo `telegram_id`
4. Edite e altere `is_admin` para `TRUE`
5. Salve

### Acessar o Painel

Digite no Telegram:
```
/admin
```

---

## 📊 Painel Principal

O painel principal mostra um **dashboard em tempo real** com:

### Métricas de Hoje:
- 💰 Vendas do dia (valor e quantidade)
- 👥 Novos usuários cadastrados
- ⏳ Pagamentos pendentes

### Métricas do Mês:
- 💵 Receita total do mês
- 🛍️ Total de vendas
- 📦 Produto mais vendido

### Botões de Navegação:
- `📊 Estatísticas` - Stats detalhadas
- `📈 Relatórios` - Relatórios por período
- `💼 Vendas` - Gerenciar vendas
- `🛍️ Produtos` - Gerenciar produtos
- `👥 Usuários` - Lista de usuários
- `📢 Broadcast` - Enviar mensagem em massa
- `🎟️ Cupons` - Sistema de cupons
- `⭐ Avaliações` - Ver feedbacks
- `💾 Backup` - Exportações
- `⚙️ Configurações` - Configurações gerais

---

## 💼 Gerenciar Vendas

### Ver Pendentes

**Via Painel:**
- `/admin` → `💼 Vendas` → `📋 Ver todas pendentes`

**Via Comando:**
```
/pendentes
```

Mostra todas as vendas que estão aguardando validação.

### Validar uma Venda

**Formato:**
```
/validar TXID
```

**Exemplo:**
```
/validar M123456ABCD
```

**O que acontece:**
1. Bot mostra preview da venda com:
   - Nome do cliente
   - Produto comprado
   - Valor pago
   - Comprovante (foto)
   - Data de recebimento

2. Você tem 3 opções:
   - ✅ **Validar e Entregar** - Valida e envia automaticamente o produto
   - ❌ **Recusar** - Recusa a venda
   - ⏸️ **Aguardar** - Coloca em espera para decisão posterior

3. Se validar:
   - ✅ Produto é entregue automaticamente
   - ✅ Status muda para "delivered"
   - ✅ Cliente recebe o acesso
   - ✅ Sistema agenda avaliação pós-venda (24h)

### Buscar Venda Específica

Use `/validar` seguido do TXID que você recebeu na notificação.

---

## 🛍️ Gerenciar Produtos

### Listar Todos os Produtos

```
/produtos
```

Mostra todos os produtos cadastrados com:
- ✅/❌ Status (ativo/inativo)
- 🆔 ID do produto
- 💰 Preço
- 📝 Descrição
- 📦 Tipo de entrega (link ou arquivo)
- 🔗 URL/arquivo configurado

### Criar Novo Produto

```
/novoproduto
```

**Fluxo interativo:**

1. **Nome do produto**
   - Digite o nome (ex: "Pack Premium")

2. **Preço**
   - Digite apenas números (ex: 79.90)

3. **Descrição**
   - Digite a descrição ou "-" para pular

4. **Entrega**
   - **Opção A:** Digite uma URL (Google Drive, Mega, etc.)
   - **Opção B:** Envie um arquivo (ZIP, PDF, etc.)
   - **Opção C:** Digite "-" para configurar depois

✅ Produto criado e já disponível no menu `/start`!

### Editar Produto

```
/editarproduto
```

1. Escolha o produto pelo ID (ex: `/edit_packpremium`)
2. Escolha o que editar:
   - `/edit_name` - Nome
   - `/edit_price` - Preço
   - `/edit_description` - Descrição
   - `/edit_url` - URL de entrega
   - `/edit_status` - Ativar/Desativar

### Deletar Produto

```
/deletarproduto
```

⚠️ **Nota:** Isso apenas **desativa** o produto (não deleta do banco).

O produto não aparecerá mais no menu, mas histórico de vendas é mantido.

---

## 🎟️ Sistema de Cupons

### Listar Cupons

```
/cupons
```

Mostra todos os cupons com:
- ✅/❌ Status
- 🎟️ Código
- 💰 Valor/percentual
- 📊 Usos (atual/máximo)
- 📅 Data de expiração

### Criar Novo Cupom

```
/novocupom
```

**Fluxo interativo:**

1. **Código**
   - Digite o código (ex: PROMO20, DESC10)
   - Será automaticamente convertido para maiúsculas

2. **Tipo**
   - `1` - Percentual (%)
   - `2` - Fixo (R$)

3. **Valor**
   - Se percentual: digite o % (ex: 20 para 20%)
   - Se fixo: digite o valor (ex: 10 para R$ 10,00)

4. **Usos máximos**
   - Digite um número (ex: 100)
   - Digite "-" para ilimitado

✅ Cupom criado e pronto para uso!

### Como Clientes Usam Cupons

**Ainda não implementado no fluxo de compra.**

_Planejado para v2.1:_
- Cliente digita código durante a compra
- Desconto é aplicado automaticamente
- PIX é gerado com valor com desconto

---

## 📈 Relatórios

### Acessar Relatórios

**Via Painel:**
- `/admin` → `📈 Relatórios`

**Opções:**

1. **📅 Hoje**
   - Vendas de hoje
   - Novos usuários
   - Pendentes

2. **📊 Últimos 7 dias**
   - Receita total
   - Número de vendas
   - Ticket médio
   - Top 5 produtos

3. **📊 Últimos 30 dias**
   - Receita total
   - Número de vendas
   - Ticket médio
   - Top 5 produtos

4. **📆 Este mês**
   - Receita do mês
   - Total de vendas
   - Produto mais vendido

5. **📥 Exportar CSV**
   - Gera arquivo CSV com todas as transações
   - Inclui: TXID, data, cliente, produto, valor, status, cupom, desconto

### Interpretar Relatórios

**Ticket Médio:**
- Valor médio de cada venda
- `Receita Total ÷ Número de Vendas`
- Use para entender o perfil de compra dos clientes

**Top Produtos:**
- Produtos que mais vendem
- Foque marketing neles
- Considere criar variações

---

## ⭐ Avaliações

### Ver Avaliações

```
/avaliacoes
```

Mostra:
- 📊 Total de avaliações
- ⭐ Média geral
- 📝 Distribuição (5⭐, 4⭐, etc.)
- 💬 Últimas 10 avaliações com comentários

### Como Funciona

1. **Automático:** 24h após entrega, cliente recebe mensagem:
   ```
   ⭐ Como foi sua experiência com nosso produto?
   
   Sua opinião é muito importante para nós!
   
   [⭐⭐⭐⭐⭐] [⭐⭐⭐⭐] [⭐⭐⭐] [⭐⭐] [⭐]
   ```

2. Cliente clica nas estrelas

3. Avaliação é salva no banco

4. Você pode ver no `/avaliacoes`

### Usar Avaliações para Melhorar

- **5⭐**: Clientes satisfeitos - peça indicações!
- **4⭐**: Bom, mas pode melhorar - pergunte o que faltou
- **3⭐ ou menos**: Problema sério - entre em contato!

---

## 💾 Backup e Exportações

### Acessar Backup

**Via Painel:**
- `/admin` → `💾 Backup`

### Opções de Exportação

1. **👥 Exportar usuários (CSV)**
   - Todos os usuários cadastrados
   - Formato: ID, Telegram ID, Username, Nome, Admin, Bloqueado, Data

2. **💳 Exportar vendas (CSV)**
   - Todas as transações
   - Formato: TXID, Data, Cliente, Produto, Valor, Status, etc.

3. **📦 Exportar produtos (JSON)**
   - Todos os produtos
   - Formato JSON com todos os campos

4. **📦 Backup completo (JSON)**
   - **TUDO**: Usuários, produtos, transações
   - Use para backup periódico
   - Formato JSON estruturado

### Quando Fazer Backup

Recomendado:
- ✅ **Semanal**: Backup completo
- ✅ **Mensal**: Exportar vendas para arquivo
- ✅ **Antes de atualizações**: Backup completo

---

## 🔧 Modo Manutenção

### O que é?

Modo que bloqueia acesso de clientes ao bot enquanto você faz manutenção.

**Admins continuam tendo acesso normal.**

### Ativar/Desativar

```
/manutencao
```

Ou via painel:
- `/admin` → `⚙️ Configurações` → `🔧 Modo manutenção`

### O que acontece quando ativo

1. Clientes que tentarem usar o bot recebem:
   ```
   🔧 Estamos em manutenção. Voltaremos em breve!
   ```

2. Admins continuam usando normalmente

3. Status aparece no painel de configurações

### Quando Usar

- ✅ Atualizações importantes
- ✅ Mudanças no sistema de pagamento
- ✅ Manutenção do banco de dados
- ✅ Correção de bugs críticos

⚠️ **Não abuse!** Clientes podem pensar que o bot está offline.

---

## 💡 Dicas e Boas Práticas

### Gestão de Vendas

1. **Valide rápido**
   - Clientes esperam resposta rápida
   - Meta: validar em até 2 horas

2. **Use preview**
   - Sempre veja o comprovante antes de validar
   - Desconfie de valores diferentes

3. **Comunique-se**
   - Se recusar, envie mensagem explicando
   - Se demorar, avise o cliente

### Gestão de Produtos

1. **Nomes claros**
   - "Pack Premium 2024" > "Pack"
   - Facilita identificação

2. **Descrições detalhadas**
   - Explique o que o cliente receberá
   - Evita dúvidas e cancelamentos

3. **Preços estratégicos**
   - Use R$ 49,90 em vez de R$ 50,00
   - Psicologia de preços funciona!

### Cupons

1. **Códigos memoráveis**
   - "PROMO20" > "X7K2P9"
   - Fácil de lembrar e compartilhar

2. **Limite de usos**
   - Evite prejuízo com cupons ilimitados
   - Use limite para criar urgência

3. **Rastreie uso**
   - Veja quais cupons convertem mais
   - Repita os que funcionam

### Notificações

1. **Configure o worker**
   - Cron job a cada 15 minutos: `/api/process-notifications`
   - Garante que notificações sejam enviadas

2. **Não seja spam**
   - Notificações são automáticas
   - Evite enviar broadcasts muito frequentes

### Segurança

1. **Proteja suas credenciais**
   - Nunca compartilhe tokens
   - Use `.env` para variáveis sensíveis

2. **Backup regular**
   - Faça backup semanal
   - Guarde em local seguro

3. **Monitore logs**
   - Use `/admin` → `Configurações` → `Ver logs`
   - Identifique ações suspeitas

### Performance

1. **Produtos ativos**
   - Desative produtos esgotados
   - Menu fica mais limpo

2. **Relatórios**
   - Use para tomar decisões
   - Identifique tendências

3. **Avaliações**
   - Responda feedbacks negativos
   - Melhore baseado nas avaliações

---

## 🆘 Resolução de Problemas

### Comandos não funcionam

1. Verifique se você é admin no Supabase
2. Tente `/start` para recarregar
3. Verifique logs da Vercel

### Bot não responde

1. Verifique se não está em modo manutenção
2. Confira webhook no Telegram
3. Veja logs na Vercel

### Produto não aparece no menu

1. Verifique se `is_active = TRUE`
2. Use `/produtos` para ver status
3. Tente desativar e ativar novamente

### Cliente não recebe produto

1. Verifique se validou corretamente
2. Confira se URL/arquivo está correto
3. Tente reenviar manualmente usando o módulo `deliver`

---

## 📞 Suporte

Para dúvidas técnicas:
1. Verifique a [documentação do Telegraf](https://telegraf.js.org/)
2. Consulte os [logs da Vercel](https://vercel.com/docs/observability/logs)
3. Revise o [README.md](README.md)

---

## 🎉 Você está pronto!

Com este guia, você tem tudo para gerenciar seu bot como um profissional!

**Lembre-se:**
- ✅ Valide vendas rapidamente
- ✅ Monitore avaliações
- ✅ Faça backup regularmente
- ✅ Use relatórios para crescer

**Boa sorte com suas vendas! 🚀💰**

