if not TaskKill_onKill then dofile("data/lib/tasks/task_kill.lua") end
if not TaskDelivery_deliver then dofile("data/lib/tasks/task_delivery.lua") end

function TaskCore_startTask(cid, taskId)
    if not isPlayer(cid) then
        return false
    end

    local config = TASKS[taskId]
    if not config then
        doPlayerSendCancel(cid, "Task not found.")
        return false
    end

    local category = TaskRank_getPlayerCategory(cid)
    if config.category ~= category and config.category ~= "general" then
        doPlayerSendCancel(cid, "This task is not available for your vocation.")
        return false
    end

    local level = getPlayerLevel(cid)
    if level < config.levelRequired then
        doPlayerSendCancel(cid, "You need level " .. config.levelRequired .. " to start this task.")
        return false
    end

    if config.rankRequired > 0 then
        local points = TaskStorage_getPlayerPoints(cid)
        if points < config.rankRequired then
            doPlayerSendCancel(cid, "You need " .. config.rankRequired .. " task points to start this task.")
            return false
        end
    end

    if config.requiredTask then
        local required = config.requiredTask
        local cache = TaskCache_getPlayerCache(cid)
        local reqTask = cache[required]
        if not reqTask or reqTask.rewarded ~= 1 then
            doPlayerSendCancel(cid,
                "You must complete '" .. (TASKS[required] and TASKS[required].name or required) .. "' first.")
            return false
        end
    end

    local cache = TaskCache_getPlayerCache(cid)
    local existing = cache[taskId]

    if existing and existing.rewarded ~= 1 then
        if config.unique then
            doPlayerSendCancel(cid, "You already have this task.")
            return false
        end
        if not config.repeatable then
            doPlayerSendCancel(cid, "You already have this task in progress or completed.")
            return false
        end
    end

    local activeCount = 0
    for tid, tdata in pairs(cache) do
        if tid:sub(1, 1) ~= "_" and tdata.rewarded ~= 1 then
            local tconfig = TASKS[tid]
            if tconfig and tconfig.type == config.type then
                activeCount = activeCount + 1
            end
        end
    end
    if activeCount >= 1 then
        doPlayerSendCancel(cid, "You already have an active " .. config.type .. " task. Finish it first.")
        return false
    end

    local taskData = {
        kills = 0,
        completed = 0,
        rewarded = 0
    }

    if config.daily and config.daily.enabled then
        taskData._dailyReset = os.time() + (config.daily.resetHours * 3600)
    end

    cache[taskId] = taskData

    TaskChannel_message(cid, TALKTYPE_CHANNEL_O, "[Task] You started '" .. config.name .. "'!")
    TaskNetwork_sendMessage(cid, "Task started successfully: '" .. config.name .. "'!", "#00ff00")
    doSendMagicEffect(getCreaturePosition(cid), CONST_ME_GREEN_RINGS)
    if config.killsRequired > 0 then
        local names = {}
        for _, m in ipairs(config.monsters) do
            table.insert(names, type(m) == "table" and m.name or m)
        end
        TaskChannel_message(cid, TALKTYPE_CHANNEL_W,
            "[Task] Kill " .. config.killsRequired .. " " .. table.concat(names, ", ") .. ".")
    end
    if config.delivery and config.delivery.enabled then
        TaskChannel_message(cid, TALKTYPE_CHANNEL_W,
            "[Task] Bring " .. config.delivery.count .. "x " .. getItemNameById(config.delivery.itemId) .. ".")
    end

    TaskNetwork_sendTaskList(cid)

    return true
end

function TaskCore_abortTask(cid, taskId)
    if not isPlayer(cid) then return false end

    local config = TASKS[taskId]
    if not config then return false end

    local category = TaskRank_getPlayerCategory(cid)
    if config.category ~= category and config.category ~= "general" then
        doPlayerSendCancel(cid, "This task is not available for your vocation.")
        return false
    end

    local cache = TaskCache_getPlayerCache(cid)
    local playerTask = cache[taskId]

    if not playerTask then
        doPlayerSendCancel(cid, "You don't have this task.")
        return false
    end

    if playerTask.rewarded == 1 then
        doPlayerSendCancel(cid, "You already completed this task.")
        return false
    end

    cache[taskId] = nil

    TaskChannel_message(cid, TALKTYPE_CHANNEL_RN, "[Task] Task aborted.")
    TaskNetwork_sendMessage(cid, "Task canceled!", "#ff4444")

    TaskNetwork_sendTaskList(cid)

    return true
