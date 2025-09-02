SpelllistSettings = {
  ['Default'] = {
    iconFile = '/images/game/spells/defaultspells',
    iconSize = { width = 32, height = 32 },
    spellListWidth = 300,
    spellWindowWidth = 700,
    spellOrder = { 'Renzoku Energy Dan' }
  }
}

SpellInfo = {
  ['Default'] = {
    ['Renzoku Energy Dan'] = { id = 1, words = 'Renzoku Energy Dan', exhaustion = 2000, premium = false, type = 'Instant', icon = 'energystrike', mana = 20, level = 16, soul = 0, group = { [1] = 2000 }, vocations = { 0 } }
  }
}

-- ['const_name'] =       {client_id, TFS_id}
-- Conversion from TFS icon id to the id used by client (icons.png order)
SpellIcons = {
  -- new tibia spells, server owners - you will probably need to adjust TFS_id
  ['summonsorcererfamiliar'] = { 130, 173 },
  ['summondruidfamiliar']    = { 129, 172 },
  ['summonpaladinfamiliar']  = { 127, 171 },
  ['summonknightfamiliar']   = { 128, 170 },
  ['exposeweakness']         = { 134, 106 },
  ['sapstrenght']            = { 135, 105 },
  ['restoration']            = { 137, 103 },
  ['fairwoundcleansing']     = { 132, 102 },
  ['chivalrouschallange']    = { 131, 101 },
  ["naturesembrace"]         = { 138, 101 },
  ['divinedazzle']           = { 139, 101 },
  ['greatfirewave']          = { 136, 100 },
  ['conjurewandofdarkness']  = { 133, 92 },
  -- old spells
  ['intenserecovery']        = { 16, 160 },
  ['recovery']               = { 15, 159 },
  ['intensewoundcleansing']  = { 4, 158 },
  ['ultimateterrastrike']    = { 37, 157 },
  ['ultimateicestrike']      = { 34, 156 },
  ['ultimateenergystrike']   = { 31, 155 },
  ['ultimateflamestrike']    = { 28, 154 },
  ['strongterrastrike']      = { 36, 153 },
  ['strongicestrike']        = { 33, 152 },
  ['strongenergystrike']     = { 30, 151 },
  ['strongflamestrike']      = { 27, 150 },
  ['lightning']              = { 51, 149 },
  ['physicalstrike']         = { 17, 148 },
  ['curecurse']              = { 11, 147 },
  ['curseelectrification']   = { 14, 146 },
  ['cureburning']            = { 13, 145 },
  ['curebleeding']           = { 12, 144 },
  ['holyflash']              = { 53, 143 },
  ['envenom']                = { 58, 142 },
  ['inflictwound']           = { 57, 141 },
  ['electrify']              = { 56, 140 },
  ['curse']                  = { 54, 139 },
  ['ignite']                 = { 55, 138 },
  -- [[ 136 / 137 Unknown ]]
  ['sharpshooter']           = { 121, 135 },
  ['swiftfoot']              = { 119, 134 },
  ['bloodrage']              = { 96, 133 },
  ['protector']              = { 122, 132 },
  ['charge']                 = { 98, 131 },
  ['holymissile']            = { 76, 130 },
  ['enchantparty']           = { 113, 129 },
  ['healparty']              = { 126, 128 },
  ['protectparty']           = { 123, 127 },
  ['trainparty']             = { 120, 126 },
  ['divinehealing']          = { 2, 125 },
  ['divinecaldera']          = { 40, 124 },
  ['woundcleansing']         = { 3, 123 },
  ['divinemissile']          = { 39, 122 },
  ['icewave']                = { 45, 121 },
  ['terrawave']              = { 47, 120 },
  ['rageoftheskies']         = { 52, 119 },
  ['eternalwinter']          = { 50, 118 },
  ['thunderstorm']           = { 63, 117 },
  ['stoneshower']            = { 65, 116 },
  ['avalanche']              = { 92, 115 },
  ['icicle']                 = { 75, 114 },
  ['terrastrike']            = { 35, 113 },
  ['icestrike']              = { 32, 112 },
  ['etherealspear']          = { 18, 111 },
  ['enchantspear']           = { 104, 110 },
  ['piercingbolt']           = { 110, 109 },
  ['sniperarrow']            = { 112, 108 },
  ['whirlwindthrow']         = { 19, 107 },
  ['groundshaker']           = { 25, 106 },
  ['fierceberserk']          = { 22, 105 },
  -- [[ 96 - 104 Unknown ]]
  ['powerbolt']              = { 108, 95 },
  ['wildgrowth']             = { 61, 94 },
  ['challenge']              = { 97, 93 },
  ['enchantstaff']           = { 103, 92 },
  ['poisonbomb']             = { 70, 91 },
  ['cancelinvisibility']     = { 95, 90 },
  ['flamestrike']            = { 26, 89 },
  ['energystrike']           = { 29, 88 },
  ['deathstrike']            = { 38, 87 },
  ['magicwall']              = { 72, 86 },
  ['healfriend']             = { 8, 84 },
  ['animatedead']            = { 93, 83 },
  ['masshealing']            = { 9, 82 },
  ['levitate']               = { 125, 81 },
  ['berserk']                = { 21, 80 },
  ['conjurebolt']            = { 107, 79 },
  ['desintegrate']           = { 88, 78 },
  ['stalagmite']             = { 66, 77 },
  ['magicrope']              = { 105, 76 },
  ['ultimatelight']          = { 115, 75 },
  -- [[ 71 - 64 TFS House Commands ]]
  -- [[ 63 - 70 Unknown ]]
  ['annihilation']           = { 24, 62 },
  ['brutalstrike']           = { 23, 61 },
  -- [[ 60 Unknown ]]
  ['frontsweep']             = { 20, 59 },
  -- [[ 58 Unknown ]]
  ['strongetherealspear']    = { 59, 57 },
  ['wrathofnature']          = { 48, 56 },
  ['energybomb']             = { 86, 55 },
  ['paralyze']               = { 71, 54 },
  --  [[ 53 Unknown ]]
  --  [[ 52 TFS Retrieve Friend ]]
  ['conjurearrow']           = { 106, 51 },
  ['soulfire']               = { 67, 50 },
  ['explosivearrow']         = { 109, 49 },
  ['poisonedarrow']          = { 111, 48 },
  -- [[ 46 / 47 Unknown ]]
  ['invisible']              = { 94, 45 },
  ['magicshield']            = { 124, 44 },
  ['strongicewave']          = { 46, 43 },
  ['food']                   = { 99, 42 },
  -- [[ 40 / 41 Unknown ]]
  ['stronghaste']            = { 102, 39 },
  ['creatureillusion']       = { 100, 38 },
  -- [[ 37 TFS Move ]]
  ['salvation']              = { 60, 36 },
  -- [[ 34 / 35 Unknown ]]
  ['energywall']             = { 84, 33 },
  ['poisonwall']             = { 68, 32 },
  ['antidote']               = { 10, 31 },
  ['destroyfield']           = { 87, 30 },
  ['curepoison']             = { 10, 29 },
  ['firewall']               = { 80, 28 },
  ['energyfield']            = { 85, 27 },
  ['poisonfield']            = { 69, 26 },
  ['firefield']              = { 81, 25 },
  ['hellscore']              = { 49, 24 },
  ['greatenergybeam']        = { 42, 23 },
  ['energybeam']             = { 41, 22 },
  ['suddendeath']            = { 64, 21 },
  ['findperson']             = { 114, 20 },
  ['firewave']               = { 44, 19 },
  ['explosion']              = { 83, 18 },
  ['firebomb']               = { 82, 17 },
  ['greatfireball']          = { 78, 16 },
  ['fireball']               = { 79, 15 },
  ['chameleon']              = { 91, 14 },
  ['energywave']             = { 43, 13 },
  ['convincecreature']       = { 90, 12 },
  ['greatlight']             = { 116, 11 },
  ['light']                  = { 117, 10 },
  ['summoncreature']         = { 118, 9 },
  ['heavymagicmissile']      = { 77, 8 },
  ['lightmagicmissile']      = { 73, 7 },
  ['haste']                  = { 101, 6 },
  ['ultimatehealingrune']    = { 62, 5 },
  ['intensehealingrune']     = { 74, 4 },
  ['ultimatehealing']        = { 1, 3 },
  ['intensehealing']         = { 7, 2 },
  ['lighthealing']           = { 6, 1 },
}

