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
    // Tentar extrair nome do arquivo de várias formas
    let fileName = 'arquivo.zip';
    if (product.fileName) {
      fileName = product.fileName;
    } else if (product.delivery_url && !product.delivery_url.startsWith('telegram_file:')) {
      // Se for URL, extrair nome do final da URL
      const urlParts = product.delivery_url.split('/');
      fileName = urlParts[urlParts.length - 1] || 'arquivo.zip';
    }
    
    // Caption simples e curto - aparece ABAIXO do arquivo na mesma mensagem
    const fullCaption = `✅ *PAGAMENTO APROVADO!*\n\n📦 ${product.name}\n\n✅ Produto entregue com sucesso!`;
    
    // Enviar arquivo com caption (tudo em UMA mensagem)
    if (product.delivery_url && product.delivery_url.startsWith('telegram_file:')) {
      const fileId = product.delivery_url.replace('telegram_file:', '');
      console.log(`📤 [DELIVER] Enviando arquivo ZIP via file_id: ${fileId.substring(0, 30)}...`);
      console.log(`📤 [DELIVER] Nome do arquivo: ${fileName}`);
      return tg.sendDocument(chatId, fileId, {
        caption: fullCaption,
        parse_mode: 'Markdown'
      });
    }
    
    // Se for URL, enviar via URL com caption
    console.log(`📤 [DELIVER] Enviando arquivo via URL: ${product.delivery_url?.substring(0, 50)}...`);
    return tg.sendDocument(chatId, { url: product.delivery_url }, {
      filename: fileName,
      caption: fullCaption,
      parse_mode: 'Markdown'
    });
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
        console.log(`📎 [DELIVER] URL: ${item.file_url}`);
        
        if (item.file_type === 'photo') {
          // Enviar foto via URL (Telegram baixa automaticamente)
          await tg.sendPhoto(chatId, { url: item.file_url }, {
            caption: `📸 ${item.file_name}`
          });
        } else if (item.file_type === 'video') {
          // Enviar vídeo via URL (Telegram baixa automaticamente)
          await tg.sendVideo(chatId, { url: item.file_url }, {
            caption: `🎥 ${item.file_name}`
          });
        }
        
        console.log(`✅ [DELIVER] Item enviado com sucesso: ${item.file_name}`);
        
        // Registrar entrega
        await db.recordMediaDelivery({
          transactionId,
          userId,
          packId,
          mediaItemId: item.id
        });
        
        successCount++;
        
        // Delay entre envios para evitar flood
        await new Promise(resolve => setTimeout(resolve, 800));
        
      } catch (itemErr) {
        console.error(`❌ [DELIVER] Erro ao enviar item ${item.id}:`, itemErr.message);
        console.error(`❌ [DELIVER] Stack:`, itemErr.stack);
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

/**
 * Adiciona usuário ao grupo/canal privado após aprovação
 * 
 * Para grupos/canais PRIVADOS: Tenta adicionar automaticamente via API
 * Para grupos/canais PÚBLICOS: Envia link de convite (usuário precisa aceitar)
 */
async function addUserToGroup(telegram, userId, group) {
  try {
    console.log(`👥 [ADD-TO-GROUP] Tentando adicionar usuário ${userId} ao grupo/canal ${group.group_name} (ID: ${group.group_id})`);
    
    let added = false;
    const axios = require('axios');
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    
    // Método 1: Tentar unban (remove ban se existir)
    // Isso permite que usuários que foram removidos anteriormente possam voltar
    try {
      await telegram.unbanChatMember(group.group_id, userId, { only_if_banned: true });
      console.log(`✅ [ADD-TO-GROUP] Unban executado - usuário pode ter estado banido`);
    } catch (unbanErr) {
      console.log(`ℹ️ [ADD-TO-GROUP] Unban não necessário: ${unbanErr.message}`);
    }
    
    // Método 2: Tentar adicionar usando inviteUsers (novo método da API - grupos privados)
    try {
      if (telegram.inviteUsers) {
        await telegram.inviteUsers(group.group_id, [userId]);
        console.log(`✅ [ADD-TO-GROUP] Usuário adicionado via inviteUsers`);
        added = true;
        return true; // Sucesso - retorna imediatamente
      }
    } catch (inviteErr) {
      console.log(`ℹ️ [ADD-TO-GROUP] inviteUsers não disponível ou falhou: ${inviteErr.message}`);
    }
    
    // Método 3: Verificar se o bot está no grupo e tem permissões
    try {
      const botInfo = await telegram.getMe();
      const botId = botInfo.id;
      
      // Verificar se o bot está no grupo
      try {
        const chatMember = await telegram.getChatMember(group.group_id, botId);
        console.log(`ℹ️ [ADD-TO-GROUP] Bot está no grupo. Status: ${chatMember.status}`);
        
        // Se o bot não for admin, não pode adicionar
        if (chatMember.status !== 'administrator' && chatMember.status !== 'creator') {
          console.log(`⚠️ [ADD-TO-GROUP] Bot não é administrador do grupo - não pode adicionar membros automaticamente`);
          console.log(`⚠️ [ADD-TO-GROUP] Status do bot: ${chatMember.status}`);
        }
      } catch (memberErr) {
        console.log(`⚠️ [ADD-TO-GROUP] Erro ao verificar status do bot: ${memberErr.message}`);
      }
    } catch (botErr) {
      console.log(`ℹ️ [ADD-TO-GROUP] Erro ao obter info do bot: ${botErr.message}`);
    }
    
    // Método 4: Tentar adicionar via API direta (addChatMember)
    // Funciona para grupos/canais PRIVADOS se o bot for admin
    try {
      console.log(`🔄 [ADD-TO-GROUP] Tentando adicionar via addChatMember...`);
      const response = await axios.post(`https://api.telegram.org/bot${botToken}/addChatMember`, {
        chat_id: group.group_id,
        user_id: userId
      });
      
      if (response.data && response.data.ok === true) {
        console.log(`✅ [ADD-TO-GROUP] ✅✅✅ USUÁRIO ADICIONADO AUTOMATICAMENTE VIA API! ✅✅✅`);
        added = true;
        return true; // Sucesso - retorna imediatamente
      }
    } catch (apiErr) {
      const errorMsg = apiErr.response?.data?.description || apiErr.message;
      const errorCode = apiErr.response?.data?.error_code;
      
      // Log detalhado do erro para debug
      console.log(`❌ [ADD-TO-GROUP] addChatMember FALHOU: ${errorMsg} (código: ${errorCode})`);
      
      // Se for erro específico de grupo público, informar
      if (errorMsg && errorMsg.includes('USER_ALREADY_PARTICIPANT')) {
        console.log(`✅ [ADD-TO-GROUP] Usuário já está no grupo!`);
        added = true;
        return true;
      } else if (errorMsg && (errorMsg.includes('chat not found') || errorMsg.includes('CHAT_NOT_FOUND'))) {
        console.log(`❌ [ADD-TO-GROUP] ERRO: Grupo/canal não encontrado - bot pode não estar no grupo`);
        console.log(`❌ [ADD-TO-GROUP] AÇÃO NECESSÁRIA: Adicione o bot ao grupo como administrador`);
      } else if (errorMsg && (errorMsg.includes('not enough rights') || errorMsg.includes('NOT_ENOUGH_RIGHTS'))) {
        console.log(`❌ [ADD-TO-GROUP] ERRO: Bot não tem permissões para adicionar membros`);
        console.log(`❌ [ADD-TO-GROUP] AÇÃO NECESSÁRIA: Dê permissão de "Adicionar Membros" ao bot no grupo`);
      } else if (errorMsg && errorMsg.includes('group chat was upgraded to a supergroup')) {
        console.log(`❌ [ADD-TO-GROUP] ERRO: Grupo foi atualizado - precisa usar novo ID`);
        console.log(`❌ [ADD-TO-GROUP] AÇÃO NECESSÁRIA: Atualize o group_id no banco de dados`);
      } else if (errorMsg && errorMsg.includes('USER_PRIVACY_RESTRICTED')) {
        console.log(`❌ [ADD-TO-GROUP] ERRO: Usuário tem privacidade restrita - não pode ser adicionado automaticamente`);
      } else if (errorMsg && errorMsg.includes('CHAT_ADMIN_REQUIRED')) {
        console.log(`❌ [ADD-TO-GROUP] ERRO: Bot precisa ser administrador do grupo`);
        console.log(`❌ [ADD-TO-GROUP] AÇÃO NECESSÁRIA: Torne o bot administrador do grupo`);
      } else {
        console.log(`❌ [ADD-TO-GROUP] ERRO DESCONHECIDO: ${errorMsg}`);
        console.log(`ℹ️ [ADD-TO-GROUP] Isso pode ser normal para grupos públicos - usuário precisa aceitar convite`);
      }
    }
    
    // Se chegou aqui, não conseguiu adicionar automaticamente
    console.log(`🔗 [ADD-TO-GROUP] Link do grupo: ${group.group_link}`);
    
    if (added) {
      console.log(`✅ [ADD-TO-GROUP] ✅ Usuário adicionado automaticamente! ✅`);
    } else {
      console.log(`ℹ️ [ADD-TO-GROUP] Não foi possível adicionar automaticamente - link será enviado`);
    }
    
    return added;
    
  } catch (err) {
    console.error(`❌ [ADD-TO-GROUP] Erro crítico ao tentar adicionar:`, err.message);
    console.error(`❌ [ADD-TO-GROUP] Stack:`, err.stack);
    return false;
  }
}

module.exports = { deliverByLink, deliverFile, deliverContent, deliverMediaPack, addUserToGroup };

