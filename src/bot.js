// src/deliver.js
const { Telegram } = require('telegraf');
const { createClient } = require('@supabase/supabase-js');

const tg = new Telegram(process.env.TELEGRAM_BOT_TOKEN);

// Mapeamento: product_id → pasta no bucket media-packs
const PRODUCT_FOLDER_MAP = {
  'destaquesdasemana':    'semana',
  'bastidoresexclusivos': 'bastidores',
  'surpresapremium':      'surpresa',
  'essencialpremium':     'essencial',
  'mixespecialmaisescol': 'mix',
  'conteudopersonalizad': 'personalizado',
  'conteudovip':          'vip',
  'pacotecompleto':       'completo',
};

// ============================================================
// CLASSIFICAÇÃO DE ERROS DE ENTREGA
// ============================================================
function classifyDeliveryError(err) {
  const msg = err.message || '';
  const code = err.code || err.status || 0;
  if (
    code === 403 ||
    msg.includes('403') ||
    msg.includes('bot was blocked') ||
    msg.includes('user is deactivated') ||
    msg.includes('Forbidden')
  ) return 'blocked';
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
  ) return 'temporary';
  return 'unknown';
}

async function withDeliveryRetry(fn, maxRetries = 3) {
  let lastErr;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const type = classifyDeliveryError(err);
      if (type === 'blocked') throw err;
      if (attempt === maxRetries) throw err;
      const delay = attempt * 2000;
      console.warn(`⚠️ [DELIVER] Tentativa ${attempt}/${maxRetries} falhou (${type}): ${err.message} — aguardando ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ============================================================
// ENTREGA DE PRODUTO VIA SUPABASE STORAGE (sendMediaGroup)
// ============================================================

/**
 * Entrega todas as mídias da pasta do produto no Supabase Storage
 * usando sendMediaGroup (máx 10 por lote).
 */
async function deliverProductFromStorage(chatId, productId, productName) {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );

  const folder = PRODUCT_FOLDER_MAP[productId];

  if (!folder) {
    console.warn(`⚠️ [DELIVER-STORAGE] product_id "${productId}" não tem pasta mapeada`);
    // Fallback: avisar o usuário e encerrar
    await withDeliveryRetry(() =>
      tg.sendMessage(chatId,
        `✅ *PAGAMENTO CONFIRMADO!*\n\n📦 *${productName}*\n\nSeu conteúdo será enviado em breve pelo suporte.\n\n💬 Use /suporte para solicitar seu material.`,
        { parse_mode: 'Markdown' }
      )
    );
    return { success: false, reason: 'no_folder_mapping' };
  }

  console.log(`📂 [DELIVER-STORAGE] Listando arquivos em "${folder}" para produto "${productId}"`);

  // Listar arquivos da pasta no bucket
  const { data: files, error: listError } = await supabase.storage
    .from('media-packs')
    .list(folder, { limit: 200, sortBy: { column: 'name', order: 'asc' } });

  if (listError) {
    console.error(`❌ [DELIVER-STORAGE] Erro ao listar bucket:`, listError.message);
    throw new Error(`Erro ao listar mídias: ${listError.message}`);
  }

  if (!files || files.length === 0) {
    console.warn(`⚠️ [DELIVER-STORAGE] Nenhum arquivo encontrado em "${folder}"`);
    await withDeliveryRetry(() =>
      tg.sendMessage(chatId,
        `✅ *PAGAMENTO CONFIRMADO!*\n\n📦 *${productName}*\n\nSeu conteúdo será enviado em breve pelo suporte.\n\n💬 Use /suporte para solicitar seu material.`,
        { parse_mode: 'Markdown' }
      )
    );
    return { success: false, reason: 'no_files' };
  }

  // Filtrar apenas arquivos de mídia (ignorar pastas e arquivos inválidos)
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const mediaFiles = files.filter(f =>
    f.name && f.metadata && (
      /\.(jpg|jpeg|png|gif|webp)$/i.test(f.name) ||
      /\.(mp4|mov|avi|mkv|webm)$/i.test(f.name)
    )
  );

  if (mediaFiles.length === 0) {
    console.warn(`⚠️ [DELIVER-STORAGE] Nenhum arquivo de mídia válido em "${folder}"`);
    await withDeliveryRetry(() =>
      tg.sendMessage(chatId,
        `✅ *PAGAMENTO CONFIRMADO!*\n\n📦 *${productName}*\n\nSeu conteúdo será enviado em breve pelo suporte.`,
        { parse_mode: 'Markdown' }
      )
    );
    return { success: false, reason: 'no_valid_media' };
  }

  console.log(`📸 [DELIVER-STORAGE] ${mediaFiles.length} arquivo(s) encontrado(s) em "${folder}"`);

  // Mensagem inicial
  await withDeliveryRetry(() =>
    tg.sendMessage(chatId,
      `✅ *PAGAMENTO CONFIRMADO!*\n\n📦 *${productName}*\n\n🚀 Enviando *${mediaFiles.length}* ${mediaFiles.length > 1 ? 'arquivos' : 'arquivo'}...`,
      { parse_mode: 'Markdown' }
    )
  );

  // Montar URLs públicas
  const mediaWithUrls = mediaFiles.map((file, idx) => {
    const url = `${SUPABASE_URL}/storage/v1/object/public/media-packs/${folder}/${file.name}`;
    const isVideo = /\.(mp4|mov|avi|mkv|webm)$/i.test(file.name);
    return {
      type: isVideo ? 'video' : 'photo',
      media: url,
      caption: idx === 0 ? `✨ *${productName}*` : undefined,
      parse_mode: idx === 0 ? 'Markdown' : undefined,
    };
  });

  // Enviar em lotes de 10 (limite do Telegram)
  const BATCH_SIZE = 10;
  let sentCount = 0;
  let batchNum = 0;

  for (let i = 0; i < mediaWithUrls.length; i += BATCH_SIZE) {
    batchNum++;
    const batch = mediaWithUrls.slice(i, i + BATCH_SIZE);

    try {
      console.log(`📤 [DELIVER-STORAGE] Enviando lote ${batchNum} (${batch.length} itens)...`);
      await withDeliveryRetry(() =>
        tg.sendMediaGroup(chatId, batch)
      );
      sentCount += batch.length;
      console.log(`✅ [DELIVER-STORAGE] Lote ${batchNum} enviado (${sentCount}/${mediaWithUrls.length})`);
    } catch (batchErr) {
      console.error(`❌ [DELIVER-STORAGE] Erro no lote ${batchNum}:`, batchErr.message);
      // Tentar enviar arquivo por arquivo como fallback
      for (const item of batch) {
        try {
          if (item.type === 'video') {
            await withDeliveryRetry(() =>
              tg.sendVideo(chatId, { url: item.media }, item.caption ? { caption: item.caption, parse_mode: 'Markdown' } : {})
            );
          } else {
            await withDeliveryRetry(() =>
              tg.sendPhoto(chatId, { url: item.media }, item.caption ? { caption: item.caption, parse_mode: 'Markdown' } : {})
            );
          }
          sentCount++;
        } catch (itemErr) {
          console.error(`❌ [DELIVER-STORAGE] Erro no item individual:`, itemErr.message);
        }
        await new Promise(r => setTimeout(r, 500));
      }
    }

    // Delay entre lotes para evitar rate limit
    if (i + BATCH_SIZE < mediaWithUrls.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log(`✅ [DELIVER-STORAGE] Entrega concluída: ${sentCount}/${mediaWithUrls.length} arquivos`);

  // Mensagem final
  await withDeliveryRetry(() =>
    tg.sendMessage(chatId,
      `🎉 *Entrega completa!*\n\n✅ ${sentCount} ${sentCount > 1 ? 'arquivos enviados' : 'arquivo enviado'} com sucesso!\n\nObrigado pela preferência! 💚`,
      { parse_mode: 'Markdown' }
    )
  );

  return { success: true, sent: sentCount, total: mediaWithUrls.length };
}

// ============================================================
// FUNÇÕES DE ENTREGA EXISTENTES (mantidas sem alteração)
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

    try { await telegram.unbanChatMember(group.group_id, userId, { only_if_banned: true }); } catch (_) {}

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

// Exportar mapeamento para uso no admin.js
module.exports = {
  deliverByLink,
  deliverFile,
  deliverContent,
  deliverMediaPack,
  deliverProductFromStorage,
  addUserToGroup,
  classifyDeliveryError,
  PRODUCT_FOLDER_MAP,
};
