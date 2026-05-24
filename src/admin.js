// src/admin.js — Orquestrador (era 7.838 linhas, agora 23)
// Divide responsabilidades em src/admin/*.js
// O bot.js continua chamando admin.registerAdminCommands(bot) sem alteração.

const { registerUserHandlers }        = require('./admin/users');
const { registerBroadcastHandlers }   = require('./admin/broadcast');
const { registerTransactionHandlers } = require('./admin/transactions');
const { registerProductHandlers }     = require('./admin/products');
const { registerDeliveryHandlers }    = require('./admin/delivery');
const { registerApprovalHandlers }    = require('./admin/approvals');
const { registerSettingsHandlers }    = require('./admin/settings');

function registerAdminCommands(bot) {
  registerUserHandlers(bot);
  registerBroadcastHandlers(bot);
  registerTransactionHandlers(bot);
  registerProductHandlers(bot);
  registerDeliveryHandlers(bot);
  registerApprovalHandlers(bot);
  registerSettingsHandlers(bot);
}

module.exports = { registerAdminCommands };
