// api/check-contract.js
// API para verificar status do contrato

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

module.exports = async (req, res) => {
  const allowedOrigin = process.env.CONTRACT_ORIGIN || 'https://api-pix-telegran.vercel.app';
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Contract-Password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  const CONTRACT_PASSWORD = process.env.CONTRACT_PASSWORD;
  if (!CONTRACT_PASSWORD) {
    console.error('❌ [CONTRACT] CONTRACT_PASSWORD não configurado — bloqueando consulta por segurança.');
    return res.status(500).json({ success: false, message: 'Servidor mal configurado. Contate o administrador.' });
  }

  const providedPassword = req.headers['x-contract-password'];
  if (!providedPassword || !safeCompare(providedPassword, CONTRACT_PASSWORD)) {
    return res.status(401).json({ success: false, message: 'Senha incorreta' });
  }

  try {
    // clientName não é mais lido da query string — fixo no servidor,
    // já que esta página serve um único contrato específico.
    const clientName = 'VALDIRENE SOUZA DOS SANTOS';

    const { data: contract, error } = await supabase
      .from('contracts')
      .select('*')
      .eq('client_name', clientName)
      .eq('status', 'active')
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar contrato:', error);
      throw error;
    }

    if (!contract) {
      return res.status(200).json({
        success: true,
        alreadySigned: false,
        message: 'Contrato disponível para assinatura'
      });
    }

    const endDate = new Date(contract.end_date);
    const today = new Date();
    const isExpired = endDate < today;

    if (isExpired) {
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
