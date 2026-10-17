local config = {
    type = COMBAT_ICEDAMAGE,
    effects = { 1172, 1173, 1174 },
    spellMaxLevel = 75,
    areaIncreaseDelay = 65,
    maxRadius = 4
}

function onCastSpell(cid, var)
    return doExpandingWaveCombat(cid, config)
end
