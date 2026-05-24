// src/db/tickets.js
const { supabase } = require('./client');

module.exports = {
  createSupportTicket,
  getSupportTicket,
  getUserTickets,
  getAllOpenTickets,
  addTicketMessage,
  getTicketMessages,
  updateTicketStatus,
  assignTicket
};
