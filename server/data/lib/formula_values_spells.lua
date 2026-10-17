-- Level brackets used to look up the level/magic-level factors (DAMAGE_FACTOR_LEVEL* /
-- DAMAGE_FACTOR_SKILL* constants live in data/lib/000-constant.lua). Both factors grow
-- together as the character's level tier rises, so spells stay relevant as players level up.
local PLAYER_DAMAGE_LEVEL_BRACKETS = {
  { maxLevel = 50,        levelFactor = DAMAGE_FACTOR_LEVEL50,   skillFactor = DAMAGE_FACTOR_SKILL50 },
  { maxLevel = 75,        levelFactor = DAMAGE_FACTOR_LEVEL75,   skillFactor = DAMAGE_FACTOR_SKILL75 },
  { maxLevel = 100,       levelFactor = DAMAGE_FACTOR_LEVEL100,  skillFactor = DAMAGE_FACTOR_SKILL100 },
  { maxLevel = 150,       levelFactor = DAMAGE_FACTOR_LEVEL150,  skillFactor = DAMAGE_FACTOR_SKILL150 },
  { maxLevel = 200,       levelFactor = DAMAGE_FACTOR_LEVEL200,  skillFactor = DAMAGE_FACTOR_SKILL200 },
  { maxLevel = 250,       levelFactor = DAMAGE_FACTOR_LEVEL250,  skillFactor = DAMAGE_FACTOR_SKILL250 },
  { maxLevel = 300,       levelFactor = DAMAGE_FACTOR_LEVEL300,  skillFactor = DAMAGE_FACTOR_SKILL300 },
  { maxLevel = 400,       levelFactor = DAMAGE_FACTOR_LEVEL400,  skillFactor = DAMAGE_FACTOR_SKILL400 },
  { maxLevel = 600,       levelFactor = DAMAGE_FACTOR_LEVEL600,  skillFactor = DAMAGE_FACTOR_SKILL600 },
  { maxLevel = 800,       levelFactor = DAMAGE_FACTOR_LEVEL800,  skillFactor = DAMAGE_FACTOR_SKILL800 },
  { maxLevel = 1000,      levelFactor = DAMAGE_FACTOR_LEVEL1000, skillFactor = DAMAGE_FACTOR_SKILL1000 },
  { maxLevel = math.huge, levelFactor = DAMAGE_FACTOR_LEVEL1000, skillFactor = DAMAGE_FACTOR_SKILL1000 },
}

-- Player-cast target/wave spells:
--   core = DAMAGE_FACTOR_LEVELx * level + DAMAGE_FACTOR_SKILLx * magicLevel
--   min  = -core * 0.75
--   max  = -core * 1.25
-- x is the bracket matching the caster's level. Vocation archetype (DPS/Bruiser/Support/Tank
-- damageMult from vocation_ranks_config.lua) and the "magic_damage" skill upgrade
-- (skill_upgrades_config.lua) are applied on top as multipliers. Vocation star-rank damage
-- bonus is applied natively by the engine (doPlayerSetVocationRankDamageBonus), so it is not
-- duplicated here.
local function getPlayerCombatFormulaValues(cid, level, maglevel)
  local voc = getPlayerVocation(cid)
  local vocationConfig = VocationRankConfig.Vocations[voc]
  local archetype = vocationConfig and vocationConfig.archetype or "DPS"
  local archetypeData = VocationRankConfig.Archetypes[archetype]
  local damageMult = archetypeData and archetypeData.damageMult or 1.0

  if SkillUpgradesLib then
    local extraMagicDamage = SkillUpgradesLib.getSkillValue(cid, "magic_damage")
    if extraMagicDamage > 0 then
      damageMult = damageMult * (1 + (extraMagicDamage / 100))
    end
  end

  local levelFactor, skillFactor = DAMAGE_FACTOR_LEVEL1, DAMAGE_FACTOR_SKILL1
  for _, bracket in ipairs(PLAYER_DAMAGE_LEVEL_BRACKETS) do
    if level <= bracket.maxLevel then
      levelFactor, skillFactor = bracket.levelFactor, bracket.skillFactor
      break
    end
  end

  local core = (levelFactor * level) + (skillFactor * maglevel)

  local min = -core * 0.75 * damageMult
  local max = -core * 1.25 * damageMult

  return min, max