VocationNames = {
  [1] = 'Bardock',
}

SpellGroups = {
  [1] = 'Attack',
  [2] = 'Healing',
  [3] = 'Support',
  [4] = 'Special',
  [5] = 'Cripple'
}

Spells = {}

function Spells.getClientId(spellName)
  local profile = Spells.getSpellProfileByName(spellName)

  local id = SpellInfo[profile][spellName].icon
  if not tonumber(id) and SpellIcons[id] then
    return SpellIcons[id][1]
  end
  return tonumber(id)
end

function Spells.getServerId(spellName)
  local profile = Spells.getSpellProfileByName(spellName)

  local id = SpellInfo[profile][spellName].icon
  if not tonumber(id) and SpellIcons[id] then
    return SpellIcons[id][2]
  end
  return tonumber(id)
end

function Spells.getSpellByName(name)
  return SpellInfo[Spells.getSpellProfileByName(name)][name]
end

function Spells.getSpellByWords(words)
  local words = words:lower():trim()
  for profile, data in pairs(SpellInfo) do
    for k, spell in pairs(data) do
      if spell.words == words then
        return spell, profile, k
      end
    end
  end
  return nil
end

function Spells.getSpellByIcon(iconId)
  for profile, data in pairs(SpellInfo) do
    for k, spell in pairs(data) do
      if spell.id == iconId then
        return spell, profile, k
      end
    end
  end
  return nil
