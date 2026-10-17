if not DailyReward then dofile('data/lib/daily_reward.lua') end

function DailyReward.sendState(cid, cache, state)
    cache = cache or DailyReward.getMonthCache()
    state = state or DailyReward.getPlayerState(getPlayerGUID(cid), cache)

    local buffer = table.concat({
        state.today,
        cache.month,
        cache.year,
        cache.daysInMonth,
        state.claimedMask,
        state.missedMask,
        state.consecutive,
        cache.dailyStr,
        cache.bonusStr,
        state.bonusClaimedMask,
        state.bonusAvailableMask
    }, "|")

    doPlayerSendExtendedOpcode(cid, DailyReward.opcode, buffer)
end

function onLogin(cid)
    DailyReward.sendState(cid)
    return true
end

local function itemWeight(itemId, count)
    local itemInfo = getItemInfo(itemId)
    return itemInfo and (itemInfo.weight * count) or 0
end

local function hasCapacity(cid, item, extraWeight)
    return getPlayerFreeCap(cid) >= itemWeight(item.id, item.count) + (extraWeight or 0)
end

local function claimDaily(cid)
    local cache = DailyReward.getMonthCache()
    local guid = getPlayerGUID(cid)
    local state = DailyReward.getPlayerState(guid, cache)
    local day = state.today

    if state.claimed[day] then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Você já resgatou sua recompensa de hoje.")
        return
    end

    local cfg = cache.items[day]
    if not cfg then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Erro: Recompensa do dia não encontrada.")
        return
    end

    if not hasCapacity(cid, cfg) then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Você não tem capacidade suficiente.")
        return
    end

    local item = doCreateItemEx(cfg.id, cfg.count)
    if item <= 0 then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Erro técnico: Item inválido.")
        return
    end

    if doPlayerAddItemEx(cid, item, true) ~= RETURNVALUE_NOERROR then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Erro ao entregar item. Verifique sua backpack.")
        return
    end

    db.query(string.format(
        "INSERT INTO `player_daily_rewards` (`player_id`, `day`, `month`, `year`, `item_id`, `count`, `timestamp`) VALUES (%d, %d, %d, %d, %d, %d, %d)",
        guid, day, cache.month, cache.year, cfg.id, cfg.count, os.time()))

    doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR,
        "Você resgatou sua recompensa diária: " .. cfg.count .. "x " .. getItemNameById(cfg.id) .. ".")

    DailyReward.sendState(cid, cache)
end

local function claimBonus(cid, streakDay)
    local cache = DailyReward.getMonthCache()
    local index = streakDay and cache.bonusIndex[streakDay]
    if not index then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Erro: Bônus inválido.")
        return
    end

    local guid = getPlayerGUID(cid)
    local state = DailyReward.getPlayerState(guid, cache)

    if state.bonusClaimed[index] then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Você já resgatou este bônus.")
        return
    end

    if state.consecutive < streakDay then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL,
            "Você precisa de " .. streakDay .. " dias consecutivos para resgatar este bônus. Atual: " .. state.consecutive .. ".")
        return
    end

    local cfg = cache.bonus[index]
    -- Outfit bônus: o jogador recebe o item do outfit customizado (libera ao usar).
    local outfit = #cache.outfits > 0 and cache.outfits[math.random(#cache.outfits)] or nil
    if not hasCapacity(cid, cfg, outfit and itemWeight(outfit.itemId, 1) or 0) then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Você não tem capacidade suficiente.")
        return
    end

    local item = doCreateItemEx(cfg.id, cfg.count)
    if item <= 0 then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Erro técnico: Item de bônus inválido.")
        return
    end

    if doPlayerAddItemEx(cid, item, true) ~= RETURNVALUE_NOERROR then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Erro ao entregar bônus. Verifique sua backpack.")
        return
    end

    db.query(string.format(
        "INSERT INTO `player_daily_reward_bonus` (`player_id`, `month`, `year`, `streak_day`, `claimed_at`) VALUES (%d, %d, %d, %d, %d)",
        guid, cache.month, cache.year, streakDay, os.time()))

    local lines = {
        "Você resgatou o bônus de " .. streakDay .. " dias consecutivos!",
        "Item: " .. cfg.count .. "x " .. cfg.name
    }

    if outfit then
        local outfitItem = doCreateItemEx(outfit.itemId, 1)
        if outfitItem > 0 and doPlayerAddItemEx(cid, outfitItem, true) == RETURNVALUE_NOERROR then
            lines[#lines + 1] = "Outfit: " .. outfit.name .. " (use o item para liberar)"
        end
    end

    lines[#lines + 1] = "Dias consecutivos: " .. state.consecutive
    lines[#lines + 1] = "Dias resgatados: " .. DailyReward.getClaimedDaysList(state)
    doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, table.concat(lines, "\n"))

    DailyReward.sendState(cid, cache)
end

function onExtendedOpcode(cid, opcode, buffer)
    if opcode ~= DailyReward.opcode then return end

    if buffer == "open" then
        local now = os.time()
        local last = DailyReward.lastOpen[cid]
        if last and now - last < DailyReward.OPEN_EXHAUST then
            return
        end
        DailyReward.lastOpen[cid] = now
        DailyReward.sendState(cid)
        return
    end

    if buffer == "claim" then
        claimDaily(cid)
        return
    end

    local claimBonusPrefix = "claim_bonus|"
    if string.sub(buffer, 1, #claimBonusPrefix) == claimBonusPrefix then
        claimBonus(cid, tonumber(string.sub(buffer, #claimBonusPrefix + 1)))
    end
end
