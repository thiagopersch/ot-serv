if not TaskStorage_addPlayerPoints then dofile("data/lib/tasks/task_storage.lua") end

function TaskRewards_grantExperience(cid, amount)
    if amount and amount > 0 then
        doPlayerAddExp(cid, amount)
    end
end

function TaskRewards_grantMoney(cid, amount)
    if amount and amount > 0 then
        doPlayerAddMoney(cid, amount)
    end
end

function TaskRewards_grantPoints(cid, difficulty)
    local points = TaskRank_getPointsForDifficulty(cid, difficulty)
    if points and points > 0 then
        TaskStorage_addPlayerPoints(cid, points)
        TaskRank_checkAndRankUp(cid)
    end
    return points
end

function TaskRewards_grantItems(cid, items)
    if not items or #items == 0 then return end

    local backpack = doPlayerAddItem(cid, 5801, 1)
    if not backpack then
        backpack = doPlayerAddItem(cid, 1988, 1)
    end

    if backpack then
        for _, itemData in ipairs(items) do
            local itemId = itemData[1]
            local count = itemData[2]
            if isItemStackable(itemId) or count == 1 then
                doAddContainerItem(backpack, itemId, count)
            else
                for i = 1, count do
                    doAddContainerItem(backpack, itemId, 1)
                end
            end
        end
    end
end

function TaskRewards_grantAll(cid, taskConfig)
    TaskRewards_grantExperience(cid, taskConfig.experience)
    TaskRewards_grantMoney(cid, taskConfig.money)
    local pointsEarned = TaskRewards_grantPoints(cid, taskConfig.difficulty)
    TaskRewards_grantItems(cid, taskConfig.rewards.items)
    TaskStorage_incrementCompleted(cid)
end

function TaskRewards_hasRequiredItems(cid, taskConfig)
    if not taskConfig.delivery or not taskConfig.delivery.enabled then
        return true
    end

    local count = getPlayerItemCount(cid, taskConfig.delivery.itemId)
    return count >= taskConfig.delivery.count
end

function TaskRewards_removeDeliveryItems(cid, taskConfig)
    if not taskConfig.delivery or not taskConfig.delivery.enabled then
        return true
    end

    return doPlayerRemoveItem(cid, taskConfig.delivery.itemId, taskConfig.delivery.count)
end
