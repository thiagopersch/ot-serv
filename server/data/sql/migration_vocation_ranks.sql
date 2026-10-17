-- Migration: Add Vocation Upgraded System
-- SQLite version for The Forgotten Server 0.4

CREATE TABLE IF NOT EXISTS player_vocation_ranks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  vocation_id INTEGER NOT NULL,
  rank TINYINT NOT NULL DEFAULT 1,
  stars TINYINT NOT NULL DEFAULT 0,
  total_stars SMALLINT NOT NULL DEFAULT 0,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_player_vocation_ranks ON player_vocation_ranks(player_id, vocation_id);
