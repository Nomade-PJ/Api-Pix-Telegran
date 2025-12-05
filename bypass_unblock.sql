-- =====================================================
-- SQL ÚNICO PARA DESBLOQUEIO/BYPASS POR ID DO TELEGRAM
-- =====================================================
-- 
-- INSTRUÇÕES:
-- 1. Substitua 123456789 pelo telegram_id do usuário
-- 2. Execute este SQL no Supabase SQL Editor
-- 3. O usuário será desbloqueado e terá bypass de DDD
--
-- =====================================================

-- SQL ÚNICO: Atualiza se existe, cria se não existe (UPSERT)
-- Funciona mesmo se o usuário ainda não foi criado
INSERT INTO users (telegram_id, is_blocked, created_at, updated_at)
VALUES (123456789, false, NOW(), NOW())
ON CONFLICT (telegram_id) 
DO UPDATE SET 
  is_blocked = false,
  updated_at = NOW()
RETURNING telegram_id, first_name, username, is_blocked, is_admin, is_creator;

-- =====================================================
-- VERIFICAR SE FOI APLICADO CORRETAMENTE:
-- =====================================================
-- (Execute separadamente se quiser confirmar)
-- SELECT 
--   telegram_id,
--   first_name,
--   username,
--   is_blocked,
--   is_admin,
--   is_creator,
--   created_at,
--   updated_at
-- FROM users
-- WHERE telegram_id = 123456789;

