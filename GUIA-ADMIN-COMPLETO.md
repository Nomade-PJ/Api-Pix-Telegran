# 🎛️ GUIA COMPLETO - GERENCIAMENTO ADMIN VIA BOT

## 🎉 **TUDO AGORA É PELO BOT! NADA DE CÓDIGO!**

Você pode gerenciar TUDO direto pelo Telegram, sem mexer em código ou Vercel!

---

## 📱 **COMANDOS DISPONÍVEIS**

### **🔐 Painel Principal**
```
/admin
```
Mostra o painel administrativo completo com estatísticas e todos os comandos disponíveis.

---

## 💰 **GERENCIAR CHAVE PIX**

### **Alterar Chave PIX:**
```
/setpix [sua_chave]
```

**Exemplos:**
```
/setpix seuemail@gmail.com
/setpix 11999887766
/setpix 12345678900
/setpix 123e4567-e89b-12d3-a456-426614174000
```

**Tipos aceitos:**
- ✅ Email
- ✅ Telefone (com DDD, sem +55)
- ✅ CPF/CNPJ (só números)
- ✅ Chave aleatória

⚠️ **Nota:** A alteração funciona imediatamente, mas é temporária. Para tornar permanente, atualize também na Vercel.

---

## 🛍️ **GERENCIAR PRODUTOS**

### **1. Ver Todos os Produtos:**
```
/produtos
```

**Você verá:**
- ✅/❌ Status (ativo/inativo)
- Nome do produto
- ID do produto
- Preço
- Descrição
- Tipo de entrega (arquivo ou link)
- URL de entrega

---

### **2. Criar Novo Produto:**
```
/novoproduto
```

**Fluxo interativo em 4 passos:**

#### **Passo 1 - Nome:**
```
Bot: Digite o nome do produto:
Você: Pack Premium VIP
```

#### **Passo 2 - Preço:**
```
Bot: Digite o preço:
Você: 79.90
```
ou
```
Você: 79
```

#### **Passo 3 - Descrição:**
```
Bot: Digite uma descrição (ou "-" para pular):
Você: Acesso completo ao conteúdo exclusivo premium
```
ou
```
Você: -
```
(para pular)

#### **Passo 4 - Entrega:**

**Opção A - Enviar Arquivo:**
```
Bot: Envie a URL de entrega ou envie um arquivo:
Você: [ENVIA UM ARQUIVO ZIP/PDF]
```

**Opção B - Enviar Link:**
```
Bot: Envie a URL de entrega ou envie um arquivo:
Você: https://drive.google.com/file/d/XXXXX/view
```

**Opção C - Pular:**
```
Você: -
```
(configura depois)

#### **Resultado:**
```
✅ PRODUTO CRIADO COM SUCESSO!

🛍️ Nome: Pack Premium VIP
🆔 ID: packpremiumvip
💰 Preço: R$ 79.90
📝 Descrição: Acesso completo...
🔗 URL: [sua URL]

O produto já está disponível no menu de compras!
```

---

### **3. Editar Produto Existente:**
```
/editarproduto
```

**Fluxo:**

#### **Passo 1 - Selecionar Produto:**
```
Bot: Digite o ID do produto que deseja editar:
• packA - Pack A
• packB - Pack B
• packpremiumvip - Pack Premium VIP

Você: /edit_packA
```

#### **Passo 2 - Escolher Campo:**
```
Bot: O que deseja editar?

1️⃣ /edit_name - Nome
2️⃣ /edit_price - Preço
3️⃣ /edit_description - Descrição
4️⃣ /edit_url - URL de entrega
5️⃣ /edit_status - Ativar/Desativar

Você: /edit_price
```

#### **Passo 3 - Novo Valor:**
```
Bot: Digite o novo preço:
Você: 25.00
```

```
✅ Produto atualizado com sucesso!
```

---

### **4. Remover Produto:**
```
/deletarproduto
```

**Fluxo:**
```
Bot: Digite o ID do produto:
• packA - Pack A
• packB - Pack B

Você: /delete_packB
```

```
✅ Produto desativado com sucesso!
```

