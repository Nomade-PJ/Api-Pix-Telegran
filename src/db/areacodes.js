// src/db/areacodes.js
const { supabase } = require('./client');
const cache = require('../cache');
const crypto = require('crypto');


async function getBlockedAreaCodes() {
  try {
    const { data, error } = await supabase
      .from('blocked_area_codes')
      .select('*')
      .order('area_code');
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar DDDs bloqueados:', err);
    return [];
  }
}

async function isAreaCodeBlocked(areaCode) {
  try {
    const { data, error } = await supabase
      .from('blocked_area_codes')
      .select('*')
      .eq('area_code', areaCode)
      .single();
    
    if (error && error.code === 'PGRST116') {
      return false; // Não encontrado = não bloqueado
    }
    
    if (error) throw error;
    return true; // Encontrado = bloqueado
  } catch (err) {
    console.error('Erro ao verificar DDD:', err);
    return false;
  }
}

async function addBlockedAreaCode(areaCode, state, reason = '') {
  try {
    const { data, error } = await supabase
      .from('blocked_area_codes')
      .insert([{ area_code: areaCode, state, reason }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao adicionar DDD bloqueado:', err);
    return null;
  }
}

async function removeBlockedAreaCode(areaCode) {
  try {
    const { error } = await supabase
      .from('blocked_area_codes')
      .delete()
      .eq('area_code', areaCode);
    
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Erro ao remover DDD bloqueado:', err);
    return false;
  }
}

async function updateUserPhone(telegramId, phoneNumber) {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ phone_number: phoneNumber })
      .eq('telegram_id', telegramId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Erro ao atualizar telefone:', err);
    return null;
  }
}

function extractAreaCode(phoneNumber) {
  // Remove todos os caracteres não numéricos
  const cleaned = phoneNumber.replace(/\D/g, '');
  
  // Formato brasileiro: +55 (DDD) XXXXX-XXXX
  // Pode vir como: 5511999999999, 11999999999, (11) 99999-9999, etc.
  
  if (cleaned.length >= 12 && cleaned.startsWith('55')) {
    // Formato internacional: 5511999999999
    return cleaned.substring(2, 4);
  } else if (cleaned.length === 11 && cleaned.startsWith('5')) {
    // Formato especial: 59892253870 (DDD nas posições 2-3, não nas posições 0-1)
    // Verificar se posições 2-3 formam um DDD válido bloqueado (98, 86, 64)
    const possibleDDD = cleaned.substring(1, 3);
    if (['98', '86', '64'].includes(possibleDDD)) {
      return possibleDDD;
    }
    // Se não for um DDD bloqueado conhecido, retorna os primeiros 2 dígitos
    return cleaned.substring(0, 2);
  } else if (cleaned.length >= 10) {
    // Formato nacional: 11999999999
    return cleaned.substring(0, 2);
  }
  
  return null;
}

// Função para obter usuários mensais (últimos 30 dias)

module.exports = {
  getBlockedAreaCodes,
  isAreaCodeBlocked,
  addBlockedAreaCode,
  removeBlockedAreaCode,
  updateUserPhone,
  extractAreaCode
};
