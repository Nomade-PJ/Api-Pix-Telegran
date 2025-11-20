// src/groupControl.js
const db = require('./database');

async function checkExpirations(bot) {
  try {
    console.log('🔍 Verificando expirações de assinaturas...');
    
    // 1. Enviar lembretes (3 dias antes)
    const expiring = await db.getExpiringMembers();
    
    for (const member of expiring) {
      try {
        const expiresAt = new Date(member.expires_at);
        const now = new Date();
        const daysLeft = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));
        
        await bot.telegram.sendMessage(member.telegram_id, `⏰ *LEMBRETE DE ASSINATURA*

⚠️ Sua assinatura expira em *${daysLeft} dias*!

👥 Grupo: ${member.group?.group_name || 'Grupo'}
📅 Expira em: ${expiresAt.toLocaleDateString('pt-BR')}
💰 Renovar por: R$ ${member.group?.subscription_price || '30.00'}/mês

🔄 *Para renovar:*
Use o comando /renovar e faça o pagamento.

Não perca o acesso! 🚀`, {
          parse_mode: 'Markdown'
        });
        
        // Marcar como lembrado
        await db.markMemberReminded(member.id);
        
      } catch (err) {
        console.error(`Erro ao enviar lembrete para ${member.telegram_id}:`, err.message);
      }
    }
    
    // 2. Remover membros expirados
    const expired = await db.getExpiredMembers();
    
    for (const member of expired) {
      try {
        // Remover do grupo (ban + unban = remove sem bloquear)
        await bot.telegram.banChatMember(
          member.group.group_id,
          member.telegram_id
        );
        
        // Desbanir imediatamente (só remove, não bloqueia)
        await bot.telegram.unbanChatMember(
          member.group.group_id,
          member.telegram_id,
          { only_if_banned: true }
        );
        
        // Atualizar status
        await db.expireMember(member.id);
        
        // Notificar usuário
        await bot.telegram.sendMessage(member.telegram_id, `❌ *ASSINATURA EXPIRADA*

Sua assinatura do grupo expirou e você foi removido.

🔄 *Para voltar:*
Use /renovar e renove sua assinatura.`, {
          parse_mode: 'Markdown'
        });
        
      } catch (err) {
        console.error(`Erro ao remover membro ${member.telegram_id}:`, err.message);
      }
    }
    
    console.log(`✅ Verificação concluída: ${expiring.length} lembretes, ${expired.length} removidos`);
    
  } catch (err) {
    console.error('Erro no controle de grupos:', err);
  }
}

// Executar a cada 1 hora
function startGroupControl(bot) {
  // Executar imediatamente
  checkExpirations(bot);
  
  // Repetir a cada hora
  setInterval(() => {
    checkExpirations(bot);
  }, 60 * 60 * 1000); // 1 hora
}

module.exports = { startGroupControl };

