// src/db/index.js — Re-exporta todos os módulos
// O database.js aponta para cá. Zero breaking changes.
const { supabase }   = require('./client');
const users          = require('./users');
const products       = require('./products');
const transactions   = require('./transactions');
const stats          = require('./stats');
const settings       = require('./settings');
const groups         = require('./groups');
const ocr            = require('./ocr');
const mediapacks     = require('./mediapacks');
const areacodes      = require('./areacodes');
const reports        = require('./reports');
const tickets        = require('./tickets');
const trust          = require('./trust');
const autoresponse   = require('./autoresponse');
const analytics      = require('./analytics');

module.exports = {
  supabase,
  ...users,
  ...products,
  ...transactions,
  ...stats,
  ...settings,
  ...groups,
  ...ocr,
  ...mediapacks,
  ...areacodes,
  ...reports,
  ...tickets,
  ...trust,
  ...autoresponse,
  ...analytics,
};
