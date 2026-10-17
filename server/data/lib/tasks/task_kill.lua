if not TaskCache_getPlayerTask then dofile("data/lib/tasks/task_cache.lua") end
if not TaskNetwork_sendTaskUpdate then dofile("data/lib/tasks/task_network.lua") end

function TaskKill_onKill(cid, monsterName)
    if not isPlayer(cid) or not monsterName then
        return
    end

    local taskIds = TaskCache_getTasksForMonster(monsterName)
    if #taskIds == 0 then
        return
    end

    local cache = TaskCache_getPlayerCache(cid)

    local playerCategory = TaskRank_getPlayerCategory(cid)

    for _, taskId in ipairs(taskIds) do
        local config = TASKS[taskId]
        if not config then
        elseif config.category ~= playerCategory and config.category ~= "general" then
        else
            local shouldProcess = config.type ~= "delivery"

            if shouldProcess then
                local playerTask = cache[taskId]
                if playerTask then
                end
                if playerTask and playerTask.completed ~= 1 then
                    local canProgress = true

                    if playerTask.rewarded == 1 and not config.repeatable then
                        canProgress = false
                    end

                    if canProgress then
                        if config.daily and config.daily.enabled then
                            if playerTask._dailyReset and os.time() > playerTask._dailyReset then
                                playerTask.kills = 0
                                playerTask.completed = 0
                                playerTask.rewarded = 0
                            end
                        end

                        playerTask.kills = (playerTask.kills or 0) + 1

                        if playerTask.kills >= config.killsRequired then
                            playerTask.completed = 1
                            TaskChannel_message(cid, TALKTYPE_CHANNEL_O,
                                "[Task] '" .. config.name .. "' completed! Open the Tasks window and claim your reward.")
                            TaskNetwork_sendMessage(cid, "Task '" .. config.name .. "' completed!", "#00ff00")
                            doSendMagicEffect(getCreaturePosition(cid), CONST_ME_FIREAREA)
                            TaskNetwork_sendCompletePopup(cid, taskId, config)
                        else
                            TaskChannel_message(cid, TALKTYPE_CHANNEL_W,
                                "[Task] " .. config.name .. ": " ..
                                playerTask.kills .. "/" .. config.killsRequired)
                        end

                        TaskNetwork_sendTaskUpdate(cid, taskId, playerTask.kills, config.killsRequired,
                            playerTask.completed)
                    end
                else
                end
            end
        end
    end
end
