// src/admin/users.js
const db = require('../database');
const deliver = require('../deliver');

function registerUserHandlers(bot) {
  // ===== RELATÓRIO DETALHADO DE USUÁRIOS (REGISTRAR PRIMEIRO) =====
  bot.command('relatorio_usuarios', async (ctx) => {
    console.log('🔍 [RELATORIO] Comando /relatorio_usuarios capturado');
    console.log('🔍 [RELATORIO] Usuário:', ctx.from.id, '@' + (ctx.from.username || 'sem username'));
    
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      console.log('🔍 [RELATORIO] É admin?', isAdmin);
      
      if (!isAdmin) {
        console.log('❌ [RELATORIO] Acesso negado');
        return ctx.reply('❌ Acesso negado.');
      }
      
      console.log('⏳ [RELATORIO] Enviando mensagem de "Gerando relatório..."');
      await ctx.reply('⏳ Gerando relatório de usuários...');
      
      console.log('📊 [RELATORIO] Buscando dados do relatório...');
      const report = await db.getUserReport();
      console.log('✅ [RELATORIO] Dados obtidos:', JSON.stringify(report));
      
      let message = `📊 *RELATÓRIO DETALHADO DE USUÁRIOS*

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👥 *TOTAL DE USUÁRIOS:* ${report.totalUsers}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

💰 *COMPRAS*
✅ Usuários que compraram: ${report.usersWhoBought}
📈 Taxa de conversão: ${report.buyRate}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔓 *USUÁRIOS DESBLOQUEADOS/LIBERADOS*
📊 Total desbloqueados: ${report.unblockedUsers}
✅ Desbloqueados que compraram: ${report.unblockedWhoBought}
❌ Desbloqueados SEM compra: ${report.unblockedWithoutPurchase}
📈 Taxa de conversão: ${report.unblockedBuyRate}%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚫 *BLOQUEIOS POR DDD*
📍 Total de usuários bloqueados por DDD (tentaram acessar): ${report.usersBlockedByDDD}
   ├─ ⛔ Desbloqueados manualmente: ${report.usersWithBlockedDDDButUnlocked || 0}
   └─ 🚫 Ainda bloqueados: ${report.usersBlockedByDDD - (report.usersWithBlockedDDDButUnlocked || 0)}`;

      // Adicionar lista detalhada de usuários ainda bloqueados por DDD (limitar a 20 para não exceder limite do Telegram)
      const stillBlockedCount = report.usersBlockedByDDD - (report.usersWithBlockedDDDButUnlocked || 0);
      if (stillBlockedCount > 0 && report.usersBlockedByDDDDetails && report.usersBlockedByDDDDetails.length > 0) {
        message += `\n\n📋 *LISTA DE USUÁRIOS AINDA BLOQUEADOS POR DDD:*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
        
        const limitedList = report.usersBlockedByDDDDetails.slice(0, 20);
        
        limitedList.forEach((user, index) => {
          const name = user.name.length > 20 ? user.name.substring(0, 17) + '...' : user.name;
          message += `\n${index + 1}. ${name} | DDD: ${user.ddd} | ID: ${user.telegram_id}`;
        });
        
        if (stillBlockedCount > 20) {
          message += `\n\n... e mais ${stillBlockedCount - 20} usuário(s) ainda bloqueado(s) por DDD.`;
        }
      }

      message += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📅 *Atualizado:* ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

      console.log('📤 [RELATORIO] Enviando relatório completo...');
      const result = await ctx.reply(message, { parse_mode: 'Markdown' });
      console.log('✅ [RELATORIO] Relatório enviado com sucesso');
      return result;
      
    } catch (err) {
      console.error('❌ [RELATORIO] Erro ao gerar relatório:', err);
      console.error('❌ [RELATORIO] Stack:', err.stack);
      return ctx.reply('❌ Erro ao gerar relatório. Verifique os logs.');
    }
  });
  
  // ===== FUNÇÃO PARA BUSCAR E EXIBIR INFORMAÇÕES DO USUÁRIO =====
  // Escapa caracteres especiais do Markdown v1 em valores dinâmicos
  function escMd(val) {
    if (val == null) return 'N/A';
    return String(val).replace(/[_*[\]()~`>#+=|{}.!\\-]/g, '\\$&');
  }

  async function buscarUsuarioInfo(ctx, telegramId) {
    try {
      // Buscar usuário
      const user = await db.getUserByTelegramId(telegramId);
      if (!user) {
        return ctx.reply(`❌ Usuário com ID ${telegramId} não encontrado.`);
      }
      
      // Buscar transações
      const transactions = await db.getUserTransactions(telegramId, 50);
      
      // Montar mensagem — valores dinâmicos SEM parse_mode para evitar quebra
      // Usamos MarkdownV2 com escape correto em todos os campos variáveis
      const nome     = escMd(user.first_name);
      const username = user.username ? `@${escMd(user.username)}` : 'sem username';
      const bloq     = user.is_blocked ? '🚫 Sim' : '✅ Não';
      const cadData  = escMd(new Date(user.created_at).toLocaleString('pt-BR'));

      let message = `👤 *USUÁRIO ENCONTRADO:*\n\n`;
      message += `Nome: ${nome}\n`;
      message += `ID: ${telegramId}\n`;
      message += `Username: ${username}\n`;
      message += `Bloqueado: ${bloq}\n`;
      message += `Cadastrado em: ${cadData}\n`;
      
      const keyboard = [];

      if (transactions.length === 0) {
        message += `\n❌ Nenhuma transação encontrada\\.`;
      } else {
        message += `\n📊 *TRANSAÇÕES \\(${transactions.length}\\):*\n\n`;

        for (const tx of transactions.slice(0, 5)) {
          const txid   = escMd(tx.txid);
          const valor  = escMd(parseFloat(tx.amount || 0).toFixed(2));
          const status = escMd(tx.status);
          const data   = escMd(new Date(tx.created_at).toLocaleString('pt-BR'));

          message += `🆔 TXID: \`${txid}\`\n`;
          message += `💰 Valor: R$ ${valor}\n`;
          message += `📊 Status: ${status}\n`;
          message += `📅 Data: ${data}\n`;
          if (tx.proof_file_id) {
            message += `📸 Comprovante: ✅ Disponível\n`;
          }
          message += `\n`;

          keyboard.push([
            { text: `📋 Ver TXID: ${tx.txid.substring(0, 10)}...`, callback_data: `details_${tx.txid}` }
          ]);
        }

        if (transactions.length > 5) {
          message += `\n\\.\\.\\. e mais ${transactions.length - 5} transação\\(ões\\)\\.`;
        }
      }

      keyboard.push([
        { text: '⬅️ Voltar ao Painel', callback_data: 'admin_refresh' }
      ]);
      
      return ctx.reply(message, { 
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (err) {
      console.error('Erro ao buscar usuário:', err);
      return ctx.reply('❌ Erro ao buscar usuário. Verifique os logs.');
    }
  }

  // ===== COMANDO PARA BUSCAR TRANSAÇÕES POR ID DE USUÁRIO =====
  bot.command('buscar_usuario', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ Acesso negado.');
      }
      
      const args = ctx.message.text.split(' ');
      if (args.length < 2) {
        return ctx.reply('📋 *Como usar:*\n\n/buscar_usuario <ID_TELEGRAM>\n\nExemplo:\n/buscar_usuario 6224210204', { parse_mode: 'Markdown' });
      }
      
      const telegramId = args[1];
      return await buscarUsuarioInfo(ctx, telegramId);
    } catch (err) {
      console.error('Erro ao buscar usuário:', err);
      return ctx.reply('❌ Erro ao buscar usuário. Verifique os logs.');
    }
  });

  // ===== COMANDO DE TESTE PARA ATUALIZAR DESCRIÇÃO =====
  bot.command('teste_descricao', async (ctx) => {
    console.log('🔍 [TESTE-DESC] ========== COMANDO CAPTURADO ==========');
    console.log('🔍 [TESTE-DESC] Comando /teste_descricao recebido de:', ctx.from.id);
    console.log('🔍 [TESTE-DESC] Usuário:', ctx.from.username || 'sem username');
    try {
      console.log('🔍 [TESTE-DESC] Verificando se é admin...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      console.log('🔍 [TESTE-DESC] É admin?', isAdmin);
      
      if (!isAdmin) {
        console.log('❌ [TESTE-DESC] Acesso negado - não é admin');
        return ctx.reply('❌ Acesso negado.');
      }

      console.log('⏳ [TESTE-DESC] Enviando mensagem de "Testando..."');
      await ctx.reply('⏳ Testando atualização da descrição...');

      console.log('📦 [TESTE-DESC] Carregando função updateBotDescription...');
      const { updateBotDescription } = require('./jobs/updateBotDescription');
      console.log('🔄 [TESTE-DESC] Executando updateBotDescription...');
      const result = await updateBotDescription();
      console.log('📊 [TESTE-DESC] Resultado:', JSON.stringify(result));

      if (result.success) {
        return ctx.reply(`✅ *Teste realizado com sucesso!*

📊 *Usuários mensais:* ${result.monthlyUsers}
📝 *Descrição atualizada:* "${result.description}"

A descrição deve aparecer no perfil do bot em alguns instantes.`, { parse_mode: 'Markdown' });
      } else {
        return ctx.reply(`❌ *Erro ao atualizar descrição*

Erro: ${result.error}

Verifique os logs do servidor para mais detalhes.`, { parse_mode: 'Markdown' });
      }
      
    } catch (err) {
      console.error('❌ [TESTE-DESC] Erro no teste de descrição:', err.message);
      console.error('❌ [TESTE-DESC] Stack:', err.stack);
      return ctx.reply(`❌ Erro: ${err.message}`);
    }
  });
  
}

module.exports = { registerUserHandlers };
