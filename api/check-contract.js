// api/check-contract.js
// API para verificar status do contrato

const { createClient } = require('@supabase/supabase-js');

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Responder OPTIONS para CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas GET permitido
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Método não permitido' 
    });
  }

  try {
    const { clientName } = req.query;

    if (!clientName) {
      return res.status(400).json({
        success: false,
        message: 'Nome do cliente é obrigatório'
      });
    }

    // Buscar contrato ativo do cliente
    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('client_name', clientName)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = nenhum registro encontrado
      console.error('Erro ao buscar contrato:', error);
      throw error;
    }

    // Se não encontrou contrato, retorna disponível
    if (!contract) {
      return res.status(200).json({
        success: true,
        alreadySigned: false,
        message: 'Contrato disponível para assinatura'
      });
    }

    // Verificar se o contrato expirou
    const endDate = new Date(contract.end_date);
    const today = new Date();
    const isExpired = endDate < today;

    if (isExpired) {
      // Atualizar status para expirado
      await supabase
        .from('contracts')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', contract.id);

      return res.status(200).json({
        success: true,
        alreadySigned: true,
        isExpired: true,
        contract: {
          id: contract.id,
          signedAt: contract.signed_at,
          startDate: contract.start_date,
          endDate: contract.end_date,
          status: 'expired'
        },
        message: 'Contrato expirado. Entre em contato para renovação.'
      });
    }

    // Contrato ativo
    return res.status(200).json({
      success: true,
      alreadySigned: true,
      isExpired: false,
      contract: {
        id: contract.id,
        signedAt: contract.signed_at,
        startDate: contract.start_date,
        endDate: contract.end_date,
        status: 'active'
      },
      message: 'Contrato já foi assinado e está ativo'
    });

  } catch (error) {
    console.error('Erro ao verificar contrato:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao verificar status do contrato'
    });
  }
};
