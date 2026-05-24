// src/db/settings.js
const { supabase } = require('./client');

async function getSetting(key) {
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', key)
      .single();
    
    if (error) {
      // Se não existe, retornar do env como fallback
      if (key === 'pix_key') {
        return process.env.MY_PIX_KEY || null;
      }
      return null;
    }
    
    return data.value;
  } catch (err) {
    console.error('Erro ao buscar setting:', err.message);
    // Fallback para variável de ambiente
    if (key === 'pix_key') {
      return process.env.MY_PIX_KEY || null;
    }
    return null;
  }
}

async function setSetting(key, value, updatedBy = null) {
  try {
    const { data, error } = await supabase
      .from('settings')
      .upsert({
        key,
        value,
        updated_by: updatedBy,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'key'
      })
      .select()
      .single();
    
    if (error) throw error;
    console.log('Setting atualizado:', key);
    return data;
  } catch (err) {
    console.error('Erro ao salvar setting:', err.message);
    throw err;
  }
}

async function getPixKey() {
  return await getSetting('pix_key');
}

async function setPixKey(pixKey, updatedBy = null) {
  return await setSetting('pix_key', pixKey, updatedBy);
}

module.exports = {
  getSetting,
  setSetting,
  getPixKey,
  setPixKey
};
