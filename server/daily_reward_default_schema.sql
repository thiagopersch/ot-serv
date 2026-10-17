-- Daily Reward: padrão de recompensas (pool por raridade, itens bônus e outfits bônus)
-- Administrado no portal em /admin/daily-rewards/default (models DailyRewardDefault* do prisma).
-- O servidor (data/lib/daily_reward.lua) gera o calendário de cada mês a partir destas tabelas.

CREATE TABLE IF NOT EXISTS `daily_reward_default_items` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `kind` VARCHAR(10) NOT NULL DEFAULT 'daily',
    `rarity` VARCHAR(20) NULL,
    `item_id` INT NOT NULL,
    `client_id` INT NOT NULL DEFAULT 0,
    `count` INT NOT NULL DEFAULT 1,
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `daily_reward_default_items_kind_idx` (`kind`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `daily_reward_rarity_weights` (
    `rarity` VARCHAR(20) NOT NULL,
    `weight` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`rarity`)
) ENGINE=InnoDB;

-- Outfits customizados (/admin/custom-outfits): looktype liberado para qualquer vocação ao usar
-- o item `item_id`. O portal gera o bloco CUSTOM_OUTFITS em data/XML/outfits.xml (storageId =
-- 61000 + id) e data/actions/actions.xml (custom_outfit_unlock.lua).
CREATE TABLE IF NOT EXISTS `custom_outfits` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(60) NOT NULL,
    `look_type` INT NOT NULL,
    `item_id` INT NOT NULL,
    `client_id` INT NOT NULL DEFAULT 0,
    `active` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `custom_outfits_item_id_key` (`item_id`)
) ENGINE=InnoDB;

-- Versão antiga desta tabela guardava `look_type`/`name` direto: recria no formato novo
-- (referência ao catálogo de outfits customizados).
SET @old_outfits := (SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'daily_reward_default_outfits' AND COLUMN_NAME = 'look_type');
SET @sql := IF(@old_outfits > 0, 'DROP TABLE `daily_reward_default_outfits`', 'DO 0');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS `daily_reward_default_outfits` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `custom_outfit_id` INT NOT NULL,
    PRIMARY KEY (`id`),
    UNIQUE KEY `daily_reward_default_outfits_custom_outfit_id_key` (`custom_outfit_id`),
    FOREIGN KEY (`custom_outfit_id`) REFERENCES `custom_outfits`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Valores iniciais (os que ficavam fixos no script antigo).
INSERT IGNORE INTO `daily_reward_rarity_weights` (`rarity`, `weight`) VALUES
    ('comum', 50), ('incomum', 25), ('raro', 15), ('lendario', 7), ('mitico', 3);

INSERT INTO `daily_reward_default_items` (`kind`, `rarity`, `item_id`, `client_id`, `count`)
SELECT * FROM (
    SELECT 'daily' AS k, 'comum' AS r, 49693 AS i, 44638 AS c, 10 AS n UNION ALL
    SELECT 'daily', 'comum', 56697, 51642, 5 UNION ALL
    SELECT 'daily', 'comum', 56745, 51690, 3 UNION ALL
    SELECT 'daily', 'comum', 49694, 44639, 5 UNION ALL
    SELECT 'daily', 'raro', 56744, 51689, 2 UNION ALL
    SELECT 'daily', 'raro', 56817, 51762, 2 UNION ALL
    SELECT 'daily', 'raro', 49695, 44640, 1 UNION ALL
    SELECT 'daily', 'lendario', 56818, 51763, 1 UNION ALL
    SELECT 'daily', 'lendario', 49696, 44641, 1 UNION ALL
    SELECT 'bonus', NULL, 56406, 51351, 1 UNION ALL
    SELECT 'bonus', NULL, 56407, 51352, 1 UNION ALL
    SELECT 'bonus', NULL, 9971, 9971, 5 UNION ALL
    SELECT 'bonus', NULL, 56399, 51344, 1
) AS seed
WHERE NOT EXISTS (SELECT 1 FROM `daily_reward_default_items`);
