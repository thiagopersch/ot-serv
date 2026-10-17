if not TaskCore_getAvailableTasks then dofile("data/lib/tasks/task_core.lua") end

function TaskNPC_listAvailable(cid)
    local available = TaskCore_getAvailableTasks(cid)
    local names = {}

    for _, taskId in ipairs(available) do
        local config = TASKS[taskId]
        if config then
            table.insert(names, config.name)
        end
    end

    if #names == 0 then
        return "Sorry, I have no tasks available for you right now."
    end

    return "Available tasks: " .. table.concat(names, ", ") .. "."
end

function TaskNPC_deliver(cid)
    local completed = TaskCore_getCompletedTasks(cid)
    if #completed == 0 then
        doPlayerSendCancel(cid, "You don't have any completed tasks to deliver.")
        return false
    end

    if #completed == 1 then
        return TaskDelivery_deliver(cid, completed[1])
    end

    doPlayerSendCancel(cid, "You have multiple completed tasks. Please specify which one.")
    return false
end

function TaskNPC_deliverSpecific(cid, taskName)
    for taskId, config in pairs(TASKS) do
        if config.name:lower() == taskName:lower() then
            return TaskDelivery_deliver(cid, taskId)
        end
    end

    doPlayerSendCancel(cid, "Task not found.")
    return false
end

function TaskNPC_startTaskByName(cid, taskName)
    for taskId, config in pairs(TASKS) do
        if config.name:lower() == taskName:lower() then
            return TaskCore_startTask(cid, taskId)
        end
    end

    doPlayerSendCancel(cid, "Task not found.")
    return false
end

function TaskNPC_getRankInfo(cid)
    local category = TaskRank_getPlayerCategory(cid)
    local rankName, rankPoints = TaskRank_getPlayerRankName(cid)
    local nextRankName, pointsToNext = TaskRank_getNextRank(cid, category)

    local msg = "Your Rank: " .. rankName .. " (" .. rankPoints .. " points)"

    if pointsToNext and pointsToNext > 0 then
        msg = msg .. ". Next rank: " .. nextRankName .. " (" .. pointsToNext .. " points needed)."
    else
        msg = msg .. ". You are at the maximum rank!"
    end

    return msg
end

function TaskNPC_startDaily(cid)
    local level = getPlayerLevel(cid)
    local dailyIds = {}

    for taskId, config in pairs(TASKS) do
        if config.type == "daily" and config.daily and config.daily.enabled then
            if level >= config.levelRequired then
                table.insert(dailyIds, taskId)
            end
        end
    end

    if #dailyIds == 0 then
        doPlayerSendCancel(cid, "No daily tasks available for your level.")
        return false
    end

    local cache = TaskCache_getPlayerCache(cid)
    for _, taskId in ipairs(dailyIds) do
        if cache[taskId] and cache[taskId].rewarded ~= 1 then
            doPlayerSendCancel(cid, "You already have an active daily task.")
            return false
        end
    end

    local chosen = dailyIds[math.random(1, #dailyIds)]
    return TaskCore_startTask(cid, chosen)
end
