-- Migration: Extended Outfit System
-- Compatível com MySQL e SQLite
-- 
-- MySQL: mysql -u root dbosupreme < data/sql/migration_extoutfits.sql
-- SQLite: Read the comments and execute the corresponding lines via sqlite3

-- =============================================================================
-- 1. Tabela de desbloqueios (player_extoutfit_unlocks)
-- =============================================================================
-- MySQL:
CREATE TABLE IF NOT EXISTS `player_extoutfit_unlocks` (
  `player_id` INT NOT NULL,
  `type` VARCHAR(20) NOT NULL,
  `id` INT NOT NULL,
  PRIMARY KEY (`player_id`, `type`, `id`),
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE
);

-- SQLite:
-- CREATE TABLE IF NOT EXISTS `player_extoutfit_unlocks` (
--   `player_id` INTEGER NOT NULL,
--   `type` TEXT NOT NULL,
--   `id` INTEGER NOT NULL,
--   PRIMARY KEY (`player_id`, `type`, `id`),
--   FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE
-- );

-- =============================================================================
-- 2. Colunas na tabela players (MySQL)
-- =============================================================================
-- ALTER TABLE `players`
--   ADD COLUMN `lookmount` INT NOT NULL DEFAULT 0,
--   ADD COLUMN `lookwings` INT NOT NULL DEFAULT 0,
--   ADD COLUMN `lookaura` INT NOT NULL DEFAULT 0,
--   ADD COLUMN `lookshader` INT NOT NULL DEFAULT 0,
--   ADD COLUMN `lookhealthbar` INT NOT NULL DEFAULT 0,
--   ADD COLUMN `lookmanabar` INT NOT NULL DEFAULT 0;

-- =============================================================================
-- 3. Colunas na tabela players (SQLite)
-- Se a tabela já foi criada sem essas colunas, adicione:
-- =============================================================================
-- ALTER TABLE players ADD COLUMN lookmount INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE players ADD COLUMN lookwings INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE players ADD COLUMN lookaura INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE players ADD COLUMN lookshader INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE players ADD COLUMN lookhealthbar INTEGER NOT NULL DEFAULT 0;
-- ALTER TABLE players ADD COLUMN lookmanabar INTEGER NOT NULL DEFAULT 0;
