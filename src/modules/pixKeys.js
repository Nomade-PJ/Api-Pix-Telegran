// src/modules/pixKeys.js
const db = require('../database');

/**
 * Obter chave PIX ativa
 */
async function getActivePixKey() {
  try {
    const { data, error } = await db.supabase
      .from('pix_keys')
      .select('*')
      .eq('is_active', true)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    
    // Se não tem chave no banco, usar a variável de ambiente
    if (!data && process.env.MY_PIX_KEY) {
      return {
        key: process.env.MY_PIX_KEY,
        owner_name: 'Sistema',
        key_type: detectKeyType(process.env.MY_PIX_KEY),
        from_env: true
      };
    }
    
    return data;
  } catch (err) {
    console.error('Erro ao buscar chave PIX ativa:', err);
    // Fallback para variável de ambiente
    return process.env.MY_PIX_KEY ? {
      key: process.env.MY_PIX_KEY,
      owner_name: 'Sistema',
      from_env: true
    } : null;
  }
}

/**
 * Detectar tipo de chave PIX
 */
function detectKeyType(key) {
  if (key.includes('@')) return 'email';
  if (/^\d{11}$/.test(key)) return 'cpf';
  if (/^\d{14}$/.test(key)) return 'cnpj';
  if (/^\d{10,11}$/.test(key)) return 'phone';
  return 'random';
}

/**
 * Criar nova chave PIX
 */
async function createPixKey({ key, ownerName, description = null, createdBy, setAsActive = true }) {
  try {
    const keyType = detectKeyType(key);
    
    // Se deve ser ativa, desativar todas as outras
    if (setAsActive) {
      await deactivateAllKeys();
    }
    
    const { data, error } = await db.supabase
      .from('pix_keys')
      .insert([{
        key: key,
        key_type: keyType,
        owner_name: ownerName,
        description,
        is_active: setAsActive,
        is_default: false,
        created_by: createdBy
      }])
      .select()
      .single();
    
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Erro ao criar chave PIX:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Listar todas as chaves PIX
 */
async function getAllPixKeys() {
  try {
    const { data, error } = await db.supabase
      .from('pix_keys')
      .select(`
        *,
        creator:created_by(first_name, username)
      `)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao listar chaves PIX:', err);
    return [];
  }
}

/**
 * Ativar uma chave específica
 */
async function activatePixKey(keyId) {
  try {
    // Desativar todas as outras
    await deactivateAllKeys();
    
    // Ativar a selecionada
    const { error } = await db.supabase
      .from('pix_keys')
      .update({
        is_active: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', keyId);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao ativar chave PIX:', err);
    return false;
  }
}

/**
 * Desativar todas as chaves
 */
async function deactivateAllKeys() {
  try {
    const { error } = await db.supabase
      .from('pix_keys')
      .update({ is_active: false })
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Atualiza todas
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao desativar chaves:', err);
    return false;
  }
}

/**
 * Deletar uma chave PIX
 */
async function deletePixKey(keyId) {
  try {
    // Verificar se não é a única ativa
    const allKeys = await getAllPixKeys();
    const activeKeys = allKeys.filter(k => k.is_active);
    const keyToDelete = allKeys.find(k => k.id === keyId);
    
    if (activeKeys.length === 1 && keyToDelete?.is_active) {
      return { success: false, error: 'Não é possível deletar a única chave ativa. Ative outra primeiro.' };
    }
    
    const { error } = await db.supabase
      .from('pix_keys')
      .delete()
      .eq('id', keyId);
    
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Erro ao deletar chave PIX:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Atualizar chave PIX
 */
async function updatePixKey(keyId, updates) {
  try {
    const { error } = await db.supabase
      .from('pix_keys')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', keyId);
    
    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Erro ao atualizar chave PIX:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Validar formato de chave PIX
 */
function validatePixKey(key) {
  // Email
  if (key.includes('@')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(key);
  }
  
  // CPF (11 dígitos)
  if (/^\d{11}$/.test(key)) {
    return true;
  }
  
  // CNPJ (14 dígitos)
  if (/^\d{14}$/.test(key)) {
    return true;
  }
  
  // Telefone (10 ou 11 dígitos)
  if (/^\d{10,11}$/.test(key)) {
    return true;
  }
  
  // Chave aleatória (32 caracteres alfanuméricos)
  if (/^[a-zA-Z0-9]{32}$/.test(key)) {
    return true;
  }
  
  return false;
}

/**
 * Migrar chave da variável de ambiente para o banco (executar uma vez)
 */
async function migrateEnvKeyToDatabase(adminUserId) {
  try {
    const envKey = process.env.MY_PIX_KEY;
    if (!envKey) return { success: false, error: 'Nenhuma chave em MY_PIX_KEY' };
    
    // Verificar se já existe no banco
    const existing = await getAllPixKeys();
    const keyExists = existing.some(k => k.key === envKey);
    
    if (keyExists) {
      return { success: true, message: 'Chave já existe no banco' };
    }
    
    // Criar no banco
    const result = await createPixKey({
      key: envKey,
      ownerName: 'Sistema (Migrado)',
      description: 'Chave migrada automaticamente da variável de ambiente',
      createdBy: adminUserId,
      setAsActive: true
    });
    
    return result;
  } catch (err) {
    console.error('Erro ao migrar chave:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  getActivePixKey,
  createPixKey,
  getAllPixKeys,
  activatePixKey,
  deactivateAllKeys,
  deletePixKey,
  updatePixKey,
  validatePixKey,
  detectKeyType,
  migrateEnvKeyToDatabase
};

