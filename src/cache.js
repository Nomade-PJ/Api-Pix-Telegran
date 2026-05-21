// src/cache.js
// Cache desativado — na Vercel cada request pode ser uma instância diferente,
// então Map em memória nunca persiste entre chamadas. As queries vão direto ao banco.
// Mantemos a interface idêntica para não quebrar nenhum código existente.

class NoOpCache {
  set()    {}
  get()    { return null; }
  delete() {}
  clear()  {}
  has()    { return false; }
  getStats() { return { size: 0, keys: [] }; }
}

const cache = new NoOpCache();
module.exports = cache;