end

-- Monster-cast spells (a handful of monster attacks reuse these same spell scripts) keep the
-- original pre-rework formula untouched, so monster damage output does not change.
local function getMonsterCombatFormulaValues(cid, level, maglevel, baseMin, baseMax, levelDiv, magMultMin, magMultMax)
  local voc = getPlayerVocation(cid)
  local vocationConfig = VocationRankConfig.Vocations[voc]
  local archetype = vocationConfig and vocationConfig.archetype or "DPS"
  local archetypeData = VocationRankConfig.Archetypes[archetype]
  local damageMult = archetypeData and archetypeData.damageMult or 1.0

  if SkillUpgradesLib then
    local extraMagicDamage = SkillUpgradesLib.getSkillValue(cid, "magic_damage")
    if extraMagicDamage > 0 then
      damageMult = damageMult * (1 + (extraMagicDamage / 100))
    end
  end

  local levelRanges = {
    { maxLevel = 1,         minMult = 0.5,  maxMult = 1.2,  minAdd = 2,   maxAdd = 5 },
    { maxLevel = 30,        minMult = 0.8,  maxMult = 2.0,  minAdd = 5,   maxAdd = 12 },
    { maxLevel = 50,        minMult = 1.2,  maxMult = 2.5,  minAdd = 8,   maxAdd = 18 },
    { maxLevel = 100,       minMult = 1.8,  maxMult = 3.5,  minAdd = 15,  maxAdd = 30 },
    { maxLevel = 200,       minMult = 2.5,  maxMult = 4.5,  minAdd = 25,  maxAdd = 50 },
    { maxLevel = 300,       minMult = 3.5,  maxMult = 5.5,  minAdd = 35,  maxAdd = 70 },
    { maxLevel = 400,       minMult = 4.5,  maxMult = 6.5,  minAdd = 45,  maxAdd = 90 },
    { maxLevel = 500,       minMult = 5.5,  maxMult = 7.5,  minAdd = 55,  maxAdd = 110 },
    { maxLevel = 600,       minMult = 6.5,  maxMult = 8.5,  minAdd = 65,  maxAdd = 130 },
    { maxLevel = 700,       minMult = 7.5,  maxMult = 9.5,  minAdd = 75,  maxAdd = 150 },
    { maxLevel = 800,       minMult = 8.5,  maxMult = 10.5, minAdd = 85,  maxAdd = 170 },
    { maxLevel = 900,       minMult = 9.5,  maxMult = 11.5, minAdd = 95,  maxAdd = 190 },
    { maxLevel = 1000,      minMult = 11.0, maxMult = 13.0, minAdd = 110, maxAdd = 220 },
    { maxLevel = math.huge, minMult = 12.0, maxMult = 14.5, minAdd = 120, maxAdd = 250 }
  }

  local randomFactor = math.random(90, 110) / 100 -- More stable random factor (0.9 to 1.1)

  local str = getPlayerSkill(cid, STAT_STRENGTH) or 0
  local int = getPlayerSkill(cid, STAT_INTELLIGENCE) or 0
  local skillMult = 1 + ((str + int) / 200)

  for _, range in ipairs(levelRanges) do
    if level <= range.maxLevel then
      local baseMinCalc = (level / levelDiv) + (maglevel * range.minMult) + range.minAdd
      local baseMaxCalc = (level / levelDiv) + (maglevel * range.maxMult) + range.maxAdd

      local min = -baseMinCalc * baseMin * skillMult * damageMult * randomFactor
      local max = -baseMaxCalc * baseMax * skillMult * damageMult * randomFactor

      return min, max
    end
  end
end

function getCombatFormulaValues(cid, level, maglevel, baseMin, baseMax, levelDiv, magMultMin, magMultMax, spellMaxLevel)
  level = math.min(level, spellMaxLevel)

  if isPlayer(cid) then
    return getPlayerCombatFormulaValues(cid, level, maglevel)
  end

  return getMonsterCombatFormulaValues(cid, level, maglevel, baseMin, baseMax, levelDiv, magMultMin, magMultMax)
end
