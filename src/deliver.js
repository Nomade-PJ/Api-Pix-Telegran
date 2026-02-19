// src/deliver.js
const { Telegram } = require('telegraf');

const tg = new Telegram(process.env.TELEGRAM_BOT_TOKEN);

// ============================================================
// CLASSIFICAÇÃO DE ERROS DE ENTREGA
// ============================================================

/**
 * Classifica o erro do Telegram para determinar a ação correta
 * Retorna: 'blocked' | 'temporary' | 'unknown'
 */
function classifyDeliveryError(err) {
  const msg = err.message || '';
  const code = err.code || err.status || 0;

  // 403 = usuário bloqueou o bot ou conta deletada
  if (
    code === 403 ||
    msg.includes('403') ||
    msg.includes('bot was blocked') ||
    msg.includes('user is deactivated') ||
    msg.includes('Forbidden')
  ) {
    return 'blocked';
  }

  // Erros temporários de rede/timeout/rate limit
  if (
    msg.includes('ETIMEDOUT') ||
    msg.includes('ECONNRESET') ||
    msg.includes('fetch failed') ||
    msg.includes('socket hang up') ||
    msg.includes('ENOTFOUND') ||
    msg.includes('429') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504')
  ) {
    return 'temporary';
  }

  return 'unknown';
}

/**
 * Wrapper com retry automático para erros temporários.
 * Para erros 403 (bloqueado), falha imediatamente sem retry.
 */
