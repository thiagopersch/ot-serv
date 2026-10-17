local config = {
    type = COMBAT_PHYSICALDAMAGE,
    effects = { 479, 943, 969 }, -- lista de efeitos para alternar
    spellMaxLevel = 75,
    areaIncreaseDelay = 100,
    maxRadius = 4
}

function onCastSpell(cid, var)
    return doExpandingWaveCombat(cid, config)
end
