// src/jobs/updateBotDescription.js
// Job automático para atualizar a descrição curta do bot com usuários mensais

const db = require('../database');
const axios = require('axios');

/**
 * Atualiza a descrição curta do bot com a quantidade de usuários mensais
 */
async function updateBotDescription() {
  try {
    console.log('🔄 [BOT-DESC] Atualizando descrição do bot...');
    
    // Buscar usuários mensais
    const monthlyUsers = await db.getMonthlyUsers();
    
    // Formatar número com pontos (ex: 82.531)
    const formattedUsers = monthlyUsers.toLocaleString('pt-BR');
    
    // Criar descrição no formato similar ao exemplo
    const description = `${formattedUsers} usuários mensais`;
    
    // Atualizar descrição curta do bot usando a API do Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      console.error('❌ [BOT-DESC] TELEGRAM_BOT_TOKEN não configurado');
      return { success: false, error: 'Token não configurado' };
    }
    
    const response = await axios.post(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
      short_description: description
    });
    
    if (response.data && response.data.ok) {
      console.log(`✅ [BOT-DESC] Descrição atualizada: "${description}"`);
      return { success: true, description, monthlyUsers };
    } else {
      throw new Error(response.data?.description || 'Erro desconhecido da API');
    }
    
  } catch (err) {
    console.error('❌ [BOT-DESC] Erro ao atualizar descrição:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Inicia o job de atualização automática da descrição
 * Executa ao iniciar e depois a cada 1 hora
 */
function startBotDescriptionJob() {
  console.log('🚀 [BOT-DESC] Job de atualização de descrição iniciado - executará a cada 1 hora');
  
  // Executar imediatamente na inicialização
  updateBotDescription();
  
  // Executar a cada 1 hora (3600000ms)
  const interval = setInterval(() => {
    updateBotDescription();
  }, 60 * 60 * 1000); // 1 hora
  
  // Retornar interval para poder cancelar se necessário
  return interval;
}

module.exports = {
  updateBotDescription,
  startBotDescriptionJob
};

