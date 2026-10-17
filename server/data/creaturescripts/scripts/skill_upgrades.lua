-- ============================================================
-- skill_upgrades.lua
-- Creature events for Skill Upgrade System
-- ============================================================

if not SkillUpgradesLib then dofile("data/lib/skill_upgrades_lib.lua") end

function onLogin(cid)
    -- Load cache into memory
    SkillUpgradesLib.loadPlayer(cid)

    -- Send skill metadata (names, descriptions, max levels, formula display)
    SkillUpgradesLib.sendMetaToClient(cid)

    -- Send current skill levels and points
    SkillUpgradesLib.sendUpdateToClient(cid)

    -- Apply passive stats (ML, Melee, Dist, Shielding)
    SkillUpgradesLib.applyCombatStats(cid)

    registerCreatureEvent(cid, "SkillUpgradesAdvance")
    registerCreatureEvent(cid, "SkillUpgradesExtended")
    return true
end

function onLogout(cid)
    -- Memory cleanup
    SkillUpgradesLib.unloadPlayer(cid)
    return true
end

function onAdvance(cid, skill, oldLevel, newLevel)
    if skill == SKILL__LEVEL and newLevel > oldLevel then
        local vocationId = getPlayerVocation(cid)
        local highestCounted = SkillUpgradesLib.getHighestCountedLevel(cid, vocationId)

        -- Only levels never counted before grant points: this covers prestige resets and
        -- death releveling, where the player climbs back through levels already paid out.
        if newLevel > highestCounted then
            local grantFrom = math.max(oldLevel, highestCounted)
            local diff = newLevel - grantFrom
            if diff > 0 then
                local pointsToGive = diff * SkillUpgradesConfig.PointsPerLevel
                SkillUpgradesLib.addAvailablePoints(cid, vocationId, pointsToGive)
                doPlayerSendTextMessage(cid, MESSAGE_EVENT_ADVANCE,
                    "You received " .. pointsToGive .. " skill upgrade points!")
            end
            SkillUpgradesLib.setHighestCountedLevel(cid, vocationId, newLevel)
        end
    end
    return true
end

function onExtendedOpcode(cid, opcode, buffer)
    if opcode == SkillUpgradesConfig.Opcode then
        local data = string.explode(buffer, "|")
        if not data[1] then return true end

        local action = data[1]
        if action == "upgrade" and data[2] then
            local skill_name = data[2]
            SkillUpgradesLib.upgradeSkill(cid, skill_name)
        elseif action == "request" then
            SkillUpgradesLib.sendMetaToClient(cid)
            SkillUpgradesLib.sendUpdateToClient(cid)
        elseif action == "reset" then
            local resetItemId = SkillUpgradesConfig.ResetItemId or 9004
            local resetItemCount = SkillUpgradesConfig.ResetItemCount or 1
            if getPlayerItemCount(cid, resetItemId) < resetItemCount then
                doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "You need a Reset Item to reset your skills.")
                return true
            end
            if SkillUpgradesLib.resetSkills(cid) then
                doPlayerRemoveItem(cid, resetItemId, resetItemCount)
                doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "Your skills have been reset!")
            else
                doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "You don't have any skills to reset.")
            end
        end
    end
    return true
end
