-- Battle Pass, NPC and Chest system schema
-- Import this to your database (matches prisma/schema.prisma models added on the web portal)

CREATE TABLE IF NOT EXISTS `battle_pass_seasons` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `month` TINYINT NOT NULL,
    `year` SMALLINT NOT NULL,
    `max_level` INT NOT NULL DEFAULT 100,
    `xp_per_level` INT NOT NULL DEFAULT 1000,
    `gold_pass_item_id` INT NOT NULL DEFAULT 0,
    `gold_pass_cost` INT NOT NULL DEFAULT 0,
    `is_active` TINYINT(1) NOT NULL DEFAULT 0,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `battle_pass_seasons_month_year_key` (`month`, `year`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `battle_pass_missions` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `season_id` INT NOT NULL,
    `type` VARCHAR(20) NOT NULL,
    `target` JSON NOT NULL,
    `description` VARCHAR(255) NOT NULL,
    `xp_reward` INT NOT NULL DEFAULT 0,
    `published` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `battle_pass_missions_season_id_idx` (`season_id`),
    FOREIGN KEY (`season_id`) REFERENCES `battle_pass_seasons`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `battle_pass_rewards` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `season_id` INT NOT NULL,
    `level` INT NOT NULL,
    `track` VARCHAR(10) NOT NULL,
    `rarity` VARCHAR(20) NOT NULL,
    `item_id` INT NOT NULL,
    `count` INT NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `battle_pass_rewards_season_id_level_track_key` (`season_id`, `level`, `track`),
    FOREIGN KEY (`season_id`) REFERENCES `battle_pass_seasons`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `player_battle_pass` (
    `player_id` INT NOT NULL,
    `season_id` INT NOT NULL,
    `xp` INT NOT NULL DEFAULT 0,
    `level` INT NOT NULL DEFAULT 0,
    `has_gold_pass` TINYINT(1) NOT NULL DEFAULT 0,
    `mission_progress` JSON NOT NULL,
    `claimed_bronze` JSON NOT NULL,
    `claimed_gold` JSON NOT NULL,
    PRIMARY KEY (`player_id`, `season_id`),
    FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`season_id`) REFERENCES `battle_pass_seasons`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `npcs` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `look_type_id` INT NOT NULL,
    `type` VARCHAR(20) NOT NULL DEFAULT 'misc',
    `town` VARCHAR(100) NOT NULL DEFAULT '',
    `pos_x` INT NOT NULL DEFAULT 0,
    `pos_y` INT NOT NULL DEFAULT 0,
    `pos_z` INT NOT NULL DEFAULT 0,
    `direction` INT NOT NULL DEFAULT 2,
    `shop_items` JSON NULL,
    `script_id` INT NULL,
    `published` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `npcs_name_key` (`name`),
    FOREIGN KEY (`script_id`) REFERENCES `lua_scripts`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `chest_rewards` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `item_id` INT NOT NULL,
    `count` INT NOT NULL DEFAULT 1,
    `weight` INT NOT NULL DEFAULT 10,
    `published` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `autoloot_items` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `item_id` INT NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `published` TINYINT(1) NOT NULL DEFAULT 1,
    `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `autoloot_items_item_id_key` (`item_id`)
) ENGINE=InnoDB;
