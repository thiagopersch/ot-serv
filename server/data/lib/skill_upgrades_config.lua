SkillUpgradesConfig = {
    Opcode = 240,
    PointsPerLevel = 1,

    ResetItemId = 9004,
    ResetItemCount = 1,

    SkillGroups = {
        ["attack"]     = { name = "Attack", order = 1 },
        ["support"]    = { name = "Support", order = 2 },
        ["techniques"] = { name = "Techniques", order = 3 },
        ["looting"]    = { name = "Looting", order = 4 },
        ["bonus"]      = { name = "Bonus", order = 5 },
    },

    -- Every category scales linearly with invested levels: at level `lvl` (out of `maxLevel`)
    -- the bonus is `(lvl / maxLevel) * maxBonus`, reaching `maxBonus` exactly at `maxLevel`.
    -- Display formats use %.1f (1 decimal place) since the linear value is a fraction below max
    -- level (e.g. level 1/200 of a 25% bonus = 0.125%, shown as "0.1%").
    Categories = {
        ["fist_fighting"]      = { id = 1, group = "attack", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Fist Fighting", desc = "Scales up to +25% attack speed with the weapon in your hand at max level (200).", formulaDisplay = "+%.1f%% atk speed" },
        ["club_fighting"]      = { id = 2, group = "attack", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Club Fighting", desc = "Scales up to +25% damage while wielding a club at max level (200).", formulaDisplay = "+%.1f%% damage" },
        ["axe_fighting"]       = { id = 3, group = "attack", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Axe Fighting", desc = "Scales up to +25% damage while wielding an axe at max level (200).", formulaDisplay = "+%.1f%% damage" },
        ["sword_fighting"]     = { id = 4, group = "attack", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Sword Fighting", desc = "Scales up to +25% damage while wielding a sword at max level (200).", formulaDisplay = "+%.1f%% damage" },
        ["distance_fighting"]  = { id = 5, group = "attack", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Distance Fighting", desc = "Scales up to +25% damage while wielding a distance weapon at max level (200).", formulaDisplay = "+%.1f%% damage" },
        ["shielding"]          = { id = 6, group = "attack", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Shielding", desc = "Scales up to -25% damage taken while a shield is equipped at max level (200).", formulaDisplay = "-%.1f%% dmg taken" },
        ["critical_damage"]    = { id = 7, group = "attack", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Critical Damage", desc = "Scales up to +25% damage on critical strikes at max level (200).", formulaDisplay = "+%.1f%% crit dmg" },
        ["magic_damage"]       = { id = 8, group = "attack", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Magic Damage", desc = "Scales up to +25% damage dealt by offensive spells at max level (200).", formulaDisplay = "+%.1f%% damage" },
        ["life_leech_chance"]  = { id = 9, group = "support", maxLevel = 200, maxBonus = 20, formula = function(lvl) return (lvl / 200) * 20 end, name = "Life Leech Chance", desc = "Scales up to leeching 20% of the damage you deal as life at max level (200).", formulaDisplay = "%.1f%% leech" },
        ["mana_leech_chance"]  = { id = 10, group = "support", maxLevel = 200, maxBonus = 20, formula = function(lvl) return (lvl / 200) * 20 end, name = "Mana Leech Chance", desc = "Scales up to leeching 20% of the damage you deal as mana at max level (200).", formulaDisplay = "%.1f%% leech" },
        ["critical_chance"]    = { id = 11, group = "support", maxLevel = 200, maxBonus = 15, formula = function(lvl) return (lvl / 200) * 15 end, name = "Critical Hit Chance", desc = "Scales up to a 15% chance to land a critical hit at max level (200).", formulaDisplay = "%.1f%% chance" },
        ["healing_power"]      = { id = 12, group = "support", maxLevel = 200, maxBonus = 50, formula = function(lvl) return (lvl / 200) * 50 end, name = "Healing", desc = "Scales up to +50% effectiveness on regeneration spells at max level (200).", formulaDisplay = "+%.1f%% healing" },
        ["magic_level"]        = { id = 13, group = "techniques", maxLevel = 200, maxBonus = 35, formula = function(lvl) return (lvl / 200) * 35 end, name = "Magic Level", desc = "Scales up to +35% faster magic level progress from training and regular spells at max level (200).", formulaDisplay = "+%.1f%% ML speed" },
        ["loot_chance"]        = { id = 14, group = "looting", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Loot Chance", desc = "Scales up to +25% chance of finding loot on slain creatures at max level (200).", formulaDisplay = "+%.1f%% chance" },
        ["reflect_chance"]     = { id = 15, group = "bonus", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Reflect Hit Chance", desc = "Scales up to a chance to reflect 25% of incoming damage back to the attacker at max level (200).", formulaDisplay = "%.1f%% reflect" },
        ["cooldown_reduction"] = { id = 16, group = "bonus", maxLevel = 200, maxBonus = 60, formula = function(lvl) return (lvl / 200) * 60 end, name = "Cooldown Reduction Spells", desc = "Scales up to -60% cooldown and mana cost on spells and techniques at max level (200).", formulaDisplay = "-%.1f%% cost" },
        ["exp_bonus"]          = { id = 17, group = "bonus", maxLevel = 200, maxBonus = 25, formula = function(lvl) return (lvl / 200) * 25 end, name = "Experience Bonus", desc = "Scales up to +25% faster level progress at max level (200).", formulaDisplay = "+%.1f%% EXP" },
    },

    GetUpgradeCost = function(currentLevel)
        local tier = math.floor(currentLevel / 5)
        return tier + 1
    end,

    GetTotalSpentPoints = function(currentLevel)
        local total = 0
        for i = 0, currentLevel - 1 do
            total = total + SkillUpgradesConfig.GetUpgradeCost(i)
        end
        return total
    end
}
