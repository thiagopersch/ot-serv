-- Migration: Create Task System Tables
-- Run this on your existing database (MySQL — ver config.lua).

CREATE TABLE IF NOT EXISTS player_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    task_id VARCHAR(50) NOT NULL,
    kills INT DEFAULT 0,
    completed TINYINT(1) DEFAULT 0,
    rewarded TINYINT(1) DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_player_task (player_id, task_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS player_task_points (
    player_id INT PRIMARY KEY,
    points INT DEFAULT 0,
    total_completed INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- SQLite syntax (referência, não usado neste servidor):
-- CREATE TABLE IF NOT EXISTS player_tasks (
--     id INTEGER PRIMARY KEY AUTOINCREMENT,
--     player_id INTEGER NOT NULL,
--     task_id TEXT NOT NULL,
--     kills INTEGER DEFAULT 0,
--     completed INTEGER DEFAULT 0,
--     rewarded INTEGER DEFAULT 0,
--     started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
--     UNIQUE(player_id, task_id)
-- );
--
-- CREATE TABLE IF NOT EXISTS player_task_points (
--     player_id INTEGER PRIMARY KEY,
--     points INTEGER DEFAULT 0,
--     total_completed INTEGER DEFAULT 0
-- );
