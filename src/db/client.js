// src/db/client.js
// Cliente Supabase singleton — importado por todos os módulos db/
// createClient é chamado UMA única vez em toda a aplicação.
const { createClient } = require('@supabase/supabase-js');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ [DB] SUPABASE_URL e SUPABASE_SERVICE_KEY são obrigatórios');
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = { supabase };