⚠️ **Nota:** O produto NÃO é deletado do banco, apenas desativado. Não aparecerá mais no menu de compras.

---

### **5. Cancelar Operação:**

A qualquer momento durante criação/edição:
```
/cancelar
```

---

## 📊 **GERENCIAR VENDAS**

### **Ver Transações Pendentes:**
```
/pendentes
```

**Você verá:**
- TXID de cada transação
- Nome do cliente
- Produto comprado
- Valor
- Data/hora do comprovante
- Comando para validar

### **Validar e Entregar:**
```
/validar_M87588057GRGV
```

**O bot automaticamente:**
1. ✅ Valida a transação
2. ✅ Envia o produto ao cliente
3. ✅ Atualiza o banco de dados
4. ✅ Marca como entregue

---

## 📈 **ESTATÍSTICAS**

### **Estatísticas Completas:**
```
/stats
```

**Você verá:**
- Total de usuários
- Total de transações
- Transações pendentes
- Total em vendas (R$)
- Ticket médio

---

## 👥 **GERENCIAR USUÁRIOS**

### **Listar Últimos 20 Usuários:**
```
/users
```

**Você verá:**
- Nome
- Username
- Telegram ID
- Data de cadastro
- Se é admin (🔐)

---

## 📢 **ENVIAR MENSAGENS**

### **Broadcast (Enviar para Todos):**
```
/broadcast Olá! Temos uma promoção especial hoje! 🎉
```

**O bot envia para TODOS os usuários cadastrados.**

⚠️ **Respeita rate limit do Telegram automaticamente.**

---

## 🎯 **EXEMPLOS PRÁTICOS**

### **Exemplo 1: Criar produto com arquivo**

```
Você: /novoproduto

Bot: Digite o nome do produto:
Você: Curso Completo 2025

Bot: Digite o preço:
Você: 149.90

Bot: Digite uma descrição:
Você: Curso completo com certificado e suporte vitalício

Bot: Envie a URL de entrega ou envie um arquivo:
Você: [ENVIA curso-completo-2025.zip]

Bot: 🎉 PRODUTO CRIADO COM SUCESSO!

🛍️ Nome: Curso Completo 2025
🆔 ID: cursocompleto2025
💰 Preço: R$ 149.90
📝 Descrição: Curso completo...
📄 Arquivo: curso-completo-2025.zip

O produto já está disponível no menu de compras!
```

**Pronto! O botão já aparece no `/start` automaticamente!**

---

### **Exemplo 2: Criar produto com link do Google Drive**

```
Você: /novoproduto

Bot: Digite o nome do produto:
Você: Pack Fotos HD

Bot: Digite o preço:
Você: 29.90

Bot: Digite uma descrição:
Você: -

Bot: Envie a URL de entrega ou envie um arquivo:
Você: https://drive.google.com/file/d/1A2B3C4D5E/view?usp=sharing

Bot: 🎉 PRODUTO CRIADO COM SUCESSO!
```

---

### **Exemplo 3: Editar preço de um produto**

```
Você: /editarproduto

Bot: Digite o ID do produto:
• packA - Pack A
• cursocompleto2025 - Curso Completo 2025

Você: /edit_cursocompleto2025

Bot: O que deseja editar?
1️⃣ /edit_name
2️⃣ /edit_price
...

Você: /edit_price

Bot: Digite o novo preço:
Você: 99.90

Bot: ✅ Produto atualizado com sucesso!
```

---

### **Exemplo 4: Alterar chave PIX**

```
Você: /setpix novoemail@gmail.com

Bot: ✅ Chave PIX atualizada com sucesso!

🔑 Nova chave: novoemail@gmail.com

⚠️ IMPORTANTE: 
Esta alteração é temporária. Para torná-la permanente...
```

---

## 🔄 **FLUXO COMPLETO DE VENDA**

### **1. Cliente compra:**
- Envia `/start`
- Vê os produtos (carregados do banco automaticamente)
- Clica em "Comprar Pack Premium VIP"
- Recebe QR Code PIX

### **2. Cliente paga e envia comprovante:**
- Tira foto do comprovante
- Envia para o bot
- Bot salva no banco

