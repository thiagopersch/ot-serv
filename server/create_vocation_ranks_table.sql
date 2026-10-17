-- Execute this SQL on your SQLite database (theforgottenserver.s3db)
-- You can use SQLite Browser or similar tool to run this

CREATE TABLE IF NOT EXISTS "player_vocation_ranks" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id INTEGER NOT NULL,
  vocation_id INTEGER NOT NULL,
  rank TINYINT NOT NULL DEFAULT 0,
  stars TINYINT NOT NULL DEFAULT 0,
  total_stars SMALLINT NOT NULL DEFAULT 0,
  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_player_vocation_ranks" ON "player_vocation_ranks"("player_id", "vocation_id");
