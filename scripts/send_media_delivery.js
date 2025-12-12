// Script para enviar mídias já registradas no banco de dados
const db = require('../src/database');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function sendTelegramMessage(chatId, text, parseMode = 'Markdown') {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: parseMode
    })
  });
  return await response.json();
}

async function sendTelegramPhoto(chatId, photoUrl, caption) {
  const response = await fetch(`${TELEGRAM_API}/sendPhoto`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      photo: photoUrl,
      caption: caption
    })
  });
  return await response.json();
}

async function sendTelegramVideo(chatId, videoUrl, caption) {
  const response = await fetch(`${TELEGRAM_API}/sendVideo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      video: videoUrl,
      caption: caption
    })
  });
  return await response.json();
}

async function sendRegisteredMediaDelivery(txid) {
  try {
    console.log(`📤 Iniciando envio de mídias para transação ${txid}`);
    
    // Buscar transação
    const transaction = await db.getTransactionByTxid(txid);
    if (!transaction) {
      throw new Error(`Transação ${txid} não encontrada`);
    }
    
    if (!transaction.media_pack_id) {
      throw new Error('Esta transação não é um media pack');
    }
    
    // Buscar entregas registradas
    const { data: deliveries, error } = await db.supabase
      .from('media_deliveries')
      .select(`
        *,
        media_items:media_item_id (*)
      `)
      .eq('transaction_id', transaction.id)
      .order('delivered_at');
    
    if (error) throw error;
    
    if (!deliveries || deliveries.length === 0) {
      throw new Error('Nenhuma entrega registrada encontrada');
    }
    
    const pack = await db.getMediaPackById(transaction.media_pack_id);
    const chatId = transaction.telegram_id;
    
    // Enviar mensagem inicial
    await sendTelegramMessage(chatId, `✅ *PAGAMENTO CONFIRMADO!*

📸 *${pack.name}* 

Enviando *${deliveries.length} ${deliveries.length > 1 ? 'itens' : 'item'}*...`);
    
    // Enviar cada item registrado
    let successCount = 0;
    for (const delivery of deliveries) {
      const item = delivery.media_items;
      if (!item) continue;
      
      try {
        console.log(`📤 Enviando ${item.file_type}: ${item.file_name}`);
        console.log(`📎 URL: ${item.file_url}`);
        
        if (item.file_type === 'photo') {
          await sendTelegramPhoto(chatId, item.file_url, `📸 ${item.file_name}`);
        } else if (item.file_type === 'video') {
          await sendTelegramVideo(chatId, item.file_url, `🎥 ${item.file_name}`);
        }
        
        console.log(`✅ Item enviado: ${item.file_name}`);
        successCount++;
        
        // Delay entre envios
        await new Promise(resolve => setTimeout(resolve, 800));
        
      } catch (itemErr) {
        console.error(`❌ Erro ao enviar item ${item.id}:`, itemErr.message);
      }
    }
    
    // Mensagem final
    const totalItems = await db.getMediaItems(transaction.media_pack_id).then(items => items.length);
    
    await sendTelegramMessage(chatId, `🎉 *Entrega completa!*

✅ ${successCount} ${successCount > 1 ? 'itens enviados' : 'item enviado'} com sucesso!

💡 *Dica:* A cada compra você receberá itens diferentes!

📊 Total de itens no pack: ${totalItems}

Obrigado pela preferência! 💚`);
    
    console.log(`✅ Entrega concluída: ${successCount}/${deliveries.length} itens enviados`);
    return true;
    
  } catch (err) {
    console.error('❌ Erro ao enviar mídias:', err);
    throw err;
  }
}

// Executar
const txid = process.argv[2] || 'M328716869U0Q';

sendRegisteredMediaDelivery(txid)
  .then(() => {
    console.log('✅ Script executado com sucesso!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Erro:', err.message);
    process.exit(1);
  });

