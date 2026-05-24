// src/db/users.js
const { supabase } = require('./client');
const cache = require('../cache');
const crypto = require('crypto');


async function getUserByUUID(userId) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return user || null;
  } catch (err) {
    console.error('Erro ao buscar usuário por UUID:', err);
    return null;
  }
}

async function getUserByTelegramId(telegramId) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return null; // Não encontrado
    }
    
    if (error) throw error;
    return user;
  } catch (err) {
    console.error('Erro ao buscar usuário:', err.message);
    return null;
  }
}

async function getOrCreateUser(telegramUser) {
  try {
    const { id, username, first_name, language_code } = telegramUser;
    
    // Buscar usuário existente
    let { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('telegram_id', id)
      .single();
    
    // Se não existe, criar
    if (error && error.code === 'PGRST116') {
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{
          telegram_id: id,
          username,
          first_name,
          language_code
        }])
        .select()
        .single();
      
      if (insertError) throw insertError;
      return newUser;
    }
    
    if (error) throw error;
    
    // OTIMIZAÇÃO #3: Só atualizar se realmente mudou algo
    const needsUpdate = 
      user.username !== username || 
      user.first_name !== first_name;
    
    if (needsUpdate) {
      await supabase
        .from('users')
        .update({
          username,
          first_name,
          updated_at: new Date().toISOString()
        })
        .eq('telegram_id', id);
      
      // Atualizar objeto local
      user.username = username;
      user.first_name = first_name;
    }
    
    return user;
  } catch (err) {
    console.error('Erro get/create user:', err.message);
    throw err;
  }
}

async function isUserAdmin(telegramId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_admin')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error) return false;
    return data?.is_admin || false;
  } catch (err) {
    return false;
  }
}

async function isUserCreator(telegramId) {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('is_creator')
      .eq('telegram_id', telegramId)
      .single();
    
    if (error) {
      console.log(`🔍 [DB] Erro ao verificar criador ${telegramId}:`, error.message);
      return false;
    }
    
    const result = data?.is_creator || false;
    console.log(`🔍 [DB] Usuário ${telegramId} - is_creator: ${result}`);
    return result;
  } catch (err) {
    console.error(`❌ [DB] Erro ao verificar criador ${telegramId}:`, err.message);
    return false;
  }
}

async function setUserAsCreator(telegramId) {
  try {
    const { error } = await supabase
      .from('users')
      .update({ is_creator: true })
      .eq('telegram_id', telegramId);
    
    if (error) throw error;
    console.log(`✅ Usuário ${telegramId} definido como criador`);
    return true;
  } catch (err) {
    console.error('Erro ao definir como criador:', err);
    return false;
  }
}

// ===== PRODUTOS =====


module.exports = {
  getUserByUUID,
  getUserByTelegramId,
  getOrCreateUser,
  isUserAdmin,
  isUserCreator,
  setUserAsCreator
};
