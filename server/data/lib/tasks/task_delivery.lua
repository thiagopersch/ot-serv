if not TaskRewards_hasRequiredItems then dofile("data/lib/tasks/task_rewards.lua") end

function TaskDelivery_canDeliver(cid, taskId)
    local config = TASKS[taskId]
    if not config then return false, "Task not found." end

    local category = TaskRank_getPlayerCategory(cid)
    if config.category ~= category and config.category ~= "general" then
        return false, "This task is not available for your vocation."
    end

    local cache = TaskCache_getPlayerCache(cid)
    local playerTask = cache[taskId]
    if not playerTask then return false, "You don't have this task." end

    if playerTask.completed ~= 1 then
        if config.killsRequired > 0 then
            local remaining = config.killsRequired - (playerTask.kills or 0)
            if remaining > 0 then
                return false, "You need to kill " .. remaining .. " more."
            end
        end
        return false, "Task not completed."
    end

    if playerTask.rewarded == 1 then
        if config.repeatable then
            return true, "ready"
        end
        return false, "You already received the reward for this task."
    end

    if not TaskRewards_hasRequiredItems(cid, config) then
        return false, "You don't have the required delivery items."
    end

    return true, "ready"
end

function TaskDelivery_deliver(cid, taskId)
    local canDeliver, msg = TaskDelivery_canDeliver(cid, taskId)
    if not canDeliver then
        doPlayerSendCancel(cid, msg)
        return false
    end

    local config = TASKS[taskId]
    local cache = TaskCache_getPlayerCache(cid)
    local playerTask = cache[taskId]

    if not TaskRewards_removeDeliveryItems(cid, config) then
        doPlayerSendCancel(cid, "Failed to remove delivery items.")
        return false
    end

    TaskRewards_grantAll(cid, config)

    if playerTask then
        playerTask.rewarded = 1
    end

    TaskChannel_message(cid, TALKTYPE_CHANNEL_O, "[Task] Rewards delivered for '" .. config.name .. "'!")
    doSendMagicEffect(getCreaturePosition(cid), CONST_ME_HOLYDAMAGE)

    return true
end
