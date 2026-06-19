// src/db/mediapacks.js
const { supabase } = require('./client');
const { withRetry, isConnectionError } = require('../utils/withRetry');

async function getAllMediaPacks() {
  try {
    const { data, error } = await supabase
      .from('media_packs')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const packs = data || [];
    
    // Buscar contagem de itens para cada pack separadamente
    for (const pack of packs) {
      const { count } = await supabase
        .from('media_items')
        .select('*', { count: 'exact', head: true })
        .eq('pack_id', pack.pack_id);
      
      pack.items_count = count || 0;
    }
    
    return packs;
  } catch (err) {
    console.error('Erro ao buscar media packs:', err.message);
    return [];
  }
}

async function getMediaPackById(packId) {
  try {
    const { data, error } = await supabase
      .from('media_packs')
      .select('*')
      .eq('pack_id', packId)
      .single();
    
    if (error) {
      // PGRST116 = pack não encontrado (0 rows) - isso é esperado e não é um erro
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }
    return data;
  } catch (err) {
    // Só logar se não for o erro esperado de "não encontrado"
    if (err.code !== 'PGRST116') {
      console.error('Erro ao buscar media pack:', err.message);
    }
    return null;
  }
}

async function createMediaPack({ packId, name, description, price, itemsPerDelivery = 3 }) {
  try {
    const { data, error } = await supabase
      .from('media_packs')
      .insert([{
        pack_id: packId,
        name,
        description,
        price,
        items_per_delivery: itemsPerDelivery
      }])
      .select()
      .single();
    
    if (error) throw error;
    console.log('Media pack criado:', packId);
    return data;
  } catch (err) {
    console.error('Erro ao criar media pack:', err.message);
    throw err;
  }
}

async function addMediaItem({ packId, fileName, fileUrl, fileType, storagePath, thumbnailUrl = null, sizeBytes = null }) {
  try {
    const { data, error } = await supabase
      .from('media_items')
      .insert([{
        pack_id: packId,
        file_name: fileName,
        file_url: fileUrl,
        file_type: fileType,
        storage_path: storagePath,
        thumbnail_url: thumbnailUrl,
        size_bytes: sizeBytes
      }])
      .select()
      .single();
    
    if (error) throw error;
    console.log('Media item adicionado:', fileName);
    return data;
  } catch (err) {
    console.error('Erro ao adicionar media item:', err.message);
    throw err;
  }
}

async function getMediaItems(packId) {
  try {
    const { data, error } = await supabase
      .from('media_items')
      .select('*')
      .eq('pack_id', packId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  } catch (err) {
    console.error('Erro ao buscar media items:', err.message);
    return [];
  }
}

async function getRandomMediaItems(packId, userId, count = 3) {
  try {
    // Buscar itens já entregues para este usuário
    const { data: delivered, error: deliveredError } = await supabase
      .from('media_deliveries')
      .select('media_item_id')
      .eq('pack_id', packId)
      .eq('user_id', userId);
    
    if (deliveredError) throw deliveredError;
    
    const deliveredIds = delivered ? delivered.map(d => d.media_item_id) : [];
    
    // Buscar todos os itens do pack
    const { data: allItems, error: itemsError } = await supabase
      .from('media_items')
      .select('*')
      .eq('pack_id', packId)
      .eq('is_active', true);
    
    if (itemsError) throw itemsError;
    
    if (!allItems || allItems.length === 0) {
      throw new Error('Pack sem itens de mídia cadastrados');
    }
    
    // Filtrar itens não entregues
    let availableItems = allItems.filter(item => !deliveredIds.includes(item.id));
    
    // Se não há itens disponíveis, resetar e usar todos
    if (availableItems.length === 0) {
      console.log('Todos os itens já foram entregues, resetando pool');
      availableItems = allItems;
    }
    
    // Selecionar itens aleatórios
    const shuffled = availableItems.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Math.min(count, shuffled.length));
    
    return selected;
  } catch (err) {
    console.error('Erro ao buscar media items aleatórios:', err.message);
    throw err;
  }
}

async function recordMediaDelivery({ transactionId, userId, packId, mediaItemId }) {
  try {
    return await withRetry(async () => {
      const { data, error } = await supabase
        .from('media_deliveries')
        .insert([{
          transaction_id: transactionId,
          user_id: userId,
          pack_id: packId,
          media_item_id: mediaItemId
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }, { retries: 4, delay: 1500, label: '[MEDIA-DELIVERY]' });
  } catch (err) {
    // Se esgotou retries de conexão, apenas loga warn (não é erro crítico)
    if (err._isConnectionRetryExhausted || isConnectionError(err)) {
      console.warn(`⚠️ [MEDIA-DELIVERY] Falha de conexão ao registrar entrega (transação: ${transactionId}). Entrega já foi feita, apenas o registro falhou.`);
    } else {
      console.error('❌ [MEDIA-DELIVERY] Erro ao registrar entrega de mídia:', err.message);
    }
    return null;
  }
}

async function deleteMediaPack(packId) {
  try {
    // Deletar itens de mídia (cascata)
    const { error: itemsError } = await supabase
      .from('media_items')
      .delete()
      .eq('pack_id', packId);
    
    if (itemsError) throw itemsError;
    
    // Deletar pack
    const { error: packError } = await supabase
      .from('media_packs')
      .delete()
      .eq('pack_id', packId);
    
    if (packError) throw packError;
    
    console.log('Media pack deletado:', packId);
    return true;
  } catch (err) {
    console.error('Erro ao deletar media pack:', err.message);
    return false;
  }
}

async function deleteMediaItem(itemId) {
  try {
    const { error } = await supabase
      .from('media_items')
      .delete()
      .eq('id', itemId);
    
    if (error) throw error;
    console.log('Media item deletado:', itemId);
    return true;
  } catch (err) {
    console.error('Erro ao deletar media item:', err.message);
    return false;
  }
}


module.exports = {
  getAllMediaPacks,
  getMediaPackById,
  createMediaPack,
  addMediaItem,
  getMediaItems,
  getRandomMediaItems,
  recordMediaDelivery,
  deleteMediaPack,
  deleteMediaItem
};
