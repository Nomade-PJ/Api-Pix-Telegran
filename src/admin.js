// src/admin.js
const { Markup } = require('telegraf');
const db = require('./database');
const deliver = require('./deliver');

// Registrar comandos admin
function registerAdminCommands(bot) {
  
  // ===== PAINEL ADMIN (oculto) =====
  bot.command('admin', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ Acesso negado.');
      }
      
      const stats = await db.getStats();
      
      const message = `🔐 *PAINEL ADMINISTRATIVO*
━━━━━━━━━━━━━━━━━━━━━

📊 *Estatísticas em Tempo Real:*
👥 Usuários: *${stats.totalUsers}*
💳 Transações: *${stats.totalTransactions}*
⏳ Pendentes: *${stats.pendingTransactions}*
💰 Vendas: *R$ ${stats.totalSales}*

Selecione uma opção abaixo:`;

      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('⏳ Pendentes (' + stats.pendingTransactions + ')', 'admin_pendentes'),
          Markup.button.callback('📊 Estatísticas', 'admin_stats')
        ],
        [
          Markup.button.callback('🛍️ Ver Produtos', 'admin_produtos'),
          Markup.button.callback('➕ Novo Produto', 'admin_novoproduto')
        ],
        [
          Markup.button.callback('🔑 Alterar PIX', 'admin_setpix'),
          Markup.button.callback('👥 Usuários', 'admin_users')
        ],
        [
          Markup.button.callback('📢 Broadcast', 'admin_broadcast')
        ],
        [
          Markup.button.callback('🔄 Atualizar', 'admin_refresh')
        ]
      ]);
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (err) {
      console.error('Erro no comando admin:', err.message);
      return ctx.reply('❌ Erro ao carregar painel.');
    }
  });
  
  // ===== VER PENDENTES =====
  bot.command('pendentes', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const pending = await db.getPendingTransactions(10);
      
      if (pending.length === 0) {
        return ctx.reply('✅ Nenhuma transação pendente!');
      }
      
      let message = `⏳ *${pending.length} TRANSAÇÕES PENDENTES:*\n\n`;
      
      for (const tx of pending) {
        message += `🆔 TXID: ${tx.txid}\n`;
        message += `👤 User: ${tx.user?.first_name || 'N/A'} (@${tx.user?.username || 'N/A'})\n`;
        message += `📦 Produto: ${tx.product?.name || tx.product_id}\n`;
        message += `💵 Valor: R$ ${tx.amount}\n`;
        message += `📅 Recebido: ${new Date(tx.proof_received_at).toLocaleString('pt-BR')}\n`;
        message += `\n/validar_${tx.txid}\n`;
        message += `——————————\n\n`;
      }
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao listar pendentes:', err);
      return ctx.reply('❌ Erro ao buscar pendentes.');
    }
  });
  
  // ===== VALIDAR TRANSAÇÃO =====
  bot.hears(/^\/validar[_\s](.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const txid = ctx.match[1].trim();
      
      // Buscar transação
      const transaction = await db.getTransactionByTxid(txid);
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      if (transaction.status === 'delivered') {
        return ctx.reply('⚠️ Esta transação já foi entregue.');
      }
      
      // Validar transação
      const user = await db.getOrCreateUser({ id: ctx.from.id });
      await db.validateTransaction(txid, user.id);
      
      // Entregar automaticamente
      try {
        const product = await db.getProduct(transaction.product_id);
        
        if (!product) {
          return ctx.reply(`❌ Produto não encontrado: ${transaction.product_id}`);
        }
        
        await deliver.deliverContent(transaction.telegram_id, product);
        await db.markAsDelivered(txid);
        
        return ctx.reply(`✅ Transação validada e entregue!\n\n🆔 TXID: ${txid}\n👤 Cliente: ${transaction.user?.first_name}\n💰 Valor: R$ ${transaction.amount}`, {
          parse_mode: 'Markdown'
        });
      } catch (deliverErr) {
        console.error('Erro ao entregar:', deliverErr);
        return ctx.reply(`⚠️ Transação validada, mas erro ao entregar.\nTXID: ${txid}\nTente novamente ou entregue manualmente.`, {
          parse_mode: 'Markdown'
        });
      }
    } catch (err) {
      console.error('Erro ao validar:', err);
      return ctx.reply('❌ Erro ao validar transação.');
    }
  });
  
  // ===== ESTATÍSTICAS DETALHADAS =====
  bot.command('stats', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const stats = await db.getStats();
      
      const message = `📊 *ESTATÍSTICAS DETALHADAS*

👥 *Usuários:*
Total: ${stats.totalUsers}

💳 *Transações:*
Total: ${stats.totalTransactions}
⏳ Pendentes: ${stats.pendingTransactions}
✅ Entregues: ${stats.totalTransactions - stats.pendingTransactions}

💰 *Financeiro:*
Total em vendas: R$ ${stats.totalSales}
Ticket médio: R$ ${stats.totalTransactions > 0 ? (parseFloat(stats.totalSales) / stats.totalTransactions).toFixed(2) : '0.00'}`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
      return ctx.reply('❌ Erro ao carregar estatísticas.');
    }
  });
  
  // ===== BROADCAST (enviar para todos) =====
  bot.command('broadcast', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const message = ctx.message.text.replace('/broadcast', '').trim();
      if (!message) {
        return ctx.reply('❌ Uso: /broadcast [mensagem]');
      }
      
      // Buscar todos os usuários
      const { data: users, error } = await db.supabase
        .from('users')
        .select('telegram_id')
        .eq('is_blocked', false);
      
      if (error) throw error;
      
      let sent = 0;
      let failed = 0;
      
      await ctx.reply(`📤 Enviando para ${users.length} usuários...`);
      
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
          sent++;
          await new Promise(resolve => setTimeout(resolve, 50)); // Rate limit
        } catch (err) {
          failed++;
          console.error(`Erro ao enviar para ${user.telegram_id}:`, err.message);
        }
      }
      
      return ctx.reply(`✅ Broadcast concluído!\n\n✔️ Enviados: ${sent}\n❌ Falharam: ${failed}`);
    } catch (err) {
      console.error('Erro no broadcast:', err);
      return ctx.reply('❌ Erro ao enviar broadcast.');
    }
  });
  
  // ===== LISTAR USUÁRIOS =====
  bot.command('users', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const { data: users, error } = await db.supabase
        .from('users')
        .select('telegram_id, username, first_name, created_at, is_admin')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      let message = `👥 *ÚLTIMOS 20 USUÁRIOS:*\n\n`;
      
      for (const user of users) {
        message += `${user.is_admin ? '🔐 ' : ''}${user.first_name}`;
        if (user.username) message += ` @${user.username}`;
        message += `\nID: ${user.telegram_id}\n`;
        message += `Desde: ${new Date(user.created_at).toLocaleDateString('pt-BR')}\n\n`;
      }
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao listar users:', err);
      return ctx.reply('❌ Erro ao buscar usuários.');
    }
  });
  
  // ===== ALTERAR CHAVE PIX =====
  bot.command('setpix', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length === 0) {
        // Mostrar chave atual
        const currentKey = await db.getPixKey();
        return ctx.reply(`❌ *Uso incorreto!*

🔑 *Chave atual:* ${currentKey || 'Não configurada'}

*Formato:* /setpix [chave]

*Exemplos:*
• /setpix seu@email.com
• /setpix 11999887766
• /setpix 12345678900

*Tipos aceitos:*
Email, Telefone (com DDD, sem +55), CPF/CNPJ ou Chave aleatória`, { parse_mode: 'Markdown' });
      }
      
      const novaChave = args.join(' ').trim();
      
      // Validação básica
      if (novaChave.length < 5) {
        return ctx.reply('❌ Chave PIX muito curta. Verifique e tente novamente.');
      }
      
      // Salvar no banco de dados (PERMANENTE!)
      const user = await db.getOrCreateUser(ctx.from);
      await db.setPixKey(novaChave, user.id);
      
      // Também atualizar variável de ambiente em memória
      process.env.MY_PIX_KEY = novaChave;
      
      await ctx.reply(`✅ *Chave PIX atualizada com sucesso!*

🔑 Nova chave: ${novaChave}

✅ *Alteração PERMANENTE salva no banco de dados!*

Todos os novos pagamentos usarão esta chave automaticamente.`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro ao alterar PIX:', err.message);
      return ctx.reply('❌ Erro ao alterar chave PIX. Tente novamente.');
    }
  });
  
  // ===== LISTAR PRODUTOS =====
  bot.command('produtos', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const products = await db.getAllProducts(false); // APENAS ATIVOS
      
      if (products.length === 0) {
        return ctx.reply('📦 Nenhum produto cadastrado ainda.\n\nUse /novoproduto para criar um.');
      }
      
      let message = `🛍️ PRODUTOS CADASTRADOS:\n\n`;
      
      for (const product of products) {
        const status = product.is_active ? '✅' : '❌';
        message += `${status} ${product.name}\n`;
        message += `🆔 ID: ${product.product_id}\n`;
        message += `💰 Preço: R$ ${parseFloat(product.price).toFixed(2)}\n`;
        if (product.description) message += `📝 ${product.description}\n`;
        message += `📦 Entrega: ${product.delivery_type === 'file' ? '📄 Arquivo' : '🔗 Link'}\n`;
        if (product.delivery_url) {
          const urlPreview = product.delivery_url.length > 50 
            ? product.delivery_url.substring(0, 50) + '...' 
            : product.delivery_url;
          message += `🔗 ${urlPreview}\n`;
        } else {
          message += `🔗 Não configurada\n`;
        }
        message += `\n`;
      }
      
      message += `\nComandos:\n`;
      message += `• /novoproduto - Criar novo\n`;
      message += `• /editarproduto - Editar\n`;
      message += `• /deletarproduto - Remover`;
      
      return ctx.reply(message);
    } catch (err) {
      console.error('Erro ao listar produtos:', err);
      return ctx.reply('❌ Erro ao buscar produtos.');
    }
  });
  
  // ===== CRIAR NOVO PRODUTO (INTERATIVO) =====
  bot.command('novoproduto', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      // Iniciar sessão de criação
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'create_product',
        step: 'name',
        data: {}
      };
      
      return ctx.reply(`🎯 *CRIAR NOVO PRODUTO*

*Passo 1/4:* Digite o *nome* do produto:
Exemplo: Pack Premium, Curso Avançado, etc.

_Digite /cancelar para cancelar_`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro ao iniciar criação:', err);
      return ctx.reply('❌ Erro ao iniciar criação.');
    }
  });
  
  // ===== EDITAR PRODUTO =====
  bot.command('editarproduto', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const products = await db.getAllProducts(true);
      
      if (products.length === 0) {
        return ctx.reply('📦 Nenhum produto para editar.');
      }
      
      let message = `📝 EDITAR PRODUTO\n\nDigite o ID do produto que deseja editar:\n\n`;
      
      for (const product of products) {
        message += `• ${product.product_id} - ${product.name}\n`;
      }
      
      message += `\nExemplo: /edit_packA\nCancelar: /cancelar`;
      
      // Iniciar sessão
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_product_select',
        step: 'select_id'
      };
      
      return ctx.reply(message);
      
    } catch (err) {
      console.error('Erro ao editar:', err);
      return ctx.reply('❌ Erro ao editar produto.');
    }
  });
  
  // Handler para /edit_[productId]
  bot.hears(/^\/edit_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      const product = await db.getProduct(productId);
      
      if (!product) {
        return ctx.reply('❌ Produto não encontrado.');
      }
      
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_product',
        step: 'field',
        data: { productId, product }
      };
      
      return ctx.reply(`📝 EDITAR: ${product.name}

O que deseja editar?

1️⃣ /edit_name - Nome
2️⃣ /edit_price - Preço
3️⃣ /edit_description - Descrição
4️⃣ /edit_url - URL de entrega
5️⃣ /edit_status - Ativar/Desativar

Cancelar: /cancelar`);
      
    } catch (err) {
      console.error('Erro ao selecionar produto:', err);
    }
  });
  
  // ===== DELETAR PRODUTO =====
  bot.command('deletarproduto', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const products = await db.getAllProducts(true);
      
      if (products.length === 0) {
        return ctx.reply('📦 Nenhum produto para remover.');
      }
      
      let message = `🗑️ REMOVER PRODUTO\n\n⚠️ *ATENÇÃO:* Isso DELETARÁ PERMANENTEMENTE o produto do banco!\n\nDigite o ID do produto:\n\n`;
      
      for (const product of products) {
        if (product.is_active) {
          message += `• ${product.product_id} - ${product.name}\n`;
        }
      }
      
      message += `\nExemplo: /delete_packA\nCancelar: /cancelar`;
      
      return ctx.reply(message);
      
    } catch (err) {
      console.error('Erro ao deletar:', err);
      return ctx.reply('❌ Erro ao remover produto.');
    }
  });
  
  // Handler para /delete_[productId]
  bot.hears(/^\/delete_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      const product = await db.getProduct(productId);
      
      if (!product) {
        return ctx.reply('❌ Produto não encontrado.');
      }
      
      await db.deleteProduct(productId);
      
      return ctx.reply(`✅ *Produto deletado permanentemente!*

🛍️ ${product.name}
🆔 ID: ${productId}

O produto foi removido completamente do banco de dados.
Use /produtos para ver os restantes.`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro ao deletar produto:', err);
      return ctx.reply('❌ Erro ao remover produto.');
    }
  });
  
  // ===== CANCELAR OPERAÇÃO =====
  bot.command('cancelar', async (ctx) => {
    global._SESSIONS = global._SESSIONS || {};
    if (global._SESSIONS[ctx.from.id]) {
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Operação cancelada.');
    }
  });
  
  // ===== HANDLER DE MENSAGENS (PARA SESSÕES INTERATIVAS) =====
  bot.on('text', async (ctx) => {
    try {
      // Ignorar comandos (mensagens que começam com /)
      if (ctx.message.text.startsWith('/')) return;
      
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      
      if (!session) return; // Não há sessão ativa
      
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      // ===== CRIAR PRODUTO =====
      if (session.type === 'create_product') {
        if (session.step === 'name') {
          session.data.name = ctx.message.text.trim();
          session.step = 'price';
          return ctx.reply(`✅ Nome: *${session.data.name}*

*Passo 2/4:* Digite o *preço* (apenas números):
Exemplo: 30.00 ou 50

_Cancelar:_ /cancelar`, { parse_mode: 'Markdown' });
        }
        
        if (session.step === 'price') {
          const price = parseFloat(ctx.message.text.replace(',', '.'));
          if (isNaN(price) || price <= 0) {
            return ctx.reply('❌ Preço inválido. Digite apenas números (ex: 30.00)');
          }
          session.data.price = price;
          session.step = 'description';
          return ctx.reply(`✅ Preço: *R$ ${price.toFixed(2)}*

*Passo 3/4:* Digite uma *descrição* (ou envie "-" para pular):
Exemplo: Acesso completo ao conteúdo premium

_Cancelar:_ /cancelar`, { parse_mode: 'Markdown' });
        }
        
        if (session.step === 'description') {
          const desc = ctx.message.text.trim();
          session.data.description = desc === '-' ? null : desc;
          session.step = 'url';
          return ctx.reply(`✅ Descrição salva!

*Passo 4/4:* Envie a *URL de entrega* ou envie um *arquivo*:

📎 *Arquivo:* Envie um arquivo (ZIP, PDF, etc.)
🔗 *Link:* Digite a URL (Google Drive, Mega, etc.)
➖ *Pular:* Digite "-" para configurar depois

_Cancelar:_ /cancelar`, { parse_mode: 'Markdown' });
        }
        
        if (session.step === 'url') {
          const url = ctx.message.text.trim();
          session.data.deliveryUrl = url === '-' ? null : url;
          session.data.deliveryType = 'link';
          
          // Gerar ID do produto
          const productId = session.data.name
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]/g, '')
            .substring(0, 20);
          
          session.data.productId = productId;
          
          // Criar produto
          try {
            await db.createProduct({
              productId: session.data.productId,
              name: session.data.name,
              description: session.data.description,
              price: session.data.price,
              deliveryType: session.data.deliveryType,
              deliveryUrl: session.data.deliveryUrl
            });
            
            delete global._SESSIONS[ctx.from.id];
            
            return ctx.reply(`🎉 *PRODUTO CRIADO COM SUCESSO!*

🛍️ *Nome:* ${session.data.name}
🆔 *ID:* ${session.data.productId}
💰 *Preço:* R$ ${session.data.price.toFixed(2)}
📝 *Descrição:* ${session.data.description || 'Nenhuma'}
🔗 *URL:* ${session.data.deliveryUrl || 'Não configurada'}

O produto já está disponível no menu de compras!
Use /produtos para ver todos.`, { parse_mode: 'Markdown' });
            
          } catch (err) {
            delete global._SESSIONS[ctx.from.id];
            console.error('Erro ao criar produto:', err);
            return ctx.reply('❌ Erro ao criar produto. Tente novamente.');
          }
        }
      }
      
      // ===== EDITAR PRODUTO =====
      if (session.type === 'edit_product' && session.step === 'edit_value') {
        const { productId, field } = session.data;
        const value = ctx.message.text.trim();
        
        let updates = {};
        
        if (field === 'name') updates.name = value;
        else if (field === 'price') {
          const price = parseFloat(value.replace(',', '.'));
          if (isNaN(price) || price <= 0) {
            return ctx.reply('❌ Preço inválido.');
          }
          updates.price = price;
        }
        else if (field === 'description') updates.description = value === '-' ? null : value;
        else if (field === 'url') updates.delivery_url = value === '-' ? null : value;
        
        await db.updateProduct(productId, updates);
        delete global._SESSIONS[ctx.from.id];
        
        return ctx.reply(`✅ *Produto atualizado com sucesso!*

Use /produtos para ver as alterações.`, { parse_mode: 'Markdown' });
      }
      
    } catch (err) {
      console.error('Erro no handler de texto:', err);
    }
  });
  
  // ===== HANDLER DE ARQUIVOS (PARA UPLOAD) =====
  bot.on('document', async (ctx) => {
    try {
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      
      if (!session || session.type !== 'create_product' || session.step !== 'url') return;
      
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const fileId = ctx.message.document.file_id;
      const fileName = ctx.message.document.file_name;
      
      // Salvar file_id como URL de entrega
      session.data.deliveryUrl = `telegram_file:${fileId}`;
      session.data.deliveryType = 'file';
      session.data.fileName = fileName;
      
      // Gerar ID do produto
      const productId = session.data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
      
      session.data.productId = productId;
      
      // Criar produto
      await db.createProduct({
        productId: session.data.productId,
        name: session.data.name,
        description: session.data.description,
        price: session.data.price,
        deliveryType: session.data.deliveryType,
        deliveryUrl: session.data.deliveryUrl
      });
      
      delete global._SESSIONS[ctx.from.id];
      
      return ctx.reply(`🎉 *PRODUTO CRIADO COM SUCESSO!*

🛍️ *Nome:* ${session.data.name}
🆔 *ID:* ${session.data.productId}
💰 *Preço:* R$ ${session.data.price.toFixed(2)}
📝 *Descrição:* ${session.data.description || 'Nenhuma'}
📄 *Arquivo:* ${fileName}

O produto já está disponível no menu de compras!
Use /produtos para ver todos.`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro ao processar arquivo:', err);
      return ctx.reply('❌ Erro ao processar arquivo.');
    }
  });
  
  // Handlers para edição de campos
  bot.command('edit_name', async (ctx) => handleEditField(ctx, 'name', 'Digite o novo nome:'));
  bot.command('edit_price', async (ctx) => handleEditField(ctx, 'price', 'Digite o novo preço:'));
  bot.command('edit_description', async (ctx) => handleEditField(ctx, 'description', 'Digite a nova descrição:'));
  bot.command('edit_url', async (ctx) => handleEditField(ctx, 'url', 'Digite a nova URL ou envie um arquivo:'));
  bot.command('edit_status', async (ctx) => {
    try {
      const session = global._SESSIONS?.[ctx.from.id];
      if (!session || session.type !== 'edit_product') return;
      
      const { productId, product } = session.data;
      const newStatus = !product.is_active;
      
      await db.updateProduct(productId, { is_active: newStatus });
      delete global._SESSIONS[ctx.from.id];
      
      return ctx.reply(`✅ Produto ${newStatus ? 'ativado' : 'desativado'} com sucesso!`);
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  });
  
  async function handleEditField(ctx, field, prompt) {
    try {
      const session = global._SESSIONS?.[ctx.from.id];
      if (!session || session.type !== 'edit_product') return;
      
      session.step = 'edit_value';
      session.data.field = field;
      
      return ctx.reply(`${prompt}\n\n_Cancelar:_ /cancelar`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro:', err);
    }
  }

  // ===== HANDLERS DOS BOTÕES DO PAINEL ADMIN =====
  
  bot.action('admin_refresh', async (ctx) => {
    await ctx.answerCbQuery('🔄 Atualizando...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    const stats = await db.getStats();
    const message = `🔐 *PAINEL ADMINISTRATIVO*
━━━━━━━━━━━━━━━━━━━━━

📊 *Estatísticas em Tempo Real:*
👥 Usuários: *${stats.totalUsers}*
💳 Transações: *${stats.totalTransactions}*
⏳ Pendentes: *${stats.pendingTransactions}*
💰 Vendas: *R$ ${stats.totalSales}*

Selecione uma opção abaixo:`;

    const keyboard = Markup.inlineKeyboard([
      [
        Markup.button.callback('⏳ Pendentes (' + stats.pendingTransactions + ')', 'admin_pendentes'),
        Markup.button.callback('📊 Estatísticas', 'admin_stats')
      ],
      [
        Markup.button.callback('🛍️ Ver Produtos', 'admin_produtos'),
        Markup.button.callback('➕ Novo Produto', 'admin_novoproduto')
      ],
      [
        Markup.button.callback('🔑 Alterar PIX', 'admin_setpix'),
        Markup.button.callback('👥 Usuários', 'admin_users')
      ],
      [
        Markup.button.callback('📢 Broadcast', 'admin_broadcast')
      ],
      [
        Markup.button.callback('🔄 Atualizar', 'admin_refresh')
      ]
    ]);
    
    return ctx.editMessageText(message, {
      parse_mode: 'Markdown',
      ...keyboard
    });
  });

  bot.action('admin_pendentes', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply('Para ver pendentes, use: /pendentes');
  });

  bot.action('admin_stats', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply('Para ver estatísticas detalhadas, use: /stats');
  });

  bot.action('admin_produtos', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply('Para ver produtos, use: /produtos');
  });

  bot.action('admin_novoproduto', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply('Para criar produto, use: /novoproduto');
  });

  bot.action('admin_setpix', async (ctx) => {
    await ctx.answerCbQuery();
    const currentKey = await db.getPixKey();
    return ctx.reply(`🔑 *Chave PIX atual:* ${currentKey || 'Não configurada'}\n\nPara alterar, use: /setpix [nova_chave]`, {
      parse_mode: 'Markdown'
    });
  });

  bot.action('admin_users', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply('Para ver usuários, use: /users');
  });

  bot.action('admin_broadcast', async (ctx) => {
    await ctx.answerCbQuery();
    return ctx.reply('Para enviar broadcast, use: /broadcast [mensagem]');
  });
}

module.exports = { registerAdminCommands };

