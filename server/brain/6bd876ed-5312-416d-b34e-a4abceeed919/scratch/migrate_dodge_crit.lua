-- Migration for Dodge and Critical
local function dbQuery(query)
  if db.query then
    return db.query(query)
  elseif db.executeQuery then
    return db.executeQuery(query)
  end
end

-- Add columns to players table
dbQuery("ALTER TABLE `players` ADD COLUMN `dodge` INTEGER NOT NULL DEFAULT 0;")
dbQuery("ALTER TABLE `players` ADD COLUMN `critical` INTEGER NOT NULL DEFAULT 0;")

-- Add columns to vocation stats table
dbQuery("ALTER TABLE `player_vocation_stats` ADD COLUMN `dodge` INTEGER NOT NULL DEFAULT 0;")
dbQuery("ALTER TABLE `player_vocation_stats` ADD COLUMN `critical` INTEGER NOT NULL DEFAULT 0;")

print("Migration for Dodge/Critical completed.")