end

function TaskCore_completeTask(cid, taskId)
    if not isPlayer(cid) then return false end

    local config = TASKS[taskId]
    if not config then return false end

    local cache = TaskCache_getPlayerCache(cid)
    local playerTask = cache[taskId]

    if not playerTask then
        doPlayerSendCancel(cid, "You don't have this task.")
        return false
    end

    if playerTask.completed == 1 then
        doPlayerSendCancel(cid, "Task already completed. Talk to Taskerman to claim reward.")
        return false
    end

    if config.killsRequired > 0 and (playerTask.kills or 0) < config.killsRequired then
        doPlayerSendCancel(cid, "Task not yet completed. Keep killing!")
        return false
    end

    playerTask.completed = 1

    TaskChannel_message(cid, TALKTYPE_CHANNEL_O,
        "[Task] '" .. config.name .. "' completed! Open the Tasks window and click Claim Rewards.")
    TaskNetwork_sendMessage(cid, "Task '" .. config.name .. "' completed! Claim your rewards.", "#00ff00")
    doSendMagicEffect(getCreaturePosition(cid), CONST_ME_FIREAREA)

    TaskNetwork_sendCompletePopup(cid, taskId, config)

    return true
end

function TaskCore_claimTask(cid, taskId)
    if not isPlayer(cid) then return false end

    local config = TASKS[taskId]
    if not config then
        doPlayerSendCancel(cid, "Task not found.")
        return false
    end

    local category = TaskRank_getPlayerCategory(cid)
    if config.category ~= category and config.category ~= "general" then
        doPlayerSendCancel(cid, "This task is not available for your vocation.")
        return false
    end

    local cache = TaskCache_getPlayerCache(cid)
    local playerTask = cache[taskId]

    if not playerTask then
        doPlayerSendCancel(cid, "You don't have this task active.")
        return false
    end

    if playerTask.rewarded == 1 then
        doPlayerSendCancel(cid, "You already claimed the reward for this task.")
        return false
    end

    if config.killsRequired > 0 and (playerTask.kills or 0) < config.killsRequired then
        if playerTask.completed ~= 1 then
            doPlayerSendCancel(cid, "Task not yet completed. Keep killing!")
            return false
        end
    end

    if config.delivery and config.delivery.enabled then
        if not TaskRewards_removeDeliveryItems(cid, config) then
            doPlayerSendCancel(cid, "You don't have the required delivery items.")
            return false
        end
    end

    TaskRewards_grantAll(cid, config)

    playerTask.rewarded = 1

    TaskChannel_message(cid, TALKTYPE_CHANNEL_O, "[Task] Rewards delivered for '" .. config.name .. "'!")
    TaskNetwork_sendMessage(cid, "Rewards claimed for '" .. config.name .. "'!", "#00ff00")
    doSendMagicEffect(getCreaturePosition(cid), CONST_ME_HOLYDAMAGE)

    TaskNetwork_sendTaskList(cid)

    return true
end

function TaskCore_getAvailableTasks(cid)
    local category = TaskRank_getPlayerCategory(cid)
    local level = getPlayerLevel(cid)
    local points = TaskStorage_getPlayerPoints(cid)
    local cache = TaskCache_getPlayerCache(cid)

    local available = {}

    for taskId, config in pairs(TASKS) do
        if config.category == category or config.category == "general" then
            if level >= config.levelRequired and points >= config.rankRequired then
                local playerTask = cache[taskId]
                if not playerTask or playerTask.rewarded == 1 then
                    table.insert(available, taskId)
                elseif config.repeatable and playerTask.rewarded == 1 then
                    table.insert(available, taskId)
                end
            end
        end
    end

    return available
end

function TaskCore_getActiveTasks(cid)
    local cache = TaskCache_getPlayerCache(cid)
    local active = {}

    for taskId, data in pairs(cache) do
        if taskId:sub(1, 1) ~= "_" and data.rewarded ~= 1 then
            table.insert(active, taskId)
        end
    end

    return active
end

function TaskCore_getCompletedTasks(cid)
    local cache = TaskCache_getPlayerCache(cid)
    local completed = {}

    for taskId, data in pairs(cache) do
        if taskId:sub(1, 1) ~= "_" and data.completed == 1 and data.rewarded == 0 then
            table.insert(completed, taskId)
        end
    end

    return completed
end
