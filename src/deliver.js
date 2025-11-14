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

module.exports = { deliverByLink, deliverFile, deliverContent };

