// src/cache.js
// Sistema de cache em memória para otimizar consultas frequentes

class MemoryCache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Armazena um valor no cache com TTL (Time To Live)
   * @param {string} key - Chave do cache
   * @param {*} value - Valor a ser armazenado
   * @param {number} ttlSeconds - Tempo de vida em segundos (padrão: 60)
   */
  set(key, value, ttlSeconds = 60) {
    // Remover timer existente se houver
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Armazenar valor
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });

    // Configurar timer para remover automaticamente
    const timer = setTimeout(() => {
      this.cache.delete(key);
      this.timers.delete(key);
    }, ttlSeconds * 1000);

    this.timers.set(key, timer);
  }

  /**
   * Recupera um valor do cache
   * @param {string} key - Chave do cache
   * @returns {*} Valor armazenado ou null se não existir/expirado
   */
  get(key) {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    // Verificar se expirou
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      if (this.timers.has(key)) {
        clearTimeout(this.timers.get(key));
        this.timers.delete(key);
      }
      return null;
    }

    return item.value;
  }

  /**
   * Remove um item do cache
   * @param {string} key - Chave do cache
   */
  delete(key) {
    this.cache.delete(key);
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
  }

  /**
   * Limpa todo o cache
   */
  clear() {
    // Limpar todos os timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.cache.clear();
    this.timers.clear();
  }

  /**
   * Verifica se uma chave existe no cache
   * @param {string} key - Chave do cache
   * @returns {boolean}
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;
    
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Retorna estatísticas do cache
   * @returns {object} Estatísticas do cache
   */
  getStats() {
    // Limpar itens expirados primeiro
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.delete(key);
      }
    }

    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Instância global do cache
const cache = new MemoryCache();

module.exports = cache;

