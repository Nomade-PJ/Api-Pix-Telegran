// src/db/ocr.js
const { supabase } = require('./client');


/**
 * Verifica se já existe análise OCR para uma transação
 * Retorna o resultado se existir, null caso contrário
 */
async function getOCRResult(txid) {
  try {
    console.log(`🔍 [DB-CACHE] Buscando cache OCR para TXID: ${txid}`);
    const { data, error } = await supabase
      .from('transactions')
      .select('ocr_result, ocr_confidence, ocr_analyzed_at')
      .eq('txid', txid)
      .single();
    
    // PGRST116 = not found (transação não existe ou campos não existem ainda)
    if (error && error.code === 'PGRST116') {
      console.log(`ℹ️ [DB-CACHE] Nenhum cache encontrado para TXID ${txid} (primeira análise)`);
      return null;
    }
    
    if (error) {
      console.error(`❌ [DB-CACHE] Erro ao buscar cache:`, error.message);
      return null;
    }
    
    // Se existe resultado e foi analisado recentemente (últimas 24h), retornar
    if (data && data.ocr_result && data.ocr_analyzed_at) {
      const analyzedAt = new Date(data.ocr_analyzed_at);
      const now = new Date();
      const hoursDiff = (now - analyzedAt) / (1000 * 60 * 60);
      
      if (hoursDiff < 24) {
        console.log(`✅ [DB-CACHE] Cache OCR encontrado para TXID ${txid} (${hoursDiff.toFixed(1)}h atrás)`);
        return {
          isValid: data.ocr_result.isValid,
          confidence: data.ocr_confidence,
          details: data.ocr_result.details || {}
        };
      } else {
        console.log(`⏰ [DB-CACHE] Cache expirado para TXID ${txid} (${hoursDiff.toFixed(1)}h atrás, > 24h)`);
      }
    } else {
      console.log(`ℹ️ [DB-CACHE] Nenhum resultado OCR salvo ainda para TXID ${txid}`);
    }
    
    return null;
  } catch (err) {
    console.error(`❌ [DB-CACHE] Erro ao buscar cache OCR:`, err.message);
    console.error(`❌ [DB-CACHE] Stack:`, err.stack);
    return null;
  }
}

/**
 * Salva resultado do OCR no banco para cache
 */
async function saveOCRResult(txid, ocrResult) {
  try {
    console.log(`💾 [DB-CACHE] Salvando resultado OCR no cache para TXID: ${txid}`);
    const { error } = await supabase
      .from('transactions')
      .update({
        ocr_result: ocrResult,
        ocr_confidence: ocrResult.confidence || 0,
        ocr_analyzed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('txid', txid);
    
    if (error) {
      console.error(`❌ [DB-CACHE] Erro ao salvar cache:`, error.message);
      throw error;
    }
    
    console.log(`✅ [DB-CACHE] Resultado OCR salvo no cache para TXID ${txid} (confiança: ${ocrResult.confidence || 0}%)`);
    return true;
  } catch (err) {
    console.error(`❌ [DB-CACHE] Erro ao salvar cache OCR:`, err.message);
    console.error(`❌ [DB-CACHE] Stack:`, err.stack);
    return false;
  }
}

/**
 * Atualiza URL do arquivo de comprovante (para uso futuro com Supabase Storage)
 */
async function updateProofFileUrl(txid, fileUrl) {
  try {
    const { error } = await supabase
      .from('transactions')
      .update({
        proof_file_url: fileUrl,
        updated_at: new Date().toISOString()
      })
      .eq('txid', txid);
    
    if (error) {
      console.warn(`⚠️ [DB-CACHE] Erro ao atualizar URL do arquivo:`, error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn(`⚠️ [DB-CACHE] Erro ao atualizar URL do arquivo:`, err.message);
    return false;
  }
}


module.exports = {
  getOCRResult,
  saveOCRResult,
  updateProofFileUrl
};