async function withDeliveryRetry(fn, maxRetries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const type = classifyDeliveryError(err);

      if (type === 'blocked') throw err; // não adianta tentar de novo

      if (attempt === maxRetries) throw err;

      const delay = attempt * 2000; // 2s depois 4s
      console.warn(`⚠️ [DELIVER] Tentativa ${attempt}/${maxRetries} falhou (${type}): ${err.message} — aguardando ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ============================================================
// FUNÇÕES DE ENTREGA
// ============================================================

async function deliverByLink(chatId, link, caption = 'Aqui está seu acesso:') {
  return withDeliveryRetry(() =>
    tg.sendMessage(chatId, `${caption}\n${link}`)
  );
}

async function deliverFile(chatId, fileUrl, filename = 'pack.zip') {
  return withDeliveryRetry(() => {
    if (fileUrl.startsWith('telegram_file:')) {
      const fileId = fileUrl.replace('telegram_file:', '');
      return tg.sendDocument(chatId, fileId);
    }
    return tg.sendDocument(chatId, { url: fileUrl }, { filename });
  });
}

async function deliverContent(chatId, product, caption = '✅ **Pagamento Confirmado!**') {
  if (!product.delivery_url) {
    return withDeliveryRetry(() =>
      tg.sendMessage(chatId, `${caption}\n\nSeu acesso ao **${product.name}** foi liberado!\n\n⚠️ Aguarde instruções do suporte.`, {
        parse_mode: 'Markdown'
      })
    );
  }

  if (product.delivery_type === 'file') {
    let fileName = 'arquivo.zip';
    if (product.fileName) {
      fileName = product.fileName;
    } else if (product.delivery_url && !product.delivery_url.startsWith('telegram_file:')) {
      const urlParts = product.delivery_url.split('/');
      fileName = urlParts[urlParts.length - 1] || 'arquivo.zip';
    }

    const fullCaption = `✅ *PRODUTO ENTREGUE COM SUCESSO!*\n\n📦 ${product.name}\n\n🎉 Obrigado pela compra!`;

    if (product.delivery_url && product.delivery_url.startsWith('telegram_file:')) {
      const fileId = product.delivery_url.replace('telegram_file:', '');
      console.log(`📤 [DELIVER] Enviando arquivo ZIP via file_id: ${fileId.substring(0, 30)}...`);
      return withDeliveryRetry(() =>
        tg.sendDocument(chatId, fileId, { caption: fullCaption, parse_mode: 'Markdown' })
      );
    }

    console.log(`📤 [DELIVER] Enviando arquivo via URL: ${product.delivery_url?.substring(0, 50)}...`);
    return withDeliveryRetry(() =>
      tg.sendDocument(chatId, { url: product.delivery_url }, {
        filename: fileName,
        caption: fullCaption,
        parse_mode: 'Markdown'
      })
    );
  }

  return deliverByLink(
    chatId,
    product.delivery_url,
    `${caption}\n\nSeu acesso ao **${product.name}** foi liberado!\n\nAcesse aqui:`
  );
}

async function deliverMediaPack(chatId, packId, userId, transactionId, db) {
  try {
    console.log(`📸 [DELIVER] Entregando media pack ${packId} para usuário ${userId}`);

    const pack = await db.getMediaPackById(packId);
    if (!pack) throw new Error('Pack não encontrado');

    const randomItems = await db.getRandomMediaItems(packId, userId, pack.items_per_delivery);
    if (randomItems.length === 0) throw new Error('Nenhum item de mídia disponível');

    console.log(`📸 [DELIVER] Encontrados ${randomItems.length} itens para entregar`);

    await withDeliveryRetry(() =>
      tg.sendMessage(chatId, `✅ *PAGAMENTO CONFIRMADO!*\n\n📸 *${pack.name}* \n\nEnviando *${randomItems.length} ${randomItems.length > 1 ? 'itens' : 'item'}* aleatório(s)...`, {
        parse_mode: 'Markdown'
      })
    );

    let successCount = 0;
    for (const item of randomItems) {
      try {
        console.log(`📤 [DELIVER] Enviando ${item.file_type}: ${item.file_name}`);

        if (item.file_type === 'photo') {
          await withDeliveryRetry(() =>
            tg.sendPhoto(chatId, { url: item.file_url }, { caption: `📸 ${item.file_name}` })
          );
        } else if (item.file_type === 'video') {
          await withDeliveryRetry(() =>
            tg.sendVideo(chatId, { url: item.file_url }, { caption: `🎥 ${item.file_name}` })
          );
        }

        await db.recordMediaDelivery({ transactionId, userId, packId, mediaItemId: item.id });
        successCount++;
        await new Promise(resolve => setTimeout(resolve, 800));

      } catch (itemErr) {
        console.error(`❌ [DELIVER] Erro ao enviar item ${item.id}:`, itemErr.message);
      }
    }

    console.log(`✅ [DELIVER] Entrega concluída: ${successCount}/${randomItems.length} itens`);

    await withDeliveryRetry(() =>
      tg.sendMessage(chatId, `🎉 *Entrega completa!*\n\n✅ ${successCount} ${successCount > 1 ? 'itens enviados' : 'item enviado'} com sucesso!\n\n💡 *Dica:* A cada compra você receberá itens diferentes!\n\nObrigado pela preferência! 💚`, {
        parse_mode: 'Markdown'
      })
    );

    return true;

  } catch (err) {
    console.error(`❌ [DELIVER] Erro ao entregar media pack:`, err.message);
    const type = classifyDeliveryError(err);
    if (type !== 'blocked') {
      try {
        await tg.sendMessage(chatId, `⚠️ *Erro na entrega*\n\nOcorreu um erro ao enviar suas mídias. Entre em contato com o suporte.`, {
          parse_mode: 'Markdown'
        });
      } catch (_) {}
    }
    throw err;
  }
}

async function addUserToGroup(telegram, userId, group) {
  try {
    console.log(`👥 [ADD-TO-GROUP] Tentando adicionar ${userId} ao grupo ${group.group_name}`);

    const axios = require('axios');
    const botToken = process.env.TELEGRAM_BOT_TOKEN;

    try {
      await telegram.unbanChatMember(group.group_id, userId, { only_if_banned: true });
    } catch (_) {}

    try {
      if (telegram.inviteUsers) {
        await telegram.inviteUsers(group.group_id, [userId]);
        console.log(`✅ [ADD-TO-GROUP] Adicionado via inviteUsers`);
        return true;
      }
    } catch (_) {}

    try {
      const response = await axios.post(`https://api.telegram.org/bot${botToken}/addChatMember`, {
        chat_id: group.group_id,
        user_id: userId
      });
      if (response.data?.ok === true) {
        console.log(`✅ [ADD-TO-GROUP] Adicionado via API`);
        return true;
      }
    } catch (apiErr) {
      const errorMsg = apiErr.response?.data?.description || apiErr.message;
      if (errorMsg?.includes('USER_ALREADY_PARTICIPANT')) return true;
      console.log(`❌ [ADD-TO-GROUP] Falhou: ${errorMsg}`);
    }

    return false;

  } catch (err) {
    console.error(`❌ [ADD-TO-GROUP] Erro crítico:`, err.message);
    return false;
  }
}

module.exports = {
  deliverByLink,
  deliverFile,
  deliverContent,
  deliverMediaPack,
  addUserToGroup,
  classifyDeliveryError
};
