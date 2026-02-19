// api/sign-contract.js
// API para processar assinatura de contratos

const { createClient } = require('@supabase/supabase-js');

// Inicializar Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

module.exports = async (req, res) => {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Responder OPTIONS para CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Apenas POST permitido
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Método não permitido' 
    });
  }

  try {
    const {
      clientName,
      clientFullName,
      startDate,
      endDate,
      monthlyValue,
      initialValue,
      totalValue
    } = req.body;

    // Validações
    if (!clientName || !clientFullName) {
      return res.status(400).json({
        success: false,
        message: 'Nome do cliente é obrigatório'
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Datas de início e fim são obrigatórias'
      });
    }

    // Verificar se já existe um contrato ativo para este cliente
    const { data: existingContract, error: checkError } = await supabase
      .from('contracts')
      .select('*')
      .eq('client_name', clientName)
      .eq('status', 'active')
      .single();

    if (existingContract) {
      console.log('⚠️ [CONTRACT] Tentativa de assinar contrato duplicado:', {
        client: clientName,
        existingContractId: existingContract.id
      });

      return res.status(400).json({
        success: false,
        message: 'Contrato já foi assinado anteriormente',
        alreadySigned: true,
        contractId: existingContract.id,
        signedAt: existingContract.signed_at
      });
    }

    // Obter IP do cliente
    const ipAddress = req.headers['x-forwarded-for'] || 
                     req.headers['x-real-ip'] || 
                     req.connection.remoteAddress;

    // Obter User Agent
    const userAgent = req.headers['user-agent'];

    // Salvar contrato no banco
    const { data: contract, error } = await supabase
      .from('contracts')
      .insert([{
        client_name: clientName,
        client_full_name: clientFullName,
        start_date: startDate,
        end_date: endDate,
        monthly_value: monthlyValue,
        initial_value: initialValue,
        total_value: totalValue,
        ip_address: ipAddress,
        user_agent: userAgent,
        contract_type: 'bot_telegram',
        contract_version: '1.0',
        status: 'active'
      }])
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar contrato:', error);
      throw error;
    }

    console.log('✅ [CONTRACT] Contrato assinado:', {
      contractId: contract.id,
      client: clientName,
      signedAt: contract.signed_at
    });

    // Retornar sucesso
    return res.status(200).json({
      success: true,
      message: 'Contrato assinado com sucesso',
      contractId: contract.id,
      signedAt: contract.signed_at
    });

  } catch (error) {
    console.error('Erro ao processar assinatura:', error);
    return res.status(500).json({
      success: false,
      message: 'Erro ao processar assinatura do contrato'
    });
  }
};
