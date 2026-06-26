// api/sign-contract.js
// API para processar assinatura de contratos

const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Dados do contrato fixados no SERVIDOR — nunca confiar nesses valores vindos do cliente.
// Isso evita que qualquer pessoa envie valores financeiros arbitrários no corpo da requisição.
const CONTRACT_CONFIG = {
  clientName: 'VALDIRENE SOUZA DOS SANTOS',
  startDate: '2025-12-01',
  endDate: '2026-03-01',
  monthlyValue: 800,
  initialValue: 600,
  totalValue: 2200
};

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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Contract-Password');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido' });
  }

  // Senha obrigatória — sem fallback. Sem CONTRACT_PASSWORD configurado, bloqueia tudo.
  const CONTRACT_PASSWORD = process.env.CONTRACT_PASSWORD;
  if (!CONTRACT_PASSWORD) {
    console.error('❌ [CONTRACT] CONTRACT_PASSWORD não configurado — bloqueando assinatura por segurança.');
    return res.status(500).json({ success: false, message: 'Servidor mal configurado. Contate o administrador.' });
  }

  const providedPassword = req.headers['x-contract-password'];
  if (!providedPassword || !safeCompare(providedPassword, CONTRACT_PASSWORD)) {
    return res.status(401).json({ success: false, message: 'Senha incorreta' });
  }

  try {
    const { clientFullName } = req.body || {};

    // Único campo que o cliente realmente controla: o próprio nome digitado na assinatura.
    if (!clientFullName || typeof clientFullName !== 'string') {
      return res.status(400).json({ success: false, message: 'Nome completo é obrigatório' });
    }

    const trimmedName = clientFullName.trim();
    if (trimmedName.split(/\s+/).length < 2 || trimmedName.length > 200) {
      return res.status(400).json({ success: false, message: 'Informe nome e sobrenome (até 200 caracteres)' });
    }

    // Todos os demais dados vêm do CONTRACT_CONFIG fixo no servidor, nunca do cliente.
    const { clientName, startDate, endDate, monthlyValue, initialValue, totalValue } = CONTRACT_CONFIG;

    const { data: existingContract } = await supabase
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

    const ipAddress = req.headers['x-forwarded-for'] ||
                     req.headers['x-real-ip'] ||
                     req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    const { data: contract, error } = await supabase
      .from('contracts')
      .insert([{
        client_name: clientName,
        client_full_name: trimmedName,
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
