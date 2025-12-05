// src/jobs/updateBotDescription.js
// Job automático para atualizar a descrição curta do bot com usuários mensais

const db = require('../database');
const axios = require('axios');

/**
 * Atualiza a descrição curta do bot com a quantidade de usuários mensais
 */
async function updateBotDescription() {
  try {
    console.log('🔄 [BOT-DESC] Iniciando atualização da descrição do bot...');
    
    // Buscar usuários mensais
    const monthlyUsers = await db.getMonthlyUsers();
    console.log(`📊 [BOT-DESC] Usuários mensais encontrados: ${monthlyUsers}`);
    
    // Formatar número com pontos (ex: 82.531)
    const formattedUsers = monthlyUsers.toLocaleString('pt-BR');
    
    // Criar descrição no formato similar ao exemplo
    const description = `${formattedUsers} usuários mensais`;
    console.log(`📝 [BOT-DESC] Descrição que será enviada: "${description}"`);
    
    // Atualizar descrição curta do bot usando a API do Telegram
    const token = process.env.TELEGRAM_BOT_TOKEN;
    
    if (!token) {
      console.error('❌ [BOT-DESC] TELEGRAM_BOT_TOKEN não configurado');
      return { success: false, error: 'Token não configurado' };
    }
    
    console.log('🌐 [BOT-DESC] Enviando requisição para API do Telegram...');
    console.log('   Endpoint: setMyShortDescription (Atualiza o campo "About")');
    
    // API do Telegram aceita POST com JSON ou GET com query params
    // Usando POST com JSON (método mais comum)
    const response = await axios.post(`https://api.telegram.org/bot${token}/setMyShortDescription`, {
      short_description: description
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📥 [BOT-DESC] Resposta da API:', JSON.stringify(response.data));
    
    if (response.data && response.data.ok) {
      console.log(`✅ [BOT-DESC] Descrição atualizada com sucesso: "${description}"`);
      return { success: true, description, monthlyUsers };
    } else {
      const errorMsg = response.data?.description || 'Erro desconhecido da API';
      console.error(`❌ [BOT-DESC] API retornou erro: ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
  } catch (err) {
    console.error('❌ [BOT-DESC] Erro ao atualizar descrição:');
    console.error('   Mensagem:', err.message);
    if (err.response) {
      console.error('   Status:', err.response.status);
      console.error('   Dados:', JSON.stringify(err.response.data));
    }
    if (err.stack) {
      console.error('   Stack:', err.stack);
    }
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

