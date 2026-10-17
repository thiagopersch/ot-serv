local config = {
    type = COMBAT_PHYSICALDAMAGE,
    effect = 569,
    minDmg = 100,
    maxDmg = 200,
    areaIncreaseDelay = 100,
    maxRadius = 4
}

function onCastSpell(cid, var)
    return doExpandingWaveCombat(cid, config)
end
