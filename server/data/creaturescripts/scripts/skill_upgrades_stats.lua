-- ============================================================
-- skill_upgrades_stats.lua
-- Handles Combat Stats (Crit, Leech, Healing, Shielding, Weapon/Magic Damage) for Skill Upgrades
--
-- All skills here are all-or-nothing: SkillUpgradesLib.getSkillValue() returns 0 until the
-- skill reaches its max level (200), then returns the fixed bonus described in
-- skill_upgrades_config.lua. See that file for the exact value of each skill.
-- ============================================================

if not SkillUpgradesLib then dofile("data/lib/skill_upgrades_lib.lua") end

local WEAPON_SKILL_BY_TYPE = {
    [WEAPON_SWORD] = "sword_fighting",
    [WEAPON_CLUB]  = "club_fighting",
    [WEAPON_AXE]   = "axe_fighting",
    [WEAPON_DIST]  = "distance_fighting",
}

local function getEquippedWeaponType(cid)
    for _, slot in ipairs({ CONST_SLOT_RIGHT, CONST_SLOT_LEFT }) do
        local item = getPlayerSlotItem(cid, slot)
        if item and item.itemid > 0 then
            local info = getItemInfo(item.itemid)
            if info and info.weaponType and info.weaponType > 0 then
                return info.weaponType
            end
        end
    end
    return 0
end

local function hasShieldEquipped(cid)
    for _, slot in ipairs({ CONST_SLOT_RIGHT, CONST_SLOT_LEFT }) do
        local item = getPlayerSlotItem(cid, slot)
        if item and item.itemid > 0 then
            local info = getItemInfo(item.itemid)
            if info and info.weaponType == WEAPON_SHIELD then
                return true
            end
        end
    end
    return false
end

function onStatsChange(cid, attacker, type, combat, value)
    if value <= 0 then return true end

    -- Healing Power handling
    if type == STATSCHANGE_HEALTHGAIN then
        local healPower = SkillUpgradesLib.getSkillValue(cid, "healing_power")
        if healPower > 0 then
            value = math.ceil(value * (1 + (healPower / 100)))
            doTargetCombatHealth(0, cid, combat, value, value, 255)
            return false -- block original to apply new value
        end
        return true
    end

    -- From here, we handle damage (HEALTHLOSS or MANALOSS)
    if type ~= STATSCHANGE_HEALTHLOSS and type ~= STATSCHANGE_MANALOSS then return true end

    local validAttacker = attacker ~= 0 and attacker ~= cid and isCreature(attacker)

    -- Reflect: when the player takes damage, chance to reflect a portion back
    if type == STATSCHANGE_HEALTHLOSS and isPlayer(cid) and validAttacker then
        local reflectChance = SkillUpgradesLib.getSkillValue(cid, "reflect_chance")
        if reflectChance > 0 and math.random(1, 100) <= reflectChance then
            local reflectDamage = math.ceil(value * 0.5)
            if reflectDamage > 0 then
                doTargetCombatHealth(0, attacker, combat, -reflectDamage, -reflectDamage, 255)
                doSendMagicEffect(getCreaturePosition(attacker), CONST_ME_MAGIC_RED)
            end
        end
    end

    local damage = value
    local modified = false

    -- Shielding: flat damage reduction while a shield is equipped
    if type == STATSCHANGE_HEALTHLOSS and isPlayer(cid) and isCreature(cid) then
        local shieldLvl = SkillUpgradesLib.getSkillValue(cid, "shielding")
        if shieldLvl > 0 and hasShieldEquipped(cid) then
            damage = damage - math.ceil(damage * (shieldLvl / 100))
            modified = true
            doSendAnimatedText(getCreaturePosition(cid), "SHIELDING!", TEXTCOLOR_TEAL)
        end
    end

    -- Attacker-side bonuses (weapon/magic damage, crit, leech) require a valid, alive player attacker
    if validAttacker and isPlayer(attacker) and isCreature(cid) then
        if type == STATSCHANGE_HEALTHLOSS then
            if combat == COMBAT_PHYSICALDAMAGE then
                -- Weapon-type damage bonus (Sword/Axe/Club/Distance Fighting)
                local weaponType = getEquippedWeaponType(attacker)
                local skillName = WEAPON_SKILL_BY_TYPE[weaponType]
                if skillName then
                    local bonus = SkillUpgradesLib.getSkillValue(attacker, skillName)
                    if bonus > 0 then
                        damage = math.ceil(damage * (1 + (bonus / 100)))
                        modified = true
                    end
                end
            end
            -- Note: "magic_damage" is NOT reapplied here — getPlayerCombatFormulaValues()
            -- in formula_values_spells.lua already folds it into damageMult for every
            -- player-cast spell (physical or elemental), so applying it again here would
            -- double it for non-physical spells.

            -- Vocation Rank System: flat +2% damage per star, stacks with the bonuses above
            local rankBonus = getPlayerVocationRankDamageBonus and getPlayerVocationRankDamageBonus(attacker) or 0
            if rankBonus and rankBonus > 0 then
                damage = math.ceil(damage * (1 + (rankBonus / 100)))
                modified = true
            end

            -- Critical Strike: critical_chance rolls whether it happens, critical_damage is the bonus
            local critChance = SkillUpgradesLib.getSkillValue(attacker, "critical_chance")
            if critChance > 0 and math.random(1, 100) <= critChance then
                local critDmg = SkillUpgradesLib.getSkillValue(attacker, "critical_damage")
                if critDmg > 0 then
                    damage = math.ceil(damage * (1 + (critDmg / 100)))
                    modified = true
                    doSendMagicEffect(getCreaturePosition(cid), 172)
                    doSendAnimatedText(getCreaturePosition(attacker), "CRITICAL!", 144)
                end
            end
        end

        -- Life Leech: heals the attacker for a fixed % of the damage dealt
        local llPercent = SkillUpgradesLib.getSkillValue(attacker, "life_leech_chance")
        if llPercent > 0 then
            local healAmount = math.ceil(damage * (llPercent / 100))
            if healAmount > 0 then
                doCreatureAddHealth(attacker, healAmount)
                doSendMagicEffect(getCreaturePosition(attacker), CONST_ME_MAGIC_RED)
            end
        end

        -- Mana Leech: restores the attacker mana for a fixed % of the damage dealt
        local mlPercent = SkillUpgradesLib.getSkillValue(attacker, "mana_leech_chance")
        if mlPercent > 0 then
            local manaAmount = math.ceil(damage * (mlPercent / 100))
            if manaAmount > 0 then
                doCreatureAddMana(attacker, manaAmount)
                doSendMagicEffect(getCreaturePosition(attacker), CONST_ME_MAGIC_BLUE)
            end
        end
    end

    if modified then
        doTargetCombatHealth(attacker ~= 0 and attacker or 0, cid, combat, -damage, -damage, 255)
        return false
    end

    return true
end
