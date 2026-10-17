-- ============================================================
-- skill_upgrades_lib.lua
-- Main logic for Skill Upgrade System (TFS 0.4)
-- ============================================================

if not SkillUpgradesConfig then dofile("data/lib/skill_upgrades_config.lua") end

SkillUpgradesLib = {}

-- Cache to hold player stats in memory for performance
-- Structure: PlayerSkillUpgradesCache[guid][vocationId][skill_name] = level
PlayerSkillUpgradesCache = {}
-- Structure: PlayerSkillPointsCache[guid][vocationId] = {available = X, spent = Y, highestLevel = Z}
PlayerSkillPointsCache = {}

function SkillUpgradesLib.ensureSchema()
    if SkillUpgradesLib.__schemaEnsured then return end
    SkillUpgradesLib.__schemaEnsured = true

    local query = db.getResult(
    "SELECT 1 FROM `information_schema`.`COLUMNS` WHERE `TABLE_SCHEMA` = DATABASE() AND `TABLE_NAME` = 'player_skill_points' AND `COLUMN_NAME` = 'highest_level_counted'")
    if not query or query:getID() == -1 then
        db.query("ALTER TABLE `player_skill_points` ADD COLUMN `highest_level_counted` INT NOT NULL DEFAULT 0")
    else
        query:free()
    end
end

function SkillUpgradesLib.loadPlayer(cid)
    local guid = getPlayerGUID(cid)
    if not guid then return end

    SkillUpgradesLib.ensureSchema()

    PlayerSkillUpgradesCache[guid] = {}
    PlayerSkillPointsCache[guid] = {}

    -- Load Points
    local query = db.getResult(
    "SELECT `vocation_id`, `available_points`, `spent_points`, `highest_level_counted` FROM `player_skill_points` WHERE `player_id` = " .. guid)
    if query:getID() ~= -1 then
        repeat
            local voc = query:getDataInt("vocation_id")
            local avail = query:getDataInt("available_points")
            local spent = query:getDataInt("spent_points")
            local highestLevel = query:getDataInt("highest_level_counted")
            PlayerSkillPointsCache[guid][voc] = { available = avail, spent = spent, highestLevel = highestLevel }
        until not query:next()
        query:free()
    end

    -- Load Skills
    local querySkills = db.getResult(
    "SELECT `vocation_id`, `skill_name`, `current_level` FROM `player_skill_upgrades` WHERE `player_id` = " .. guid)
    if querySkills:getID() ~= -1 then
        repeat
            local voc = querySkills:getDataInt("vocation_id")
            local skill = querySkills:getDataString("skill_name")
            local lvl = querySkills:getDataInt("current_level")

            if not PlayerSkillUpgradesCache[guid][voc] then
                PlayerSkillUpgradesCache[guid][voc] = {}
            end
            PlayerSkillUpgradesCache[guid][voc][skill] = lvl
        until not querySkills:next()
        querySkills:free()
    end
end

function SkillUpgradesLib.unloadPlayer(cid)
    local guid = getPlayerGUID(cid)
    if guid then
        PlayerSkillUpgradesCache[guid] = nil
        PlayerSkillPointsCache[guid] = nil
    end
end

function SkillUpgradesLib.initVocation(guid, vocationId)
    if not PlayerSkillPointsCache[guid] then PlayerSkillPointsCache[guid] = {} end
    if not PlayerSkillUpgradesCache[guid] then PlayerSkillUpgradesCache[guid] = {} end

    if not PlayerSkillPointsCache[guid][vocationId] then
        PlayerSkillPointsCache[guid][vocationId] = { available = 0, spent = 0, highestLevel = 0 }
        db.query(
        "INSERT INTO `player_skill_points` (`player_id`, `vocation_id`, `available_points`, `spent_points`, `highest_level_counted`) VALUES (" ..
        guid .. ", " .. vocationId .. ", 0, 0, 0)")
    end

    if not PlayerSkillUpgradesCache[guid][vocationId] then
        PlayerSkillUpgradesCache[guid][vocationId] = {}
    end
end

function SkillUpgradesLib.getPoints(cid, vocationId)
    local guid = getPlayerGUID(cid)
    if not guid or not PlayerSkillPointsCache[guid] then return { available = 0, spent = 0, highestLevel = 0 } end
    return PlayerSkillPointsCache[guid][vocationId] or { available = 0, spent = 0, highestLevel = 0 }
end

-- Watermark of the highest character level for which skill points were already granted
-- in this vocation. Prevents re-granting points after a prestige reset or a death releveling
-- back up to a level that was already counted.
function SkillUpgradesLib.getHighestCountedLevel(cid, vocationId)
    local guid = getPlayerGUID(cid)
    vocationId = vocationId or getPlayerVocation(cid)
    if not guid then return 0 end

    SkillUpgradesLib.initVocation(guid, vocationId)
    return PlayerSkillPointsCache[guid][vocationId].highestLevel or 0
end

