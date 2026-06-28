// src/admin/media.js
// Handlers de foto, arquivo e upload de mídia
const { Markup } = require('telegraf');
const db = require('../database');
const deliver = require('../deliver');

function registerMediaHandlers(bot) {
  // ===== HANDLER DE FOTOS (PARA BROADCAST) =====
  bot.on('photo', async (ctx, next) => {
    try {
      const isCreator = await db.isUserCreator(ctx.from.id);
      
      if (!isCreator) {
        return next();
      }
      
      global._SESSIONS = global._SESSIONS || {};
      const session = global._SESSIONS[ctx.from.id];
      
      // ── BPM: imagem do "Com Produto" (multi) ──────────────────────────────────
      if (session && session.type === 'creator_broadcast_product_multi' &&
          (session.step === 'image' || session.step === 'message')) {

        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        session.imageFileId = photo.file_id;

        // Se ainda estava no step 'message', usa a legenda da foto como mensagem
        // (o usuário enviou a foto diretamente sem digitar texto separado)
        if (session.step === 'message') {
          const caption = ctx.message.caption || '';
          if (!caption.trim()) {
            // Sem legenda e sem mensagem — pedir que adicione legenda ou texto
            return ctx.reply(
              `⚠️ *Foto recebida, mas falta a mensagem!*\n\nPor favor, reenvie a foto com uma *legenda* (caption) ou primeiro envie o texto da mensagem e depois a foto.\n\n_Cancelar: /cancelar_`,
              { parse_mode: 'Markdown' }
            );
          }
          session.broadcastMessage = caption;
        }

        session.step = 'confirm';

        const listaSel = (session.selectedProducts || []).map(p =>
          `• ${p.name} — R$ ${parseFloat(p.price).toFixed(2)}`
        ).join('\n');

        return ctx.reply(
          `🛍️ *CONFIRMAR BROADCAST COM PRODUTO*\n\n*Mensagem:*\n${session.broadcastMessage}\n\n📸 *Imagem:* Anexada ✅\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n📦 *Produtos em destaque:*\n${listaSel}\n\n━━━━━━━━━━━━━━━━━━━━━━━━\n\n⚠️ *Será enviado para TODOS os usuários.*\n\nDeseja continuar?`,
          {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('✅ Confirmar e Enviar', 'confirm_bpm_broadcast')],
              [Markup.button.callback('❌ Cancelar', 'cancel_creator_broadcast')]
            ])
          }
        );
      }

      // Verificar se é broadcast + produto + cupom - imagem
      if (session && session.type === 'creator_broadcast_product_coupon' && session.step === 'image') {

        // Pegar a foto de maior qualidade (última do array)
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const photoFileId = photo.file_id;
        
        // Salvar file_id da imagem
        session.imageFileId = photoFileId;
        session.step = 'confirm';
        
        // Preparar confirmação
        const { Markup } = require('telegraf');
        
        let previewMessage = `🎁 *CONFIRMAR BROADCAST + PRODUTO + DESCONTO*

*Mensagem:*
${session.broadcastMessage}

📸 *Imagem:* Anexada

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
      
      return next();
    } catch (err) {
      console.error('Erro ao processar foto:', err);
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


}

module.exports = { registerMediaHandlers };
