// src/admin/transactions.js
const db = require('../database');
const deliver = require('../deliver');

function registerTransactionHandlers(bot) {
  // ===== PAINEL ADMIN (oculto) =====
  bot.command('admin', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('🔐 *Acesso Restrito*\n\nEste painel é exclusivo para administradores da plataforma.\n\n💬 Precisa de ajuda? Use /suporte', { parse_mode: 'Markdown' });
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
        Markup.button.callback('📦 Entregues', 'admin_entregues')
      ],
      [
        Markup.button.callback('📊 Estatísticas', 'admin_stats')
      ],
        [
          Markup.button.callback('🛍️ Ver Produtos', 'admin_produtos')
        ],
      [
        Markup.button.callback('👥 Gerenciar Grupos', 'admin_groups'),
        Markup.button.callback('⚠️ Falhas de Entrega', 'admin_delivery_failures'),
        Markup.button.callback('🔑 Alterar PIX', 'admin_setpix')
      ],
      [
        Markup.button.callback('💳 Rotação PIX', 'admin_pix_config')
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
          Markup.button.callback('🔓 Gerenciar Bloqueios', 'admin_manage_blocks')
        ],
        [
          Markup.button.callback('🏪 Controle da Loja', 'admin_shop_control')
        ],
        [
          Markup.button.callback('📂 Mais Opções', 'admin_mais_opcoes')
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
  // ===== REVERTER TRANSAÇÃO POR USUÁRIO E VALOR =====
  bot.hears(/^\/reverter[_\s]+(\d+)[_\s]+([\d,\.]+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const telegramId = ctx.match[1];
      const amountStr = ctx.match[2].replace(',', '.');
      const amount = parseFloat(amountStr);
      
      if (isNaN(amount)) {
        return ctx.reply('❌ Valor inválido. Use: /reverter <telegram_id> <valor>\n\nExemplo: /reverter 8385308498 21.90');
      }
      
      // Buscar transações
      const transactions = await db.getTransactionsByUserAndAmount(telegramId, amount);
      
      if (transactions.length === 0) {
        return ctx.reply(`❌ Nenhuma transação encontrada para:\n\n👤 ID: ${telegramId}\n💰 Valor: R$ ${amount.toFixed(2)}\n\nVerifique se o ID e valor estão corretos.`);
      }
      
      if (transactions.length > 1) {
        // Múltiplas transações - mostrar lista
        let message = `⚠️ *Múltiplas transações encontradas*\n\n`;
        message += `👤 Usuário: ${telegramId}\n💰 Valor: R$ ${amount.toFixed(2)}\n\n`;
        message += `*Transações encontradas:*\n\n`;
        
        transactions.forEach((t, index) => {
          const date = t.created_at ? new Date(t.created_at).toLocaleString('pt-BR') : 'N/A';
          message += `${index + 1}. 🆔 TXID: \`${t.txid}\`\n`;
          message += `   📅 Data: ${date}\n`;
          message += `   📊 Status: ${t.status}\n\n`;
        });
        
        message += `Use: /reverter_txid <TXID> para reverter uma específica.`;
        
        return ctx.reply(message, { parse_mode: 'Markdown' });
      }
      
      // Apenas uma transação - reverter diretamente
      const transaction = transactions[0];
      
      // Confirmar reversão
      const user = transaction.user_id ? await db.getUserByUUID(transaction.user_id) : null;
      const userName = user ? `${user.first_name} (@${user?.username || 'N/A'})` : 'N/A';
      
      return ctx.reply(`⚠️ *CONFIRMAR REVERSÃO DE TRANSAÇÃO*

🆔 TXID: \`${transaction.txid}\`
👤 Usuário: ${userName}
💰 Valor: R$ ${transaction.amount}
📊 Status: ${transaction.status}
📦 Produto: ${transaction.product_id || transaction.media_pack_id || transaction.group_id || 'N/A'}

⚠️ *ATENÇÃO:*
• A transação será cancelada
• Entregas de mídia serão deletadas
• O usuário perderá acesso ao produto/grupo
• Esta ação não pode ser desfeita

Para confirmar, responda: /confirmar_reverter_${transaction.txid}`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao buscar transação para reversão:', err);
      return ctx.reply('❌ Erro ao buscar transação. Verifique os logs.');
    }
  });
  
  // Comando para confirmar reversão por TXID
  bot.hears(/^\/confirmar_reverter_(.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const txid = ctx.match[1].trim();
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      if (!['validated', 'delivered'].includes(transaction.status)) {
        return ctx.reply(`⚠️ Esta transação não pode ser revertida.\n\nStatus atual: ${transaction.status}\n\nApenas transações validadas ou entregues podem ser revertidas.`);
      }
      
      // Reverter transação
      const result = await db.reverseTransaction(txid, 'Transação revertida - comprovante incorreto aprovado por engano');
      
      if (!result.success) {
        return ctx.reply(`❌ Erro ao reverter transação:\n\n${result.error}`);
      }
      
      const trans = result.transaction;
      const user = trans.user_id ? await db.getUserByUUID(trans.user_id) : null;
      
      // Notificar usuário
      try {
        await ctx.telegram.sendMessage(trans.telegram_id, `⚠️ *TRANSAÇÃO CANCELADA*

Sua transação foi cancelada pelo administrador.

🆔 TXID: \`${txid}\`
💰 Valor: R$ ${trans.amount}
📅 Cancelada em: ${new Date().toLocaleString('pt-BR')}

*Motivo:* Comprovante incorreto aprovado por engano.

Se você acredita que isso foi um erro, entre em contato com o suporte: /suporte`, {
          parse_mode: 'Markdown'
        });
      } catch (notifyErr) {
        console.error('Erro ao notificar usuário:', notifyErr);
      }
      
      // Se for grupo, tentar remover do grupo via Telegram
      if (trans.group_id) {
        try {
          const group = await db.getGroupById(trans.group_id);
          if (group && group.group_id) {
            try {
              await ctx.telegram.banChatMember(group.group_id, trans.telegram_id);
              await ctx.telegram.unbanChatMember(group.group_id, trans.telegram_id, { only_if_banned: true });
              console.log(`✅ [REVERSE] Usuário removido do grupo via Telegram: ${trans.telegram_id}`);
            } catch (groupErr) {
              console.error('⚠️ [REVERSE] Erro ao remover do grupo via Telegram:', groupErr.message);
            }
          }
        } catch (groupErr) {
          console.error('⚠️ [REVERSE] Erro ao buscar grupo:', groupErr.message);
        }
      }
      
      return ctx.reply(`✅ *TRANSAÇÃO REVERTIDA COM SUCESSO*

🆔 TXID: \`${txid}\`
👤 Usuário: ${user ? `${user.first_name} (@${user?.username || 'N/A'})` : 'N/A'}
💰 Valor: R$ ${trans.amount}

✅ Transação cancelada
✅ Entregas de mídia deletadas (se houver)
✅ Acesso removido (se grupo)
✅ Usuário notificado

📋 A transação foi completamente revertida.`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao reverter transação:', err);
      return ctx.reply(`❌ Erro ao reverter transação:\n\n${err.message}`);
    }
  });
  
  // Comando alternativo para reverter diretamente por TXID
  bot.hears(/^\/reverter_txid[_\s](.+)$/, async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return ctx.reply('❌ Acesso negado.');
      
      const txid = ctx.match[1].trim();
      const transaction = await db.getTransactionByTxid(txid);
      
      if (!transaction) {
        return ctx.reply('❌ Transação não encontrada.');
      }
      
      if (!['validated', 'delivered'].includes(transaction.status)) {
        return ctx.reply(`⚠️ Esta transação não pode ser revertida.\n\nStatus atual: ${transaction.status}\n\nApenas transações validadas ou entregues podem ser revertidas.`);
      }
      
      // Mostrar confirmação
      const user = transaction.user_id ? await db.getUserByUUID(transaction.user_id) : null;
      const userName = user ? `${user.first_name} (@${user?.username || 'N/A'})` : 'N/A';
      
      return ctx.reply(`⚠️ *CONFIRMAR REVERSÃO DE TRANSAÇÃO*

🆔 TXID: \`${txid}\`
👤 Usuário: ${userName}
💰 Valor: R$ ${transaction.amount}
📊 Status: ${transaction.status}
📦 Produto: ${transaction.product_id || transaction.media_pack_id || transaction.group_id || 'N/A'}

⚠️ *ATENÇÃO:*
• A transação será cancelada
• Entregas de mídia serão deletadas
• O usuário perderá acesso ao produto/grupo
• Esta ação não pode ser desfeita

Para confirmar, responda: /confirmar_reverter_${txid}`, {
        parse_mode: 'Markdown'
      });
      
    } catch (err) {
      console.error('Erro ao buscar transação:', err);
      return ctx.reply('❌ Erro ao buscar transação. Verifique os logs.');
    }
  });

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
        
        const productName = product.name || transaction.product_id;
        await deliver.deliverProductFromStorage(transaction.telegram_id, transaction.product_id, productName);
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
          // Não logar como erro se for um caso esperado (comportamento normal)
          const errorMessage = err.message || '';
          const isExpectedError = 
            errorMessage.includes('bot was blocked by the user') ||
            errorMessage.includes('user is deactivated') ||
            errorMessage.includes('chat not found') ||
            errorMessage.includes('user not found') ||
            errorMessage.includes('chat_id is empty');
          
          if (isExpectedError) {
            // Silencioso - apenas contar como falha (comportamento esperado)
          } else {
            // Logar apenas erros reais (não relacionados a usuários inativos)
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

        // Sincronizar com pix_settings (usado pelo sistema de rotação PIX)
        try {
          await db.supabase
            .from('pix_settings')
            .update({ primary_pix_key: novaChave, updated_at: new Date().toISOString() })
            .eq('id', 1);
        } catch (syncErr) {
          console.warn('⚠️ [SETPIX] Erro ao sincronizar pix_settings:', syncErr.message);
        }

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
  
}

module.exports = { registerTransactionHandlers };
