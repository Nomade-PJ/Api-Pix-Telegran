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
        Markup.button.callback('👥 Gerenciar Grupos', 'admin_groups'),
        Markup.button.callback('🔑 Alterar PIX', 'admin_setpix')
      ],
      [
        Markup.button.callback('💬 Configurar Suporte', 'admin_support')
      ],
        [
          Markup.button.callback('👤 Usuários', 'admin_users'),
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
        // Verificar se é media pack ou produto
        if (transaction.media_pack_id) {
          // É um media pack - não tentar buscar produto
          return ctx.reply(`✅ Transação validada!\n\nMedia pack será entregue através do painel admin.\n\n🆔 TXID: ${txid}\n👤 Cliente: ${transaction.user?.first_name}\n💰 Valor: R$ ${transaction.amount}`);
        }
        
        // Buscar produto incluindo inativos (transação já paga, produto pode ter sido desativado depois)
        const product = await db.getProduct(transaction.product_id, true);
        
        if (!product) {
          console.error(`❌ [VALIDATE] Produto "${transaction.product_id}" não encontrado na transação ${txid}`);
          return ctx.reply(`❌ Produto não encontrado: ${transaction.product_id}\n\nO produto pode ter sido removido após a transação.`);
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
• /setpix +55 11 99988-7766
• /setpix 11999887766
• /setpix 12345678900
• /setpix 6f2a2e5d-5308-4588-ad31-ee81a67807d6

*Tipos aceitos:*
✅ Email
✅ Telefone (com ou sem formatação)
✅ CPF/CNPJ
✅ Chave aleatória (UUID)`, { parse_mode: 'Markdown' });
      }
      
      const novaChave = args.join(' ').trim();
      
      // Validação básica
      if (novaChave.length < 5) {
        return ctx.reply('❌ Chave PIX muito curta. Verifique e tente novamente.');
      }
      
      // Validar formato da chave usando a função sanitizePixKey
      // Importar a função temporariamente para validação
      try {
        // Testar se a chave é válida (sem salvar ainda)
        const { sanitizePixKey } = require('./pix/manual');
        const sanitizedKey = sanitizePixKey(novaChave);
        
        // Se chegou aqui, a chave é válida
        // Salvar no banco de dados (PERMANENTE!)
        const user = await db.getOrCreateUser(ctx.from);
        await db.setPixKey(novaChave, user.id);
        
        // Também atualizar variável de ambiente em memória
        process.env.MY_PIX_KEY = novaChave;
        
        // Mostrar tanto a chave original quanto a normalizada (se diferentes)
        let message = `✅ *Chave PIX atualizada com sucesso!*

🔑 *Chave configurada:* ${novaChave}`;
        
        if (sanitizedKey !== novaChave) {
          message += `\n🔧 *Será normalizada para:* ${sanitizedKey}`;
        }
        
        message += `\n\n✅ *Alteração PERMANENTE salva no banco de dados!*

Todos os novos pagamentos usarão esta chave automaticamente.`;
        
        await ctx.reply(message, { parse_mode: 'Markdown' });
        
      } catch (validationError) {
        // Chave inválida
        return ctx.reply(`❌ *Chave PIX inválida!*

📋 Erro: ${validationError.message}

*Formatos aceitos:*
✅ Email: exemplo@email.com
✅ Telefone: +55 11 99988-7766 ou 11999887766
✅ CPF: 123.456.789-00 ou 12345678900
✅ CNPJ: 12.345.678/0001-00 ou 12345678000100
✅ Chave aleatória: 6f2a2e5d-5308-4588-ad31-ee81a67807d6`, { parse_mode: 'Markdown' });
      }
      
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

_Digite /cancelar para cancelar_`, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
          ]]
        }
      });
      
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
  
  // IMPORTANTE: Registrar comandos de edição ANTES do bot.hears para ter prioridade
  // Esses comandos são para editar campos específicos (precisa de sessão ativa)
  bot.command('edit_name', async (ctx) => handleEditField(ctx, 'name', 'Digite o novo nome:'));
  bot.command('edit_price', async (ctx) => handleEditField(ctx, 'price', 'Digite o novo preço:'));
  bot.command('edit_description', async (ctx) => handleEditField(ctx, 'description', 'Digite a nova descrição:'));
  bot.command('edit_url', async (ctx) => {
    // Ignorar argumentos extras (ex: /edit_url packsdaval deve ser tratado apenas como /edit_url)
    console.log(`📝 [EDIT] Comando edit_url recebido para usuário ${ctx.from.id}`);
    return handleEditField(ctx, 'url', 'Digite a nova URL ou envie um arquivo:');
  });
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
  
  // Handler para /edit_[productId] - DEVE vir DEPOIS dos comandos edit_name, edit_url, etc
  // Regex ajustado para não capturar comandos específicos (edit_name, edit_url, edit_price, etc)
  bot.hears(/^\/edit_(?!name|price|description|url|status)(.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      // Buscar produto incluindo inativos (pode estar desativado temporariamente)
      const product = await db.getProduct(productId, true);
      
      if (!product) {
        console.error(`❌ [EDIT] Produto "${productId}" não encontrado (mesmo incluindo inativos)`);
        return ctx.reply(`❌ Produto não encontrado.\n\n🆔 ID: ${productId}\n\nVerifique se o ID está correto ou se o produto foi removido.`);
      }
      
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_product',
        step: 'field',
        data: { productId, product }
      };
      
      const statusText = product.is_active ? '🟢 Ativo' : '🔴 Inativo';
      
      return ctx.reply(`📝 EDITAR: ${product.name}
${statusText}

O que deseja editar?

1️⃣ /edit_name - Nome
2️⃣ /edit_price - Preço
3️⃣ /edit_description - Descrição
4️⃣ /edit_url - URL de entrega
5️⃣ /edit_status - Ativar/Desativar

Cancelar: /cancelar`);
      
    } catch (err) {
      console.error('❌ [EDIT] Erro ao selecionar produto:', err);
      return ctx.reply('❌ Erro ao selecionar produto. Tente novamente.');
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
      
      let message = `🗑️ *DELETAR PRODUTO*

⚠️ *ATENÇÃO - Esta ação é irreversível\\!*

• Produto será deletado permanentemente ❌
• Todas as transações associadas serão removidas 🗑️
• Histórico de vendas será perdido 📊

Digite o ID do produto:

`;
      
      for (const product of products) {
        if (product.is_active) {
          message += `• ${product.product_id} - ${product.name}\n`;
        }
      }
      
      message += `\nExemplo: /delete_packA\nCancelar: /cancelar`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
      
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
      // Buscar produto incluindo inativos (pode estar desativado)
      const product = await db.getProduct(productId, true);
      
      if (!product) {
        console.error(`❌ [DELETE] Produto "${productId}" não encontrado (mesmo incluindo inativos)`);
        return ctx.reply(`❌ Produto não encontrado.\n\n🆔 ID: ${productId}\n\nVerifique se o ID está correto ou se o produto já foi removido.`);
      }
      
      // Verificar se há transações associadas para informar o usuário
      const hasTransactions = await db.productHasTransactions(productId);
      
      // Deletar permanentemente (deletará transações em cascata)
      const deleted = await db.deleteProduct(productId);
      
      if (deleted) {
        let message = `✅ *Produto deletado permanentemente!*

🛍️ ${product.name}
🆔 ID: ${productId}

🗑️ O produto foi removido completamente do banco de dados.`;

        if (hasTransactions) {
          message += `\n\n⚠️ **Atenção:** As transações (vendas) associadas a este produto também foram removidas do histórico.`;
        }

        message += `\n\nUse /produtos para ver os restantes.`;
        
        return ctx.reply(message, { parse_mode: 'Markdown' });
      } else {
        return ctx.reply('❌ Erro ao remover produto. Tente novamente.');
      }
      
    } catch (err) {
      console.error('Erro ao deletar produto:', err);
      return ctx.reply('❌ Erro ao remover produto. Verifique os logs e tente novamente.');
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
Exemplo: 30.00 ou 50`, { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⬅️ Voltar', callback_data: 'product_back_name' },
                  { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
                ]
              ]
            }
          });
        }
        
        if (session.step === 'price') {
          const price = parseFloat(ctx.message.text.replace(',', '.'));
          if (isNaN(price) || price <= 0) {
            return ctx.reply('❌ Preço inválido. Digite apenas números (ex: 30.00)', {
              reply_markup: {
                inline_keyboard: [[
                  { text: '⬅️ Voltar', callback_data: 'product_back_name' },
                  { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
                ]]
              }
            });
          }
          session.data.price = price;
          session.step = 'description';
          return ctx.reply(`✅ Preço: *R$ ${price.toFixed(2)}*

*Passo 3/4:* Digite uma *descrição*:
Exemplo: Acesso completo ao conteúdo premium`, { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⏭️ Pular', callback_data: 'product_skip_description' }
                ],
                [
                  { text: '⬅️ Voltar', callback_data: 'product_back_price' },
                  { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
                ]
              ]
            }
          });
        }
        
        if (session.step === 'description') {
          const desc = ctx.message.text.trim();
          session.data.description = desc;
          session.step = 'url';
          return ctx.reply(`✅ Descrição salva!

*Passo 4/4:* Envie a *URL de entrega* ou envie um *arquivo*:

📎 *Arquivo:* Envie um arquivo (ZIP, PDF, etc.)
🔗 *Link:* Digite a URL (Google Drive, Mega, etc.)`, { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⏭️ Pular', callback_data: 'product_skip_url' }
                ],
                [
                  { text: '⬅️ Voltar', callback_data: 'product_back_description' },
                  { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
                ]
              ]
            }
          });
        }
        
        if (session.step === 'url') {
          const url = ctx.message.text.trim();
          session.data.deliveryUrl = url;
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
              description: session.data.description || null,
              price: session.data.price,
              deliveryType: session.data.deliveryType,
              deliveryUrl: session.data.deliveryUrl || null
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

      // ===== CRIAR GRUPO =====
      if (session.type === 'create_group') {
        if (session.step === 'group_id') {
          const groupId = parseInt(ctx.message.text.trim());
          if (isNaN(groupId)) {
            return ctx.reply('❌ ID inválido. Digite apenas números (ex: -1001234567890)', {
              reply_markup: {
                inline_keyboard: [[
                  { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
                ]]
              }
            });
          }
          session.data.groupId = groupId;
          session.step = 'group_name';
          return ctx.reply(`✅ ID: *${groupId}*

*Passo 2/5:* Digite o *nome do grupo*:

Exemplo: Grupo Premium VIP`, { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⬅️ Voltar', callback_data: 'group_back_id' },
                  { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
                ]
              ]
            }
          });
        }
        
        if (session.step === 'group_name') {
          session.data.groupName = ctx.message.text.trim();
          session.step = 'group_link';
          return ctx.reply(`✅ Nome: *${session.data.groupName}*

*Passo 3/5:* Envie o *link do grupo*:

Exemplo: https://t.me/seugrupo`, { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⬅️ Voltar', callback_data: 'group_back_name' },
                  { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
                ]
              ]
            }
          });
        }
        
        if (session.step === 'group_link') {
          const link = ctx.message.text.trim();
          if (!link.startsWith('http')) {
            return ctx.reply('❌ Link inválido. Deve começar com http:// ou https://', {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '⬅️ Voltar', callback_data: 'group_back_name' },
                    { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
                  ]
                ]
              }
            });
          }
          session.data.groupLink = link;
          session.step = 'price';
          return ctx.reply(`✅ Link: *${link}*

*Passo 4/5:* Digite o *preço da assinatura* (mensal):

Exemplo: 30.00 ou 50`, { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⬅️ Voltar', callback_data: 'group_back_link' },
                  { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
                ]
              ]
            }
          });
        }
        
        if (session.step === 'price') {
          const price = parseFloat(ctx.message.text.replace(',', '.'));
          if (isNaN(price) || price <= 0) {
            return ctx.reply('❌ Preço inválido. Digite apenas números (ex: 30.00)', {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '⬅️ Voltar', callback_data: 'group_back_link' },
                    { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
                  ]
                ]
              }
            });
          }
          session.data.price = price;
          session.step = 'days';
          return ctx.reply(`✅ Preço: *R$ ${price.toFixed(2)}/mês*

*Passo 5/5:* Digite a *duração da assinatura* (em dias):

Exemplo: 30 (para 30 dias)`, { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '⬅️ Voltar', callback_data: 'group_back_price' },
                  { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
                ]
              ]
            }
          });
        }
        
        if (session.step === 'days') {
          const days = parseInt(ctx.message.text.trim());
          if (isNaN(days) || days <= 0) {
            return ctx.reply('❌ Número de dias inválido. Digite apenas números (ex: 30)', {
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '⬅️ Voltar', callback_data: 'group_back_price' },
                    { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
                  ]
                ]
              }
            });
          }
          session.data.days = days;
          
          // Criar grupo
          try {
            await db.createGroup({
              groupId: session.data.groupId,
              groupName: session.data.groupName,
              groupLink: session.data.groupLink,
              price: session.data.price,
              days: session.data.days
            });
            
            delete global._SESSIONS[ctx.from.id];
            
            return ctx.reply(`🎉 *GRUPO CADASTRADO COM SUCESSO!*

👥 *Nome:* ${session.data.groupName}
🆔 *ID:* ${session.data.groupId}
🔗 *Link:* ${session.data.groupLink}
💰 *Preço:* R$ ${session.data.price.toFixed(2)}/mês
📅 *Duração:* ${session.data.days} dias

✅ O grupo está pronto para receber assinaturas!

⚠️ *IMPORTANTE:*
1. Adicione o bot ao grupo como administrador
2. Dê permissão para banir/remover membros
3. O bot controlará automaticamente as assinaturas

Use /admin → Gerenciar Grupos para ver todos.`, { parse_mode: 'Markdown' });
            
          } catch (err) {
            delete global._SESSIONS[ctx.from.id];
            console.error('Erro ao criar grupo:', err);
            return ctx.reply(`❌ Erro ao criar grupo: ${err.message}`);
          }
        }
      }
      
    } catch (err) {
      console.error('Erro no handler de texto:', err);
    }
  });
  
  // ===== HANDLER DE ARQUIVOS (PARA UPLOAD) =====
  bot.on('document', async (ctx) => {
    try {
      console.log('📄 [DOCUMENT-ADMIN] Arquivo recebido:', ctx.message.document?.file_name);
      
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      
      console.log('📄 [DOCUMENT-ADMIN] Sessão:', session ? `tipo=${session.type}, step=${session.step}` : 'não existe');
      
      // 🆕 VERIFICAR SE É COMPROVANTE (PDF de transação) ANTES DE PROCESSAR
      // Se não há sessão de criação de produto, deixar passar para handler de comprovantes
      if (!session || session.type !== 'create_product' || session.step !== 'url') {
        console.log('📄 [DOCUMENT-ADMIN] Arquivo ignorado - não é criação de produto, deixando passar para handler de comprovantes');
        // NÃO retornar aqui - deixar o handler de comprovantes processar
        // Mas precisamos verificar se é admin primeiro
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) {
          console.log('📄 [DOCUMENT-ADMIN] Usuário não é admin - deixando passar para handler de comprovantes');
          return; // Não é admin, deixar passar
        }
        
        // Se é admin mas não está criando produto, pode ser comprovante
        // Verificar se há transação pendente
        const transaction = await db.getLastPendingTransaction(ctx.chat.id);
        if (transaction) {
          console.log('📄 [DOCUMENT-ADMIN] Transação pendente encontrada - deixando passar para handler de comprovantes');
          return; // Deixar handler de comprovantes processar
        }
        
        // Se não há transação, não é comprovante nem criação de produto
        console.log('📄 [DOCUMENT-ADMIN] Nenhuma transação pendente - ignorando');
        return;
      }
      
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        console.log('📄 [DOCUMENT] Arquivo ignorado - usuário não é admin');
        return;
      }
      
      console.log('📄 [DOCUMENT] Processando arquivo...');
      
      const fileId = ctx.message.document.file_id;
      const fileName = ctx.message.document.file_name;
      
      // Salvar file_id como URL de entrega
      session.data.deliveryUrl = `telegram_file:${fileId}`;
      session.data.deliveryType = 'file';
      session.data.fileName = fileName;
      
      // Gerar ID do produto
      console.log('📄 [DOCUMENT] Gerando ID do produto...');
      const productId = session.data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 20);
      
      session.data.productId = productId;
      
      console.log('📄 [DOCUMENT] Criando produto:', session.data);
      
      // Criar produto
      await db.createProduct({
        productId: session.data.productId,
        name: session.data.name,
        description: session.data.description,
        price: session.data.price,
        deliveryType: session.data.deliveryType,
        deliveryUrl: session.data.deliveryUrl
      });
      
      console.log('✅ [DOCUMENT] Produto criado com sucesso!');
      
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
  
  // Handlers para edição de campos (REMOVIDO - já foram registrados acima antes do bot.hears)
  
  async function handleEditField(ctx, field, prompt) {
    try {
      const session = global._SESSIONS?.[ctx.from.id];
      
      // Verificar se há sessão válida
      if (!session || session.type !== 'edit_product') {
        console.log(`⚠️ [EDIT] Sessão não encontrada para usuário ${ctx.from.id}. Tipo: ${session?.type || 'nenhuma'}`);
        return ctx.reply('❌ Sessão de edição não encontrada.\n\nUse /editarproduto para iniciar uma nova edição.');
      }
      
      // Verificar se o produto ainda existe
      const { productId, product } = session.data || {};
      if (!productId || !product) {
        console.log(`⚠️ [EDIT] Produto não encontrado na sessão para usuário ${ctx.from.id}`);
        // Tentar buscar o produto novamente
        if (productId) {
          const productExists = await db.getProduct(productId, true);
          if (!productExists) {
            delete global._SESSIONS[ctx.from.id];
            return ctx.reply(`❌ Produto não encontrado.\n\n🆔 ID: ${productId}\n\nO produto pode ter sido removido. Use /editarproduto para selecionar outro produto.`);
          }
          // Atualizar sessão com produto encontrado
          session.data.product = productExists;
        } else {
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Sessão inválida. Use /editarproduto para iniciar uma nova edição.');
        }
      }
      
      session.step = 'edit_value';
      session.data.field = field;
      
      console.log(`✅ [EDIT] Iniciando edição do campo "${field}" para produto "${productId}"`);
      
      return ctx.reply(`${prompt}\n\n_Cancelar:_ /cancelar`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('❌ [EDIT] Erro em handleEditField:', err);
      return ctx.reply('❌ Erro ao iniciar edição. Tente novamente.');
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

  // ===== ACTIONS DO PAINEL ADMIN =====
  
  bot.action('admin_pendentes', async (ctx) => {
    await ctx.answerCbQuery('⏳ Carregando pendentes...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
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

  bot.action('admin_stats', async (ctx) => {
    await ctx.answerCbQuery('📊 Carregando estatísticas...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const stats = await db.getStats();
      
      const message = `📊 *ESTATÍSTICAS COMPLETAS*
━━━━━━━━━━━━━━━━━━━━━

👥 *Usuários:* ${stats.totalUsers}
💳 *Transações:* ${stats.totalTransactions}
⏳ *Pendentes:* ${stats.pendingTransactions}
✅ *Validadas:* ${stats.validatedTransactions || 0}
📦 *Entregues:* ${stats.deliveredTransactions || 0}

💰 *Total em vendas:* R$ ${stats.totalSales}
💵 *Ticket médio:* R$ ${stats.avgTicket || '0.00'}

📅 *Atualizado:* ${new Date().toLocaleString('pt-BR')}`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
      return ctx.reply('❌ Erro ao buscar estatísticas.');
    }
  });

  bot.action('admin_produtos', async (ctx) => {
    await ctx.answerCbQuery('🛍️ Carregando produtos...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const products = await db.getAllProducts(true);
      
      if (products.length === 0) {
        return ctx.reply('📦 Nenhum produto cadastrado.\n\nUse /novoproduto para criar o primeiro produto.');
      }
      
      let message = `🛍️ *PRODUTOS CADASTRADOS:*\n\n`;
      
      for (const product of products) {
        const status = product.is_active ? '✅' : '❌';
        message += `${status} *${product.name}*\n`;
        message += `🆔 ID: ${product.product_id}\n`;
        message += `💰 Preço: R$ ${parseFloat(product.price).toFixed(2)}\n`;
        message += `📝 Descrição: ${product.description || 'Não tem'}\n`;
        message += `📦 Entrega: ${product.delivery_type === 'link' ? '🔗 Link' : '📄 Arquivo'}\n`;
        message += `🔗 ${product.delivery_url || 'Não configurada'}\n`;
        message += `——————————\n\n`;
      }
      
      message += `\n*Comandos disponíveis:*\n`;
      message += `➕ /novoproduto - Criar novo\n`;
      message += `✏️ /editarproduto - Editar\n`;
      message += `🗑️ /deletarproduto - Remover`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao listar produtos:', err);
      return ctx.reply('❌ Erro ao buscar produtos.');
    }
  });

  bot.action('admin_novoproduto', async (ctx) => {
    await ctx.answerCbQuery('➕ Iniciando criação...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    return ctx.reply(`➕ *CRIAR NOVO PRODUTO*

Vamos criar um novo produto passo a passo.

*Passo 1:* Digite o *NOME* do produto:

Exemplo: Pack Premium VIP

Cancelar: /cancelar`, { parse_mode: 'Markdown' });
  });

  bot.action('admin_setpix', async (ctx) => {
    await ctx.answerCbQuery();
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    const currentKey = await db.getPixKey();
    
    const message = `🔑 *ALTERAR CHAVE PIX*

🔑 *Chave atual:* ${currentKey || 'Não configurada'}

*Como alterar:*
Digite /setpix seguido da nova chave

*Exemplos:*
• /setpix seu@email.com
• /setpix +55 11 99988-7766
• /setpix 11999887766
• /setpix 12345678900
• /setpix 6f2a2e5d-5308-4588-ad31-ee81a67807d6

*Tipos aceitos:*
✅ Email
✅ Telefone (com ou sem formatação)
✅ CPF/CNPJ
✅ Chave aleatória (UUID)`;
    
    return ctx.reply(message, { parse_mode: 'Markdown' });
  });

  bot.action('admin_users', async (ctx) => {
    await ctx.answerCbQuery('👥 Carregando usuários e transações...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const [users, pending] = await Promise.all([
        db.getRecentUsers(10),
        db.getPendingTransactions(10)
      ]);
      
      let message = `👥 *GERENCIAR USUÁRIOS E TRANSAÇÕES*\n\n`;
      
      // Seção de transações pendentes
      if (pending && pending.length > 0) {
        message += `⏳ *TRANSAÇÕES PENDENTES: ${pending.length}*\n\n`;
        
        for (const tx of pending) {
          const user = tx.user || {};
          message += `🆔 TXID: ${tx.txid}\n`;
          message += `👤 ${user.first_name || 'N/A'} (@${user.username || 'N/A'})\n`;
          message += `📦 ${tx.product?.name || tx.product_id}\n`;
          message += `💵 R$ ${tx.amount}\n`;
          message += `📅 ${tx.proof_received_at ? new Date(tx.proof_received_at).toLocaleString('pt-BR') : 'Aguardando'}\n`;
          message += `\n`;
        }
        
        message += `\n*Use os botões abaixo para aprovar/rejeitar:*\n\n`;
      } else {
        message += `✅ Nenhuma transação pendente no momento.\n\n`;
      }
      
      // Seção de usuários
      message += `👥 *ÚLTIMOS USUÁRIOS: ${users.length}*\n\n`;
      
      if (users && users.length > 0) {
        for (const user of users) {
          message += `👤 ${user.first_name || 'Sem nome'}\n`;
          message += `🆔 @${user.username || 'Sem username'}\n`;
          message += `🔢 ID: ${user.telegram_id}\n`;
          message += `📅 ${new Date(user.created_at).toLocaleDateString('pt-BR')}\n`;
          message += `——————————\n\n`;
        }
      } else {
        message += `📦 Nenhum usuário cadastrado ainda.\n\n`;
      }
      
      // Criar botões para transações pendentes
      const buttons = [];
      if (pending && pending.length > 0) {
        for (const tx of pending.slice(0, 5)) { // Máximo 5 botões
          buttons.push([
            Markup.button.callback(
              `✅ Aprovar ${tx.txid.substring(0, 8)}`,
              `approve_${tx.txid}`
            ),
            Markup.button.callback(
              `❌ Rejeitar ${tx.txid.substring(0, 8)}`,
              `reject_${tx.txid}`
            )
          ]);
        }
      }
      
      buttons.push([Markup.button.callback('🔄 Atualizar', 'admin_users')]);
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
      return ctx.reply('❌ Erro ao buscar usuários.');
    }
  });

  bot.action('admin_broadcast', async (ctx) => {
    await ctx.answerCbQuery('📢 Modo broadcast...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    return ctx.reply(`📢 *ENVIAR MENSAGEM EM MASSA*

Para enviar uma mensagem para todos os usuários, use:

/broadcast [sua mensagem]

*Exemplo:*
/broadcast 🎉 Novidade! Novo produto disponível com 50% de desconto!

⚠️ *Atenção:* A mensagem será enviada para TODOS os usuários cadastrados no bot.`, { parse_mode: 'Markdown' });
  });

  // ===== CONFIGURAR SUPORTE =====
  bot.action('admin_support', async (ctx) => {
    await ctx.answerCbQuery('💬 Configurando suporte...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    const currentSupport = await db.getSetting('support_link');
    
    return ctx.reply(`💬 *CONFIGURAR SUPORTE*

🔗 *Link atual:* ${currentSupport || 'Não configurado'}

*Para configurar o suporte, use:*
/setsuporte [link do Telegram]

*Exemplos:*
• /setsuporte https://t.me/seususuario
• /setsuporte https://t.me/seugruposuporte

*Nota:* O link será exibido como botão no menu principal do bot, abaixo dos produtos.`, { parse_mode: 'Markdown' });
  });

  bot.command('setsuporte', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length === 0) {
        const currentSupport = await db.getSetting('support_link');
        return ctx.reply(`❌ *Uso incorreto!*

🔗 *Link atual:* ${currentSupport || 'Não configurado'}

*Formato:* /setsuporte [link]

*Exemplos:*
• /setsuporte https://t.me/seususuario
• /setsuporte https://t.me/seugruposuporte

*Para remover o suporte:*
/setsuporte remover`, { parse_mode: 'Markdown' });
      }
      
      const link = args.join(' ').trim();
      
      // Remover suporte
      if (link.toLowerCase() === 'remover') {
        await db.setSetting('support_link', null, ctx.from.id);
        return ctx.reply(`✅ *Link de suporte removido com sucesso!*

O botão de suporte não será mais exibido no menu principal.`, { parse_mode: 'Markdown' });
      }
      
      // Validação básica de link do Telegram
      if (!link.startsWith('http://') && !link.startsWith('https://')) {
        return ctx.reply('❌ Link inválido! Deve começar com http:// ou https://');
      }
      
      if (!link.includes('t.me/') && !link.includes('telegram.me/')) {
        return ctx.reply('❌ O link deve ser do Telegram (contendo t.me/ ou telegram.me/)');
      }
      
      // Salvar no banco
      await db.setSetting('support_link', link, ctx.from.id);
      
      return ctx.reply(`✅ *Link de suporte configurado com sucesso!*

🔗 *Link:* ${link}

O botão de suporte agora aparecerá no menu principal do bot, abaixo dos produtos!

*Para testar:* Use /start e veja o botão "💬 Suporte"`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      console.error('Erro ao configurar suporte:', err.message);
      return ctx.reply('❌ Erro ao configurar suporte. Tente novamente.');
    }
  });

  // ===== GERENCIAR GRUPOS =====
  bot.action('admin_groups', async (ctx) => {
    await ctx.answerCbQuery('👥 Carregando grupos...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const groups = await db.getAllGroups();
      
      let message = `👥 *GERENCIAR GRUPOS*

*Grupos cadastrados:* ${groups.length}

`;

      if (groups.length === 0) {
        message += `📦 Nenhum grupo cadastrado ainda.

*Para cadastrar:*
➕ /novogrupo - Cadastrar novo grupo`;
      } else {
        for (const group of groups) {
          const status = group.is_active ? '✅' : '❌';
          message += `${status} *${group.group_name || 'Sem nome'}*
🆔 ID: ${group.group_id}
💰 Preço: R$ ${group.subscription_price}/mês
📅 Dias: ${group.subscription_days}
🔗 ${group.group_link}
──────────────

`;
        }
        
        message += `*Comandos:*
➕ /novogrupo - Cadastrar grupo
✏️ /editargrupo - Editar grupo
🗑️ /deletargrupo - Remover grupo`;
      }
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao listar grupos:', err);
      return ctx.reply('❌ Erro ao buscar grupos.');
    }
  });

  bot.command('novogrupo', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'create_group',
      step: 'group_id',
      data: {}
    };
    
    return ctx.reply(`➕ *CADASTRAR NOVO GRUPO*

*Passo 1/5:* Envie o *ID do grupo*

📝 *Como obter o ID:*
1. Adicione o bot @userinfobot ao grupo
2. Copie o ID que aparece (ex: -1001234567890)
3. Cole aqui`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
        ]]
      }
    });
  });

  bot.command('editargrupo', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    const groups = await db.getAllGroups();
    
    if (groups.length === 0) {
      return ctx.reply('📦 Nenhum grupo cadastrado.\n\nUse /novogrupo para criar o primeiro.');
    }
    
    let message = `✏️ *EDITAR GRUPO*

Digite o ID do grupo que deseja editar:

`;
    
    for (const group of groups) {
      message += `• ${group.group_id} - ${group.group_name || 'Sem nome'}\n`;
    }
    
    message += `\nExemplo: /edit_${groups[0].group_id}\nCancelar: /cancelar`;
    
    return ctx.reply(message, { parse_mode: 'Markdown' });
  });

  bot.command('deletargrupo', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    const groups = await db.getAllGroups();
    
    if (groups.length === 0) {
      return ctx.reply('📦 Nenhum grupo para remover.');
    }
    
    let message = `🗑️ *DELETAR GRUPO*

⚠️ *ATENÇÃO:* Ação irreversível\\!
• Grupo será deletado permanentemente
• Todas as assinaturas serão removidas

Digite o ID do grupo:

`;
    
    for (const group of groups) {
      message += `• ${group.group_id} - ${group.group_name || 'Sem nome'}\n`;
    }
    
    message += `\nExemplo: /delete_group_${groups[0].group_id}\nCancelar: /cancelar`;
    
    return ctx.reply(message, { parse_mode: 'Markdown' });
  });

  // Handler para /edit_[groupId]
  bot.hears(/^\/edit_(-?\d+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const groupId = parseInt(ctx.match[1]);
      const group = await db.getGroupById(groupId);
      
      if (!group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }
      
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_group',
        step: 'field',
        data: { groupId }
      };
      
      return ctx.reply(`✏️ *EDITAR GRUPO*

*Grupo:* ${group.group_name || 'Sem nome'}
🆔 ID: ${group.group_id}

*O que deseja editar?*

1️⃣ /edit_group_name - Nome
2️⃣ /edit_group_link - Link
3️⃣ /edit_group_price - Preço
4️⃣ /edit_group_days - Dias de assinatura
5️⃣ /edit_group_status - Ativar/Desativar

_Cancelar:_ /cancelar`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao editar grupo:', err);
      return ctx.reply('❌ Erro ao editar grupo.');
    }
  });

  // Handler para /delete_group_[groupId]
  bot.hears(/^\/delete_group_(-?\d+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const groupId = parseInt(ctx.match[1]);
      const group = await db.getGroupById(groupId);
      
      if (!group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }
      
      const deleted = await db.deleteGroup(groupId);
      
      if (deleted) {
        return ctx.reply(`✅ *Grupo deletado permanentemente!*

👥 ${group.group_name || 'Sem nome'}
🆔 ID: ${groupId}

O grupo foi removido completamente do banco de dados.`, { parse_mode: 'Markdown' });
      } else {
        return ctx.reply('❌ Erro ao remover grupo.');
      }
    } catch (err) {
      console.error('Erro ao deletar grupo:', err);
      return ctx.reply('❌ Erro ao remover grupo.');
    }
  });

  // ===== APROVAR/REJEITAR TRANSAÇÕES VIA BOTÕES =====
  
  bot.action(/^approve_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('✅ Aprovando...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      if (transaction.status !== 'proof_sent') {
        return ctx.reply(`⚠️ Esta transação já foi processada.\n\nStatus: ${transaction.status}`);
      }
      
      // Validar transação
      await db.validateTransaction(txid, transaction.user_id);
      
      // Verificar se é media pack (fotos/vídeos aleatórios)
      if (transaction.media_pack_id) {
        const packId = transaction.media_pack_id;
        
        try {
          // Buscar o internal ID da transação
          const { data: transData, error: transError } = await db.supabase
            .from('transactions')
            .select('id')
            .eq('txid', txid)
            .single();
          
          if (transError) throw transError;
          
          // Entregar media pack (fotos/vídeos aleatórios)
          await deliver.deliverMediaPack(
            transaction.telegram_id,
            packId,
            transaction.user_id,
            transData.id,
            db
          );
          
          // Marcar como entregue após entrega bem-sucedida
          await db.markAsDelivered(txid);
          
          console.log(`✅ Media pack ${packId} entregue com sucesso e marcado como entregue`);
        } catch (err) {
          console.error('Erro ao entregar media pack:', err);
          
          // Notificar usuário sobre erro
          try {
            await ctx.telegram.sendMessage(transaction.telegram_id, `⚠️ *PAGAMENTO APROVADO!*

Seu pagamento foi confirmado, mas ocorreu um erro ao enviar as mídias.

Entre em contato com o suporte.

🆔 TXID: ${txid}`, {
              parse_mode: 'Markdown'
            });
          } catch (notifyErr) {
            console.error('Erro ao notificar usuário:', notifyErr);
          }
        }
      }
      // Verificar se é assinatura de grupo
      else if (transaction.product_id && transaction.product_id.startsWith('group_')) {
        const groupTelegramId = parseInt(transaction.product_id.replace('group_', ''));
        const group = await db.getGroupById(groupTelegramId);
        
        if (group) {
          // Adicionar membro ao grupo
          await db.addGroupMember({
            telegramId: transaction.telegram_id,
            userId: transaction.user_id,
            groupId: group.id,
            days: group.subscription_days
          });
          
          // Notificar usuário
          try {
            await ctx.telegram.sendMessage(transaction.telegram_id, `✅ *ASSINATURA APROVADA!*

👥 *Grupo:* ${group.group_name}
📅 *Acesso válido por:* ${group.subscription_days} dias
🔗 *Link:* ${group.group_link}

✅ Você foi adicionado ao grupo!

🆔 TXID: ${txid}`, {
              parse_mode: 'Markdown'
            });
          } catch (err) {
            console.error('Erro ao notificar usuário:', err);
          }
        }
      } else if (transaction.product_id) {
        // Entregar produto normal - buscar incluindo inativos (transação antiga pode ter produto desativado)
        const product = await db.getProduct(transaction.product_id, true);
        if (product && product.delivery_url) {
          await deliver.deliverByLink(transaction.telegram_id, product.delivery_url, `✅ *Produto aprovado e entregue!*\n\n${product.delivery_url}`);
        }
        
        // Notificar usuário
        try {
          await ctx.telegram.sendMessage(transaction.telegram_id, `✅ *PAGAMENTO APROVADO!*

💰 Valor: R$ ${transaction.amount}
✅ Produto entregue com sucesso!

🆔 TXID: ${txid}`, {
            parse_mode: 'Markdown'
          });
        } catch (err) {
          console.error('Erro ao notificar usuário:', err);
        }
      }
      
      await db.markAsDelivered(txid);
      
      // Atualizar mensagem do botão
      await ctx.editMessageReplyMarkup({
        inline_keyboard: [
          [{ text: '✅ Aprovado', callback_data: 'approved' }]
        ]
      });
      
      return ctx.reply(`✅ *Transação aprovada com sucesso!*

🆔 TXID: ${txid}
👤 Usuário notificado
📦 Produto/Grupo entregue`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao aprovar transação:', err);
      return ctx.reply('❌ Erro ao aprovar transação.');
    }
  });

  bot.action(/^reject_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('❌ Rejeitando...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      if (transaction.status !== 'proof_sent') {
        return ctx.reply(`⚠️ Esta transação já foi processada.\n\nStatus: ${transaction.status}`);
      }
      
      // Cancelar transação
      await db.cancelTransaction(txid);
      
      // Notificar usuário
      try {
        await ctx.telegram.sendMessage(transaction.telegram_id, `❌ *COMPROVANTE REJEITADO*

Seu comprovante foi analisado e não foi aprovado.

🔄 *O que fazer:*
1. Verifique se pagou o valor correto (R$ ${transaction.amount})
2. Verifique se pagou para a chave correta
3. Tente enviar outro comprovante
4. Ou faça uma nova compra: /start

🆔 TXID: ${txid}`, {
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Erro ao notificar usuário:', err);
      }
      
      // Atualizar mensagem do botão
      await ctx.editMessageReplyMarkup({
        inline_keyboard: [
          [{ text: '❌ Rejeitado', callback_data: 'rejected' }]
        ]
      });
      
      return ctx.reply(`❌ *Transação rejeitada!*

🆔 TXID: ${txid}
👤 Usuário notificado`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao rejeitar transação:', err);
      return ctx.reply('❌ Erro ao rejeitar transação.');
    }
  });

  bot.action(/^details_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery('📋 Carregando detalhes...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      // 🔧 Buscar usuário por UUID, não por telegram_id
      const user = transaction.user_id ? await db.getUserByUUID(transaction.user_id) : null;
      
      // Buscar produto OU media pack
      let productName = 'N/A';
      try {
        if (transaction.media_pack_id) {
          // É um media pack
        const pack = await db.getMediaPackById(transaction.media_pack_id);
          productName = pack ? pack.name : transaction.media_pack_id || 'Media Pack';
        } else if (transaction.product_id) {
          // É um produto normal - buscar incluindo inativos (transação antiga pode ter produto desativado)
          const product = await db.getProduct(transaction.product_id, true);
          productName = product ? product.name : transaction.product_id || 'Produto';
        }
      } catch (err) {
        console.error('Erro ao buscar produto/pack:', err);
        productName = transaction.media_pack_id || transaction.product_id || 'N/A';
      }
      
      // Garantir que productName nunca seja null ou undefined
      if (!productName || productName === 'null' || productName === 'undefined') {
        productName = transaction.media_pack_id || transaction.product_id || 'N/A';
      }
      
      // Construir mensagem - usar Markdown simples para evitar problemas de escape
      let message = `📋 *DETALHES DA TRANSAÇÃO*\n\n`;
      message += `🆔 TXID: \`${txid}\`\n`;
      message += `💰 Valor: R$ ${transaction.amount}\n`;
      message += `📦 Produto: ${productName}\n`;
      message += `👤 Usuário: ${user ? user.first_name : 'N/A'} (@${user?.username || 'N/A'})\n`;
      message += `🔑 Chave PIX: \`${transaction.pix_key}\`\n`;
      message += `📊 Status: ${transaction.status}\n`;
      message += `📅 Criada: ${new Date(transaction.created_at).toLocaleString('pt-BR')}\n`;
      
      if (transaction.proof_received_at) {
        message += `📸 Comprovante: ${new Date(transaction.proof_received_at).toLocaleString('pt-BR')}\n`;
      }
      
      message += `\n*Ações:*\n`;
      message += `✅ /validar${txid} - Aprovar\n`;
      message += `❌ /rejeitar${txid} - Rejeitar`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
      return ctx.reply('❌ Erro ao buscar detalhes.');
    }
  });

  // ===== HANDLERS DE NAVEGAÇÃO PARA CRIAR PRODUTO =====
  
  bot.action('cancel_create_product', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    global._SESSIONS = global._SESSIONS || {};
    if (global._SESSIONS[ctx.from.id]) {
      delete global._SESSIONS[ctx.from.id];
    }
    return ctx.reply('❌ Operação cancelada.');
  });

  bot.action('product_back_name', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_product') return;
    
    session.step = 'name';
    return ctx.reply(`🎯 *CRIAR NOVO PRODUTO*

*Passo 1/4:* Digite o *nome* do produto:
Exemplo: Pack Premium, Curso Avançado, etc.`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
        ]]
      }
    });
  });

  bot.action('product_back_price', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_product') return;
    
    session.step = 'price';
    return ctx.reply(`✅ Nome: *${session.data.name}*

*Passo 2/4:* Digite o *preço* (apenas números):
Exemplo: 30.00 ou 50`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Voltar', callback_data: 'product_back_name' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
          ]
        ]
      }
    });
  });

  bot.action('product_back_description', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_product') return;
    
    session.step = 'description';
    return ctx.reply(`✅ Preço: *R$ ${session.data.price.toFixed(2)}*

*Passo 3/4:* Digite uma *descrição*:
Exemplo: Acesso completo ao conteúdo premium`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏭️ Pular', callback_data: 'product_skip_description' }
          ],
          [
            { text: '⬅️ Voltar', callback_data: 'product_back_price' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
          ]
        ]
      }
    });
  });

  bot.action('product_skip_description', async (ctx) => {
    await ctx.answerCbQuery('⏭️ Pulando descrição...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_product') return;
    
    session.data.description = null;
    session.step = 'url';
    
    return ctx.reply(`⏭️ *Descrição pulada!*

*Passo 4/4:* Envie a *URL de entrega* ou envie um *arquivo*:

📎 *Arquivo:* Envie um arquivo (ZIP, PDF, etc.)
🔗 *Link:* Digite a URL (Google Drive, Mega, etc.)`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⏭️ Pular', callback_data: 'product_skip_url' }
          ],
          [
            { text: '⬅️ Voltar', callback_data: 'product_back_description' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_product' }
          ]
        ]
      }
    });
  });

  bot.action('product_skip_url', async (ctx) => {
    await ctx.answerCbQuery('⏭️ Finalizando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_product') return;
    
    session.data.deliveryUrl = null;
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
        description: session.data.description || null,
        price: session.data.price,
        deliveryType: session.data.deliveryType,
        deliveryUrl: session.data.deliveryUrl || null
      });
      
      delete global._SESSIONS[ctx.from.id];
      
      return ctx.reply(`🎉 *PRODUTO CRIADO COM SUCESSO!*

🛍️ *Nome:* ${session.data.name}
🆔 *ID:* ${session.data.productId}
💰 *Preço:* R$ ${session.data.price.toFixed(2)}
📝 *Descrição:* ${session.data.description || 'Nenhuma'}
🔗 *URL:* Não configurada

⚠️ *Lembre-se de configurar a URL de entrega depois!*

O produto já está disponível no menu de compras!
Use /produtos para ver todos.`, { parse_mode: 'Markdown' });
      
    } catch (err) {
      delete global._SESSIONS[ctx.from.id];
      console.error('Erro ao criar produto:', err);
      return ctx.reply('❌ Erro ao criar produto. Tente novamente.');
    }
  });

  // ===== HANDLERS DE NAVEGAÇÃO PARA CRIAR GRUPO =====
  
  bot.action('cancel_create_group', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    global._SESSIONS = global._SESSIONS || {};
    if (global._SESSIONS[ctx.from.id]) {
      delete global._SESSIONS[ctx.from.id];
    }
    return ctx.reply('❌ Operação cancelada.');
  });

  bot.action('group_back_id', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_group') return;
    
    session.step = 'group_id';
    return ctx.reply(`➕ *CADASTRAR NOVO GRUPO*

*Passo 1/5:* Envie o *ID do grupo*

📝 *Como obter o ID:*
1. Adicione o bot @userinfobot ao grupo
2. Copie o ID que aparece (ex: -1001234567890)
3. Cole aqui`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
        ]]
      }
    });
  });

  bot.action('group_back_name', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_group') return;
    
    session.step = 'group_name';
    return ctx.reply(`✅ ID: *${session.data.groupId}*

*Passo 2/5:* Digite o *nome do grupo*:

Exemplo: Grupo Premium VIP`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Voltar', callback_data: 'group_back_id' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
          ]
        ]
      }
    });
  });

  bot.action('group_back_link', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_group') return;
    
    session.step = 'group_link';
    return ctx.reply(`✅ Nome: *${session.data.groupName}*

*Passo 3/5:* Envie o *link do grupo*:

Exemplo: https://t.me/seugrupo`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Voltar', callback_data: 'group_back_name' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
          ]
        ]
      }
    });
  });

  bot.action('group_back_price', async (ctx) => {
    await ctx.answerCbQuery('⬅️ Voltando...');
    global._SESSIONS = global._SESSIONS || {};
    const session = global._SESSIONS[ctx.from.id];
    if (!session || session.type !== 'create_group') return;
    
    session.step = 'price';
    return ctx.reply(`✅ Link: *${session.data.groupLink}*

*Passo 4/5:* Digite o *preço da assinatura* (mensal):

Exemplo: 30.00 ou 50`, { 
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '⬅️ Voltar', callback_data: 'group_back_link' },
            { text: '❌ Cancelar', callback_data: 'cancel_create_group' }
          ]
        ]
      }
    });
  });
  // ===== GERENCIAR DDDs BLOQUEADOS =====
  
  bot.command('ddds', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    try {
      const blockedDDDs = await db.getBlockedAreaCodes();
      
      let message = `🚫 *DDDs BLOQUEADOS*\n\n`;
      
      if (blockedDDDs.length === 0) {
        message += `Nenhum DDD bloqueado no momento.\n\n`;
      } else {
        for (const ddd of blockedDDDs) {
          message += `📍 *${ddd.area_code}* - ${ddd.state}\n`;
          if (ddd.reason) {
            message += `   └ ${ddd.reason}\n`;
          }
        }
        message += `\n`;
      }
      
      message += `*Comandos:*\n`;
      message += `➕ /addddd <DDD> <Estado> <Motivo> - Bloquear DDD\n`;
      message += `➖ /removeddd <DDD> - Desbloquear DDD\n\n`;
      message += `*Exemplo:*\n`;
      message += `/addddd 11 São Paulo Região não atendida`;
      
      return ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao listar DDDs:', err);
      return ctx.reply('❌ Erro ao buscar DDDs bloqueados.');
    }
  });
  
  bot.command('addddd', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    try {
      // Extrair argumentos: /addddd 11 São Paulo Região não atendida
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length < 2) {
        return ctx.reply(
          '❌ *Uso incorreto*\n\n' +
          'Formato: `/addddd <DDD> <Estado> [Motivo]`\n\n' +
          '*Exemplo:*\n' +
          '`/addddd 98 Maranhão Região não atendida`',
          { parse_mode: 'Markdown' }
        );
      }
      
      const areaCode = args[0];
      const state = args[1];
      const reason = args.slice(2).join(' ') || 'Região não atendida';
      
      // Validar DDD (2 dígitos)
      if (!/^\d{2}$/.test(areaCode)) {
        return ctx.reply('❌ DDD inválido. Use 2 dígitos (ex: 11, 98, 86)');
      }
      
      // Verificar se já existe
      const isBlocked = await db.isAreaCodeBlocked(areaCode);
      if (isBlocked) {
        return ctx.reply(`⚠️ DDD ${areaCode} já está bloqueado.`);
      }
      
      // Adicionar
      const result = await db.addBlockedAreaCode(areaCode, state, reason);
      
      if (result) {
        return ctx.reply(
          `✅ *DDD Bloqueado*\n\n` +
          `📍 DDD: ${areaCode}\n` +
          `📌 Estado: ${state}\n` +
          `💬 Motivo: ${reason}`,
          { parse_mode: 'Markdown' }
        );
      } else {
        return ctx.reply('❌ Erro ao bloquear DDD.');
      }
    } catch (err) {
      console.error('Erro ao adicionar DDD:', err);
      return ctx.reply('❌ Erro ao bloquear DDD.');
    }
  });
  
  bot.command('removeddd', async (ctx) => {
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Acesso negado.');
    
    try {
      const args = ctx.message.text.split(' ').slice(1);
      
      if (args.length === 0) {
        return ctx.reply(
          '❌ *Uso incorreto*\n\n' +
          'Formato: `/removeddd <DDD>`\n\n' +
          '*Exemplo:*\n' +
          '`/removeddd 98`',
          { parse_mode: 'Markdown' }
        );
      }
      
      const areaCode = args[0];
      
      // Validar DDD
      if (!/^\d{2}$/.test(areaCode)) {
        return ctx.reply('❌ DDD inválido. Use 2 dígitos (ex: 11, 98, 86)');
      }
      
      // Verificar se existe
      const isBlocked = await db.isAreaCodeBlocked(areaCode);
      if (!isBlocked) {
        return ctx.reply(`⚠️ DDD ${areaCode} não está bloqueado.`);
      }
      
      // Remover
      const success = await db.removeBlockedAreaCode(areaCode);
      
      if (success) {
        return ctx.reply(
          `✅ *DDD Desbloqueado*\n\n` +
          `📍 DDD ${areaCode} foi removido da lista de bloqueios.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        return ctx.reply('❌ Erro ao desbloquear DDD.');
      }
    } catch (err) {
      console.error('Erro ao remover DDD:', err);
      return ctx.reply('❌ Erro ao desbloquear DDD.');
    }
  });
}

module.exports = { registerAdminCommands };

