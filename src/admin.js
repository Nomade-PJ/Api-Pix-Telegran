// src/admin.js
const { Markup } = require('telegraf');
const db = require('./database');
const deliver = require('./deliver');

// Registrar comandos admin
function registerAdminCommands(bot) {
  
  // ===== RELATÓRIO DETALHADO DE USUÁRIOS (REGISTRAR PRIMEIRO) =====
  bot.command('relatorio_usuarios', async (ctx) => {
    console.log('🔍 [RELATORIO] Comando /relatorio_usuarios capturado');
    console.log('🔍 [RELATORIO] Usuário:', ctx.from.id, '@' + (ctx.from.username || 'sem username'));
    
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      console.log('🔍 [RELATORIO] É admin?', isAdmin);
      
      if (!isAdmin) {
        console.log('❌ [RELATORIO] Acesso negado');
        return ctx.reply('❌ Acesso negado.');
      }
      
      console.log('⏳ [RELATORIO] Enviando mensagem de "Gerando relatório..."');
      await ctx.reply('⏳ Gerando relatório de usuários...');
      
      console.log('📊 [RELATORIO] Buscando dados do relatório...');
      const report = await db.getUserReport();
      console.log('✅ [RELATORIO] Dados obtidos:', JSON.stringify(report));
      
      let message = `📊 *RELATÓRIO DETALHADO DE USUÁRIOS*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 *TOTAL DE USUÁRIOS:* ${report.totalUsers}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *COMPRAS*
✅ Usuários que compraram: ${report.usersWhoBought}
📈 Taxa de conversão: ${report.buyRate}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔓 *USUÁRIOS DESBLOQUEADOS/LIBERADOS*
📊 Total desbloqueados: ${report.unblockedUsers}
✅ Desbloqueados que compraram: ${report.unblockedWhoBought}
❌ Desbloqueados SEM compra: ${report.unblockedWithoutPurchase}
📈 Taxa de conversão: ${report.unblockedBuyRate}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 *BLOQUEIOS POR DDD*
📍 Total de usuários bloqueados por DDD (tentaram acessar): ${report.usersBlockedByDDD}
   ├─ ⛔ Desbloqueados manualmente: ${report.usersWithBlockedDDDButUnlocked || 0}
   └─ 🚫 Ainda bloqueados: ${report.usersBlockedByDDD - (report.usersWithBlockedDDDButUnlocked || 0)}`;

      // Adicionar lista detalhada de usuários ainda bloqueados por DDD (limitar a 20 para não exceder limite do Telegram)
      const stillBlockedCount = report.usersBlockedByDDD - (report.usersWithBlockedDDDButUnlocked || 0);
      if (stillBlockedCount > 0 && report.usersBlockedByDDDDetails && report.usersBlockedByDDDDetails.length > 0) {
        message += `\n\n📋 *LISTA DE USUÁRIOS AINDA BLOQUEADOS POR DDD:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        const limitedList = report.usersBlockedByDDDDetails.slice(0, 20);
        
        limitedList.forEach((user, index) => {
          const name = user.name.length > 20 ? user.name.substring(0, 17) + '...' : user.name;
          message += `\n${index + 1}. ${name} | DDD: ${user.ddd} | ID: ${user.telegram_id}`;
        });
        
        if (stillBlockedCount > 20) {
          message += `\n\n... e mais ${stillBlockedCount - 20} usuário(s) ainda bloqueado(s) por DDD.`;
        }
      }

      message += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 *Atualizado:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

      console.log('📤 [RELATORIO] Enviando relatório completo...');
      const result = await ctx.reply(message, { parse_mode: 'Markdown' });
      console.log('✅ [RELATORIO] Relatório enviado com sucesso');
      return result;
      
    } catch (err) {
      console.error('❌ [RELATORIO] Erro ao gerar relatório:', err);
      console.error('❌ [RELATORIO] Stack:', err.stack);
      return ctx.reply('❌ Erro ao gerar relatório. Verifique os logs.');
    }
  });
  
  // ===== FUNÇÃO PARA BUSCAR E EXIBIR INFORMAÇÕES DO USUÁRIO =====
  async function buscarUsuarioInfo(ctx, telegramId) {
    try {
      // Buscar usuário
      const user = await db.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(`❌ Usuário com ID ${telegramId} não encontrado.`);
      }
      
      // Buscar transações
      const transactions = await db.getUserTransactions(telegramId, 50);
      
      // Construir mensagem sem Markdown problemático
      let message = `👤 *USUÁRIO ENCONTRADO:*\n\n`;
      message += `Nome: ${user.first_name || 'N/A'}\n`;
      message += `ID: ${telegramId}\n`;
      message += `Username: @${user.username || 'N/A'}\n`;
      message += `Bloqueado: ${user.is_blocked ? 'Sim' : 'Não'}\n`;
      message += `Cadastrado em: ${new Date(user.created_at).toLocaleString('pt-BR')}\n`;
      
      if (transactions.length === 0) {
        message += `\n❌ Nenhuma transação encontrada.`;
        return ctx.reply(message, { parse_mode: 'Markdown' });
      }
      
      message += `\n📊 *TRANSAÇÕES (${transactions.length}):*\n\n`;
      
      const keyboard = [];
      
      for (const tx of transactions.slice(0, 5)) {
        message += `🆔 TXID: ${tx.txid}\n`;
        message += `💰 Valor: R$ ${tx.amount}\n`;
        message += `📊 Status: ${tx.status}\n`;
        message += `📅 Data: ${new Date(tx.created_at).toLocaleString('pt-BR')}\n`;
        
        if (tx.proof_file_id) {
          message += `📸 Comprovante: ✅ Disponível\n`;
        }
        
        // Adicionar botão para ver detalhes
        keyboard.push([
          { text: `📋 Ver TXID: ${tx.txid.substring(0, 10)}...`, callback_data: `details_${tx.txid}` }
        ]);
        
        message += `\n`;
      }
      
      if (transactions.length > 5) {
        message += `\n... e mais ${transactions.length - 5} transação(ões).`;
      }
      
      // Adicionar botão para voltar
      keyboard.push([
        { text: '⬅️ Voltar ao Painel', callback_data: 'admin_refresh' }
      ]);
      
      return ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (err) {
      console.error('Erro ao buscar usuário:', err);
      return ctx.reply('❌ Erro ao buscar usuário. Verifique os logs.');
    }
  }

  // ===== COMANDO PARA BUSCAR TRANSAÇÕES POR ID DE USUÁRIO =====
  bot.command('buscar_usuario', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ Acesso negado.');
      }
      
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
        return ctx.reply('📋 *Como usar:*\n\n/buscar_usuario <ID_TELEGRAM>\n\nExemplo:\n/buscar_usuario 6224210204', { parse_mode: 'Markdown' });
      }
      
      const telegramId = args[1];
      return await buscarUsuarioInfo(ctx, telegramId);
    } catch (err) {
      console.error('Erro ao buscar usuário:', err);
      return ctx.reply('❌ Erro ao buscar usuário. Verifique os logs.');
    }
  });

  // ===== COMANDO DE TESTE PARA ATUALIZAR DESCRIÇÃO =====
  bot.command('teste_descricao', async (ctx) => {
    console.log('🔍 [TESTE-DESC] ========== COMANDO CAPTURADO ==========');
    console.log('🔍 [TESTE-DESC] Comando /teste_descricao recebido de:', ctx.from.id);
    console.log('🔍 [TESTE-DESC] Usuário:', ctx.from.username || 'sem username');
    try {
      console.log('🔍 [TESTE-DESC] Verificando se é admin...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      console.log('🔍 [TESTE-DESC] É admin?', isAdmin);
      
      if (!isAdmin) {
        console.log('❌ [TESTE-DESC] Acesso negado - não é admin');
        return ctx.reply('❌ Acesso negado.');
      }

      console.log('⏳ [TESTE-DESC] Enviando mensagem de "Testando..."');
      await ctx.reply('⏳ Testando atualização da descrição...');

      console.log('📦 [TESTE-DESC] Carregando função updateBotDescription...');
      const { updateBotDescription } = require('./jobs/updateBotDescription');
      console.log('🔄 [TESTE-DESC] Executando updateBotDescription...');
      const result = await updateBotDescription();
      console.log('📊 [TESTE-DESC] Resultado:', JSON.stringify(result));

      if (result.success) {
        return ctx.reply(`✅ *Teste realizado com sucesso!*

📊 *Usuários mensais:* ${result.monthlyUsers}
📝 *Descrição atualizada:* "${result.description}"

A descrição deve aparecer no perfil do bot em alguns instantes.`, { parse_mode: 'Markdown' });
      } else {
        return ctx.reply(`❌ *Erro ao atualizar descrição*

Erro: ${result.error}

Verifique os logs do servidor para mais detalhes.`, { parse_mode: 'Markdown' });
      }
      
    } catch (err) {
      console.error('❌ [TESTE-DESC] Erro no teste de descrição:', err.message);
      console.error('❌ [TESTE-DESC] Stack:', err.stack);
      return ctx.reply(`❌ Erro: ${err.message}`);
    }
  });
  
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
          Markup.button.callback('🎫 Tickets de Suporte', 'admin_tickets')
        ],
        [
          Markup.button.callback('⭐ Usuários Confiáveis', 'admin_trusted_users'),
          Markup.button.callback('🤖 Respostas Automáticas', 'admin_auto_responses')
        ],
        [
          Markup.button.callback('👤 Usuários', 'admin_users'),
          Markup.button.callback('📢 Broadcast', 'admin_broadcast')
        ],
        [
          Markup.button.callback('🔓 Gerenciar Bloqueios', 'admin_manage_blocks'),
          Markup.button.callback('🎟️ Cupons', 'admin_coupons')
        ],
        [
          Markup.button.callback('🔍 Buscar Usuário', 'admin_buscar_usuario')
        ],
        [
          Markup.button.callback('📦 Reentregar Packs', 'admin_reentregar_packs')
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
      
      const pendingResult = await db.getPendingTransactions(10, 0);
      const pending = pendingResult.data || [];
      
      if (pending.length === 0) {
        return ctx.reply('✅ Nenhuma transação pendente!');
      }
      
      let message = `⏳ *${pendingResult.total} TRANSAÇÕES PENDENTES* (mostrando ${pending.length}):\n\n`;
      
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
          // Não logar como erro se o bot foi bloqueado pelo usuário (comportamento esperado)
          if (err.message && err.message.includes('bot was blocked by the user')) {
            // Silencioso - apenas contar como falha
          } else {
            // Logar apenas erros reais (não relacionados a bloqueio)
            console.error(`❌ [BROADCAST] Erro ao enviar para ${user.telegram_id}:`, err.message);
          }
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
  bot.on('text', async (ctx, next) => {
    try {
      // 🆕 DEBUG: Log para verificar se este handler está sendo executado
      console.log(`🔍 [ADMIN-TEXT-HANDLER-1] Handler executado para usuário ${ctx.from.id}`);
      console.log(`🔍 [ADMIN-TEXT-HANDLER-1] Mensagem: ${ctx.message.text?.substring(0, 50)}`);
      
      // Ignorar comandos (mensagens que começam com /)
      if (ctx.message.text.startsWith('/')) {
        console.log(`🔍 [ADMIN-TEXT-HANDLER-1] É comando, passando para próximo handler`);
        return next();
      }
      
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      console.log(`🔍 [ADMIN-TEXT-HANDLER-1] Sessão: ${session ? session.type : 'nenhuma'}`);
      
      // Se não há sessão ou é sessão de bloqueio, passar para próximo handler
      if (!session) {
        console.log(`🔍 [ADMIN-TEXT-HANDLER-1] Sem sessão, passando para próximo handler`);
        return next();
      }
      if (['unblock_user', 'block_user', 'check_block_status'].includes(session.type)) {
        console.log(`🔍 [ADMIN-TEXT-HANDLER-1] Sessão de bloqueio, passando para próximo handler`);
        return next(); // Deixar o handler de bloqueios processar
      }
      
      // 🆕 Se for sessão admin_reply_ticket, passar para próximo handler (que está na linha 4861)
      if (session.type === 'admin_reply_ticket') {
        console.log(`🔍 [ADMIN-TEXT-HANDLER-1] Sessão admin_reply_ticket detectada, passando para próximo handler`);
        return next();
      }
      
      // Verificar se é busca de usuário
      if (session.type === 'buscar_usuario' && session.step === 'waiting_id') {
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) {
          delete global._SESSIONS[ctx.from.id];
          return;
        }
        
        const telegramId = ctx.message.text.trim();
        
        // Validar ID (deve ser numérico)
        if (!/^\d+$/.test(telegramId)) {
          return ctx.reply('❌ ID inválido. Digite apenas números.\n\nExemplo: `6224210204`', {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ Cancelar', callback_data: 'cancel_buscar_usuario' }
              ]]
            }
          });
        }
        
        // Limpar sessão
        delete global._SESSIONS[ctx.from.id];
        
        // Buscar e exibir informações
        return await buscarUsuarioInfo(ctx, telegramId);
      }
      
      // Verificar se é broadcast do admin
      if (session.type === 'admin_broadcast' && session.step === 'waiting_message') {
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) {
          delete global._SESSIONS[ctx.from.id];
          return;
        }
        
        const message = ctx.message.text;
        
        // Confirmar antes de enviar
        global._SESSIONS[ctx.from.id] = {
          type: 'admin_broadcast',
          step: 'confirm',
          data: { message }
        };
        
        const previewMessage = `📢 *CONFIRMAR BROADCAST*

*Mensagem:*
${message}

━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ *Esta mensagem será enviada para TODOS os usuários não bloqueados.*

Deseja continuar?`;
        
        return ctx.reply(previewMessage, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirmar e Enviar', 'confirm_admin_broadcast')],
            [Markup.button.callback('❌ Cancelar', 'cancel_admin_broadcast')]
          ])
        });
      }
      
      // Verificar se é broadcast do criador
      if (session.type === 'creator_broadcast' && session.step === 'message') {
        const isCreator = await db.isUserCreator(ctx.from.id);
        if (!isCreator) {
          delete global._SESSIONS[ctx.from.id];
          return;
        }
        
        const message = ctx.message.text;
        
        // Confirmar antes de enviar
        global._SESSIONS[ctx.from.id] = {
          type: 'creator_broadcast',
          step: 'confirm',
          data: { message },
          broadcastType: session.broadcastType || 'simple',
          productId: session.productId,
          mediaPackId: session.mediaPackId,
          productName: session.productName || '',
          productPrice: session.productPrice || 0
        };
        
        let previewMessage = `📢 *CONFIRMAR BROADCAST*

*Mensagem:*
${message}`;

        if (session.broadcastType === 'product' && session.productName) {
          previewMessage += `\n\n📦 *Produto:* ${session.productName}`;
          previewMessage += `\n💰 *Preço:* R$ ${parseFloat(session.productPrice || 0).toFixed(2)}`;
        } else if (session.broadcastType === 'media_pack' && session.packName) {
          previewMessage += `\n\n📸 *Pack:* ${session.packName}`;
          previewMessage += `\n💰 *Preço:* R$ ${parseFloat(session.packPrice || 0).toFixed(2)}`;
        }

        previewMessage += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ *Esta mensagem será enviada para TODOS os usuários.*\n\nDeseja continuar?`;
        
        return ctx.reply(previewMessage, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirmar e Enviar', 'confirm_creator_broadcast')],
            [Markup.button.callback('❌ Cancelar', 'cancel_creator_broadcast')]
          ])
        });
      }
      
      // Verificar se é criação de cupom
      if (session.type === 'create_coupon') {
        const isCreator = await db.isUserCreator(ctx.from.id);
        if (!isCreator) {
          delete global._SESSIONS[ctx.from.id];
          return;
        }
        
        if (session.step === 'code') {
          const code = ctx.message.text.trim().toUpperCase();
          
          // Validar código
          if (code.length < 3 || code.length > 20) {
            return ctx.reply('❌ Código inválido. Use entre 3 e 20 caracteres.\n\nTente novamente:');
          }
          
          // Verificar se código já existe
          const { data: existingCoupon } = await db.supabase
            .from('coupons')
            .select('code')
            .eq('code', code)
            .single();
          
          if (existingCoupon) {
            return ctx.reply('❌ Este código já está em uso. Escolha outro:');
          }
          
          session.data = { code };
          session.step = 'discount';
          
          return ctx.reply(`✅ Código: \`${code}\`

*Passo 2/4:* Digite a *porcentagem de desconto* (1-99):

Exemplo: 10, 20, 50, 90

_Cancelar: /cancelar_`, { parse_mode: 'Markdown' });
        }
        
        if (session.step === 'discount') {
          const discount = parseInt(ctx.message.text.trim());
          
          if (isNaN(discount) || discount < 1 || discount > 99) {
            return ctx.reply('❌ Porcentagem inválida. Use um número entre 1 e 99.\n\nTente novamente:');
          }
          
          session.data.discount = discount;
          session.step = 'max_uses';
          
          const productName = session.productName || session.packName || 'Produto';
          const originalPrice = parseFloat(session.productPrice || session.packPrice || 0);
          const discountedPrice = originalPrice * (1 - discount / 100);
          
          return ctx.reply(`✅ Desconto: ${discount}%

💰 Preço original: R$ ${originalPrice.toFixed(2)}
💚 Preço com desconto: R$ ${discountedPrice.toFixed(2)}

*Passo 3/4:* Digite o *número máximo de usos* (ou envie 0 para ilimitado):

Exemplo: 100, 500, 0

_Cancelar: /cancelar_`, { parse_mode: 'Markdown' });
        }
        
        if (session.step === 'max_uses') {
          const maxUses = parseInt(ctx.message.text.trim());
          
          if (isNaN(maxUses) || maxUses < 0) {
            return ctx.reply('❌ Número inválido. Use 0 para ilimitado ou um número positivo.\n\nTente novamente:');
          }
          
          session.data.maxUses = maxUses === 0 ? null : maxUses;
          session.step = 'expiration';
          
          return ctx.reply(`✅ Usos máximos: ${maxUses === 0 ? 'Ilimitado' : maxUses}

*Passo 4/4:* Digite a *data de expiração* (ou envie 0 para sem expiração):

Formato: DD/MM/AAAA
Exemplo: 31/12/2025, 15/01/2026, 0

_Cancelar: /cancelar_`, { parse_mode: 'Markdown' });
        }
        
        if (session.step === 'expiration') {
          const text = ctx.message.text.trim();
          let expiresAt = null;
          
          if (text !== '0') {
            // Validar formato de data
            const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
            const match = text.match(dateRegex);
            
            if (!match) {
              return ctx.reply('❌ Formato de data inválido. Use DD/MM/AAAA ou 0 para sem expiração.\n\nTente novamente:');
            }
            
            const [_, day, month, year] = match;
            const date = new Date(year, month - 1, day, 23, 59, 59);
            
            if (date < new Date()) {
              return ctx.reply('❌ Data de expiração não pode ser no passado.\n\nTente novamente:');
            }
            
            expiresAt = date.toISOString();
          }
          
          // Criar cupom no banco
          try {
            const user = await db.getOrCreateUser(ctx.from);
            
            const { data: coupon, error } = await db.supabase
              .from('coupons')
              .insert([{
                code: session.data.code,
                discount_percentage: session.data.discount,
                product_id: session.productId || null,
                media_pack_id: session.mediaPackId || null,
                max_uses: session.data.maxUses,
                expires_at: expiresAt,
                created_by: user.id
              }])
              .select()
              .single();
            
            if (error) throw error;
            
            delete global._SESSIONS[ctx.from.id];
            
            const productName = session.productName || session.packName || 'Produto';
            const originalPrice = parseFloat(session.productPrice || session.packPrice || 0);
            const discountedPrice = originalPrice * (1 - session.data.discount / 100);
            
            return ctx.reply(`🎉 *CUPOM CRIADO COM SUCESSO!*

🎟️ *Código:* \`${session.data.code}\`
💰 *Desconto:* ${session.data.discount}%
📦 *Produto:* ${productName}
💵 *Preço original:* R$ ${originalPrice.toFixed(2)}
💚 *Preço com desconto:* R$ ${discountedPrice.toFixed(2)}
📊 *Usos máximos:* ${session.data.maxUses || 'Ilimitado'}
${expiresAt ? `⏰ *Expira em:* ${new Date(expiresAt).toLocaleDateString('pt-BR')}` : '⏰ *Expira em:* Nunca'}

✅ O cupom já está ativo e pronto para uso!

Para divulgar, você pode:
1. Usar /start para ver o produto
2. Criar um broadcast associado ao cupom
3. Compartilhar o código: \`${session.data.code}\``, { 
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('📢 Criar Broadcast', 'creator_broadcast_coupon')],
                [Markup.button.callback('🔙 Voltar', 'creator_coupons')]
              ])
            });
          } catch (err) {
            console.error('Erro ao criar cupom:', err);
            delete global._SESSIONS[ctx.from.id];
            return ctx.reply('❌ Erro ao criar cupom. Tente novamente.');
          }
        }
      }
      
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
        const { productId, field, product } = session.data;
        const value = ctx.message.text.trim();
        
        let updates = {};
        let fieldName = '';
        let newValue = '';
        
        if (field === 'name') {
          updates.name = value;
          fieldName = 'Nome';
          newValue = value;
        }
        else if (field === 'price') {
          const price = parseFloat(value.replace(',', '.'));
          if (isNaN(price) || price <= 0) {
            return ctx.reply('❌ Preço inválido. Digite apenas números.');
          }
          updates.price = price;
          fieldName = 'Preço';
          newValue = `R$ ${price.toFixed(2)}`;
        }
        else if (field === 'description') {
          updates.description = value === '-' ? null : value;
          fieldName = 'Descrição';
          newValue = value === '-' ? 'Removida' : value;
        }
        else if (field === 'url') {
          updates.delivery_url = value === '-' ? null : value;
          updates.delivery_type = 'link';
          fieldName = 'URL/Link';
          newValue = value === '-' ? 'Removida' : value;
        }
        
        await db.updateProduct(productId, updates);
        delete global._SESSIONS[ctx.from.id];
        
        return ctx.reply(`✅ *${fieldName} atualizado com sucesso!*

🛍️ *Produto:* ${product.name}
🆔 *ID:* \`${productId}\`
✏️ *Campo alterado:* ${fieldName}
📝 *Novo valor:* ${newValue}

Use /admin → Produtos para ver todas as alterações.`, { parse_mode: 'Markdown' });
      }

      // ===== CRIAR GRUPO =====
      if (session.type === 'create_group') {
        if (session.step === 'group_id') {
          const inputText = ctx.message.text.trim();
          
          // Remover espaços e caracteres especiais, manter apenas números e sinal negativo
          const cleanId = inputText.replace(/[^\d-]/g, '');
          const groupId = parseInt(cleanId);
          
          if (isNaN(groupId) || groupId >= 0) {
            return ctx.reply(`❌ *ID inválido!*

O ID do grupo/canal deve ser um *número negativo*.

📝 *Exemplos válidos:*
• -1001234567890
• -1003479868247

💡 *Dica:* Adicione @userinfobot ao seu grupo/canal para obter o ID correto.`, {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('❌ Cancelar', 'cancel_create_group')]
              ])
            });
          }
          
          // Verificar se já existe grupo com esse ID
          const existingGroup = await db.getGroupById(groupId);
          if (existingGroup) {
            return ctx.reply(`⚠️ *Grupo já cadastrado!*

🆔 ID: \`${groupId}\`
👥 Nome: ${existingGroup.group_name || 'Sem nome'}

Use /admin → Gerenciar Grupos para editar.`, {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('👥 Ver Grupos', 'admin_groups')],
                [Markup.button.callback('❌ Cancelar', 'cancel_create_group')]
              ])
            });
          }
          
          session.data.groupId = groupId;
          session.step = 'group_name';
          return ctx.reply(`✅ *ID confirmado:* \`${groupId}\`

*Passo 2/5:* Digite o *nome do grupo/canal*:

📝 *Exemplo:* Grupo Privado 🔞`, { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('⬅️ Voltar', 'group_back_id'),
                Markup.button.callback('❌ Cancelar', 'cancel_create_group')
              ]
            ])
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
🆔 *ID:* \`${session.data.groupId}\`
🔗 *Link:* ${session.data.groupLink}
💰 *Preço:* R$ ${session.data.price.toFixed(2)}/mês
📅 *Duração:* ${session.data.days} dias

✅ O grupo está pronto para receber assinaturas!

⚠️ *IMPORTANTE:*
1. ✅ Adicione o bot ao grupo como administrador
2. ✅ Dê permissão para banir/remover membros
3. ✅ O bot controlará automaticamente as assinaturas

O botão "🔞 Grupo Privado 🔞" aparecerá no menu principal!`, { 
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('👥 Ver Todos os Grupos', 'admin_groups')],
                [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
              ])
            });
            
          } catch (err) {
            delete global._SESSIONS[ctx.from.id];
            console.error('Erro ao criar grupo:', err);
            return ctx.reply(`❌ Erro ao criar grupo: ${err.message}`);
          }
        }
      }
      
      // 🆕 Se não processou nenhuma sessão, passar para próximo handler
      console.log(`🔍 [ADMIN-TEXT-HANDLER-1] Sessão não processada por este handler, passando para próximo: ${session ? session.type : 'nenhuma'}`);
      return next();
      
    } catch (err) {
      console.error('❌ [ADMIN-TEXT-HANDLER-1] Erro no handler de texto:', err);
      // Passar para próximo handler em caso de erro
      return next();
    }
  });
  
  // ===== HANDLER DE ARQUIVOS (PARA UPLOAD) =====
  bot.on('document', async (ctx, next) => {
    console.log(`📄 [DOCUMENT-ADMIN] ========== HANDLER ADMIN.JS EXECUTADO ==========`);
    try {
      const fileName = ctx.message.document?.file_name;
      console.log(`📄 [DOCUMENT-ADMIN] Arquivo recebido: ${fileName}`);
      console.log(`📄 [DOCUMENT-ADMIN] User ID: ${ctx.from.id}`);
      
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      console.log(`📄 [DOCUMENT-ADMIN] Is Admin: ${isAdmin}`);
      
      if (!isAdmin) {
        console.log('📄 [DOCUMENT-ADMIN] ❌ Usuário não é admin, passando adiante');
        return next();
      }
      
      // Verificar sessão ANTES de verificar transação
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      
      console.log('📄 [DOCUMENT-ADMIN] Sessão atual:', session ? JSON.stringify({
        type: session.type,
        step: session.step,
        field: session.data?.field,
        productId: session.data?.productId,
        productName: session.data?.product?.name
      }) : '❌ NÃO EXISTE');
      
      // PRIORIDADE 1: Verificar se é EDIÇÃO de produto (URL/Arquivo)
      if (session && session.type === 'edit_product' && session.step === 'edit_value' && session.data?.field === 'url') {
        console.log('📄 [DOCUMENT] 🎯 MATCH: Edição de produto detectada!');
        
        const fileId = ctx.message.document.file_id;
        const { productId, product } = session.data;
        
        console.log(`📄 [DOCUMENT] 📦 Atualizando produto "${product.name}" (ID: ${productId})`);
        console.log(`📄 [DOCUMENT] 📎 File ID: ${fileId.substring(0, 30)}...`);
        
        // Atualizar produto com novo arquivo
        const updated = await db.updateProduct(productId, {
          delivery_url: `telegram_file:${fileId}`,
          delivery_type: 'file'
        });
        
        console.log(`📄 [DOCUMENT] ✅ Update result: ${updated}`);
        
        delete global._SESSIONS[ctx.from.id];
        console.log('📄 [DOCUMENT] 🗑️ Sessão deletada');
        
        return ctx.reply(`✅ *Arquivo atualizado com sucesso!*

🛍️ *Produto:* ${product.name}
📄 *Novo arquivo:* ${fileName}
📦 *Tipo:* Arquivo ZIP

Use /admin → Produtos para ver as alterações.`, { parse_mode: 'Markdown' });
      }
      
      // PRIORIDADE 2: Verificar se há transação pendente (comprovante)
      const transaction = await db.getLastPendingTransaction(ctx.chat.id);
      if (transaction) {
        console.log('📄 [DOCUMENT-ADMIN] Transação pendente encontrada - deixando passar para handler de comprovantes');
        return next(); // Passar para próximo handler (comprovantes)
      }
      
      // ===== CRIAR PRODUTO - Arquivo enviado =====
      if (!session || session.type !== 'create_product' || session.step !== 'url') {
        console.log('📄 [DOCUMENT-ADMIN] Arquivo ignorado - não é criação/edição de produto');
        return next(); // Passar para próximo handler
      }
      
      console.log('📄 [DOCUMENT] Processando arquivo para CRIAÇÃO de produto...');
      
      const fileId = ctx.message.document.file_id;
      // fileName já foi declarado no topo do handler
      
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
        Markup.button.callback('🔓 Gerenciar Bloqueios', 'admin_manage_blocks'),
        Markup.button.callback('🎟️ Cupons', 'admin_coupons')
      ],
      [
        Markup.button.callback('🔍 Buscar Usuário', 'admin_buscar_usuario')
      ],
      [
        Markup.button.callback('📦 Reentregar Packs', 'admin_reentregar_packs')
      ],
      [
        Markup.button.callback('🔄 Atualizar', 'admin_refresh')
      ]
    ]);
    
    try {
      return await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...keyboard
      });
    } catch (err) {
      if (err.message && err.message.includes('message is not modified')) {
        console.log('ℹ️ [ADMIN-REFRESH] Mensagem já está atualizada');
        return;
      }
      throw err;
    }
  });

  // ===== BUSCAR USUÁRIO =====
  bot.action('admin_buscar_usuario', async (ctx) => {
    try {
      await ctx.answerCbQuery('🔍 Buscando usuário...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      // Criar sessão para pedir o ID
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'buscar_usuario',
        step: 'waiting_id'
      };
      
      return ctx.reply('🔍 *BUSCAR USUÁRIO*\n\nDigite o *ID do Telegram* do usuário que deseja buscar:\n\nExemplo: `6224210204`', {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '❌ Cancelar', callback_data: 'cancel_buscar_usuario' }
          ]]
        }
      });
    } catch (err) {
      console.error('Erro ao iniciar busca de usuário:', err);
      return ctx.reply('❌ Erro ao iniciar busca. Verifique os logs.');
    }
  });

  // ===== CANCELAR BUSCA DE USUÁRIO =====
  bot.action('cancel_buscar_usuario', async (ctx) => {
    try {
      await ctx.answerCbQuery('❌ Cancelado');
      global._SESSIONS = global._SESSIONS || {};
      if (global._SESSIONS[ctx.from.id]) {
        delete global._SESSIONS[ctx.from.id];
      }
      return ctx.reply('❌ Busca cancelada.');
    } catch (err) {
      console.error('Erro ao cancelar busca:', err);
    }
  });

  // ===== REENTREGAR PACKS =====
  bot.action('admin_reentregar_packs', async (ctx) => {
    try {
      await ctx.answerCbQuery('📦 Verificando...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      // Buscar transações dos produtos de Pack que foram entregues E têm comprovante
      const { data: transactions, error } = await db.supabase
        .from('transactions')
        .select('txid, user_id, telegram_id, product_id, amount, status, delivered_at, created_at, proof_file_id, proof_received_at, validated_at')
        .in('product_id', ['packsavulsos', 'packsexplicitos', 'packspicantes'])
        .eq('status', 'delivered')
        .not('delivered_at', 'is', null)
        .not('proof_received_at', 'is', null) // Deve ter recebido comprovante
        .not('validated_at', 'is', null) // Deve ter sido validado
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) {
        console.error('Erro ao buscar transações:', error);
        return ctx.reply('❌ Erro ao buscar transações. Verifique os logs.');
      }
      
      if (!transactions || transactions.length === 0) {
        return ctx.reply('✅ Nenhuma transação de Pack encontrada para reentregar.\n\n⚠️ Apenas transações com comprovante enviado e validado são consideradas.');
      }
      
      // Confirmar antes de reentregar
      return ctx.reply(`📦 *REENTREGAR PACKS*\n\nEncontradas *${transactions.length}* transações de Pack que podem ser reentregues.\n\n✅ *Verificação:*\n• Comprovante enviado: ✅\n• Transação validada: ✅\n• Status entregue: ✅\n\n⚠️ *ATENÇÃO:* Esta ação irá reenviar o produto para todos os usuários que enviaram comprovante e foram aprovados.\n\nDeseja continuar?`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Sim, Reentregar Todos', callback_data: 'confirm_reentregar_packs' },
              { text: '❌ Cancelar', callback_data: 'cancel_reentregar_packs' }
            ]
          ]
        }
      });
      
    } catch (err) {
      console.error('Erro ao verificar packs:', err);
      return ctx.reply('❌ Erro ao verificar packs. Verifique os logs.');
    }
  });

  // ===== CONFIRMAR REENTREGA DE PACKS =====
  bot.action('confirm_reentregar_packs', async (ctx) => {
    try {
      try {
        await ctx.answerCbQuery('📦 Reentregando...');
      } catch (cbErr) {
        // Ignorar erro de callback query expirado
        if (cbErr.message && !cbErr.message.includes('query is too old')) {
          console.error('Erro ao responder callback query:', cbErr.message);
        }
      }
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      await ctx.editMessageText('📦 *REENTREGANDO PACKS...*\n\n⏳ Processando transações...\n\nIsso pode levar alguns minutos.', {
        parse_mode: 'Markdown'
      });
      
      // Buscar transações com comprovante e validação
      const { data: transactions, error } = await db.supabase
        .from('transactions')
        .select('txid, user_id, telegram_id, product_id, amount, status, delivered_at, created_at, proof_file_id, proof_received_at, validated_at')
        .in('product_id', ['packsavulsos', 'packsexplicitos', 'packspicantes'])
        .eq('status', 'delivered')
        .not('delivered_at', 'is', null)
        .not('proof_received_at', 'is', null) // Deve ter recebido comprovante
        .not('validated_at', 'is', null) // Deve ter sido validado
        .order('created_at', { ascending: false })
        .limit(200);
      
      if (error) throw error;
      
      if (!transactions || transactions.length === 0) {
        return ctx.editMessageText('✅ Nenhuma transação de Pack encontrada para reentregar.\n\n⚠️ Apenas transações com comprovante enviado e validado são consideradas.', {
          reply_markup: {
            inline_keyboard: [[
              { text: '⬅️ Voltar ao Painel', callback_data: 'admin_refresh' }
            ]]
          }
        });
      }
      
      let successCount = 0;
      let errorCount = 0;
      let skippedCount = 0;
      const errors = [];
      
      // Processar em lotes para não sobrecarregar
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        
        try {
          // Verificar se tem comprovante (dupla verificação)
          if (!tx.proof_received_at || !tx.validated_at) {
            console.log(`⚠️ [REENTREGA] TXID ${tx.txid} não tem comprovante ou validação - pulando`);
            skippedCount++;
            continue;
          }
          
          // Buscar produto
          const product = await db.getProduct(tx.product_id, true);
          if (!product || !product.delivery_url) {
            console.log(`⚠️ [REENTREGA] Produto não encontrado ou sem URL para TXID ${tx.txid}`);
            skippedCount++;
            continue;
          }
          
          // Buscar usuário
          const user = tx.user_id ? await db.getUserByUUID(tx.user_id) : null;
          if (!user || !user.telegram_id) {
            console.log(`⚠️ [REENTREGA] Usuário não encontrado para TXID ${tx.txid}`);
            skippedCount++;
            continue;
          }
          
          // 🆕 VERIFICAR SE O USUÁRIO REALMENTE NÃO RECEBEU O PRODUTO
          // 1. Verificar se o bot foi bloqueado (usuário não pode receber)
          // 2. Verificar se a entrega foi muito recente (pode ter sido recebido)
          
          let shouldReDeliver = true;
          let skipReason = '';
          
          // Verificar data de entrega - se foi entregue há menos de 1 hora, pode ter sido recebido
          const deliveredAt = new Date(tx.delivered_at);
          const now = new Date();
          const hoursSinceDelivery = (now - deliveredAt) / (1000 * 60 * 60);
          
          if (hoursSinceDelivery < 1) {
            console.log(`⏭️ [REENTREGA] TXID ${tx.txid} foi entregue há ${hoursSinceDelivery.toFixed(1)} horas - muito recente, pode ter sido recebido`);
            skipReason = `Entregue há ${hoursSinceDelivery.toFixed(1)} horas (muito recente)`;
            shouldReDeliver = false;
          }
          
          // Verificar se o usuário pode receber mensagens (bot não bloqueado)
          if (shouldReDeliver) {
            try {
              console.log(`🔍 [REENTREGA] Verificando se usuário ${user.telegram_id} pode receber mensagens...`);
              // Tentar enviar uma mensagem de teste (será deletada depois)
              const testMessage = await ctx.telegram.sendMessage(
                user.telegram_id, 
                '🔍 Verificando entrega...',
                { parse_mode: 'Markdown' }
              );
              
              // Se conseguiu enviar, o usuário pode receber mensagens
              console.log(`✅ [REENTREGA] Usuário ${user.telegram_id} pode receber mensagens`);
              
              // Deletar mensagem de teste
              try {
                await ctx.telegram.deleteMessage(user.telegram_id, testMessage.message_id);
              } catch (deleteErr) {
                // Ignorar erro ao deletar
              }
              
            } catch (testErr) {
              const errorMsg = testErr.message || '';
              // Se o bot foi bloqueado, o usuário não pode receber
              if (errorMsg.includes('bot was blocked') || errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
                console.log(`⚠️ [REENTREGA] Bot bloqueado pelo usuário ${user.telegram_id} - produto não foi recebido`);
                skipReason = 'Bot bloqueado pelo usuário';
                shouldReDeliver = false;
              } else {
                // Outro erro - tentar mesmo assim
                console.log(`⚠️ [REENTREGA] Erro ao verificar usuário ${user.telegram_id}: ${errorMsg} - tentando reentregar mesmo assim`);
                shouldReDeliver = true; // Tentar mesmo assim
              }
            }
          }
          
          // Se não deve reentregar, pular
          if (!shouldReDeliver) {
            console.log(`⏭️ [REENTREGA] Pulando TXID ${tx.txid} - ${skipReason}`);
            skippedCount++;
            continue;
          }
          
          // 🆕 VERIFICAR SE O PRODUTO FOI REALMENTE ENTREGUE
          // Comparar data de entrega com data atual - se foi entregue há muito tempo, pode ter sido recebido
          // Mas vamos reentregar mesmo assim se o usuário pode receber (pode ter sido perdido)
          
          console.log(`📤 [REENTREGA] Reentregando ${product.name} para ${user.first_name} (${user.telegram_id}) - TXID: ${tx.txid}`);
          console.log(`✅ [REENTREGA] Comprovante verificado: ${tx.proof_received_at ? 'Sim' : 'Não'}`);
          console.log(`✅ [REENTREGA] Validação verificada: ${tx.validated_at ? 'Sim' : 'Não'}`);
          console.log(`✅ [REENTREGA] Usuário pode receber mensagens: Sim`);
          
          // Reentregar usando deliverContent
          await deliver.deliverContent(
            user.telegram_id,
            product,
            `✅ *REENTREGA DE PRODUTO*\n\n📦 ${product.name}\n💰 Valor: R$ ${tx.amount}\n🆔 TXID: ${tx.txid}\n📸 Comprovante: ✅ Validado\n\n✅ Produto reentregue com sucesso!`
          );
          
          successCount++;
          
          // Delay entre envios para evitar flood
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (err) {
          errorCount++;
          const errorMsg = err.message || 'Erro desconhecido';
          let userName = 'N/A';
          try {
            const userForError = tx.user_id ? await db.getUserByUUID(tx.user_id) : null;
            userName = userForError?.first_name || 'N/A';
          } catch (userErr) {
            // Ignorar erro ao buscar usuário
          }
          errors.push({
            txid: tx.txid,
            user: userName,
            error: errorMsg
          });
          
          // Se for erro de bot bloqueado, não logar como erro crítico
          if (errorMsg.includes('bot was blocked') || errorMsg.includes('403')) {
            console.log(`⚠️ [REENTREGA] Bot bloqueado pelo usuário ${tx.telegram_id} - ignorando`);
            errorCount--; // Não contar como erro
          } else {
            console.error(`❌ [REENTREGA] Erro ao reentregar TXID ${tx.txid}:`, errorMsg);
          }
        }
        
        // Atualizar progresso a cada 10 entregas
        if ((i + 1) % 10 === 0) {
          try {
            await ctx.editMessageText(`📦 *REENTREGANDO PACKS...*\n\n⏳ Processando: ${i + 1}/${transactions.length}\n✅ Entregues: ${successCount}\n⏭️ Puladas: ${skippedCount}\n❌ Erros: ${errorCount}`, {
              parse_mode: 'Markdown'
            });
          } catch (editErr) {
            // Ignorar erro de edição
          }
        }
      }
      
      // Mensagem final
      let finalMessage = `✅ *REENTREGA CONCLUÍDA!*\n\n`;
      finalMessage += `📊 *Resultado:*\n`;
      finalMessage += `✅ Entregues com sucesso: ${successCount}\n`;
      finalMessage += `⏭️ Puladas: ${skippedCount}\n`;
      finalMessage += `   └─ Bot bloqueado ou sem comprovante/produto\n`;
      finalMessage += `❌ Erros: ${errorCount}\n`;
      finalMessage += `📦 Total processado: ${transactions.length}\n\n`;
      finalMessage += `✅ *Verificações realizadas:*\n`;
      finalMessage += `• Comprovante enviado: ✅\n`;
      finalMessage += `• Transação validada: ✅\n`;
      finalMessage += `• Usuário pode receber mensagens: ✅\n`;
      finalMessage += `• Produto reentregue: ✅\n\n`;
      
      if (errors.length > 0 && errors.length <= 10) {
        finalMessage += `⚠️ *Erros encontrados:*\n`;
        errors.slice(0, 10).forEach(err => {
          finalMessage += `• ${err.user} (${err.txid}): ${err.error.substring(0, 50)}\n`;
        });
      }
      
      return ctx.editMessageText(finalMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '⬅️ Voltar ao Painel', callback_data: 'admin_refresh' }
          ]]
        }
      });
      
    } catch (err) {
      console.error('Erro ao reentregar packs:', err);
      return ctx.editMessageText(`❌ *Erro ao reentregar packs*\n\nErro: ${err.message}\n\nVerifique os logs para mais detalhes.`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [[
            { text: '⬅️ Voltar ao Painel', callback_data: 'admin_refresh' }
          ]]
        }
      });
    }
  });

  // ===== CANCELAR REENTREGA =====
  bot.action('cancel_reentregar_packs', async (ctx) => {
    try {
      await ctx.answerCbQuery('❌ Cancelado');
      return ctx.editMessageText('❌ Reentrega cancelada.', {
        reply_markup: {
          inline_keyboard: [[
            { text: '⬅️ Voltar ao Painel', callback_data: 'admin_refresh' }
          ]]
        }
      });
    } catch (err) {
      console.error('Erro ao cancelar reentrega:', err);
    }
  });

  // ===== ACTIONS DO PAINEL ADMIN =====
  
  bot.action('admin_pendentes', async (ctx) => {
    await ctx.answerCbQuery('⏳ Carregando pendentes...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const pendingResult = await db.getPendingTransactions(10, 0);
      const pending = pendingResult.data || [];
      
      if (pending.length === 0) {
        return ctx.reply('✅ Nenhuma transação pendente!');
      }
      
      let message = `⏳ *${pendingResult.total} TRANSAÇÕES PENDENTES* (mostrando ${pending.length}):\n\n`;
      
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
    try {
      await ctx.answerCbQuery('📊 Carregando estatísticas...');
    } catch (err) {
      // Ignorar erro de callback query expirado
    }
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

📅 *Hoje:*
💰 Vendas: R$ ${stats.todaySales || '0.00'}
📦 Transações: ${stats.todayTransactions || 0}

🔄 *Atualização:* Automática em tempo real
📅 *Última atualização:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('🔄 Recalcular Valores', 'admin_recalcular_valores')
        ],
        [
          Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')
        ]
      ]);
      
      try {
        return ctx.editMessageText(message, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        });
      } catch (editErr) {
        return ctx.reply(message, { 
          parse_mode: 'Markdown',
          reply_markup: keyboard.reply_markup
        });
      }
    } catch (err) {
      console.error('Erro ao buscar stats:', err);
      return ctx.reply('❌ Erro ao buscar estatísticas.');
    }
  });
  
  // Recalcular valores de vendas
  bot.action('admin_recalcular_valores', async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Recalculando...');
    } catch (err) {
      // Ignorar erro de callback query expirado
    }
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      await ctx.editMessageText('🔄 *RECALCULANDO VALORES...*\n\n⏳ Aguarde, isso pode levar alguns segundos...', {
        parse_mode: 'Markdown'
      });
      
      const result = await db.recalculateTotalSales();
      const stats = await db.getStats();
      
      let fixedMessage = '';
      if (result.fixed && result.fixed > 0) {
        fixedMessage = `\n🔧 *Correções:* ${result.fixed} transação(ões) corrigida(s) automaticamente`;
      }
      
      const message = `✅ *VALORES RECALCULADOS COM SUCESSO!*
━━━━━━━━━━━━━━━━━━━━━

📊 *Resultado do recálculo:*
💰 Total de vendas: R$ ${result.totalSales}
📦 Total de transações: ${result.totalTransactions}
📅 Vendas de hoje: R$ ${result.todaySales} (${result.todayTransactions} transações)${fixedMessage}

📊 *Estatísticas Atualizadas:*
👥 Usuários: ${stats.totalUsers}
💳 Transações: ${stats.totalTransactions}
⏳ Pendentes: ${stats.pendingTransactions}
💰 Total em vendas: R$ ${stats.totalSales}
💵 Ticket médio: R$ ${stats.avgTicket || '0.00'}

🔄 *Sistema:* Atualização automática em tempo real
📅 *Recalculado em:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;
      
      const keyboard = Markup.inlineKeyboard([
        [
          Markup.button.callback('📊 Ver Estatísticas', 'admin_stats')
        ],
        [
          Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')
        ]
      ]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        reply_markup: keyboard.reply_markup
      });
    } catch (err) {
      console.error('Erro ao recalcular valores:', err);
      return ctx.editMessageText('❌ Erro ao recalcular valores. Verifique os logs.', {
        reply_markup: {
          inline_keyboard: [[
            Markup.button.callback('🔙 Voltar', 'admin_refresh')
          ]]
        }
      });
    }
  });

  bot.action('admin_produtos', async (ctx) => {
    await ctx.answerCbQuery('🛍️ Carregando produtos...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const products = await db.getAllProducts(true);
      
      if (products.length === 0) {
        return ctx.editMessageText('📦 Nenhum produto cadastrado.', {
          ...Markup.inlineKeyboard([
            [Markup.button.callback('➕ Criar Produto', 'admin_novoproduto')],
            [Markup.button.callback('🔙 Voltar', 'admin_refresh')]
          ])
        });
      }
      
      let message = `🛍️ *PRODUTOS CADASTRADOS:* ${products.length}\n\n`;
      
      const buttons = [];
      
      for (const product of products) {
        const status = product.is_active ? '✅' : '❌';
        
        // Determinar tipo de entrega de forma limpa
        let deliveryDisplay = '';
        if (product.delivery_type === 'file') {
          deliveryDisplay = '📦 Arquivo ZIP';
        } else if (product.delivery_url && product.delivery_url.startsWith('http')) {
          deliveryDisplay = '🔗 Link/URL';
        } else {
          deliveryDisplay = '⚠️ Não configurada';
        }
        
        message += `${status} *${product.name}*\n`;
        message += `🆔 ID: \`${product.product_id}\`\n`;
        message += `💰 Preço: R$ ${parseFloat(product.price).toFixed(2)}\n`;
        message += `📝 Descrição: ${product.description || 'Não tem'}\n`;
        message += `📦 Entrega: ${deliveryDisplay}\n`;
        message += `——————————\n\n`;
        
        // Adicionar botões para cada produto
        buttons.push([
          Markup.button.callback(`✏️ Editar ${product.name}`, `edit_product:${product.product_id}`),
          Markup.button.callback(`🗑️ Deletar`, `delete_product:${product.product_id}`)
        ]);
      }
      
      // Botões de ação geral
      buttons.push([Markup.button.callback('➕ Novo Produto', 'admin_novoproduto')]);
      buttons.push([Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao listar produtos:', err);
      return ctx.reply('❌ Erro ao buscar produtos.');
    }
  });

  bot.action('admin_novoproduto', async (ctx) => {
    await ctx.answerCbQuery('➕ Iniciando criação...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    // Iniciar sessão de criação
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'create_product',
      step: 'name',
      data: {}
    };
    
    return ctx.reply(`➕ *CRIAR NOVO PRODUTO*

Vamos criar um novo produto passo a passo.

*Passo 1:* Digite o *NOME* do produto:

Exemplo: Pack Premium VIP

Cancelar: /cancelar`, { parse_mode: 'Markdown' });
  });
  
  // Handler para editar produto via botão
  bot.action(/^edit_product:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('✏️ Carregando produto...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      const product = await db.getProduct(productId, true);
      
      if (!product) {
        return ctx.reply(`❌ Produto não encontrado: ${productId}`);
      }
      
      // Iniciar sessão de edição
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_product',
        step: 'field',
        data: { productId, product }
      };
      
      const statusText = product.is_active ? '🟢 Ativo' : '🔴 Inativo';
      
      // Determinar tipo de entrega de forma limpa
      let deliveryDisplay = '';
      if (product.delivery_type === 'file') {
        deliveryDisplay = '📦 Arquivo ZIP';
      } else if (product.delivery_url && product.delivery_url.startsWith('http')) {
        deliveryDisplay = '🔗 Link/URL';
      } else {
        deliveryDisplay = '⚠️ Não configurada';
      }
      
      const message = `✏️ *EDITAR PRODUTO*

*Produto:* ${product.name}
*Status:* ${statusText}

📋 *Detalhes atuais:*
💰 Preço: R$ ${parseFloat(product.price).toFixed(2)}
📝 Descrição: ${product.description || 'Não tem'}
📦 Entrega: ${deliveryDisplay}

*O que deseja editar?*`;

      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('📝 Nome', `edit_field:name:${productId}`),
            Markup.button.callback('💰 Preço', `edit_field:price:${productId}`)
          ],
          [
            Markup.button.callback('📄 Descrição', `edit_field:description:${productId}`),
            Markup.button.callback('🔗 URL/Arquivo', `edit_field:url:${productId}`)
          ],
          [
            Markup.button.callback(product.is_active ? '🔴 Desativar' : '🟢 Ativar', `toggle_product:${productId}`)
          ],
          [
            Markup.button.callback('🔙 Voltar', 'admin_produtos')
          ]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao editar produto:', err);
      return ctx.reply('❌ Erro ao carregar produto.');
    }
  });
  
  // Handler para deletar produto via botão (AUTOMÁTICO)
  bot.action(/^delete_product:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🗑️ Deletando produto...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      const product = await db.getProduct(productId, true);
      
      if (!product) {
        return ctx.reply(`❌ Produto não encontrado: ${productId}`);
      }
      
      console.log(`🗑️ [DELETE] Deletando produto ${productId} automaticamente...`);
      
      // Deletar produto (cascata deleta transações também)
      const deleted = await db.deleteProduct(productId);
      
      if (deleted) {
        // Se o produto tinha arquivo no Telegram, deletar também
        if (product.delivery_url && product.delivery_url.startsWith('telegram_file:')) {
          try {
            const fileId = product.delivery_url.replace('telegram_file:', '');
            console.log(`🗑️ [DELETE] Arquivo do Telegram marcado para remoção: ${fileId.substring(0, 30)}...`);
            // Nota: Telegram não permite deletar arquivos enviados, mas removemos a referência
          } catch (fileErr) {
            console.error('Aviso: Não foi possível remover arquivo do Telegram:', fileErr);
          }
        }
        
        await ctx.reply(`✅ *Produto deletado com sucesso!*

🛍️ ${product.name}
🆔 ID: \`${productId}\`

🗑️ Produto removido permanentemente do banco de dados.

${product.delivery_type === 'file' ? '📎 Arquivo também foi removido das referências.' : ''}`, {
          parse_mode: 'Markdown'
        });
        
        // Atualizar lista de produtos
        return bot.handleUpdate({
          callback_query: {
            ...ctx.callbackQuery,
            data: 'admin_produtos'
          }
        });
        
      } else {
        return ctx.reply('❌ Erro ao deletar produto.');
      }
      
    } catch (err) {
      console.error('Erro ao deletar produto:', err);
      return ctx.reply('❌ Erro ao deletar produto.');
    }
  });
  
  // Handler para alternar status do produto (ativar/desativar)
  bot.action(/^toggle_product:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🔄 Alterando status...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const productId = ctx.match[1];
      const product = await db.getProduct(productId, true);
      
      if (!product) {
        return ctx.reply(`❌ Produto não encontrado: ${productId}`);
      }
      
      const newStatus = !product.is_active;
      await db.updateProduct(productId, { is_active: newStatus });
      
      return ctx.reply(`✅ Produto ${newStatus ? '*ativado*' : '*desativado*'} com sucesso!\n\n🛍️ ${product.name}`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao alternar status:', err);
      return ctx.reply('❌ Erro ao alterar status.');
    }
  });
  
  // Handler para editar campos via botão
  bot.action(/^edit_field:(.+):(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const field = ctx.match[1];
      const productId = ctx.match[2];
      
      const product = await db.getProduct(productId, true);
      if (!product) {
        return ctx.reply(`❌ Produto não encontrado: ${productId}`);
      }
      
      // Iniciar sessão de edição
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'edit_product',
        step: 'edit_value',
        data: { productId, product, field }
      };
      
      const prompts = {
        'name': '📝 Digite o novo *nome* do produto:',
        'price': '💰 Digite o novo *preço* (apenas números):',
        'description': '📄 Digite a nova *descrição* (ou "-" para remover):',
        'url': '🔗 Digite a nova *URL* ou envie um *arquivo*:'
      };
      
      return ctx.reply(`${prompts[field]}\n\n_Cancelar: /cancelar_`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao editar campo:', err);
      return ctx.reply('❌ Erro ao editar campo.');
    }
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
      const [usersResult, pendingResult] = await Promise.all([
        db.getRecentUsers(10, 0),
        db.getPendingTransactions(10, 0)
      ]);
      
      const users = usersResult.data || [];
      const pending = pendingResult.data || [];
      
      let message = `👥 *GERENCIAR USUÁRIOS E TRANSAÇÕES*\n\n`;
      
      // Seção de transações pendentes
      if (pending && pending.length > 0) {
        message += `⏳ *TRANSAÇÕES PENDENTES: ${pendingResult.total}* (mostrando ${pending.length})\n\n`;
        
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
      message += `👥 *ÚLTIMOS USUÁRIOS: ${usersResult.total}* (mostrando ${users.length})\n\n`;
      
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
    
    try {
      const message = `📢 *BROADCAST*

Digite a mensagem que deseja enviar para todos os usuários:

💡 *Dica:* Você pode usar formatação Markdown:
• \`*negrito*\` para **negrito**
• \`_itálico_\` para _itálico_
• \`\`\`código\`\`\` para \`código\`

_Cancelar:_ /cancelar`;

      // Criar sessão para capturar mensagem
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'admin_broadcast',
        step: 'waiting_message'
      };
      
      try {
        return await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'cancel_admin_broadcast')]
          ])
        });
      } catch (editErr) {
        if (editErr.message && editErr.message.includes('message is not modified')) {
          console.log('ℹ️ [BROADCAST] Mensagem já está atualizada');
          return;
        }
        // Se falhou ao editar, tentar enviar nova mensagem
        console.log('⚠️ [BROADCAST] Erro ao editar, enviando nova mensagem');
        return await ctx.reply(message, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'cancel_admin_broadcast')]
          ])
        });
      }
    } catch (err) {
      console.error('Erro no broadcast:', err);
      return ctx.reply('❌ Erro ao carregar opções de broadcast.');
    }
  });
  
  // Confirmar broadcast do admin
  bot.action('confirm_admin_broadcast', async (ctx) => {
    await ctx.answerCbQuery('📤 Enviando...');
    
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    const session = global._SESSIONS && global._SESSIONS[ctx.from.id];
    if (!session || !session.data || !session.data.message) {
      return ctx.reply('❌ Sessão expirada. Tente novamente.');
    }
    
    try {
      const message = session.data.message;
      
      // Buscar todos os usuários não bloqueados
      const { data: users, error } = await db.supabase
        .from('users')
        .select('telegram_id')
        .eq('is_blocked', false);
      
      if (error) throw error;
      
      let sent = 0;
      let failed = 0;
      
      await ctx.reply(`📤 Enviando broadcast para ${users.length} usuários...\n\n⏳ Aguarde...`);
      
      for (const user of users) {
        try {
          await ctx.telegram.sendMessage(user.telegram_id, message, { parse_mode: 'Markdown' });
          sent++;
          // Rate limit para evitar bloqueio do Telegram
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (err) {
          failed++;
          // Não logar como erro se o bot foi bloqueado pelo usuário (comportamento esperado)
          if (err.message && err.message.includes('bot was blocked by the user')) {
            // Silencioso - apenas contar como falha
          } else {
            // Logar apenas erros reais (não relacionados a bloqueio)
            console.error(`❌ [BROADCAST] Erro ao enviar para ${user.telegram_id}:`, err.message);
          }
        }
      }
      
      // Limpar sessão
      delete global._SESSIONS[ctx.from.id];
      
      return ctx.reply(`✅ *BROADCAST CONCLUÍDO!*

📊 *Estatísticas:*
✔️ Enviados: ${sent}
❌ Falharam: ${failed}
📝 Total: ${users.length}`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
        ])
      });
    } catch (err) {
      console.error('❌ [BROADCAST] Erro ao enviar:', err);
      
      // Limpar sessão
      if (global._SESSIONS && global._SESSIONS[ctx.from.id]) {
        delete global._SESSIONS[ctx.from.id];
      }
      
      return ctx.reply('❌ Erro ao enviar broadcast. Tente novamente.');
    }
  });
  
  // Cancelar broadcast
  bot.action('cancel_admin_broadcast', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    
    // Limpar sessão
    if (global._SESSIONS && global._SESSIONS[ctx.from.id]) {
      delete global._SESSIONS[ctx.from.id];
    }
    
    // Voltar ao painel
    return bot.handleUpdate({ 
      ...ctx.update, 
      callback_query: { 
        ...ctx.update.callback_query, 
        data: 'admin_refresh' 
      } 
    });
  });

  // ===== CUPONS (ADMIN) =====
  bot.action('admin_coupons', async (ctx) => {
    await ctx.answerCbQuery('🎟️ Carregando cupons...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      // Buscar todos os cupons
      const { data: coupons, error } = await db.supabase
        .from('coupons')
        .select('*, products:product_id(name), media_packs:media_pack_id(name), users:created_by(first_name, username)')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      let message = `🎟️ *GERENCIAR CUPONS*\n\n`;
      
      if (!coupons || coupons.length === 0) {
        message += `Nenhum cupom criado ainda.\n\n`;
      } else {
        message += `📋 *Cupons cadastrados (últimos 20):*\n\n`;
        
        for (const coupon of coupons) {
          const status = coupon.is_active ? '✅' : '❌';
          const productName = coupon.products?.name || coupon.media_packs?.name || 'Produto removido';
          const uses = coupon.max_uses ? `${coupon.current_uses}/${coupon.max_uses}` : `${coupon.current_uses}/∞`;
          const creator = coupon.users ? `${coupon.users.first_name || coupon.users.username || 'N/A'}` : 'Admin';
          
          message += `${status} \`${coupon.code}\`\n`;
          message += `   💰 ${coupon.discount_percentage}% de desconto\n`;
          message += `   📦 ${productName}\n`;
          message += `   📊 Usos: ${uses}\n`;
          message += `   👤 Criador: ${creator}\n`;
          if (coupon.expires_at) {
            const expiresAt = new Date(coupon.expires_at);
            const isExpired = expiresAt < new Date();
            message += `   ⏰ ${isExpired ? '🔴 Expirado' : 'Expira'}: ${expiresAt.toLocaleDateString('pt-BR')}\n`;
          }
          message += `\n`;
        }
      }
      
      // Estatísticas gerais
      const { data: allCoupons } = await db.supabase
        .from('coupons')
        .select('id, current_uses, max_uses, is_active');
      
      const { data: usage } = await db.supabase
        .from('coupon_usage')
        .select('discount_amount');
      
      const totalCoupons = allCoupons?.length || 0;
      const activeCoupons = allCoupons?.filter(c => c.is_active && c.current_uses < (c.max_uses || Infinity)).length || 0;
      const totalUses = usage?.length || 0;
      const totalDiscount = usage?.reduce((sum, u) => sum + parseFloat(u.discount_amount), 0) || 0;
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `📊 *Estatísticas gerais:*\n`;
      message += `🎟️ Total de cupons: ${totalCoupons}\n`;
      message += `✅ Cupons ativos: ${activeCoupons}\n`;
      message += `📈 Total de usos: ${totalUses}\n`;
      message += `💰 Desconto total: R$ ${totalDiscount.toFixed(2)}\n\n`;
      message += `Selecione uma opção:`;
      
      const buttons = [
        [Markup.button.callback('➕ Novo Cupom', 'admin_new_coupon')],
        [Markup.button.callback('🗑️ Desativar Cupons Expirados', 'admin_cleanup_coupons')],
        [Markup.button.callback('🔙 Voltar', 'admin_refresh')]
      ];
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao listar cupons:', err);
      return ctx.reply('❌ Erro ao carregar cupons.');
    }
  });
  
  // Criar novo cupom (admin)
  bot.action('admin_new_coupon', async (ctx) => {
    await ctx.answerCbQuery('➕ Use o painel criador para criar cupons');
    return ctx.reply('➕ Para criar cupons, use o comando /criador e acesse a seção de cupons.\n\nIsso garante que os cupons sejam associados corretamente ao criador.');
  });
  
  // Limpar cupons expirados
  bot.action('admin_cleanup_coupons', async (ctx) => {
    await ctx.answerCbQuery('🗑️ Limpando cupons expirados...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    try {
      const now = new Date().toISOString();
      
      // Desativar cupons expirados
      const { data, error } = await db.supabase
        .from('coupons')
        .update({ is_active: false })
        .lt('expires_at', now)
        .eq('is_active', true)
        .select();
      
      if (error) throw error;
      
      const count = data?.length || 0;
      
      return ctx.reply(`✅ Limpeza concluída!\n\n🗑️ ${count} cupom(ns) expirado(s) foi(ram) desativado(s).`, {
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar', 'admin_coupons')]
        ])
      });
    } catch (err) {
      console.error('Erro ao limpar cupons:', err);
      return ctx.reply('❌ Erro ao limpar cupons expirados.');
    }
  });

  // ===== CONFIGURAR SUPORTE =====
  // ===== GERENCIAR TICKETS DE SUPORTE =====
  bot.action('admin_tickets', async (ctx) => {
    try {
      await ctx.answerCbQuery('🎫 Carregando tickets...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const openTickets = await db.getAllOpenTickets(20);
      
      let message = `🎫 *TICKETS DE SUPORTE*

📊 *Tickets Abertos:* ${openTickets.length}

`;
      
      if (openTickets.length === 0) {
        message += `✅ Nenhum ticket aberto no momento.`;
      } else {
        for (const ticket of openTickets.slice(0, 10)) {
          const user = ticket.users || {};
          const statusEmoji = ticket.status === 'open' ? '🟢' : '🟡';
          message += `${statusEmoji} *${ticket.ticket_number}*\n`;
          message += `👤 ${user.first_name || 'N/A'} (@${user.username || 'N/A'})\n`;
          message += `📝 ${ticket.subject || 'Sem assunto'}\n`;
          message += `📅 ${new Date(ticket.created_at).toLocaleDateString('pt-BR')}\n\n`;
        }
      }
      
      const buttons = [];
      for (const ticket of openTickets.slice(0, 5)) {
        buttons.push([Markup.button.callback(
          `📋 ${ticket.ticket_number} - ${ticket.subject?.substring(0, 30) || 'Sem assunto'}...`,
          `admin_view_ticket_${ticket.id}`
        )]);
      }
      buttons.push([
        Markup.button.callback('🔄 Atualizar', 'admin_tickets'),
        Markup.button.callback('🔙 Voltar', 'admin_refresh')
      ]);
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup
      });
    } catch (err) {
      console.error('❌ [ADMIN-TICKETS] Erro:', err);
      return ctx.reply('❌ Erro ao carregar tickets.');
    }
  });
  
  // Ver ticket específico (admin)
  bot.action(/^admin_view_ticket_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const ticketId = ctx.match[1];
      const ticket = await db.getSupportTicket(ticketId);
      
      if (!ticket) {
        return ctx.reply('❌ Ticket não encontrado.');
      }
      
      const messages = await db.getTicketMessages(ticketId);
      const user = await db.getUserByTelegramId(ticket.telegram_id);
      
      // Escapar caracteres especiais do Markdown
      const escapeMarkdown = (text) => {
        if (!text) return '';
        return String(text)
          .replace(/\*/g, '\\*')
          .replace(/_/g, '\\_')
          .replace(/\[/g, '\\[')
          .replace(/\]/g, '\\]')
          .replace(/\(/g, '\\(')
          .replace(/\)/g, '\\)')
          .replace(/~/g, '\\~')
          .replace(/`/g, '\\`');
      };
      
      const ticketNumber = escapeMarkdown(ticket.ticket_number);
      const userName = escapeMarkdown(user?.first_name || 'N/A');
      const userUsername = escapeMarkdown(user?.username || 'N/A');
      const subject = escapeMarkdown(ticket.subject || 'Sem assunto');
      
      let message = `📋 *TICKET ${ticketNumber}*\n\n`;
      message += `👤 *Usuário:* ${userName} (@${userUsername})\n`;
      message += `🆔 *ID:* ${ticket.telegram_id}\n`;
      message += `📝 *Assunto:* ${subject}\n`;
      message += `📊 *Status:* ${ticket.status === 'open' ? '🟢 Aberto' : ticket.status === 'in_progress' ? '🟡 Em andamento' : ticket.status === 'resolved' ? '✅ Resolvido' : '🔴 Fechado'}\n`;
      message += `📅 *Criado:* ${new Date(ticket.created_at).toLocaleString('pt-BR')}\n\n`;
      message += `💬 *Conversa:*\n\n`;
      
      for (const msg of messages) {
        const sender = msg.is_admin ? '👨\\u200d💼 Admin' : '👤 Cliente';
        const dateStr = new Date(msg.created_at).toLocaleString('pt-BR');
        message += `${sender} \\(${dateStr}\\):\n`;
        // Escapar caracteres especiais do Markdown na mensagem
        const escapedMessage = escapeMarkdown(msg.message);
        message += `${escapedMessage}\n\n`;
      }
      
      const buttons = [];
      if (ticket.status !== 'closed') {
        buttons.push([Markup.button.callback('💬 Responder', `admin_reply_ticket_${ticketId}`)]);
        if (ticket.status === 'open') {
          buttons.push([Markup.button.callback('✅ Atribuir a Mim', `admin_assign_ticket_${ticketId}`)]);
        }
        buttons.push([
          Markup.button.callback('✅ Resolver', `admin_resolve_ticket_${ticketId}`),
          Markup.button.callback('🔴 Fechar', `admin_close_ticket_${ticketId}`)
        ]);
      }
      buttons.push([
        Markup.button.callback('🎫 Todos os Tickets', 'admin_tickets'),
        Markup.button.callback('🔙 Voltar', 'admin_refresh')
      ]);
      
      // Tentar editar a mensagem, se falhar, enviar nova mensagem
      try {
        return await ctx.editMessageText(message, {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard(buttons).reply_markup
        });
      } catch (editErr) {
        // Se falhar ao editar (mensagem muito antiga ou erro de parsing), enviar nova mensagem
        if (editErr.message && (editErr.message.includes('can\'t parse entities') || editErr.message.includes('message is not modified') || editErr.message.includes('message to edit not found'))) {
          return ctx.reply(message, {
            parse_mode: 'Markdown',
            reply_markup: Markup.inlineKeyboard(buttons).reply_markup
          });
        }
        throw editErr;
      }
    } catch (err) {
      console.error('❌ [ADMIN-TICKET] Erro:', err);
      return ctx.reply('❌ Erro ao visualizar ticket.');
    }
  });
  
  // Atribuir ticket
  bot.action(/^admin_assign_ticket_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('✅ Atribuindo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const ticketId = ctx.match[1];
      const user = await db.getUserByTelegramId(ctx.from.id);
      
      await db.assignTicket(ticketId, user.id);
      
      const ticket = await db.getSupportTicket(ticketId);
      
      // Notificar usuário
      try {
        await ctx.telegram.sendMessage(ticket.telegram_id, 
          `✅ *Seu ticket foi atribuído a um admin*\n\n📋 Ticket: ${ticket.ticket_number}\n\n⏳ Um admin está analisando seu caso e responderá em breve.`, {
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Erro ao notificar usuário:', err);
      }
      
      return ctx.reply(`✅ Ticket ${ticket.ticket_number} atribuído a você!`, {
        reply_markup: {
          inline_keyboard: [[
            { text: '📋 Ver Ticket', callback_data: `admin_view_ticket_${ticketId}` }
          ]]
        }
      });
    } catch (err) {
      console.error('❌ [ADMIN-TICKET] Erro:', err);
      return ctx.reply('❌ Erro ao atribuir ticket.');
    }
  });
  
  // Responder ticket (admin)
  bot.action(/^admin_reply_ticket_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const ticketId = ctx.match[1];
      
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'admin_reply_ticket',
        ticketId: ticketId
      };
      
      // Tentar editar a mensagem, se falhar, enviar nova mensagem
      try {
        return await ctx.editMessageText(`💬 *RESPONDER TICKET*

Digite sua resposta:

_Cancelar: /cancelar_`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '❌ Cancelar', callback_data: 'admin_refresh' }
            ]]
          }
        });
      } catch (editErr) {
        // Se falhar ao editar (mensagem muito antiga ou erro de parsing), enviar nova mensagem
        if (editErr.message && (editErr.message.includes('can\'t parse entities') || editErr.message.includes('message is not modified') || editErr.message.includes('message to edit not found'))) {
          return ctx.reply(`💬 *RESPONDER TICKET*

Digite sua resposta:

_Cancelar: /cancelar_`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ Cancelar', callback_data: 'admin_refresh' }
              ]]
            }
          });
        }
        throw editErr;
      }
    } catch (err) {
      console.error('❌ [ADMIN-TICKET] Erro:', err);
      return ctx.reply('❌ Erro ao responder ticket.');
    }
  });
  
  // Resolver ticket
  bot.action(/^admin_resolve_ticket_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('✅ Resolvendo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const ticketId = ctx.match[1];
      const user = await db.getUserByTelegramId(ctx.from.id);
      
      await db.updateTicketStatus(ticketId, 'resolved', user.id);
      
      const ticket = await db.getSupportTicket(ticketId);
      
      // Notificar usuário
      try {
        await ctx.telegram.sendMessage(ticket.telegram_id, 
          `✅ *Seu ticket foi resolvido*\n\n📋 Ticket: ${ticket.ticket_number}\n\n✅ O problema foi resolvido. Se precisar de mais ajuda, abra um novo ticket.`, {
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Erro ao notificar usuário:', err);
      }
      
      return ctx.reply(`✅ Ticket ${ticket.ticket_number} marcado como resolvido!`);
    } catch (err) {
      console.error('❌ [ADMIN-TICKET] Erro:', err);
      return ctx.reply('❌ Erro ao resolver ticket.');
    }
  });
  
  // Fechar ticket
  bot.action(/^admin_close_ticket_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🔴 Fechando...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const ticketId = ctx.match[1];
      const user = await db.getUserByTelegramId(ctx.from.id);
      
      await db.updateTicketStatus(ticketId, 'closed', user.id);
      
      const ticket = await db.getSupportTicket(ticketId);
      
      // Notificar usuário
      try {
        await ctx.telegram.sendMessage(ticket.telegram_id, 
          `🔴 *Seu ticket foi fechado*\n\n📋 Ticket: ${ticket.ticket_number}\n\nSe precisar de mais ajuda, abra um novo ticket.`, {
          parse_mode: 'Markdown'
        });
      } catch (err) {
        console.error('Erro ao notificar usuário:', err);
      }
      
      return ctx.reply(`🔴 Ticket ${ticket.ticket_number} fechado!`);
    } catch (err) {
      console.error('❌ [ADMIN-TICKET] Erro:', err);
      return ctx.reply('❌ Erro ao fechar ticket.');
    }
  });
  
  // ===== GERENCIAR USUÁRIOS CONFIÁVEIS =====
  bot.action('admin_trusted_users', async (ctx) => {
    try {
      await ctx.answerCbQuery('⭐ Carregando usuários confiáveis...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const { data: trustedUsers, error } = await db.supabase
        .from('trusted_users')
        .select(`
          *,
          users:user_id (first_name, username, telegram_id)
        `)
        .order('trust_score', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      
      let message = `⭐ *USUÁRIOS CONFIÁVEIS*\n\n`;
      message += `📊 Total: ${trustedUsers?.length || 0} usuários\n\n`;
      
      if (!trustedUsers || trustedUsers.length === 0) {
        message += `Nenhum usuário confiável cadastrado ainda.\n\n`;
        message += `*Como funciona:*\n`;
        message += `• Usuários ganham confiança ao ter comprovantes aprovados\n`;
        message += `• Quanto maior a confiança, menor o threshold para aprovação automática\n`;
        message += `• Você pode adicionar usuários manualmente à whitelist`;
      } else {
        for (const trusted of trustedUsers.slice(0, 10)) {
          const user = trusted.users || {};
          const score = parseFloat(trusted.trust_score) || 0;
          const emoji = score >= 80 ? '🟢' : score >= 60 ? '🟡' : '🔴';
          message += `${emoji} *${user.first_name || 'N/A'}* (@${user.username || 'N/A'})\n`;
          message += `⭐ Score: ${score.toFixed(1)}/100\n`;
          message += `✅ Aprovadas: ${trusted.approved_transactions || 0} | ❌ Rejeitadas: ${trusted.rejected_transactions || 0}\n`;
          message += `🎯 Threshold: ${parseFloat(trusted.auto_approve_threshold || 60).toFixed(0)}%\n\n`;
        }
      }
      
      const buttons = [];
      if (trustedUsers && trustedUsers.length > 0) {
        buttons.push([Markup.button.callback('➕ Adicionar à Whitelist', 'admin_add_trusted')]);
      }
      buttons.push([
        Markup.button.callback('🔄 Atualizar', 'admin_trusted_users'),
        Markup.button.callback('🔙 Voltar', 'admin_refresh')
      ]);
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup
      });
    } catch (err) {
      console.error('❌ [ADMIN-TRUSTED] Erro:', err);
      return ctx.reply('❌ Erro ao carregar usuários confiáveis.');
    }
  });
  
  // ===== GERENCIAR RESPOSTAS AUTOMÁTICAS =====
  bot.action('admin_auto_responses', async (ctx) => {
    try {
      await ctx.answerCbQuery('🤖 Carregando respostas automáticas...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const responses = await db.getAllAutoResponses();
      
      let message = `🤖 *RESPOSTAS AUTOMÁTICAS (FAQ)*\n\n`;
      message += `📊 Total: ${responses.length} respostas\n\n`;
      
      if (responses.length === 0) {
        message += `Nenhuma resposta automática cadastrada.\n\n`;
        message += `*Como funciona:*\n`;
        message += `• O bot responde automaticamente a palavras-chave\n`;
        message += `• Útil para perguntas frequentes\n`;
        message += `• Reduz carga de suporte`;
      } else {
        for (const resp of responses.slice(0, 10)) {
          const status = resp.is_active ? '🟢' : '🔴';
          message += `${status} *${resp.keyword}*\n`;
          message += `📝 ${resp.response.substring(0, 50)}${resp.response.length > 50 ? '...' : ''}\n`;
          message += `📊 Uso: ${resp.usage_count || 0} vezes | Prioridade: ${resp.priority || 0}\n\n`;
        }
      }
      
      const buttons = [
        [Markup.button.callback('➕ Nova Resposta', 'admin_add_auto_response')],
        [
          Markup.button.callback('🔄 Atualizar', 'admin_auto_responses'),
          Markup.button.callback('🔙 Voltar', 'admin_refresh')
        ]
      ];
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup
      });
    } catch (err) {
      console.error('❌ [ADMIN-AUTO-RESPONSES] Erro:', err);
      return ctx.reply('❌ Erro ao carregar respostas automáticas.');
    }
  });
  
  // Adicionar resposta automática
  bot.action('admin_add_auto_response', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      global._SESSIONS = global._SESSIONS || {};
      global._SESSIONS[ctx.from.id] = {
        type: 'add_auto_response',
        step: 'keyword'
      };
      
      return ctx.reply(`🤖 *NOVA RESPOSTA AUTOMÁTICA*

📝 *Passo 1/3: Palavra-chave*

Digite a palavra-chave que deve ativar esta resposta (ex: "entrega", "pix", "produto"):

_Cancelar: /cancelar`, {
        parse_mode: 'Markdown'
      });
    } catch (err) {
      console.error('❌ [ADMIN-AUTO-RESPONSES] Erro:', err);
      return ctx.reply('❌ Erro ao criar resposta automática.');
    }
  });
  
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

      const buttons = [];
      
      if (groups.length === 0) {
        message += `📦 Nenhum grupo cadastrado ainda.

Clique no botão abaixo para cadastrar o primeiro grupo.`;
        
        buttons.push([Markup.button.callback('➕ Novo Grupo', 'admin_novogrupo')]);
      } else {
        for (const group of groups) {
          const status = group.is_active ? '✅' : '❌';
          message += `${status} *${group.group_name || 'Sem nome'}*
🆔 ID: \`${group.group_id}\`
💰 Preço: R$ ${parseFloat(group.subscription_price).toFixed(2)}/mês
📅 Dias: ${group.subscription_days}
🔗 ${group.group_link}
──────────────

`;
          
          // Botões para cada grupo
          buttons.push([
            Markup.button.callback(`✏️ Editar ${group.group_name || 'Grupo'}`, `edit_group:${group.id}`),
            Markup.button.callback(`🗑️ Deletar`, `delete_group:${group.id}`)
          ]);
        }
        
        // Botões de ação geral
        buttons.push([Markup.button.callback('➕ Novo Grupo', 'admin_novogrupo')]);
      }
      
      buttons.push([Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]);
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
    } catch (err) {
      console.error('Erro ao listar grupos:', err);
      return ctx.reply('❌ Erro ao buscar grupos.');
    }
  });
  
  // Handler para iniciar criação de grupo via botão
  bot.action('admin_novogrupo', async (ctx) => {
    await ctx.answerCbQuery('➕ Iniciando criação...');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    // Iniciar sessão de criação
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'create_group',
      step: 'group_id',
      data: {}
    };
    
    return ctx.reply(`➕ *CADASTRAR NOVO GRUPO*

*Passo 1/5:* Envie o *ID do grupo/canal*

📝 *Como obter o ID:*
1. Adicione o bot @userinfobot ao grupo/canal
2. Copie o ID que aparece (ex: -1001234567890)
3. Cole aqui

💡 *Dica:* O ID deve ser um número negativo`, { 
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_create_group')]
      ])
    });
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
      ...Markup.inlineKeyboard([
        [Markup.button.callback('❌ Cancelar', 'cancel_create_group')]
      ])
    });
  });
  
  // Handler para cancelar criação de grupo
  bot.action('cancel_create_group', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    delete global._SESSIONS[ctx.from.id];
    
    return ctx.reply('❌ Criação de grupo cancelada.', {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('👥 Gerenciar Grupos', 'admin_groups')],
        [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
      ])
    });
  });
  
  // Handler para deletar grupo via botão
  bot.action(/^delete_group:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('🗑️ Deletando grupo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const groupUuid = ctx.match[1];
      
      // Buscar grupo pelo UUID interno
      const { data: group, error } = await db.supabase
        .from('groups')
        .select('*')
        .eq('id', groupUuid)
        .single();
      
      if (error || !group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }
      
      // Deletar grupo
      const deleted = await db.deleteGroup(group.group_id);
      
      if (deleted) {
        await ctx.reply(`✅ *Grupo deletado com sucesso!*

👥 ${group.group_name || 'Grupo'}
🆔 ID: \`${group.group_id}\`

🗑️ Grupo removido permanentemente do banco de dados.`, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('👥 Ver Grupos', 'admin_groups')],
            [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
          ])
        });
      } else {
        return ctx.reply('❌ Erro ao deletar grupo.');
      }
      
    } catch (err) {
      console.error('Erro ao deletar grupo:', err);
      return ctx.reply('❌ Erro ao deletar grupo.');
    }
  });
  
  // Handler para editar grupo via botão
  bot.action(/^edit_group:(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('✏️ Carregando grupo...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const groupUuid = ctx.match[1];
      
      // Buscar grupo pelo UUID interno
      const { data: group, error } = await db.supabase
        .from('groups')
        .select('*')
        .eq('id', groupUuid)
        .single();
      
      if (error || !group) {
        return ctx.reply('❌ Grupo não encontrado.');
      }
      
      const statusText = group.is_active ? '🟢 Ativo' : '🔴 Inativo';
      
      const message = `✏️ *EDITAR GRUPO*

*Grupo:* ${group.group_name || 'Sem nome'}
*Status:* ${statusText}

📋 *Detalhes atuais:*
🆔 ID: \`${group.group_id}\`
💰 Preço: R$ ${parseFloat(group.subscription_price).toFixed(2)}/mês
📅 Duração: ${group.subscription_days} dias
🔗 Link: ${group.group_link}

*O que deseja editar?*`;

      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('📝 Nome', `edit_group_field:name:${groupUuid}`),
            Markup.button.callback('💰 Preço', `edit_group_field:price:${groupUuid}`)
          ],
          [
            Markup.button.callback('📅 Duração', `edit_group_field:days:${groupUuid}`),
            Markup.button.callback('🔗 Link', `edit_group_field:link:${groupUuid}`)
          ],
          [
            Markup.button.callback(group.is_active ? '🔴 Desativar' : '🟢 Ativar', `toggle_group:${groupUuid}`)
          ],
          [
            Markup.button.callback('🔙 Voltar', 'admin_groups')
          ]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao editar grupo:', err);
      return ctx.reply('❌ Erro ao carregar grupo.');
    }
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
      
      // Permitir aprovação de transações com comprovante (proof_sent) ou expiradas (expired)
      // Se já foi validada/entregue/cancelada, não permitir
      if (!['proof_sent', 'expired', 'pending'].includes(transaction.status)) {
        return ctx.reply(`⚠️ Esta transação já foi processada.\n\nStatus: ${transaction.status}`);
      }
      
      // Se não tem comprovante, avisar admin
      if (!transaction.proof_file_id && transaction.status === 'pending') {
        return ctx.reply(`⚠️ *Atenção!*\n\nEsta transação não tem comprovante enviado.\n\n🆔 TXID: ${txid}\nStatus: ${transaction.status}\n\n❓ Tem certeza que deseja aprovar mesmo assim?\n\n_Responda com:_ /force_approve_${txid}`, {
          parse_mode: 'Markdown'
        });
      }
      
      // Validar transação
      await db.validateTransaction(txid, transaction.user_id);
      
      // 🆕 Atualizar trust score do usuário (aprovado)
      if (transaction.user_id && transaction.telegram_id) {
        try {
          await db.updateTrustedUser(transaction.telegram_id, transaction.user_id, true);
          console.log(`⭐ [TRUST] Trust score atualizado para usuário ${transaction.telegram_id}`);
        } catch (err) {
          console.error('Erro ao atualizar trust score:', err);
        }
      }
      
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
      // 🆕 Verificar se é assinatura/renovação de grupo (via group_id OU product_id antigo)
      const isGroupRenewal = transaction.group_id || 
                            (transaction.product_id && transaction.product_id.startsWith('group_'));
      
      if (isGroupRenewal) {
        let group = null;
        
        // Método novo: usar group_id direto
        if (transaction.group_id) {
          const { data: groupData, error: groupError } = await db.supabase
            .from('groups')
            .select('*')
            .eq('id', transaction.group_id)
            .single();
          
          if (!groupError && groupData) {
            group = groupData;
          }
        }
        
        // Método antigo: usar product_id (compatibilidade)
        if (!group && transaction.product_id && transaction.product_id.startsWith('group_')) {
          const groupTelegramId = parseInt(transaction.product_id.replace('group_', ''));
          group = await db.getGroupById(groupTelegramId);
        }
        
        if (group) {
          console.log(`👥 [ADMIN] Adicionando usuário ${transaction.telegram_id} ao grupo ${group.group_name}`);
          
          // Adicionar ou renovar assinatura no banco (monitoramento de dias)
          await db.addGroupMember({
            telegramId: transaction.telegram_id,
            userId: transaction.user_id,
            groupId: group.id,
            days: group.subscription_days
          });
          
          // Tentar adicionar usuário diretamente ao grupo
          const addedToGroup = await deliver.addUserToGroup(ctx.telegram, transaction.telegram_id, group);
          
          // Notificar usuário - mensagem diferente se foi adicionado automaticamente
          try {
            const { Markup } = require('telegraf');
            
            // Calcular data de expiração
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + group.subscription_days);
            
            // Mensagem única seguindo estrutura da imagem
            const zwsp = '\u200B'; // Zero-width space
            const zwnj = '\u200C'; // Zero-width non-joiner
            await ctx.telegram.sendMessage(transaction.telegram_id, `✅ *ASSINATURA APROVADA!*

👥 Grupo: ${group.group_name}
📅 Acesso válido por: ${group.subscription_days} dias

✅ *Seu acesso foi liberado!*

🔗 *Link direto para entrar:*
${group.group_link}

Clique no botão abaixo ou no link acima para entrar no grupo:

🆔 TXID: ${txid}

${zwsp}${zwnj}${zwsp}`, {
              parse_mode: 'Markdown',
              disable_web_page_preview: false
            });
            
            console.log(`✅ [ADMIN] Mensagem com link enviada ao usuário ${transaction.telegram_id}`);
          } catch (err) {
            console.error('❌ [ADMIN] Erro ao notificar usuário:', err);
            
            // Tentar enviar mensagem simples como fallback
            try {
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + group.subscription_days);
              
              // Mensagem única seguindo estrutura da imagem
              const zwsp = '\u200B'; // Zero-width space
              const zwnj = '\u200C'; // Zero-width non-joiner
              await ctx.telegram.sendMessage(transaction.telegram_id, `✅ *ASSINATURA APROVADA!*

👥 Grupo: ${group.group_name}
📅 Acesso válido por: ${group.subscription_days} dias

✅ *Seu acesso foi liberado!*

🔗 *Link direto para entrar:*
${group.group_link}

Clique no botão abaixo ou no link acima para entrar no grupo:

🆔 TXID: ${txid}

${zwsp}${zwnj}${zwsp}`, {
                parse_mode: 'Markdown',
                disable_web_page_preview: false
              });
            } catch (fallbackErr) {
              console.error('❌ [ADMIN] Erro no fallback:', fallbackErr.message);
            }
          }
        } else {
          console.error(`❌ [ADMIN] Grupo não encontrado para transação ${txid}`);
        }
      } else if (transaction.product_id) {
        // Entregar produto normal - buscar incluindo inativos (transação antiga pode ter produto desativado)
        const product = await db.getProduct(transaction.product_id, true);
        if (product && product.delivery_url) {
          // Usar deliverContent que detecta automaticamente se é arquivo ou link
          await deliver.deliverContent(
            transaction.telegram_id, 
            product, 
            `✅ *PAGAMENTO APROVADO!*\n\n💰 Valor: R$ ${transaction.amount}\n🆔 TXID: ${txid}`
          );
          
          console.log(`✅ Produto entregue com sucesso para ${transaction.telegram_id}`);
        } else {
          // Se não tem produto/URL, notificar mesmo assim
          try {
            await ctx.telegram.sendMessage(transaction.telegram_id, `✅ *PAGAMENTO APROVADO!*

💰 Valor: R$ ${transaction.amount}
⚠️ Aguarde instruções do suporte para receber seu produto.

🆔 TXID: ${txid}`, {
              parse_mode: 'Markdown'
            });
          } catch (err) {
            console.error('Erro ao notificar usuário:', err);
          }
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
      
      // Permitir rejeição de transações com comprovante (proof_sent), expiradas (expired) ou pendentes
      // Se já foi validada/entregue/cancelada, não permitir
      if (!['proof_sent', 'expired', 'pending'].includes(transaction.status)) {
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
        if (transaction.group_id) {
          // É uma transação de grupo
          const { data: groupData } = await db.supabase
            .from('groups')
            .select('group_name')
            .eq('id', transaction.group_id)
            .single();
          productName = groupData?.group_name || 'Grupo';
        } else if (transaction.media_pack_id) {
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
      message += `🆔 ID Usuário: ${user ? user.telegram_id : 'N/A'}\n`;
      message += `🔑 Chave PIX: \`${transaction.pix_key}\`\n`;
      message += `📊 Status: ${transaction.status}\n`;
      message += `📅 Criada: ${new Date(transaction.created_at).toLocaleString('pt-BR')}\n`;
      
      if (transaction.proof_received_at) {
        message += `📸 Comprovante recebido: ${new Date(transaction.proof_received_at).toLocaleString('pt-BR')}\n`;
      }
      
      if (transaction.validated_at) {
        message += `✅ Validado em: ${new Date(transaction.validated_at).toLocaleString('pt-BR')}\n`;
      }
      
      if (transaction.delivered_at) {
        message += `📦 Entregue em: ${new Date(transaction.delivered_at).toLocaleString('pt-BR')}\n`;
      }
      
      // 🆕 Verificar se tem comprovante e tentar recuperar
      const hasProof = transaction.proof_file_id || transaction.proof_file_url;
      const keyboard = [];
      
      if (hasProof) {
        keyboard.push([
          { text: '📸 Ver Comprovante', callback_data: `get_proof_${txid}` }
        ]);
      }
      
      if (transaction.status === 'proof_sent' || transaction.status === 'pending' || transaction.status === 'expired') {
        keyboard.push([
          { text: '✅ Aprovar', callback_data: `approve_${txid}` },
          { text: '❌ Rejeitar', callback_data: `reject_${txid}` }
        ]);
      }
      
      message += `\n*Ações:*\n`;
      message += `✅ /validar${txid} - Aprovar\n`;
      message += `❌ /rejeitar${txid} - Rejeitar`;
      
      return ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
      });
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
      return ctx.reply('❌ Erro ao buscar detalhes.');
    }
  });

  // 🆕 HANDLER PARA RECUPERAR COMPROVANTE
  bot.action(/^get_proof_(.+)$/, async (ctx) => {
    try {
      await ctx.answerCbQuery('📸 Tentando recuperar comprovante...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const txid = ctx.match[1];
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      if (!transaction.proof_file_id && !transaction.proof_file_url) {
        return ctx.reply('❌ Comprovante não encontrado no banco de dados.');
      }
      
      // Tentar recuperar usando File ID primeiro (mais confiável)
      if (transaction.proof_file_id) {
        try {
          console.log(`📸 [GET-PROOF] Tentando recuperar comprovante via File ID: ${transaction.proof_file_id.substring(0, 30)}...`);
          
          // Tentar obter informações do arquivo
          const file = await ctx.telegram.getFile(transaction.proof_file_id);
          
          if (file && file.file_path) {
            // Construir URL temporária
            const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
            
            // Detectar se é PDF ou imagem
            const isPDF = file.file_path.toLowerCase().endsWith('.pdf') || 
                         (transaction.proof_file_url && transaction.proof_file_url.toLowerCase().includes('.pdf'));
            
            // Tentar enviar o arquivo
            if (isPDF) {
              await ctx.reply('📄 *Comprovante em PDF:*', { parse_mode: 'Markdown' });
              await ctx.telegram.sendDocument(ctx.from.id, transaction.proof_file_id, {
                caption: `📄 Comprovante - TXID: ${txid}\n📅 Recebido em: ${transaction.proof_received_at ? new Date(transaction.proof_received_at).toLocaleString('pt-BR') : 'N/A'}`
              });
            } else {
              await ctx.reply('🖼️ *Comprovante em imagem:*', { parse_mode: 'Markdown' });
              await ctx.telegram.sendPhoto(ctx.from.id, transaction.proof_file_id, {
                caption: `🖼️ Comprovante - TXID: ${txid}\n📅 Recebido em: ${transaction.proof_received_at ? new Date(transaction.proof_received_at).toLocaleString('pt-BR') : 'N/A'}`
              });
            }
            
            return ctx.reply(`✅ *Comprovante recuperado com sucesso!*\n\n🆔 TXID: \`${txid}\`\n📎 File ID: \`${transaction.proof_file_id.substring(0, 30)}...\``, { parse_mode: 'Markdown' });
          }
        } catch (fileErr) {
          console.error('❌ [GET-PROOF] Erro ao recuperar via File ID:', fileErr.message);
          
          // Se File ID não funcionar, tentar URL (pode estar expirada)
          if (transaction.proof_file_url) {
            return ctx.reply(`⚠️ *File ID expirado ou inválido*\n\n📎 URL salva: ${transaction.proof_file_url}\n\n❌ URLs do Telegram expiram após algum tempo. O comprovante pode não estar mais acessível.\n\n💡 *Solução:* Implementar salvamento permanente de comprovantes (Supabase Storage) para evitar perda de arquivos.`, { parse_mode: 'Markdown' });
          }
          
          return ctx.reply(`❌ *Não foi possível recuperar o comprovante*\n\n📎 File ID: \`${transaction.proof_file_id.substring(0, 30)}...\`\n\n⚠️ O arquivo pode ter expirado no Telegram (arquivos ficam disponíveis por tempo limitado).\n\n💡 *Recomendação:* Solicitar ao cliente que reenvie o comprovante se necessário.`, { parse_mode: 'Markdown' });
        }
      }
      
      // Se não tem File ID, tentar URL (provavelmente expirada)
      if (transaction.proof_file_url) {
        return ctx.reply(`⚠️ *Comprovante encontrado, mas URL pode estar expirada*\n\n📎 URL: ${transaction.proof_file_url}\n\n❌ URLs do Telegram expiram após algum tempo.\n\n💡 *Solução:* Implementar salvamento permanente de comprovantes.`, { parse_mode: 'Markdown' });
      }
      
      return ctx.reply('❌ Comprovante não encontrado.');
    } catch (err) {
      console.error('❌ [GET-PROOF] Erro ao recuperar comprovante:', err);
      return ctx.reply('❌ Erro ao recuperar comprovante. Verifique os logs.');
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

  // ===== GERENCIAMENTO DE BLOQUEIOS INDIVIDUAIS =====
  
  // Handler do botão "Gerenciar Bloqueios"
  bot.action('admin_manage_blocks', async (ctx) => {
    await ctx.answerCbQuery();
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    const message = `🔓 *GERENCIAR BLOQUEIOS DE USUÁRIOS*

Você pode bloquear ou desbloquear usuários específicos pelo ID do Telegram.

🟢 *DESBLOQUEAR:* Libera acesso mesmo com DDD bloqueado
🔴 *BLOQUEAR:* Impede acesso aos produtos

Escolha uma ação:`;

    try {
      return await ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('🟢 Desbloquear Usuário', 'block_action_unblock'),
            Markup.button.callback('🔴 Bloquear Usuário', 'block_action_block')
          ],
          [
            Markup.button.callback('🔍 Verificar Status', 'block_action_check')
          ],
          [
            Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')
          ]
        ])
      });
    } catch (err) {
      // Ignorar erro se mensagem já é a mesma (usuário clicou duas vezes)
      if (err.message && err.message.includes('message is not modified')) {
        console.log('ℹ️ [MANAGE-BLOCKS] Mensagem já está atualizada, ignorando erro');
        return;
      }
      throw err;
    }
  });
  
  // Handler: Desbloquear Usuário
  bot.action('block_action_unblock', async (ctx) => {
    await ctx.answerCbQuery();
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    // Criar sessão
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'unblock_user',
      step: 'waiting_id'
    };
    
    try {
      return await ctx.editMessageText(
        `🟢 *DESBLOQUEAR USUÁRIO*

Digite o *ID do Telegram* do usuário que deseja desbloquear:

💡 *Como obter o ID:*
• Peça ao usuário para enviar /start no bot
• Ou use @userinfobot no Telegram
• O ID aparece nos logs quando o usuário interage

_Cancelar:_ /cancelar`, 
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'cancel_block_action')]
          ])
        }
      );
    } catch (err) {
      if (err.message && err.message.includes('message is not modified')) {
        console.log('ℹ️ [UNBLOCK-ACTION] Mensagem já está atualizada');
        return;
      }
      throw err;
    }
  });
  
  // Handler: Bloquear Usuário
  bot.action('block_action_block', async (ctx) => {
    await ctx.answerCbQuery();
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    // Criar sessão
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'block_user',
      step: 'waiting_id'
    };
    
    try {
      return await ctx.editMessageText(
        `🔴 *BLOQUEAR USUÁRIO*

Digite o *ID do Telegram* do usuário que deseja bloquear:

⚠️ *Atenção:* O usuário não verá mais os produtos disponíveis.

💡 *Como obter o ID:*
• Peça ao usuário para enviar /start no bot
• Ou use @userinfobot no Telegram
• O ID aparece nos logs quando o usuário interage

_Cancelar:_ /cancelar`, 
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'cancel_block_action')]
          ])
        }
      );
    } catch (err) {
      if (err.message && err.message.includes('message is not modified')) {
        console.log('ℹ️ [BLOCK-ACTION] Mensagem já está atualizada');
        return;
      }
      throw err;
    }
  });
  
  // Handler: Verificar Status
  bot.action('block_action_check', async (ctx) => {
    await ctx.answerCbQuery();
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) return;
    
    // Criar sessão
    global._SESSIONS = global._SESSIONS || {};
    global._SESSIONS[ctx.from.id] = {
      type: 'check_block_status',
      step: 'waiting_id'
    };
    
    try {
      return await ctx.editMessageText(
        `🔍 *VERIFICAR STATUS DE BLOQUEIO*

Digite o *ID do Telegram* do usuário:

_Cancelar:_ /cancelar`, 
        { 
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancelar', 'cancel_block_action')]
          ])
        }
      );
    } catch (err) {
      if (err.message && err.message.includes('message is not modified')) {
        console.log('ℹ️ [CHECK-STATUS] Mensagem já está atualizada');
        return;
      }
      throw err;
    }
  });
  
  // Handler: Cancelar ação de bloqueio
  bot.action('cancel_block_action', async (ctx) => {
    await ctx.answerCbQuery('❌ Cancelado');
    
    // Limpar sessão
    if (global._SESSIONS && global._SESSIONS[ctx.from.id]) {
      delete global._SESSIONS[ctx.from.id];
    }
    
    // Voltar ao menu de bloqueios
    return bot.handleUpdate({ 
      ...ctx.update, 
      callback_query: { 
        ...ctx.update.callback_query, 
        data: 'admin_manage_blocks' 
      } 
    });
  });
  
  // Handler para responder tickets e criar respostas automáticas (admin) - ANTES do handler de bloqueio
  bot.on('text', async (ctx, next) => {
    const session = global._SESSIONS?.[ctx.from.id];
    
    // 🆕 DEBUG: Log para verificar se o handler está sendo executado
    console.log(`🔍 [ADMIN-TEXT-HANDLER] Handler executado para usuário ${ctx.from.id}`);
    console.log(`🔍 [ADMIN-TEXT-HANDLER] Sessão: ${session ? session.type : 'nenhuma'}`);
    if (session && session.type === 'admin_reply_ticket') {
      console.log(`🔍 [ADMIN-REPLY-TICKET] Handler executado para usuário ${ctx.from.id}, ticket: ${session.ticketId}`);
      console.log(`🔍 [ADMIN-REPLY-TICKET] Mensagem: ${ctx.message.text?.substring(0, 50)}`);
    }
    
    // Handler para responder ticket (admin) - VERIFICAR PRIMEIRO
    if (session && session.type === 'admin_reply_ticket') {
      if (ctx.message.text.startsWith('/')) {
        if (ctx.message.text === '/cancelar') {
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Operação cancelada.');
        }
        return next();
      }
      
      try {
        console.log(`✅ [ADMIN-REPLY-TICKET] Processando resposta do ticket ${session.ticketId}`);
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) {
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Acesso negado.');
        }
        
        const ticketId = session.ticketId;
        const user = await db.getUserByTelegramId(ctx.from.id);
        const ticket = await db.getSupportTicket(ticketId);
        
        if (!ticket) {
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Ticket não encontrado.');
        }
        
        console.log(`✅ [ADMIN-REPLY-TICKET] Adicionando mensagem ao ticket ${ticketId}`);
        // Adicionar mensagem do admin
        await db.addTicketMessage(ticketId, user.id, ctx.message.text, true);
        
        // Atualizar status se estiver aberto
        if (ticket.status === 'open') {
          await db.updateTicketStatus(ticketId, 'in_progress', user.id);
        }
        
        delete global._SESSIONS[ctx.from.id];
        
        // Notificar usuário
        try {
          // Escapar caracteres Markdown na mensagem do admin
          const escapeMarkdown = (text) => {
            if (!text) return '';
            return String(text)
              .replace(/\*/g, '\\*')
              .replace(/_/g, '\\_')
              .replace(/\[/g, '\\[')
              .replace(/\]/g, '\\]')
              .replace(/\(/g, '\\(')
              .replace(/\)/g, '\\)')
              .replace(/~/g, '\\~')
              .replace(/`/g, '\\`');
          };
          
          const ticketNumber = escapeMarkdown(ticket.ticket_number);
          const adminMessage = escapeMarkdown(ctx.message.text);
          
          console.log(`✅ [ADMIN-REPLY-TICKET] Notificando usuário ${ticket.telegram_id}`);
          await ctx.telegram.sendMessage(ticket.telegram_id, 
            `💬 *Nova resposta no seu ticket*\n\n📋 Ticket: ${ticketNumber}\n\n👨\\u200d💼 *Admin:*\n${adminMessage}\n\n💬 Use /suporte para ver seus tickets.`, {
              parse_mode: 'Markdown'
            });
        } catch (err) {
          console.error('❌ [ADMIN-REPLY-TICKET] Erro ao notificar usuário:', err);
        }
        
        const ticketNumber = (ticket.ticket_number || '').replace(/\*/g, '\\*').replace(/_/g, '\\_');
        
        console.log(`✅ [ADMIN-REPLY-TICKET] Resposta enviada com sucesso!`);
        return ctx.reply(`✅ Resposta enviada ao ticket ${ticketNumber}!`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '📋 Ver Ticket', callback_data: `admin_view_ticket_${ticketId}` }
            ]]
          }
        });
      } catch (err) {
        console.error('❌ [ADMIN-REPLY-TICKET] Erro ao responder:', err);
        delete global._SESSIONS[ctx.from.id];
        return ctx.reply('❌ Erro ao responder ticket.');
      }
    }
    
    // Handler para criar resposta automática
    if (session && session.type === 'add_auto_response') {
      if (ctx.message.text.startsWith('/')) {
        if (ctx.message.text === '/cancelar') {
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Operação cancelada.');
        }
        return next();
      }
      
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        delete global._SESSIONS[ctx.from.id];
        return ctx.reply('❌ Acesso negado.');
      }
      
      if (session.step === 'keyword') {
        session.data = { keyword: ctx.message.text };
        session.step = 'response';
        
        return ctx.reply(`🤖 *NOVA RESPOSTA AUTOMÁTICA*

📝 *Passo 2/3: Resposta*

Digite a resposta que será enviada quando alguém usar a palavra-chave "${session.data.keyword}":

_Cancelar: /cancelar`, {
          parse_mode: 'Markdown'
        });
      } else if (session.step === 'response') {
        session.data.response = ctx.message.text;
        session.step = 'priority';
        
        return ctx.reply(`🤖 *NOVA RESPOSTA AUTOMÁTICA*

📝 *Passo 3/3: Prioridade*

Digite a prioridade (0-100, maior = mais importante):

_Cancelar: /cancelar`, {
          parse_mode: 'Markdown'
        });
      } else if (session.step === 'priority') {
        try {
          const priority = parseInt(ctx.message.text) || 0;
          
          await db.createAutoResponse(
            session.data.keyword,
            session.data.response,
            priority
          );
          
          delete global._SESSIONS[ctx.from.id];
          
          return ctx.reply(`✅ *Resposta automática criada!*

📝 *Palavra-chave:* ${session.data.keyword}
💬 *Resposta:* ${session.data.response.substring(0, 100)}${session.data.response.length > 100 ? '...' : ''}
📊 *Prioridade:* ${priority}

A resposta será ativada automaticamente quando alguém usar essa palavra-chave.`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '🤖 Ver Respostas', callback_data: 'admin_auto_responses' }
              ]]
            }
          });
        } catch (err) {
          console.error('❌ [ADMIN-AUTO-RESPONSES] Erro:', err);
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Erro ao criar resposta automática.');
        }
      }
      return;
    }
    
    // Se não for nenhuma sessão admin conhecida, passar para próximo handler
    return next();
  });
  
  // Interceptar texto quando em sessão de bloqueio
  bot.on('text', async (ctx, next) => {
    console.log('🔍 [BLOCK-HANDLER] Handler de bloqueio executado');
    
    // Verificar se está em sessão de bloqueio
    const session = global._SESSIONS && global._SESSIONS[ctx.from.id];
    
    console.log('🔍 [BLOCK-HANDLER] Sessão encontrada:', session ? session.type : 'nenhuma');
    
    if (!session || !['unblock_user', 'block_user', 'check_block_status'].includes(session.type)) {
      console.log('🔍 [BLOCK-HANDLER] Não é sessão de bloqueio, passando para próximo handler');
      return next(); // Passar para próximo handler
    }
    
    console.log('✅ [BLOCK-HANDLER] Sessão de bloqueio detectada:', session.type);
    
    const isAdmin = await db.isUserAdmin(ctx.from.id);
    if (!isAdmin) {
      console.log('❌ [BLOCK-HANDLER] Usuário não é admin');
      delete global._SESSIONS[ctx.from.id];
      return;
    }
    
    // Cancelar
    if (ctx.message.text === '/cancelar') {
      console.log('❌ [BLOCK-HANDLER] Operação cancelada pelo usuário');
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply('❌ Operação cancelada. Use /admin para voltar ao painel.');
    }
    
    // Processar ID
    const telegramId = parseInt(ctx.message.text.trim());
    
    console.log('📋 [BLOCK-HANDLER] ID recebido:', ctx.message.text.trim(), '→ Parsed:', telegramId);
    
    if (isNaN(telegramId) || telegramId <= 0) {
      console.log('❌ [BLOCK-HANDLER] ID inválido');
      return ctx.reply('❌ ID inválido. Digite apenas números.\n\nExemplo: `123456789`\n\n_Cancelar:_ /cancelar', {
        parse_mode: 'Markdown'
      });
    }
    
    try {
      if (session.type === 'unblock_user') {
        // DESBLOQUEAR
        await ctx.reply('⏳ Desbloqueando usuário...');
        
        const user = await db.unblockUserByTelegramId(telegramId);
        
        delete global._SESSIONS[ctx.from.id];
        
        return ctx.reply(
          `✅ *USUÁRIO DESBLOQUEADO COM SUCESSO!*

🆔 *ID:* \`${telegramId}\`
👤 *Nome:* ${user.first_name || 'N/A'}
📱 *Username:* @${user.username || 'N/A'}
🔓 *Status:* Desbloqueado

O usuário agora pode acessar todos os produtos, mesmo se o DDD dele estiver bloqueado.

Use /admin para voltar ao painel.`, 
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
            ])
          }
        );
        
      } else if (session.type === 'block_user') {
        // BLOQUEAR
        console.log(`🔴 [BLOCK-HANDLER] Iniciando bloqueio do usuário ${telegramId}`);
        await ctx.reply('⏳ Bloqueando usuário...');
        
        console.log(`📤 [BLOCK-HANDLER] Chamando db.blockUserByTelegramId(${telegramId})`);
        const user = await db.blockUserByTelegramId(telegramId);
        console.log(`✅ [BLOCK-HANDLER] Usuário bloqueado:`, user);
        
        delete global._SESSIONS[ctx.from.id];
        
        // Enviar mensagem de bloqueio ao usuário
        try {
          await ctx.telegram.sendMessage(
            telegramId,
            '⚠️ *Serviço Temporariamente Indisponível*\n\n' +
            'No momento, não conseguimos processar seu acesso.\n\n' +
            'Estamos trabalhando para expandir nosso atendimento em breve!',
            { 
              parse_mode: 'Markdown',
              reply_markup: { remove_keyboard: true }
            }
          );
        } catch (notifyErr) {
          console.log('ℹ️ [BLOCK] Não foi possível notificar usuário (pode ter bloqueado o bot)');
        }
        
        return ctx.reply(
          `🔴 *USUÁRIO BLOQUEADO COM SUCESSO!*

🆔 *ID:* \`${telegramId}\`
👤 *Nome:* ${user.first_name || 'N/A'}
📱 *Username:* @${user.username || 'N/A'}
🔒 *Status:* Bloqueado

O usuário não poderá mais acessar os produtos.
Ele receberá a mensagem de "Serviço Indisponível".

Use /admin para voltar ao painel.`, 
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
            ])
          }
        );
        
      } else if (session.type === 'check_block_status') {
        // VERIFICAR STATUS
        await ctx.reply('⏳ Verificando status...');
        
        const user = await db.checkBlockStatus(telegramId);
        
        delete global._SESSIONS[ctx.from.id];
        
        if (!user) {
          return ctx.reply(
            `ℹ️ *USUÁRIO NÃO ENCONTRADO*

🆔 *ID:* \`${telegramId}\`

Este usuário ainda não interagiu com o bot.

💡 *O que fazer:*
• Peça ao usuário para enviar /start no bot
• Depois você poderá bloquear/desbloquear

Use /admin para voltar ao painel.`, 
            { 
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')]
              ])
            }
          );
        }
        
        const ddd = user.phone_number ? db.extractAreaCode(user.phone_number) : 'N/A';
        const statusEmoji = user.is_blocked ? '🔴' : '🟢';
        const statusText = user.is_blocked ? 'BLOQUEADO' : 'DESBLOQUEADO';
        
        return ctx.reply(
          `${statusEmoji} *STATUS DO USUÁRIO*

🆔 *ID:* \`${telegramId}\`
👤 *Nome:* ${user.first_name || 'N/A'}
📱 *Username:* @${user.username || 'N/A'}
📞 *Telefone:* ${user.phone_number || 'N/A'}
📍 *DDD:* ${ddd}
${statusEmoji} *Status:* ${statusText}

Use /admin para voltar ao painel.`, 
          { 
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback(user.is_blocked ? '🟢 Desbloquear' : '🔴 Bloquear', user.is_blocked ? 'block_action_unblock' : 'block_action_block')
              ],
              [
                Markup.button.callback('🔙 Voltar ao Painel', 'admin_refresh')
              ]
            ])
          }
        );
      }
      
    } catch (err) {
      console.error('❌ [BLOCK-HANDLER] Erro:', err);
      delete global._SESSIONS[ctx.from.id];
      return ctx.reply(
        `❌ *ERRO AO PROCESSAR*

Erro: ${err.message}

Use /admin para voltar ao painel.`,
        { parse_mode: 'Markdown' }
      );
    }
  });

}

module.exports = { registerAdminCommands };

