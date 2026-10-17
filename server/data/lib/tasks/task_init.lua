function TaskInit_createTables()
    -- MySQL syntax (este servidor não usa SQLite): CREATE TABLE IF NOT EXISTS já é
    -- idempotente, então não precisa de um check prévio via sqlite_master.
    db.query(
    "CREATE TABLE IF NOT EXISTS player_tasks (id INT AUTO_INCREMENT PRIMARY KEY, player_id INT NOT NULL, task_id VARCHAR(50) NOT NULL, kills INT DEFAULT 0, completed TINYINT(1) DEFAULT 0, rewarded TINYINT(1) DEFAULT 0, started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_player_task (player_id, task_id)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4")
    db.query(
    "CREATE TABLE IF NOT EXISTS player_task_points (player_id INT PRIMARY KEY, points INT DEFAULT 0, total_completed INT DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4")

    print("[Task System] Database tables created successfully.")
end

local ok = pcall(TaskInit_createTables)
if not ok then
    print("[Task System] Warning: Could not create tables on mod load")
end
