// src/jobs/updateBotDescription.js
// Job automático para atualizar a descrição curta do bot com usuários mensais

const db = require('../database');
const axios = require('axios');

/**
 * Função auxiliar para fazer retry com backoff exponencial
 */
async function retryWithBackoff(fn, maxRetries = 3, initialDelay = 2000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLastAttempt = attempt === maxRetries;
      const isTimeoutError = err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED' || err.message?.includes('timeout');
      const isNetworkError = err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET';
      
      if (isLastAttempt || (!isTimeoutError && !isNetworkError)) {
        throw err;
      }
      
      const delay = initialDelay * Math.pow(2, attempt - 1);
      console.log(`⚠️ [BOT-DESC] Tentativa ${attempt}/${maxRetries} falhou (${err.message}). Tentando novamente em ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * Atualiza a descrição curta do bot com a quantidade de usuários mensais
 */
async function updateBotDescription() {
  try {
    console.log('🔄 [BOT-DESC] Iniciando atualização da descrição do bot...');
    
    // Buscar usuários mensais com timeout
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
    
    console.log('🌐 [BOT-DESC] Enviando requisição para API do Telegram (com retry)...');
    
    // Fazer requisição com retry automático
    const response = await retryWithBackoff(async () => {
      return await axios.post(
        `https://api.telegram.org/bot${token}/setMyShortDescription`,
        {
          short_description: description
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000, // 30 segundos de timeout
          validateStatus: (status) => status < 500 // Não lançar erro para status < 500
        }
      );
    }, 3, 2000); // 3 tentativas, começando com 2 segundos
    
    console.log('📥 [BOT-DESC] Resposta da API recebida');
    
    if (response.data && response.data.ok) {
      console.log(`✅ [BOT-DESC] Descrição atualizada com sucesso: "${description}"`);
      return { success: true, description, monthlyUsers };
    } else {
      const errorMsg = response.data?.description || 'Erro desconhecido da API';
      console.error(`❌ [BOT-DESC] API retornou erro: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
    
  } catch (err) {
    // Não crashar - apenas logar e continuar
    console.error('❌ [BOT-DESC] Erro ao atualizar descrição:');
    console.error('   Mensagem:', err.message);
    console.error('   Código:', err.code || 'N/A');
    
    if (err.response) {
      console.error('   Status HTTP:', err.response.status);
      console.error('   Dados:', JSON.stringify(err.response.data).substring(0, 200));
    }
    
    // Não imprimir stack completo para não poluir logs
    console.error('   ℹ️ Job continuará tentando na próxima execução');
    
    return { success: false, error: err.message, code: err.code };
  }
}

/**
 * Inicia o job de atualização automática da descrição
 * Aguarda 1 minuto antes da primeira execução (evitar problemas no cold start)
 * Depois executa a cada 1 hora
 */
function startBotDescriptionJob() {
  console.log('🚀 [BOT-DESC] Job de atualização de descrição iniciado');
  console.log('   ⏳ Primeira execução em 1 minuto (evitar cold start)');
  console.log('   🔄 Depois a cada 1 hora');
  
  // Aguardar 1 minuto antes da primeira execução (evitar problemas de cold start)
  setTimeout(() => {
    console.log('🔄 [BOT-DESC] Executando primeira atualização...');
    updateBotDescription().catch(err => {
      console.error('❌ [BOT-DESC] Erro na primeira execução (será tentado novamente em 1 hora)');
    });
  }, 60 * 1000); // 1 minuto
  
  // Executar a cada 1 hora (3600000ms)
  const interval = setInterval(() => {
    console.log('🔄 [BOT-DESC] Executando atualização agendada...');
    updateBotDescription().catch(err => {
      console.error('❌ [BOT-DESC] Erro na atualização agendada (será tentado novamente em 1 hora)');
    });
  }, 60 * 60 * 1000); // 1 hora
  
  // Retornar interval para poder cancelar se necessário
  return interval;
}

module.exports = {
  updateBotDescription,
  startBotDescriptionJob
};

