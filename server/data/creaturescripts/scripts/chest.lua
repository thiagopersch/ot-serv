-- Chest system (module game_chest on the OTC): the portal (/admin/chests) manages up to 3
-- chests in the `chests` table (name, key_item_id, rewards JSON [{itemId,count}] x<=3,
-- published). The client shows all published chests (1 centered + up to 2 on the sides),
-- requests "list" to populate them, then "open" on whichever one is centered. Opening consumes
-- 1x key_item_id (player must have it), rolls 1 reward uniformly among `rewards`, and grants it.
-- Queried directly per request (like highscore.lua) instead of cached — at most 3 rows, editing
-- happens rarely on the portal, no reload plumbing needed.

if not json then json = dofile("data/lib/json.lua") end

local CHEST_OPCODE = 252

-- Chests carregam uma janela de disponibilidade (start_month/start_year -> end_month/end_year,
-- granularidade de mês) além do `published`; um chest fora da janela não deve ser enviado ao
-- cliente mesmo que `published = 1`.
local function isChestActive(startMonth, startYear, endMonth, endYear)
    local date = os.date("*t")
    local currentValue = date.year * 12 + (date.month - 1)
    local startValue = startYear * 12 + (startMonth - 1)
    local endValue = endYear * 12 + (endMonth - 1)
    return currentValue >= startValue and currentValue <= endValue
end

local function loadPublishedChests()
    local chests = {}
    local res = db.getResult("SELECT `id`, `name`, `key_item_id`, `rewards`, `start_month`, `start_year`, `end_month`, `end_year` FROM `chests` WHERE `published` = 1 ORDER BY `id` ASC")
    if res == -1 then return chests end

    repeat
        local startMonth = result.getDataInt(res, "start_month")
        local startYear = result.getDataInt(res, "start_year")
        local endMonth = result.getDataInt(res, "end_month")
        local endYear = result.getDataInt(res, "end_year")

        if isChestActive(startMonth, startYear, endMonth, endYear) then
            local okRewards, rewards = pcall(json.decode, result.getDataString(res, "rewards") or "[]")
            table.insert(chests, {
                id = result.getDataInt(res, "id"),
                name = result.getDataString(res, "name"),
                keyItemId = result.getDataInt(res, "key_item_id"),
                rewards = okRewards and rewards or {},
            })
        end
    until not result.next(res)
    result.free(res)

    return chests
end

local function findChest(chestId)
    for _, chest in ipairs(loadPublishedChests()) do
        if chest.id == chestId then return chest end
    end
    return nil
end

-- `reward.itemId` é o server id (real OT server id) — o cliente precisa do clientId (id do
-- .dat/.otb) pra achar a sprite certa em UIItem:setItemId, mesmo padrão do game_autoloot.
local function getItemClientId(itemId)
    local itemInfo = getItemInfo(itemId)
    if itemInfo and itemInfo.clientId and itemInfo.clientId > 0 then return itemInfo.clientId end
    return itemId
end

local function sendChestList(cid)
    local list = {}
    for _, chest in ipairs(loadPublishedChests()) do
        local rewards = {}
        for _, reward in ipairs(chest.rewards) do
            table.insert(rewards, {
                itemId = reward.itemId,
                clientId = getItemClientId(reward.itemId),
                count = reward.count or 1,
                name = getItemNameById(reward.itemId),
            })
        end

        table.insert(list, {
            id = chest.id,
            name = chest.name,
            keyItemId = chest.keyItemId,
            keyClientId = getItemClientId(chest.keyItemId),
            hasKey = getPlayerItemCount(cid, chest.keyItemId) >= 1,
            keyCount = getPlayerItemCount(cid, chest.keyItemId),
            rewards = rewards,
        })
    end

    doPlayerSendExtendedOpcode(cid, CHEST_OPCODE, json.encode({
        action = "list",
        chests = list,
    }))
end

local function sendChestResult(cid, success, message, extra)
    local response = { action = "result", success = success, message = message }
    if extra then
        for key, value in pairs(extra) do
            response[key] = value
        end
    end
    doPlayerSendExtendedOpcode(cid, CHEST_OPCODE, json.encode(response))
end

-- Entrega direta no inventário do player (não numa backpack) — doPlayerAddItem já resolve o
-- primeiro slot livre e faz split automático de itens não empilháveis.
local function grantRewardItem(cid, itemId, count)
    return doPlayerAddItem(cid, itemId, count) ~= false
end

-- Sorteia exatamente 1 dentre os rewards configurados (nunca todos) — a quantidade entregue
-- desse único item sorteado varia entre 1 e o `count` configurado para ele no site, e nunca
-- ultrapassa esse máximo.
local function rollRewards(rewards)
    local reward = rewards[math.random(1, #rewards)]
    local maxCount = math.max(1, reward.count or 1)
    return { { itemId = reward.itemId, count = math.random(1, maxCount) } }
end

local function openChest(cid, chestId)
    local chest = findChest(chestId)
    if not chest then
        sendChestResult(cid, false, "This chest is not available.")
        return
    end

    if #chest.rewards == 0 then
        sendChestResult(cid, false, "This chest has no rewards configured.")
        return
    end

    if getPlayerItemCount(cid, chest.keyItemId) < 1 then
        sendChestResult(cid, false, "You don't have the required key item.")
        return
    end

    if not doPlayerRemoveItem(cid, chest.keyItemId, 1) then
        sendChestResult(cid, false, "Failed to remove the key item.")
        return
    end

    local rolled = rollRewards(chest.rewards)
    local granted = {}
    for _, reward in ipairs(rolled) do
        if grantRewardItem(cid, reward.itemId, reward.count) then
            table.insert(granted, {
                itemId = reward.itemId,
                clientId = getItemClientId(reward.itemId),
                count = reward.count,
                name = getItemNameById(reward.itemId),
            })
        end
    end

    if #granted == 0 then
        -- Refunds the key so a full inventory doesn't silently eat the player's key item.
        doPlayerAddItem(cid, chest.keyItemId, 1)
        sendChestResult(cid, false, "Your inventory is full.")
        return
    end

    local parts = {}
    for _, item in ipairs(granted) do
        table.insert(parts, item.count .. "x " .. item.name)
    end

    doSendMagicEffect(getCreaturePosition(cid), CONST_ME_GIFT_WRAPS)
    doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR,
        "You opened " .. chest.name .. " and received " .. table.concat(parts, ", ") .. "!")

    sendChestResult(cid, true, nil, {
        chestId = chest.id,
        rewards = granted,
    })
end

function onLogin(cid)
    registerCreatureEvent(cid, "ChestOpcode")
    return true
end

function onExtendedOpcode(cid, opcode, buffer)
    if opcode ~= CHEST_OPCODE then return false end
    if not isPlayer(cid) then return true end

    local success, data = pcall(json.decode, buffer)
    if not success or type(data) ~= "table" then
        sendChestList(cid)
        return true
    end

    if data.action == "open" and data.chestId then
        openChest(cid, tonumber(data.chestId))
    else
        sendChestList(cid)
    end

    return true
end
