// src/db/index.js — Ponto central da camada de dados
// Importa e re-exporta todos os módulos.
// O restante do projeto usa: const db = require('./db')
// ou: const db = require('../db')

const { supabase }       = require('./client');
const users              = require('./users');
const products           = require('./products');
const transactions       = require('./transactions');
const stats              = require('./stats');
const settings           = require('./settings');
const groups             = require('./groups');
const mediapacks         = require('./mediapacks');
const areacodes          = require('./areacodes');
const reports            = require('./reports');
const tickets            = require('./tickets');
const autoresponse       = require('./autoresponse');
const analytics          = require('./analytics');

module.exports = {
  supabase,
  ...users,
  ...products,
  ...transactions,
  ...stats,
  ...settings,
  ...groups,
  ...mediapacks,
  ...areacodes,
  ...reports,
  ...tickets,
  ...autoresponse,
  ...analytics,
};
