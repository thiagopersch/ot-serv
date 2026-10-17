local config = {
    type = COMBAT_PHYSICALDAMAGE,
    effects = { 813, 897 }, -- lista de efeitos para alternar 282
    spellMaxLevel = 75,
    areaIncreaseDelay = 100,
    maxRadius = 4
}

function onCastSpell(cid, var)
    return doExpandingWaveCombat(cid, config)
end