function SkillUpgradesLib.setHighestCountedLevel(cid, vocationId, level)
    local guid = getPlayerGUID(cid)
    if not guid then return end

    SkillUpgradesLib.initVocation(guid, vocationId)
    PlayerSkillPointsCache[guid][vocationId].highestLevel = level
    db.query("UPDATE `player_skill_points` SET `highest_level_counted` = " .. level ..
    " WHERE `player_id` = " .. guid .. " AND `vocation_id` = " .. vocationId)
end

function SkillUpgradesLib.addAvailablePoints(cid, vocationId, amount)
    local guid = getPlayerGUID(cid)
    if not guid then return end

    SkillUpgradesLib.initVocation(guid, vocationId)
    PlayerSkillPointsCache[guid][vocationId].available = PlayerSkillPointsCache[guid][vocationId].available + amount
    db.query("UPDATE `player_skill_points` SET `available_points` = " ..
    PlayerSkillPointsCache[guid][vocationId].available ..
    " WHERE `player_id` = " .. guid .. " AND `vocation_id` = " .. vocationId)
    SkillUpgradesLib.sendUpdateToClient(cid)
end

function SkillUpgradesLib.getSkillLevel(cid, skill_name, vocationId)
    local guid = getPlayerGUID(cid)
    vocationId = vocationId or getPlayerVocation(cid)
    if not guid or not PlayerSkillUpgradesCache[guid] or not PlayerSkillUpgradesCache[guid][vocationId] then
        return 0
    end
    return PlayerSkillUpgradesCache[guid][vocationId][skill_name] or 0
end

function SkillUpgradesLib.getSkillValue(cid, skill_name, vocationId)
    local lvl = SkillUpgradesLib.getSkillLevel(cid, skill_name, vocationId)
    if lvl == 0 then return 0 end
    local config = SkillUpgradesConfig.Categories[skill_name]
    if config then
        return config.formula(lvl)
    end
    return 0
end

function SkillUpgradesLib.upgradeSkill(cid, skill_name)
    local guid = getPlayerGUID(cid)
    local vocationId = getPlayerVocation(cid)
    if not guid then return false end

    SkillUpgradesLib.initVocation(guid, vocationId)

    local config = SkillUpgradesConfig.Categories[skill_name]
    if not config then return false end

    local currentLvl = SkillUpgradesLib.getSkillLevel(cid, skill_name, vocationId)
    if currentLvl >= config.maxLevel then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "This skill is already at max level.")
        return false
    end

    local cost = SkillUpgradesConfig.GetUpgradeCost(currentLvl)
    local points = PlayerSkillPointsCache[guid][vocationId]

    if points.available < cost then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "You don't have enough points. Need " .. cost .. ".")
        return false
    end

    -- Deduct points and increase level
    points.available = points.available - cost
    points.spent = points.spent + cost

    PlayerSkillUpgradesCache[guid][vocationId][skill_name] = currentLvl + 1

    -- DB Updates
    db.query("UPDATE `player_skill_points` SET `available_points` = " ..
    points.available ..
    ", `spent_points` = " .. points.spent .. " WHERE `player_id` = " .. guid .. " AND `vocation_id` = " .. vocationId)

    if currentLvl == 0 then
        db.query(
        "INSERT INTO `player_skill_upgrades` (`player_id`, `vocation_id`, `skill_name`, `current_level`) VALUES (" ..
        guid .. ", " .. vocationId .. ", '" .. skill_name .. "', 1)")
    else
        db.query("UPDATE `player_skill_upgrades` SET `current_level` = " ..
        (currentLvl + 1) ..
        " WHERE `player_id` = " ..
        guid .. " AND `vocation_id` = " .. vocationId .. " AND `skill_name` = '" .. skill_name .. "'")
    end

    SkillUpgradesLib.applyCombatStats(cid, vocationId)
    SkillUpgradesLib.sendUpdateToClient(cid)
    doSendMagicEffect(getCreaturePosition(cid), 29)
    return true
end

function SkillUpgradesLib.resetSkills(cid, vocationId)
    local guid = getPlayerGUID(cid)
    vocationId = vocationId or getPlayerVocation(cid)
    if not guid then return false end

    SkillUpgradesLib.initVocation(guid, vocationId)

    local points = PlayerSkillPointsCache[guid][vocationId]
    if points.spent == 0 then
        return false
    end

    points.available = points.available + points.spent
    points.spent = 0

    PlayerSkillUpgradesCache[guid][vocationId] = {}

    db.query("UPDATE `player_skill_points` SET `available_points` = " ..
    points.available .. ", `spent_points` = 0 WHERE `player_id` = " .. guid .. " AND `vocation_id` = " .. vocationId)
    db.query("DELETE FROM `player_skill_upgrades` WHERE `player_id` = " .. guid .. " AND `vocation_id` = " .. vocationId)

    SkillUpgradesLib.applyCombatStats(cid, vocationId)
    SkillUpgradesLib.sendUpdateToClient(cid)
    doSendMagicEffect(getCreaturePosition(cid), 30)
    return true
