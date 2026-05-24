// src/admin/products.js
const db = require('../database');
const deliver = require('../deliver');

function registerProductHandlers(bot) {
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
      
      // Verificar se é entrega manual - Step 1: Receber ID do usuário
      if (session.type === 'entregar_txid' && session.step === 'waiting_user_id') {
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) {
          delete global._SESSIONS[ctx.from.id];
          return;
        }
        
        const userId = ctx.message.text.trim();
        
        // Validar ID (deve ser numérico)
        if (!/^\d+$/.test(userId)) {
          return ctx.reply('❌ ID inválido. Digite apenas números.\n\nExemplo: `6224210204`', {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ Cancelar', callback_data: 'cancel_entregar_txid' }
              ]]
            }
          });
        }
        
        // Verificar se usuário existe
        const user = await db.getUserByTelegramId(parseInt(userId));
        if (!user) {
          return ctx.reply('❌ Usuário não encontrado.\n\nVerifique se o ID está correto e se o usuário já usou o bot pelo menos uma vez.', {
            reply_markup: {
              inline_keyboard: [[
                { text: '❌ Cancelar', callback_data: 'cancel_entregar_txid' }
              ]]
            }
          });
        }
        
        // Buscar produtos, grupos e media packs disponíveis
        await ctx.reply('⏳ Buscando produtos disponíveis...');
        
        const [products, groups, mediaPacks] = await Promise.all([
          db.getAllProducts(),
          db.getAllGroups(),
          db.getAllMediaPacks()
        ]);
        
        if (products.length === 0 && groups.length === 0 && mediaPacks.length === 0) {
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply('❌ Nenhum produto, grupo ou media pack disponível no momento.');
        }
        
        // Atualizar sessão com o ID do usuário
        global._SESSIONS[ctx.from.id] = {
          type: 'entregar_txid',
          step: 'waiting_product_selection',
          targetUserId: parseInt(userId),
          targetUser: user
        };
        
        // Gerar botões de produtos (igual ao /start)
        const buttons = [];
        
        // Botões de produtos
        for (const product of products) {
          const emoji = parseFloat(product.price) >= 50 ? '💎' : '🛍️';
          const buttonText = `${emoji} ${product.name} (R$${parseFloat(product.price).toFixed(2)})`;
          buttons.push([{ text: buttonText, callback_data: `manual_deliver_product:${product.product_id}` }]);
        }
        
        // Botões de media packs
        const activeMediaPacks = mediaPacks.filter(p => p.is_active);
        for (const pack of activeMediaPacks) {
          buttons.push([{ text: pack.name, callback_data: `manual_deliver_mediapack:${pack.pack_id}` }]);
        }
        
        // Botões de grupos
        const activeGroups = groups.filter(g => g.is_active);
        for (const group of activeGroups) {
          const groupButtonText = group.group_name || `👥 Grupo (R$${parseFloat(group.subscription_price).toFixed(2)}/mês)`;
          buttons.push([{ text: groupButtonText, callback_data: `manual_deliver_group:${group.group_id}` }]);
        }
        
        // Botão de cancelar
        buttons.push([{ text: '❌ Cancelar', callback_data: 'cancel_entregar_txid' }]);
        
        return ctx.reply(`✅ *Usuário encontrado!*\n\n👤 Nome: ${user.first_name}${user.username ? ` (@${user.username})` : ''}\n🆔 ID: ${userId}\n\n📦 *Selecione o produto/grupo para entregar:*`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: buttons
          }
        });
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

      // ── RASTREAR CLIENTE — por ID ──────────────────────────────────────
      if (session.type === 'rastrear_cliente' && session.step === 'aguardando_id') {
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) { delete global._SESSIONS[ctx.from.id]; return; }

        const texto = ctx.message.text.trim();
        if (!/^\d+$/.test(texto)) {
          return ctx.reply(
            '❌ ID inválido\\. Digite apenas números\\.\n\nEx: `6880815060`',
            {
              parse_mode: 'MarkdownV2',
              reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'cancelar_rastrear' }]] }
            }
          );
        }

        delete global._SESSIONS[ctx.from.id];

        const user = await db.getUserByTelegramId(parseInt(texto));
        if (!user) return ctx.reply(`❌ Nenhum cliente com ID *${texto}* encontrado\.`, { parse_mode: 'MarkdownV2' });

        // Última transação
        const txList = await db.getUserTransactions(parseInt(texto), 1);
        return renderClienteRastreado(ctx, user, txList?.[0] || null, 'id');
      }

      // ── RASTREAR CLIENTE — por código Pix ─────────────────────────────
      if (session.type === 'rastrear_cliente' && session.step === 'aguardando_pix') {
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) { delete global._SESSIONS[ctx.from.id]; return; }

        const pixCode = ctx.message.text.trim();
        if (pixCode.length < 10) {
          return ctx.reply('❌ Código Pix muito curto\. Cole o código completo\.', {
            parse_mode: 'MarkdownV2',
            reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'cancelar_rastrear' }]] }
          });
        }

        delete global._SESSIONS[ctx.from.id];

        // Buscar na tabela transactions (campo pix_payload = copia e cola)
        let tx = null;
        const { data: byPayload } = await db.supabase
          .from('transactions')
          .select('txid, telegram_id, user_id, amount, status, created_at, pix_payload, pix_key')
          .or(`pix_payload.ilike.%${pixCode}%,txid.eq.${pixCode}`)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        tx = byPayload;

        // Fallback: tentar extrair TXID do BR Code (campo 05 do payload EMV)
        if (!tx && pixCode.length > 20) {
          const match = pixCode.match(/05(\d{2})([A-Z0-9]{10,25})/);
          if (match) {
            const txidExtracted = match[2];
            const { data: byTxid } = await db.supabase
              .from('transactions')
              .select('txid, telegram_id, user_id, amount, status, created_at, pix_payload, pix_key')
              .eq('txid', txidExtracted)
              .maybeSingle();
            tx = byTxid;
          }
        }

        if (!tx) return ctx.reply('❌ Nenhuma transação encontrada para este código Pix\.', { parse_mode: 'MarkdownV2' });
        if (!tx.telegram_id) return ctx.reply('❌ Transação encontrada mas sem cliente vinculado\.', { parse_mode: 'MarkdownV2' });

        const user = await db.getUserByTelegramId(tx.telegram_id);
        if (!user) return ctx.reply('❌ Cliente não encontrado no banco de dados\.', { parse_mode: 'MarkdownV2' });

        return renderClienteRastreado(ctx, user, tx, 'pix');
      }

      // ── CONFIGURAÇÃO REGRAS PIX — valor digitado manualmente ──────────
      if (session.type === 'pix_rule') {
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) { delete global._SESSIONS[ctx.from.id]; return; }

        const val = ctx.message.text.trim().replace(',', '.');

        if (session.rule === 'interval') {
          const num = parseInt(val);
          if (isNaN(num) || num < 1 || num > 999) {
            return ctx.reply('❌ Número inválido. Digite um valor entre 1 e 999:');
          }
          await db.supabase.from('pix_settings').update({ rotation_interval: num, updated_at: new Date().toISOString() }).eq('id', 1);
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply(`✅ *Intervalo atualizado:* a cada *${num}* transações a rotação ocorre.`, { parse_mode: 'Markdown' });
        }

        if (session.rule === 'accum') {
          const num = parseFloat(val);
          if (isNaN(num) || num < 1) {
            return ctx.reply('❌ Valor inválido. Digite um valor em reais (ex: 80):');
          }
          await db.supabase.from('pix_settings').update({ accumulated_min_value: num, updated_at: new Date().toISOString() }).eq('id', 1);
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply(`✅ *Valor mínimo atualizado:* R$ ${num.toFixed(2)}`, { parse_mode: 'Markdown' });
        }

        if (session.rule === 'perc') {
          const num = parseInt(val);
          if (isNaN(num) || num < 1 || num > 100) {
            return ctx.reply('❌ Porcentagem inválida. Digite um valor entre 1 e 100:');
          }
          await db.supabase.from('pix_settings').update({ secondary_percentage: num, updated_at: new Date().toISOString() }).eq('id', 1);
          delete global._SESSIONS[ctx.from.id];
          return ctx.reply(`✅ *Distribuição atualizada:* ${num}% das transações vão para a chave secundária.`, { parse_mode: 'Markdown' });
        }

        return next();
      }
      if (session.type === 'pix_setup') {
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) { delete global._SESSIONS[ctx.from.id]; return; }

        const texto = ctx.message.text.trim();

        // ── Etapa 1: chave PIX ─────────────────────────────────────────
        if (session.step === 'chave') {
          if (texto.length < 5) {
            return ctx.reply('❌ Chave muito curta. Tente novamente:', {
              reply_markup: Markup.inlineKeyboard([[Markup.button.callback('❌ Cancelar', 'pix_setup_cancel')]]).reply_markup
            });
          }
          global._SESSIONS[ctx.from.id].data.chave = texto;
          global._SESSIONS[ctx.from.id].step = 'nome';

          return ctx.reply(
            `✅ Chave: \`${texto}\`\n\n` +
            `*Etapa 2 de 3*\n\n` +
            `Digite o *nome do recebedor* desta conta:`,
            {
              parse_mode: 'Markdown',
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('⬅️ Voltar', 'pix_setup_back_chave'), Markup.button.callback('❌ Cancelar', 'pix_setup_cancel')]
              ]).reply_markup
            }
          );
        }

        // ── Etapa 2: nome do recebedor ─────────────────────────────────
        if (session.step === 'nome') {
          if (texto.length < 2) {
            return ctx.reply('❌ Nome muito curto. Tente novamente:');
          }
          global._SESSIONS[ctx.from.id].data.nome = texto;
          global._SESSIONS[ctx.from.id].step = 'banco';

          return ctx.reply(
            `✅ Nome: *${texto}*\n\n` +
            `*Etapa 3 de 3*\n\n` +
            `Digite o *nome do banco* desta conta:\n\n` +
            `_Exemplos: Nubank, Itaú, Bradesco, Caixa, Inter..._`,
            {
              parse_mode: 'Markdown',
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('⬅️ Voltar', 'pix_setup_back_nome'), Markup.button.callback('❌ Cancelar', 'pix_setup_cancel')]
              ]).reply_markup
            }
          );
        }

        // ── Etapa 3: banco → confirmação ───────────────────────────────
        if (session.step === 'banco') {
          if (texto.length < 2) {
            return ctx.reply('❌ Nome do banco muito curto. Tente novamente:');
          }
          global._SESSIONS[ctx.from.id].data.banco = texto;
          global._SESSIONS[ctx.from.id].step = 'confirmar';

          const d = global._SESSIONS[ctx.from.id].data;
          return ctx.reply(
            `📋 *Confirme os dados:*\n\n` +
            `🔑 *Chave PIX:* \`${d.chave}\`\n` +
            `👤 *Recebedor:* ${d.nome}\n` +
            `🏦 *Banco:* ${d.banco}\n\n` +
            `Está tudo correto?`,
            {
              parse_mode: 'Markdown',
              reply_markup: Markup.inlineKeyboard([
                [Markup.button.callback('✅ Confirmar e Salvar', 'pix_setup_confirm')],
                [Markup.button.callback('⬅️ Corrigir Banco', 'pix_setup_back_banco'), Markup.button.callback('❌ Cancelar', 'pix_setup_cancel')]
              ]).reply_markup
            }
          );
        }

        return next();
      }
      if (session.type === 'revogar_conteudo' && session.step === 'aguardando_id') {
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) { delete global._SESSIONS[ctx.from.id]; return; }

        const inputId = ctx.message.text.trim();
        if (!/^\d+$/.test(inputId)) {
          return ctx.reply(
            '❌ ID inválido. Digite apenas números.\n\nEx: `6880815060`',
            {
              parse_mode: 'Markdown',
              reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'cancelar_revogar' }]] }
            }
          );
        }

        const telegramId = parseInt(inputId);
        delete global._SESSIONS[ctx.from.id];

        // Buscar usuário
        const usuario = await db.getUserByTelegramId(telegramId).catch(() => null);

        // Buscar mensagens rastreadas
        const todasMensagens = await buscarMensagensRevogar(telegramId);

        if (todasMensagens.length === 0) {
          return ctx.reply(
            `📭 *Nenhuma mídia rastreada encontrada*\n\n` +
            `🆔 Usuário: \`${telegramId}\`\n` +
            `ℹ️ Só aparecem mensagens enviadas após a instalação do patch no deliver.js.`,
            { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Painel', callback_data: 'admin_refresh' }]] } }
          );
        }

        const packs = await listarPacksRevogar(telegramId);
        const nomeUsuario = usuario ? (usuario.first_name || 'Sem nome') : 'Usuário não encontrado';
        const bloqLabel = usuario ? (usuario.is_blocked ? '🔴 Bloqueado' : '🟢 Ativo') : '⚠️ Não encontrado';

        // Montar botões de packs
        const packButtons = packs.map(p => ([{
          text: `📦 ${p}`,
          callback_data: `revogar_pack_${telegramId}__${p}`
        }]));

        return ctx.reply(
          `🗑️ *REVOGAR CONTEÚDO*\n\n` +
          `👤 *${nomeUsuario}* — ${bloqLabel}\n` +
          `🆔 ID: \`${telegramId}\`\n\n` +
          `📊 Mensagens rastreadas: *${todasMensagens.length}*\n` +
          `📦 Packs: *${packs.join(', ') || 'N/A'}*\n\n` +
          `O que deseja apagar?`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🗑️ TUDO (todas as mídias)', callback_data: `revogar_tudo_${telegramId}` }],
                ...packButtons,
                [{ text: '❌ Cancelar', callback_data: 'cancelar_revogar' }]
              ]
            }
          }
        );
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
      
      // Verificar se é broadcast + produto + cupom - definindo descontos
      if (session.type === 'creator_broadcast_product_coupon' && session.step === 'set_discounts') {
        const isCreator = await db.isUserCreator(ctx.from.id);
        if (!isCreator) {
          delete global._SESSIONS[ctx.from.id];
          return;
        }
        
        const currentProduct = session.selectedProducts[session.currentDiscountIndex];
        const originalPrice = parseFloat(currentProduct.price);
        
        // Aceitar valor em reais (ex: 5.00, 5, 10.50)
        const discountValue = parseFloat(ctx.message.text.trim().replace(',', '.'));
        
        if (isNaN(discountValue) || discountValue <= 0) {
          return ctx.reply('❌ Valor inválido. Digite um valor em reais (ex: 5.00, 10.50):');
        }
        
        if (discountValue >= originalPrice) {
          return ctx.reply(`❌ O desconto (R$ ${discountValue.toFixed(2)}) não pode ser maior ou igual ao preço original (R$ ${originalPrice.toFixed(2)}).\n\nDigite um valor menor:`);
        }
        
        // Calcular porcentagem para armazenar no banco
        const discountPercentage = (discountValue / originalPrice) * 100;
        const discountedPrice = originalPrice - discountValue;
        
        const key = `${currentProduct.type}_${currentProduct.id}`;
        // Armazenar porcentagem (para compatibilidade com o banco)
        session.productDiscounts[key] = discountPercentage;
        // Também armazenar valor para exibição
        if (!session.productDiscountValues) session.productDiscountValues = {};
        session.productDiscountValues[key] = discountValue;
        
        // Verificar se há mais produtos
        session.currentDiscountIndex++;
        
        if (session.currentDiscountIndex < session.selectedProducts.length) {
          const nextProduct = session.selectedProducts[session.currentDiscountIndex];
          
          return ctx.reply(`✅ Desconto de R$ ${discountValue.toFixed(2)} definido para ${currentProduct.name}!

💰 *De R$ ${originalPrice.toFixed(2)} por R$ ${discountedPrice.toFixed(2)}* (${discountPercentage.toFixed(1)}% OFF)

📦 *Próximo produto:* ${nextProduct.name}
💰 *Preço original:* R$ ${parseFloat(nextProduct.price).toFixed(2)}

*Passo ${session.currentDiscountIndex + 1}/${session.selectedProducts.length}*

Digite o *valor do desconto* em reais (ex: 5.00, 10.50):

_Cancelar: /cancelar_`, { parse_mode: 'Markdown' });
        }
        
        // Todos os descontos definidos, pedir mensagem persuasiva
        session.step = 'message';
        
        let summary = `✅ *DESCONTOS DEFINIDOS!*

📋 *Resumo:*

`;
        
        for (const product of session.selectedProducts) {
          const key = `${product.type}_${product.id}`;
          const discPercent = session.productDiscounts[key];
          const discValue = session.productDiscountValues?.[key] || (parseFloat(product.price) * discPercent / 100);
          const originalPrice = parseFloat(product.price);
          const discountedPrice = originalPrice - discValue;
          
          summary += `• ${product.name}
  💰 De R$ ${originalPrice.toFixed(2)} por R$ ${discountedPrice.toFixed(2)} (Desconto de R$ ${discValue.toFixed(2)} - ${discPercent.toFixed(1)}% OFF)

`;
        }
        
        summary += `━━━━━━━━━━━━━━━━━━━━━━━━

Agora escreva a *mensagem persuasiva* para chamar atenção dos clientes:

💡 *Dica:* Use uma mensagem atrativa que destaque os descontos e incentive a compra!

*Exemplo:*
"🔥 *PROMOÇÃO IMPERDÍVEL!*

Aproveite agora mesmo descontos exclusivos!
Não perca essa oportunidade única! 🎉"

_Cancelar: /cancelar_`;
        
        return ctx.reply(summary, { parse_mode: 'Markdown' });
      }
      
      // Verificar se é broadcast + produto + cupom - mensagem
      if (session.type === 'creator_broadcast_product_coupon' && session.step === 'message') {
        const isCreator = await db.isUserCreator(ctx.from.id);
        if (!isCreator) {
          delete global._SESSIONS[ctx.from.id];
          return;
        }
        
        const message = ctx.message.text;
        
        // Salvar mensagem e pedir imagem
        session.broadcastMessage = message;
        session.step = 'image';
        
        return ctx.reply(`✅ *Mensagem salva!*

📝 *Sua mensagem:*
${message.substring(0, 100)}${message.length > 100 ? '...' : ''}

━━━━━━━━━━━━━━━━━━━━━━━━

📸 Agora envie uma *imagem* para acompanhar a promoção:

💡 *Dica:* Pode ser uma imagem atrativa do produto, banner promocional, etc.

_Envie a foto agora ou digite /pular para continuar sem imagem_
_Cancelar: /cancelar_`, { parse_mode: 'Markdown' });
      }
      
      // Handler para pular imagem
      if (ctx.message.text === '/pular' && session.type === 'creator_broadcast_product_coupon' && session.step === 'image') {
        const isCreator = await db.isUserCreator(ctx.from.id);
        if (!isCreator) {
          delete global._SESSIONS[ctx.from.id];
          return;
        }
        
        session.imageFileId = null;
        session.step = 'confirm';
        
        let previewMessage = `🎁 *CONFIRMAR BROADCAST + PRODUTO + DESCONTO*

*Mensagem:*
${session.broadcastMessage}

━━━━━━━━━━━━━━━━━━━━━━━━

📋 *Produtos com desconto:*

`;
        
        for (const product of session.selectedProducts) {
          const key = `${product.type}_${product.id}`;
          const discPercent = session.productDiscounts[key];
          const discValue = session.productDiscountValues?.[key] || (parseFloat(product.price) * discPercent / 100);
          const originalPrice = parseFloat(product.price);
          const discountedPrice = originalPrice - discValue;
          
          previewMessage += `• ${product.name}
  💰 De R$ ${originalPrice.toFixed(2)} por R$ ${discountedPrice.toFixed(2)} (Desconto de R$ ${discValue.toFixed(2)} - ${discPercent.toFixed(1)}% OFF)

`;
        }
        
        previewMessage += `━━━━━━━━━━━━━━━━━━━━━━━━

✅ *Usuários que recebem o broadcast:*
   Verão o preço com desconto automaticamente ao clicar no produto

⚠️ *Esta promoção será enviada apenas para usuários desbloqueados e ativos.*

Deseja continuar?`;
        
        return ctx.reply(previewMessage, {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            [Markup.button.callback('✅ Confirmar e Enviar', 'confirm_bpc_broadcast')],
            [Markup.button.callback('❌ Cancelar', 'cancel_creator_broadcast')]
          ])
        });
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

      // ===== EDITAR CAMPO DE GRUPO =====
      if (session.type === 'edit_group_field') {
        const isAdmin = await db.isUserAdmin(ctx.from.id);
        if (!isAdmin) {
          delete global._SESSIONS[ctx.from.id];
          return;
        }

        const { field, groupUuid } = session.data;
        const rawValue = ctx.message.text.trim();

        const fieldMap = {
          name:  'group_name',
          price: 'subscription_price',
          days:  'subscription_days',
          link:  'group_link'
        };

        const dbColumn = fieldMap[field];
        let parsedValue = rawValue;

        if (field === 'price') {
          parsedValue = parseFloat(rawValue.replace(',', '.'));
          if (isNaN(parsedValue) || parsedValue <= 0) {
            return ctx.reply('❌ Preço inválido. Digite um número maior que zero.\nEx: 59.90');
          }
        }

        if (field === 'days') {
          parsedValue = parseInt(rawValue);
          if (isNaN(parsedValue) || parsedValue <= 0) {
            return ctx.reply('❌ Duração inválida. Digite um número inteiro.\nEx: 30');
          }
        }

        if (field === 'link' && !rawValue.startsWith('http')) {
          return ctx.reply('❌ Link inválido. Deve começar com https://');
        }

        const { error } = await db.supabase
          .from('groups')
          .update({ [dbColumn]: parsedValue, updated_at: new Date().toISOString() })
          .eq('id', groupUuid);

        if (error) {
          console.error('Erro ao salvar campo do grupo:', error.message);
          return ctx.reply('❌ Erro ao salvar. Tente novamente.');
        }

        delete global._SESSIONS[ctx.from.id];

        const fieldLabels = { name: 'Nome', price: 'Preço', days: 'Duração', link: 'Link' };
        const displayValue = field === 'price' ? `R$ ${parsedValue.toFixed(2)}` : String(parsedValue);

        return ctx.reply(
          `✅ *${fieldLabels[field]} atualizado com sucesso!*\n\nNovo valor: \`${displayValue}\``,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('✏️ Continuar editando', `edit_group:${groupUuid}`)],
              [Markup.button.callback('👥 Ver Grupos', 'admin_groups')]
            ])
          }
        );
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
  
}

module.exports = { registerProductHandlers };
