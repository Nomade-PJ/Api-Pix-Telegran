// src/admin.js — Orquestrador (era 7.838 linhas, agora 24)
// Dividido em src/admin/*.js
// bot.js continua chamando admin.registerAdminCommands(bot) sem alteração.

const { registerUserHandlers }      = require('./admin/users');
const { registerBroadcastHandlers } = require('./admin/broadcast');
const { registerProductHandlers }   = require('./admin/products');
const { registerMediaHandlers }     = require('./admin/media');
const { registerPanelHandlers }     = require('./admin/panel');
const { registerApprovalHandlers }  = require('./admin/approvals');
const { registerSettingsHandlers }  = require('./admin/settings');

function registerAdminCommands(bot) {
  registerUserHandlers(bot);
  registerBroadcastHandlers(bot);
  registerProductHandlers(bot);
  registerMediaHandlers(bot);
  registerPanelHandlers(bot);
  registerApprovalHandlers(bot);
  registerSettingsHandlers(bot);
}

module.exports = { registerAdminCommands };
