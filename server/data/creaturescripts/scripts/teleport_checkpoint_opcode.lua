if not TELEPORT_CHECKPOINTS then dofile("data/lib/teleport_checkpoints.lua") end

local function sendResult(cid, success, message)
    doPlayerSendExtendedOpcode(cid, TELEPORT_CHECKPOINT_OPCODE, json.encode({
        action = "result",
        success = success,
        message = message,
    }))
end

-- Decides how each cost is paid without touching the player: coins/items in the
-- inventory first, then (only for items with a `worth`, i.e. money) the bank balance,
-- which is shared across every money entry. Returns the plan or the list of what's missing.
local function planPayment(cid, point)
    local balance = getBooleanFromString(getConfigInfo("bankSystem")) and getPlayerBalance(cid) or 0
    local payments, missing, totalBankGold = {}, {}, 0

    for _, cost in ipairs(point.costs) do
        local have = getPlayerItemCount(cid, cost.itemId)
        local worth = getItemInfo(cost.itemId).worth or 0

        if have >= cost.count then
            table.insert(payments, { itemId = cost.itemId, fromInventory = cost.count })
        elseif worth > 0 then
            local bankGold = (cost.count - have) * worth
            if bankGold <= balance then
                balance = balance - bankGold
                totalBankGold = totalBankGold + bankGold
                table.insert(payments, { itemId = cost.itemId, fromInventory = have })
            else
                table.insert(missing, {
                    itemId = cost.itemId,
                    count = cost.count - have - math.floor(balance / worth),
                })
            end
        else
            table.insert(missing, { itemId = cost.itemId, count = cost.count - have })
        end
    end

    return payments, missing, totalBankGold
end

local function buyCheckpoint(cid, point)
    if isTeleportCheckpointPurchased(cid, point) then
        sendResult(cid, false, "You already own this teleport point.")
        return
    end

    local payments, missing, totalBankGold = planPayment(cid, point)

    if #missing > 0 then
        local lines = {}
        for _, entry in ipairs(missing) do
            table.insert(lines, entry.count .. "x " .. getItemNameById(entry.itemId))
        end
        sendResult(cid, false, "You don't have enough\nto buy this teleport point.\n\nMissing:\n" .. table.concat(lines, "\n"))
        return
    end

    for _, payment in ipairs(payments) do
        if payment.fromInventory > 0 then
            doPlayerRemoveItem(cid, payment.itemId, payment.fromInventory)
        end
    end

    if totalBankGold > 0 then
        doPlayerSetBalance(cid, getPlayerBalance(cid) - totalBankGold)
        if sendBalance then sendBalance(cid) end
    end

    setPlayerStorageValue(cid, getTeleportCheckpointStorageKey(point), 1)
    doPlayerSave(cid)

    local message = "You bought the teleport point to " .. point.name .. "!"
    if totalBankGold > 0 then
        message = message .. " " .. totalBankGold .. " gold was taken from your bank balance."
    end
    doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, message)
    sendTeleportCheckpointList(cid)
end

local function teleportToCheckpoint(cid, point)
    if not isTeleportCheckpointPurchased(cid, point) then
        sendResult(cid, false, "You don't own this teleport point yet.")
        return
    end

    local destination = { x = point.position.x, y = point.position.y, z = point.position.z, stackpos = STACKPOS_GROUND }
    if doTileQueryAdd(cid, destination, 4, false) ~= RETURNVALUE_NOERROR then
        sendResult(cid, false, "The destination is currently blocked.")
        return
    end

    doTeleportThing(cid, point.position, false)
    doSendMagicEffect(point.position, CONST_ME_TELEPORT)
    sendResult(cid, true)
end

function onExtendedOpcode(cid, opcode, buffer)
    if opcode ~= TELEPORT_CHECKPOINT_OPCODE then return false end
    if not isPlayer(cid) then return true end

    local success, data = pcall(json.decode, buffer)
    if not success or type(data) ~= "table" then
        sendTeleportCheckpointList(cid)
        return true
    end

    local point = data.pointId and getTeleportCheckpointById(tonumber(data.pointId)) or nil

    if data.action == "buy" and point then
        buyCheckpoint(cid, point)
    elseif data.action == "teleport" and point then
        teleportToCheckpoint(cid, point)
    else
        sendTeleportCheckpointList(cid)
    end

    return true
end