end

-- Every category is all-or-nothing (see skill_upgrades_config.lua): formula(lvl) is 0 until
-- the skill hits maxLevel, then returns its fixed bonus. Percent-based effects that need to be
-- read from C++ (cooldown/mana, exp, loot, magic level speed, attack speed) are pushed down to
-- cached Player fields here. Effects resolved purely from combat events (crit, leech, healing,
-- reflect, weapon-type damage, magic damage, shielding) live in skill_upgrades_stats.lua instead.
function SkillUpgradesLib.applyCombatStats(cid, vocationId)
    vocationId = vocationId or getPlayerVocation(cid)

    local cdLvl = SkillUpgradesLib.getSkillValue(cid, "cooldown_reduction", vocationId)
    if doPlayerSetSkillUpgradeManaReduction then doPlayerSetSkillUpgradeManaReduction(cid, cdLvl) end
    if doPlayerSetSkillUpgradeCooldownReduction then doPlayerSetSkillUpgradeCooldownReduction(cid, cdLvl) end

    local expLvl = SkillUpgradesLib.getSkillValue(cid, "exp_bonus", vocationId)
    if doPlayerSetSkillUpgradeExpBonus then doPlayerSetSkillUpgradeExpBonus(cid, expLvl) end

    local lootLvl = SkillUpgradesLib.getSkillValue(cid, "loot_chance", vocationId)
    if doPlayerSetSkillUpgradeLootChance then doPlayerSetSkillUpgradeLootChance(cid, lootLvl) end

    local mlSpeedLvl = SkillUpgradesLib.getSkillValue(cid, "magic_level", vocationId)
    if doPlayerSetSkillUpgradeMagicLevelSpeed then doPlayerSetSkillUpgradeMagicLevelSpeed(cid, mlSpeedLvl) end

    local atkSpeedLvl = SkillUpgradesLib.getSkillValue(cid, "fist_fighting", vocationId)
    if doPlayerSetSkillUpgradeAttackSpeed then doPlayerSetSkillUpgradeAttackSpeed(cid, atkSpeedLvl) end
end

function SkillUpgradesLib.sendMetaToClient(cid)
    local buffer = "@meta"
    for key, cat in pairs(SkillUpgradesConfig.Categories) do
        local groupName = cat.group or ""
        local groupOrder = 0
        if groupName ~= "" and SkillUpgradesConfig.SkillGroups[groupName] then
            groupOrder = SkillUpgradesConfig.SkillGroups[groupName].order
        end
        buffer = buffer ..
        "|" ..
        key ..
        ";" ..
        cat.name ..
        ";" .. cat.desc .. ";" .. cat.maxLevel .. ";" .. cat.formulaDisplay .. ";" .. groupName .. ";" .. groupOrder
    end

    local groupsBuffer = "@groups"
    for groupKey, groupInfo in pairs(SkillUpgradesConfig.SkillGroups) do
        groupsBuffer = groupsBuffer .. "|" .. groupKey .. ";" .. groupInfo.name .. ";" .. groupInfo.order
    end

    if doSendPlayerExtendedOpcode then
        doSendPlayerExtendedOpcode(cid, SkillUpgradesConfig.Opcode, buffer)
        doSendPlayerExtendedOpcode(cid, SkillUpgradesConfig.Opcode, groupsBuffer)
    elseif doPlayerSendExtendedOpcode then
        doPlayerSendExtendedOpcode(cid, SkillUpgradesConfig.Opcode, buffer)
        doPlayerSendExtendedOpcode(cid, SkillUpgradesConfig.Opcode, groupsBuffer)
    end
end

function SkillUpgradesLib.sendUpdateToClient(cid)
    local guid = getPlayerGUID(cid)
    local vocationId = getPlayerVocation(cid)
    if not guid then return end

    SkillUpgradesLib.initVocation(guid, vocationId)
    local points = PlayerSkillPointsCache[guid][vocationId]
    local skills = PlayerSkillUpgradesCache[guid][vocationId] or {}

    local data = {
        available = points.available,
        spent = points.spent,
        skills = {}
    }

    for name, _ in pairs(SkillUpgradesConfig.Categories) do
        data.skills[name] = skills[name] or 0
    end

    local buffer = data.available .. "|" .. data.spent
    for name, lvl in pairs(data.skills) do
        local cfg = SkillUpgradesConfig.Categories[name]
        local val = cfg and cfg.formula(lvl) or 0
        buffer = buffer .. "|" .. name .. ":" .. lvl .. ":" .. val
    end

    if doSendPlayerExtendedOpcode then
        doSendPlayerExtendedOpcode(cid, SkillUpgradesConfig.Opcode, buffer)
    elseif doPlayerSendExtendedOpcode then
        doPlayerSendExtendedOpcode(cid, SkillUpgradesConfig.Opcode, buffer)
    end
end
