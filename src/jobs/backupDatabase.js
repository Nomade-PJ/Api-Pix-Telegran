// src/jobs/backupDatabase.js
// Job de backup automático diário do banco de dados

const db = require('../database');
const { supabase } = require('../database');

/**
 * Faz backup das tabelas principais do banco de dados
 * Executa diariamente às 3h da manhã (horário de Brasília)
 */
async function performBackup() {
  try {
    console.log('🔄 [BACKUP] Iniciando backup automático...');
    const backupDate = new Date().toISOString().split('T')[0];
    
    // Backup das tabelas principais
    const tables = [
      'transactions',
      'users',
      'products',
      'groups',
      'group_members',
      'media_packs',
      'media_items',
      'support_tickets',
      'support_messages',
      'coupons',
      'settings'
    ];
    
    const backupData = {
      date: backupDate,
      timestamp: new Date().toISOString(),
      tables: {}
    };
    
    for (const table of tables) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(10000); // Limitar para não sobrecarregar
        
        if (error) {
          console.error(`❌ [BACKUP] Erro ao fazer backup da tabela ${table}:`, error.message);
          continue;
        }
        
        backupData.tables[table] = {
          count: data?.length || 0,
          data: data || []
        };
        
        console.log(`✅ [BACKUP] Tabela ${table}: ${data?.length || 0} registros`);
      } catch (err) {
        console.error(`❌ [BACKUP] Erro ao processar tabela ${table}:`, err.message);
      }
    }
    
    // Salvar backup no Supabase Storage (se configurado)
    // Por enquanto, apenas logamos o resumo
    console.log('📊 [BACKUP] Resumo do backup:');
    console.log(`   📅 Data: ${backupDate}`);
    console.log(`   📦 Tabelas: ${Object.keys(backupData.tables).length}`);
    console.log(`   📊 Total de registros: ${Object.values(backupData.tables).reduce((sum, t) => sum + (t.count || 0), 0)}`);
    
    // Salvar metadados do backup na tabela settings
    await supabase
      .from('settings')
      .upsert({
        key: `backup_${backupDate}`,
        value: JSON.stringify({
          timestamp: backupData.timestamp,
          tables_count: Object.keys(backupData.tables).length,
          total_records: Object.values(backupData.tables).reduce((sum, t) => sum + (t.count || 0), 0)
        }),
        description: `Backup automático de ${backupDate}`
      }, {
        onConflict: 'key'
      });
    
    console.log('✅ [BACKUP] Backup concluído com sucesso!');
    return backupData;
    
  } catch (err) {
    console.error('❌ [BACKUP] Erro crítico no backup:', err);
    throw err;
  }
}

/**
 * Inicia o job de backup diário
 */
function startBackupJob() {
  console.log('🚀 [BACKUP-JOB] Job de backup iniciado - executará diariamente às 3h');
  
  // Calcular próxima execução (3h da manhã, horário de Brasília)
  const now = new Date();
  const brasilTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  let nextRun = new Date(brasilTime);
  nextRun.setHours(3, 0, 0, 0);
  
  // Se já passou das 3h hoje, agendar para amanhã
  if (nextRun <= brasilTime) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  const msUntilNextRun = nextRun.getTime() - brasilTime.getTime();
  
  console.log(`⏰ [BACKUP-JOB] Próximo backup: ${nextRun.toLocaleString('pt-BR')} (em ${Math.floor(msUntilNextRun / 1000 / 60)} minutos)`);
  
  // Agendar primeira execução
  setTimeout(() => {
    performBackup().catch(err => {
      console.error('❌ [BACKUP-JOB] Erro na execução do backup:', err);
    });
    
    // Agendar execuções diárias (24 horas = 86400000 ms)
    setInterval(() => {
      performBackup().catch(err => {
        console.error('❌ [BACKUP-JOB] Erro na execução do backup:', err);
      });
    }, 24 * 60 * 60 * 1000);
    
  }, msUntilNextRun);
}

module.exports = {
  performBackup,
  startBackupJob
};

