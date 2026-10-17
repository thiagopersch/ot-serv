if not json then json = dofile("data/lib/json.lua") end

TASK_DIFFICULTY_ORDER = TASK_DIFFICULTY_ORDER or { "easy", "medium", "hard", "elite" }
TASK_CATEGORIES = TASK_CATEGORIES or { "dragonball", "bleach" }

-- Carrega o catálogo de tasks da tabela `task_definitions` (fonte de verdade: portal web,
-- administrado em `/admin/tasks`) e monta o global TASKS no mesmo formato que o antigo
-- data/lib/tasks/task_config.lua estático produzia — o resto do sistema de tasks
-- (task_core/task_kill/task_rewards/task_delivery/task_network/...) não muda.
-- Chamado uma vez no boot (dofile lazy, como antes) e recarregado periodicamente pelo
-- globalevent `task_save.lua` para refletir edições feitas no portal sem reiniciar o servidor.
function TaskConfig_reload()
    local resultId = db.getResult(
        "SELECT `id`, `name`, `look_type`, `category`, `type`, `difficulty`, `level_required`, " ..
        "`rank_required`, `kills_required`, `points`, `experience`, `money`, `published`, " ..
        "`monsters`, `rewards`, `delivery`, `monster_details` FROM `task_definitions`")

    local tasks = {}
    local count = 0

    if resultId:getID() ~= -1 then
        repeat
            if resultId:getDataInt("published") == 1 then
                local id = resultId:getDataString("id")

                local okMonsters, monsters = pcall(json.decode, resultId:getDataString("monsters") or "[]")
                local okRewards, rewards = pcall(json.decode, resultId:getDataString("rewards") or "{}")
                local okDelivery, delivery = pcall(json.decode, resultId:getDataString("delivery") or "{}")
                local okDetails, monsterDetails =
                    pcall(json.decode, resultId:getDataString("monster_details") or "[]")

                -- `look_type` is nullable (a task doesn't have to be tied to a monster with a
                -- registered looktype yet) — reading a NULL column via getDataInt logs
                -- "Error during getDataInt(look_type)." to the console even though it still
                -- returns safely, so read it as a string and convert instead.
                local lookTypeRaw = resultId:getDataString("look_type")
                local lookType = tonumber(lookTypeRaw) or 0

                tasks[id] = {
                    id = id,
                    name = resultId:getDataString("name"),
                    lookType = lookType,
                    category = resultId:getDataString("category"),
                    type = resultId:getDataString("type"),
                    difficulty = resultId:getDataString("difficulty"),
                    levelRequired = resultId:getDataInt("level_required"),
                    rankRequired = resultId:getDataInt("rank_required"),
                    monsters = okMonsters and monsters or {},
                    killsRequired = resultId:getDataInt("kills_required"),
                    points = resultId:getDataInt("points"),
                    experience = resultId:getDataInt("experience"),
                    money = resultId:getDataInt("money"),
                    rewards = okRewards and rewards or { items = {} },
                    delivery = okDelivery and delivery or { enabled = false },
                    monsterDetails = okDetails and monsterDetails or {},
                }
                count = count + 1
            end
        until not resultId:next()
        resultId:free()
    end

    TASKS = tasks
end

if not TASKS then
    TaskConfig_reload()
end
