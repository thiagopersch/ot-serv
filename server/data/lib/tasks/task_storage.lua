if not TASKS then dofile("data/lib/tasks/task_db_loader.lua") end
if not PLAYER_TASK_CACHE then dofile("data/lib/tasks/task_cache.lua") end

function TaskStorage_loadPlayer(cid)
    local guid = getPlayerGUID(cid)
    if not guid then return end

    local cache = TaskCache_getPlayerCache(cid)

    local result = db.getResult("SELECT `task_id`, `kills`, `completed`, `rewarded` FROM `player_tasks` WHERE `player_id` = " .. guid)

    if result:getID() ~= -1 then
        repeat
            local taskId = result:getDataString("task_id")
            cache[taskId] = {
                kills = result:getDataInt("kills"),
                completed = result:getDataInt("completed"),
                rewarded = result:getDataInt("rewarded")
            }
        until not result:next()
        result:free()
    end

    local pointsResult = db.getResult("SELECT `points`, `total_completed` FROM `player_task_points` WHERE `player_id` = " .. guid)
    if pointsResult:getID() ~= -1 then
        cache._points = pointsResult:getDataInt("points")
        cache._totalCompleted = pointsResult:getDataInt("total_completed")
        pointsResult:free()
    else
        cache._points = 0
        cache._totalCompleted = 0
        db.query("INSERT INTO `player_task_points` (`player_id`, `points`, `total_completed`) VALUES (" .. guid .. ", 0, 0)")
    end
end

function TaskStorage_savePlayer(cid)
    local guid = getPlayerGUID(cid)
    if not guid then return end

    local cache = TaskCache_getPlayerCache(cid)

    for taskId, data in pairs(cache) do
        if taskId:sub(1, 1) ~= "_" then
            local result = db.getResult("SELECT `id` FROM `player_tasks` WHERE `player_id` = " .. guid .. " AND `task_id` = '" .. taskId .. "'")
            if result:getID() ~= -1 then
                result:free()
                db.query("UPDATE `player_tasks` SET `kills` = " .. data.kills .. ", `completed` = " .. data.completed .. ", `rewarded` = " .. data.rewarded .. " WHERE `player_id` = " .. guid .. " AND `task_id` = '" .. taskId .. "'")
            else
                db.query("INSERT INTO `player_tasks` (`player_id`, `task_id`, `kills`, `completed`, `rewarded`) VALUES (" .. guid .. ", '" .. taskId .. "', " .. data.kills .. ", " .. data.completed .. ", " .. data.rewarded .. ")")
            end
        end
    end

    if cache._points ~= nil then
        local ptsResult = db.getResult("SELECT `player_id` FROM `player_task_points` WHERE `player_id` = " .. guid)
        if ptsResult:getID() ~= -1 then
            ptsResult:free()
            db.query("UPDATE `player_task_points` SET `points` = " .. cache._points .. ", `total_completed` = " .. (cache._totalCompleted or 0) .. " WHERE `player_id` = " .. guid)
        else
            db.query("INSERT INTO `player_task_points` (`player_id`, `points`, `total_completed`) VALUES (" .. guid .. ", " .. cache._points .. ", " .. (cache._totalCompleted or 0) .. ")")
        end
    end
end

function TaskStorage_saveAll()
    for guid, _ in pairs(PLAYER_TASK_CACHE) do
        local cid = getPlayerByGUID(guid)
        if cid and isPlayer(cid) then
            TaskStorage_savePlayer(cid)
        end
    end
end

function TaskStorage_getPlayerPoints(cid)
    local cache = TaskCache_getPlayerCache(cid)
    return cache._points or 0
end

function TaskStorage_addPlayerPoints(cid, amount)
    local cache = TaskCache_getPlayerCache(cid)
    cache._points = (cache._points or 0) + amount
end

function TaskStorage_getTotalCompleted(cid)
    local cache = TaskCache_getPlayerCache(cid)
    return cache._totalCompleted or 0
end

function TaskStorage_incrementCompleted(cid)
    local cache = TaskCache_getPlayerCache(cid)
    cache._totalCompleted = (cache._totalCompleted or 0) + 1
end
