-- Skill Upgrades DB Schema
-- Import this to your database

CREATE TABLE IF NOT EXISTS `player_skill_points` (
    `player_id` INT NOT NULL,
    `vocation_id` INT NOT NULL,
    `available_points` INT NOT NULL DEFAULT 0,
    `spent_points` INT NOT NULL DEFAULT 0,
    `highest_level_counted` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`player_id`, `vocation_id`),
    FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `player_skill_upgrades` (
    `player_id` INT NOT NULL,
    `vocation_id` INT NOT NULL,
    `skill_name` VARCHAR(50) NOT NULL,
    `current_level` INT NOT NULL DEFAULT 0,
    PRIMARY KEY (`player_id`, `vocation_id`, `skill_name`),
    FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;
