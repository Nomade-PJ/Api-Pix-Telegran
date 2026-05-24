// src/db/trust.js
const { supabase } = require('./client');

module.exports = {
  getTrustedUser,
  updateTrustedUser,
  addTrustedUser,
  getProofPatterns,
  updateProofPattern
};
