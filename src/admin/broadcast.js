// src/admin/broadcast.js
const db = require('../database');
const deliver = require('../deliver');

function registerBroadcastHandlers(bot) {
  // ===== GERENCIAR BROADCAST COM CUPOM =====
  bot.command('broadcast_config', async (ctx) => {
    try {
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) {
        return ctx.reply('❌ Acesso negado.');
      }
      
      // Buscar configuração atual
      const config = await db.getSetting('broadcast_coupon_enabled');
      const isEnabled = config === 'true' || config === true;
      
      const message = `⚙️ *CONFIGURAÇÃO: BROADCAST + CUPOM*

📊 *Status atual:* ${isEnabled ? '✅ Ativado' : '❌ Desativado'}

*Como funciona:*
• Criadores podem enviar broadcasts com descontos automáticos
• Usuários que recebem o broadcast veem preço com desconto
• Novos usuários podem usar cupom manualmente
• Sistema rastreia quem recebeu broadcast

*Ações disponíveis:*`;
      
      const buttons = [
        [Markup.button.callback(
          isEnabled ? '❌ Desativar' : '✅ Ativar', 
          isEnabled ? 'toggle_broadcast_coupon:disable' : 'toggle_broadcast_coupon:enable'
        )],
        [Markup.button.callback('📋 Ver Cupons Ativos', 'view_active_coupons')],
        [Markup.button.callback('🗑️ Limpar Destinatários Antigos', 'clean_old_recipients')],
        [Markup.button.callback('🔙 Voltar', 'admin_menu')]
      ];
      
      return ctx.reply(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard(buttons)
      });
      
    } catch (err) {
      console.error('Erro ao exibir configuração de broadcast:', err);
      return ctx.reply('❌ Erro ao carregar configurações.');
    }
  });
  
  // Toggle broadcast com cupom
  bot.action(/toggle_broadcast_coupon:(enable|disable)/, async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const action = ctx.match[1];
      const newValue = action === 'enable' ? 'true' : 'false';
      
      // Atualizar configuração
      await db.setSetting('broadcast_coupon_enabled', newValue);
      
      const message = action === 'enable' 
        ? '✅ *Broadcast + Cupom ATIVADO!*\n\nCriadores agora podem usar essa funcionalidade.'
        : '❌ *Broadcast + Cupom DESATIVADO!*\n\nA opção não aparecerá mais no menu de broadcast.';
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar', 'admin_menu')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao alternar broadcast com cupom:', err);
      return ctx.reply('❌ Erro ao atualizar configuração.');
    }
  });
  
  // Ver cupons ativos
  bot.action('view_active_coupons', async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const { data: coupons, error } = await db.supabase
        .from('coupons')
        .select('*, products:product_id(name), media_packs:media_pack_id(name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (error) throw error;
      
      let message = `🎟️ *CUPONS ATIVOS*\n\n`;
      
      if (!coupons || coupons.length === 0) {
        message += `Nenhum cupom ativo no momento.\n\n`;
      } else {
        for (const coupon of coupons) {
          const productName = coupon.products?.name || coupon.media_packs?.name || 'Produto removido';
          const type = coupon.is_broadcast_coupon ? '🎁 Broadcast' : '🎟️ Manual';
          const uses = coupon.max_uses ? `${coupon.current_uses}/${coupon.max_uses}` : `${coupon.current_uses}/∞`;
          
          message += `${type} \`${coupon.code}\`\n`;
          message += `   💰 ${coupon.discount_percentage}% OFF\n`;
          message += `   📦 ${productName}\n`;
          message += `   📊 Usos: ${uses}\n\n`;
        }
      }
      
      message += `━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      return ctx.editMessageText(message, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar', 'admin_menu')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao listar cupons:', err);
      return ctx.reply('❌ Erro ao carregar cupons.');
    }
  });
  
  // Limpar destinatários antigos (mais de 30 dias)
  bot.action('clean_old_recipients', async (ctx) => {
    try {
      await ctx.answerCbQuery('🗑️ Limpando...');
      const isAdmin = await db.isUserAdmin(ctx.from.id);
      if (!isAdmin) return;
      
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: deleted, error } = await db.supabase
        .from('broadcast_recipients')
        .delete()
        .lt('created_at', thirtyDaysAgo.toISOString())
        .select();
      
      if (error) throw error;
      
      const count = deleted?.length || 0;
      
      return ctx.editMessageText(`✅ *Limpeza concluída!*

🗑️ ${count} registro(s) antigo(s) removido(s).

Registros de broadcasts com mais de 30 dias foram excluídos.`, {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
          [Markup.button.callback('🔙 Voltar', 'admin_menu')]
        ])
      });
      
    } catch (err) {
      console.error('Erro ao limpar destinatários:', err);
      return ctx.reply('❌ Erro ao limpar registros.');
    }
  });
  
}

module.exports = { registerBroadcastHandlers };
