-- System for Dodge, Critical and Multipliers (XP/Skill)
-- Storages: 48700 (Dodge), 48701 (Critical), 48702 (XP Bonus Time), 48703 (Skill Bonus Time)

function onStatsChange(cid, attacker, type, combat, value)
    if not isPlayer(cid) then return true end

    -- DODGE LOGIC (1 point = 0.025%)
    if type == STATSCHANGE_HEALTHLOSS or type == STATSCHANGE_MANALOSS then
        local dodgeVal = math.max(0, getPlayerStorageValue(cid, 48700))
        local dodgeChance = dodgeVal * 0.025
        if dodgeChance > 0 and math.random(1, 100000) <= (dodgeChance * 1000) then
            doSendMagicEffect(getThingPos(cid), CONST_ME_POFF)
            doSendAnimatedText(getThingPos(cid), "DODGE", COLOR_WHITE)
            return false -- Cancel damage
        end
    end

    -- ARCHETYPE DEFENSE LOGIC
    if type == STATSCHANGE_HEALTHLOSS or type == STATSCHANGE_MANALOSS then
        local voc = getPlayerVocation(cid)
        local vocationConfig = VocationRankConfig.Vocations[voc]
        local archetype = vocationConfig and vocationConfig.archetype or "DPS"
        local archetypeData = VocationRankConfig.Archetypes[archetype]
        
        if archetypeData and archetypeData.defenseMult and archetypeData.defenseMult > 1.0 then
            local reduction = archetypeData.defenseMult - 1.0
            value = math.floor(value * (1.0 - reduction))
        end
    end

    -- CRITICAL LOGIC (1 point = 0.025%)
    if isPlayer(attacker) and (type == STATSCHANGE_HEALTHLOSS or type == STATSCHANGE_MANALOSS) then
        local critVal = math.max(0, getPlayerStorageValue(attacker, 48701))
        local critChance = critVal * 0.025
        if critChance > 0 and math.random(1, 100000) <= (critChance * 1000) then
            value = math.floor(value * 1.5)
            doSendMagicEffect(getThingPos(cid), CONST_ME_CRITICAL)
            doSendAnimatedText(getThingPos(cid), "CRITICAL", COLOR_RED)
        end
    end

    return true, value
end

function onAdvance(cid, skill, oldLevel, newLevel)
    if not isPlayer(cid) then return true end

    -- SKILL BONUS LOGIC (25% faster advance)
    local skillTime = getPlayerStorageValue(cid, 48703)
    if skillTime > os.time() then
        -- This is tricky in TFS 0.4 via Lua as advance is triggered AFTER gain.
        -- Usually done via onStatsChange or source.
        -- We will just show a message for now or implement gain multiplier if possible.
    end

    return true
end
