// src/deliver.js
const { Telegram } = require('telegraf');

const tg = new Telegram(process.env.TELEGRAM_BOT_TOKEN);

async function deliverByLink(chatId, link, caption = 'Aqui está seu acesso:') {
  return tg.sendMessage(chatId, `${caption}
${link}`);
}

async function deliverFile(chatId, fileUrl, filename = 'pack.zip') {
  // Se for file_id do Telegram, envia diretamente
  if (fileUrl.startsWith('telegram_file:')) {
    const fileId = fileUrl.replace('telegram_file:', '');
    return tg.sendDocument(chatId, fileId);
  }
  
  // Senão, envia via URL
  return tg.sendDocument(chatId, { url: fileUrl }, { filename });
}

async function deliverContent(chatId, product, caption = '✅ **Pagamento Confirmado!**') {
  // Determinar tipo de entrega baseado no produto
  if (!product.delivery_url) {
    return tg.sendMessage(chatId, `${caption}\n\nSeu acesso ao **${product.name}** foi liberado!\n\n⚠️ Aguarde instruções do suporte.`, {
      parse_mode: 'Markdown'
    });
  }
  
  if (product.delivery_type === 'file') {
    const fullCaption = `${caption}\n\nSeu acesso ao **${product.name}** foi liberado!\n\n📄 Aqui está seu arquivo:`;
    await tg.sendMessage(chatId, fullCaption, { parse_mode: 'Markdown' });
    return deliverFile(chatId, product.delivery_url);
  } else {
    return deliverByLink(chatId, product.delivery_url, `${caption}\n\nSeu acesso ao **${product.name}** foi liberado!\n\nAcesse aqui:`);
  }
}

async function deliverMediaPack(chatId, packId, userId, transactionId, db) {
  try {
    console.log(`📸 [DELIVER] Entregando media pack ${packId} para usuário ${userId}`);
    
    // Buscar pack
    const pack = await db.getMediaPackById(packId);
    if (!pack) {
      throw new Error('Pack não encontrado');
    }
    
    // Buscar itens aleatórios
    const randomItems = await db.getRandomMediaItems(packId, userId, pack.items_per_delivery);
    
    if (randomItems.length === 0) {
      throw new Error('Nenhum item de mídia disponível');
    }
    
    console.log(`📸 [DELIVER] Encontrados ${randomItems.length} itens para entregar`);
    
    // Enviar mensagem inicial
    await tg.sendMessage(chatId, `✅ *PAGAMENTO CONFIRMADO!*

📸 *${pack.name}* 

Enviando *${randomItems.length} ${randomItems.length > 1 ? 'itens' : 'item'}* aleatório(s)...`, {
      parse_mode: 'Markdown'
    });
    
    // Enviar cada item
    let successCount = 0;
    for (const item of randomItems) {
      try {
        console.log(`📤 [DELIVER] Enviando ${item.file_type}: ${item.file_name}`);
        
        if (item.file_type === 'photo') {
          await tg.sendPhoto(chatId, item.file_url, {
            caption: `📸 ${item.file_name}`
          });
        } else if (item.file_type === 'video') {
          await tg.sendVideo(chatId, item.file_url, {
            caption: `🎥 ${item.file_name}`
          });
        }
        
        // Registrar entrega
        await db.recordMediaDelivery({
          transactionId,
          userId,
          packId,
          mediaItemId: item.id
        });
        
        successCount++;
        
        // Pequeno delay entre envios para evitar flood
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (itemErr) {
        console.error(`❌ [DELIVER] Erro ao enviar item ${item.id}:`, itemErr.message);
      }
    }
    
    console.log(`✅ [DELIVER] Entrega concluída: ${successCount}/${randomItems.length} itens enviados`);
    
    // Mensagem final
    await tg.sendMessage(chatId, `🎉 *Entrega completa!*

✅ ${successCount} ${successCount > 1 ? 'itens enviados' : 'item enviado'} com sucesso!

💡 *Dica:* A cada compra você receberá itens diferentes!

📊 Total de itens no pack: ${await db.getMediaItems(packId).then(items => items.length)}

Obrigado pela preferência! 💚`, {
      parse_mode: 'Markdown'
    });
    
    return true;
    
  } catch (err) {
    console.error(`❌ [DELIVER] Erro ao entregar media pack:`, err.message);
    
    // Notificar erro ao usuário
    try {
      await tg.sendMessage(chatId, `⚠️ *Erro na entrega*

Ocorreu um erro ao enviar suas mídias.
Entre em contato com o suporte.

Erro: ${err.message}`, {
        parse_mode: 'Markdown'
      });
    } catch (notifyErr) {
      console.error('❌ [DELIVER] Erro ao notificar usuário:', notifyErr.message);
    }
    
    throw err;
  }
}

module.exports = { deliverByLink, deliverFile, deliverContent, deliverMediaPack };