end

function Spells.getSpellIconIds()
  local ids = {}
  for profile, data in pairs(SpellInfo) do
    for k, spell in pairs(data) do
      table.insert(ids, spell.id)
    end
  end
  return ids
end

function Spells.getSpellProfileById(id)
  for profile, data in pairs(SpellInfo) do
    for k, spell in pairs(data) do
      if spell.id == id then
        return profile
      end
    end
  end
  return nil
end

function Spells.getSpellProfileByWords(words)
  for profile, data in pairs(SpellInfo) do
    for k, spell in pairs(data) do
      if spell.words == words then
        return profile
      end
    end
  end
  return nil
end

function Spells.getSpellProfileByName(spellName)
  for profile, data in pairs(SpellInfo) do
    if table.findbykey(data, spellName:trim(), true) then
      return profile
    end
  end
  return nil
end

function Spells.getSpellsByVocationId(vocId)
  local spells = {}
  for profile, data in pairs(SpellInfo) do
    for k, spell in pairs(data) do
      if table.contains(spell.vocations, vocId) then
        table.insert(spells, spell)
      end
    end
  end
  return spells
end

function Spells.filterSpellsByGroups(spells, groups)
  local filtered = {}
  for v, spell in pairs(spells) do
    local spellGroups = Spells.getGroupIds(spell)
    if table.equals(spellGroups, groups) then
      table.insert(filtered, spell)
    end
  end
  return filtered
end

function Spells.getGroupIds(spell)
  local groups = {}
  for k, _ in pairs(spell.group) do
    table.insert(groups, k)
  end
  return groups
end

function Spells.getImageClip(id, profile)
  return (((id - 1) % 12) * SpelllistSettings[profile].iconSize.width) .. ' '
      .. ((math.ceil(id / 12) - 1) * SpelllistSettings[profile].iconSize.height) .. ' '
      .. SpelllistSettings[profile].iconSize.width .. ' '
      .. SpelllistSettings[profile].iconSize.height
end