### **3. Você recebe notificação:**
```
🔔 NOVO COMPROVANTE RECEBIDO

🆔 TXID: M87588057GRGV
👤 Cliente: João Silva
💰 Valor: R$ 79.90

Para validar:
/validar_M87588057GRGV
```

### **4. Você valida:**
```
Você: /validar_M87588057GRGV
```

### **5. Bot entrega automaticamente:**
- Se for arquivo: Bot envia o arquivo ZIP/PDF
- Se for link: Bot envia o link do Google Drive

### **6. Cliente recebe:**
```
✅ Pagamento Confirmado!

Seu acesso ao Pack Premium VIP foi liberado!

📄 Aqui está seu arquivo:
[ARQUIVO ENVIADO]
```

**Pronto! Venda completa e registrada no banco!**

---

## 🎨 **PERSONALIZAÇÃO AUTOMÁTICA**

### **Emojis Automáticos:**
- Produtos até R$ 49.99: 🛍️
- Produtos R$ 50.00+: 💎

### **Botões Dinâmicos:**
O menu `/start` é gerado automaticamente baseado nos produtos ativos!

**Exemplo:**
- Se você tem 2 produtos: 2 botões
- Se criar mais 3: aparecerão 5 botões
- Se desativar 1: aparecerão 4 botões

**TUDO AUTOMÁTICO!**

---

## 💡 **DICAS PRO**

### **Criar produtos rápido:**
1. Use `/novoproduto`
2. Preencha nome e preço
3. Digite `-` em descrição (pula)
4. Envie o arquivo direto do seu computador/celular

### **Organização:**
- Use IDs curtos e claros: `pack30`, `pack50`, `curso`
- Nomes descritivos: "Pack Premium VIP", não só "Pack"
- Descrições opcionais mas recomendadas

### **Entrega:**
- **Arquivos pequenos (<20MB):** Envie direto pelo Telegram
- **Arquivos grandes:** Use Google Drive ou Mega
- **Múltiplos arquivos:** Comprima em ZIP primeiro

---

## ⚠️ **LIMITAÇÕES**

### **Chave PIX:**
A alteração via `/setpix` é temporária. Para ser permanente, atualize também na Vercel:
1. Settings → Environment Variables
2. Edite `MY_PIX_KEY`
3. Salve e aguarde redeploy

### **Tamanho de arquivos:**
- Telegram: Máximo 50MB por arquivo
- Use Google Drive para arquivos maiores

---

## 🆘 **RESOLUÇÃO DE PROBLEMAS**

### **Produto não aparece no menu:**
1. Use `/produtos` para verificar
2. Confira se está ✅ (ativo)
3. Se estiver ❌: use `/editarproduto` → `/edit_status`

### **Erro ao criar produto:**
- Certifique-se do preço estar correto (só números)
- Nome não pode estar vazio
- Tente `/cancelar` e comece de novo

### **Cliente não recebeu entrega:**
1. Use `/pendentes` para ver a transação
2. Use `/validar_[txid]` novamente
3. Verifique se o produto tem URL/arquivo configurado

---

## 🎊 **RESUMO**

### **Você pode gerenciar:**
✅ Chave PIX  
✅ Produtos (criar, editar, remover)  
✅ Preços  
✅ Arquivos de entrega  
✅ Links de entrega  
✅ Validação de vendas  
✅ Estatísticas  
✅ Usuários  
✅ Mensagens em massa  

### **TUDO PELO BOT!**
Nunca mais precisa mexer em código, Vercel ou Supabase para gerenciar produtos!

---

## 📞 **COMANDOS RÁPIDOS**

```
/admin              - Painel principal
/setpix [chave]     - Alterar PIX
/produtos           - Listar produtos
/novoproduto        - Criar produto
/editarproduto      - Editar produto
/deletarproduto     - Remover produto
/pendentes          - Ver vendas pendentes
/validar_[txid]     - Validar e entregar
/stats              - Estatísticas
/users              - Listar usuários
/broadcast [msg]    - Enviar para todos
/cancelar           - Cancelar operação
```

---

**🎉 AGORA VOCÊ TEM CONTROLE TOTAL PELO TELEGRAM!**

