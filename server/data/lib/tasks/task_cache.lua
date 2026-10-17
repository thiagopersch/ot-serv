if not TASKS then dofile("data/lib/tasks/task_db_loader.lua") end

TASK_MONSTERS = {}
TASK_IDS_BY_CATEGORY = {}
TASK_IDS_BY_DIFFICULTY = {}
PLAYER_TASK_CACHE = {}

function TaskCache_buildIndexes()
    TASK_MONSTERS = {}
    TASK_IDS_BY_CATEGORY = {}
    TASK_IDS_BY_DIFFICULTY = {}

    for taskId, task in pairs(TASKS) do
        for _, monsterName in ipairs(task.monsters) do
            local name = type(monsterName) == "table" and monsterName.name or monsterName
            local key = name:lower()
            if not TASK_MONSTERS[key] then
                TASK_MONSTERS[key] = {}
            end
            table.insert(TASK_MONSTERS[key], taskId)
        end

        if not TASK_IDS_BY_CATEGORY[task.category] then
            TASK_IDS_BY_CATEGORY[task.category] = {}
        end
        table.insert(TASK_IDS_BY_CATEGORY[task.category], taskId)

        if not TASK_IDS_BY_DIFFICULTY[task.difficulty] then
            TASK_IDS_BY_DIFFICULTY[task.difficulty] = {}
        end
        table.insert(TASK_IDS_BY_DIFFICULTY[task.difficulty], taskId)
    end
end

function TaskCache_getTasksForMonster(monsterName)
    local key = monsterName:lower()
    return TASK_MONSTERS[key] or {}
end

function TaskCache_getPlayerCache(cid)
    local guid = getPlayerGUID(cid)
    if not PLAYER_TASK_CACHE[guid] then
        PLAYER_TASK_CACHE[guid] = {}
    end
    return PLAYER_TASK_CACHE[guid]
end

function TaskCache_getPlayerTask(cid, taskId)
    local cache = TaskCache_getPlayerCache(cid)
    return cache[taskId]
end

function TaskCache_setPlayerTask(cid, taskId, data)
    local cache = TaskCache_getPlayerCache(cid)
    if data == nil then
        cache[taskId] = nil
    else
        cache[taskId] = data
    end
end

function TaskCache_clearPlayerCache(cid)
    local guid = getPlayerGUID(cid)
    PLAYER_TASK_CACHE[guid] = nil
end

function TaskCache_getCategoryTasks(category)
    return TASK_IDS_BY_CATEGORY[category] or {}
end

TaskCache_buildIndexes()
