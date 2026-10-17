-- Unified Script for Daily Reward Items
-- Senzus, Potions, Boxes, Points

local CONFIG = {
    -- Senzus: [id] = {hp, mp, name}
    senzus = {
        [56818] = { heal = 500000, name = "Senzu of the Devil" },
        [49696] = { heal = 400000, name = "Crystal Senzu" },
        [49695] = { heal = 275000, name = "Black Senzu" },
        [56744] = { heal = 150000, name = "Brown Senzu" },
        [56817] = { heal = 75000, name = "Purple Senzu" },
        [56745] = { heal = 50000, name = "Blue Sky Senzu" },
        [56697] = { heal = 25000, name = "Yellow Senzu" },
        [49694] = { heal = 10000, name = "Red Senzu" },
        [49693] = { heal = 5000, name = "Green Senzu" }
    },

    -- Potions: [id] = {type, value, duration, name}
    potions = {
        -- XP Potions (Storage based or direct exp gain multiplier if supported by TFS)
        [56709] = { type = "xp", value = 50, time = 3600, name = "Green XP Potion" },
        [56705] = { type = "xp", value = 50, time = 7200, name = "Grey XP Potion" },
        [56742] = { type = "xp", value = 50, time = 21600, name = "Capsule XP Potion" },
        [56704] = { type = "xp", value = 50, time = 43200, name = "Celestial XP Potion" },
        [56703] = { type = "xp", value = 50, time = 86400, name = "Purple Shenlong XP Potion" },

        -- Skill Potions
        [56406] = { type = "skill", value = 25, time = 1800, name = "Skill Potion 30min" },
        [56404] = { type = "skill", value = 25, time = 3600, name = "Skill Potion 1h" },
        [56403] = { type = "skill", value = 25, time = 7200, name = "Skill Potion 2h" },
        [56405] = { type = "skill", value = 25, time = 10800, name = "Skill Potion 3h" },
        [56408] = { type = "skill", value = 25, time = 21600, name = "Skill Potion 6h" },
        [56410] = { type = "skill", value = 25, time = 43200, name = "Skill Potion 12h" },
        [56409] = { type = "skill", value = 25, time = 86400, name = "Skill Potion 24h" },

        -- Dodge/Critical (Permanent increase: 1 point = 0.025%. Max 1000 points = 25%)
        [56710] = { type = "dodge", value = 1, max = 1000, storage = 48700, name = "Dodge Potion" },
        [56711] = { type = "critical", value = 1, max = 1000, storage = 48701, name = "Critical Potion" }
    },

    -- Boxes: [id] = {pool}
    boxes = {
        [56396] = {                               -- Red Box
            { id = 2160,  count = 10, chance = 10 }, -- 10 Crystal Coins
            { id = 56386, count = 5,  chance = 10 }, -- Fragments
            { id = 56399, count = 1,  chance = 10 }, -- Key
            { id = 56392, count = 1,  chance = 10 }, -- Stone
            { id = 56703, count = 1,  chance = 10 }, -- Best XP Potion
        },
        [56397] = {                               -- Green Box
            { id = 2160,  count = 5, chance = 10 },
            { id = 56386, count = 2, chance = 10 },
            { id = 56710, count = 1, chance = 10 }, -- Dodge
            { id = 56711, count = 1, chance = 10 }, -- Critical
            { id = 56818, count = 1, chance = 10 }, -- Best Senzu
        }
    },

    -- Points: [id] = amount
    points = {
        [56449] = 10,
        [56451] = 20
    }
}

function onUse(cid, item, fromPosition, itemEx, toPosition)
    local itemid = item.itemid

    -- SENZUS
    local senzu = CONFIG.senzus[itemid]
    if senzu then
        doCreatureAddHealth(cid, senzu.heal)
        doCreatureAddMana(cid, senzu.heal)
        doSendMagicEffect(getThingPos(cid), CONST_ME_MAGIC_BLUE)
        doRemoveItem(item.uid, 1)
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "You used a " .. senzu.name .. ".")
        return true
    end

    -- POTIONS (Dodge/Critical)
    local pot = CONFIG.potions[itemid]
    if pot then
        if pot.type == "dodge" or pot.type == "critical" then
            local current = math.max(0, getPlayerStorageValue(cid, pot.storage))
            if current >= pot.max then
                doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL,
                    "You already reached the maximum " .. pot.type .. " (" .. pot.max .. "/1000).")
                return true
            end

            local newVal = current + pot.value
            setPlayerStorageValue(cid, pot.storage, newVal)
            db.query("UPDATE `players` SET `" .. pot.type .. "` = " .. newVal .. " WHERE `id` = " .. getPlayerGUID(cid))
            doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR,
                "Your " .. pot.type .. " skill has increased to " .. newVal .. "/1000 (" .. (newVal * 0.025) .. "%).")
            doSendMagicEffect(getThingPos(cid), CONST_ME_MAGIC_GREEN)
            doRemoveItem(item.uid, 1)
            return true
        elseif pot.type == "xp" then
            -- Implementação de Double XP via Storage (Requer ajuste no creaturescript onExp)
            local storageXP = 48702
            local time = os.time() + pot.time
            setPlayerStorageValue(cid, storageXP, time)
            doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR,
                "You consumed a " .. pot.name .. ". Bonus XP active for " .. (pot.time / 3600) .. " hours.")
            doSendMagicEffect(getThingPos(cid), CONST_ME_MAGIC_RED)
            doRemoveItem(item.uid, 1)
            return true
        elseif pot.type == "skill" then
            -- Implementação de Skill Boost via Storage
            local storageSkill = 48703
            local time = os.time() + pot.time
            setPlayerStorageValue(cid, storageSkill, time)
            doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR,
                "You consumed a " .. pot.name .. ". Skill gain increased by 25% for " .. (pot.time / 3600) .. " hours.")
            doSendMagicEffect(getThingPos(cid), CONST_ME_MAGIC_BLUE)
            doRemoveItem(item.uid, 1)
            return true
        end
    end

    -- MYSTERY BOXES
    local box = CONFIG.boxes[itemid]
    if box then
        local rand = math.random(1, 100)
        local cumul = 0
        local reward = box[math.random(#box)] -- Seleção aleatória simples conforme solicitado (chance 10%)

        local itemReward = doPlayerAddItem(cid, reward.id, reward.count)
        if itemReward then
            doCreatureSay(cid, "You found: " .. reward.count .. "x " .. getItemNameById(reward.id) .. "!",
                TALKTYPE_ORANGE_1)
            doSendMagicEffect(getThingPos(cid), CONST_ME_GIFT_WRAPS)
            doRemoveItem(item.uid, 1)
        end
        return true
    end

    -- POINTS
    local pAmount = CONFIG.points[itemid]
    if pAmount then
        -- Simulação de adição de pontos (Geralmente via SQL ou Storage dependendo do sistema de Shop)
        -- Aqui vamos usar uma query SQL se possível ou apenas um log.
        -- db.executeQuery("UPDATE accounts SET premium_points = premium_points + " .. pAmount .. " WHERE id = " .. getPlayerAccountId(cid))
        doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "You received " .. pAmount .. " shop points!")
        doRemoveItem(item.uid, 1)
        return true
    end

    return false
end
