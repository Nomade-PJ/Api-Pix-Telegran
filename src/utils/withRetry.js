// src/utils/withRetry.js
// Utilitário centralizado de retry para erros de conexão com o Supabase.
// Substitui o padrão copy-paste de while(retries > 0) espalhado pelo projeto.

const CONNECTION_ERROR_PATTERNS = [
  'fetch failed', 'SocketError', 'other side closed',
  'ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'UND_ERR_SOCKET',
];

function isConnectionError(err) {
  const str = [err?.message || '', err?.details || '', err?.code || '', JSON.stringify(err)].join(' ');
  return CONNECTION_ERROR_PATTERNS.some(p => str.includes(p));
}

/**
 * Executa fn com retry automático em erros de conexão.
 * @param {Function} fn        - Função async que lança erro em falha
 * @param {Object}   options
 * @param {number}   options.retries  - Tentativas máximas (padrão: 3)
 * @param {number}   options.delay    - Espera ms entre tentativas (padrão: 2000)
 * @param {string}   options.label    - Prefixo para logs (ex: '[EXPIRE-JOB]')
 */
async function withRetry(fn, { retries = 3, delay = 2000, label = '[RETRY]' } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (!isConnectionError(err)) throw err; // Erro real — não faz retry

      if (attempt < retries) {
        console.warn(`⚠️ ${label} Erro de conexão (tentativa ${attempt}/${retries}): ${err.message || 'desconhecido'}. Aguardando ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      } else {
        console.warn(`⚠️ ${label} Erro de conexão após ${retries} tentativas — próximo ciclo tentará novamente.`);
      }
    }
  }

  const exhausted = new Error(lastError?.message || 'Conexão esgotada após retries');
  exhausted._isConnectionRetryExhausted = true;
  throw exhausted;
}

module.exports = { withRetry, isConnectionError };
