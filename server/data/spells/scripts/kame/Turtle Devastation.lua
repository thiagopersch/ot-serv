local combat = createCombatObject()
local param = {
    magEffect = 669,
    lvl = 75,
    pos = { x = 4, y = 0, z = 0 }
}
setCombatParam(combat, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)

function onGetFormulaValues(cid, level, maglevel)
    return getCombatFormulaValues(cid, level, maglevel, 1, 2, 10, 1, 1, param.lvl)
end

setCombatCallback(combat, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues")

local area1 = createCombatArea(AREA_SQUARE3X3)

setCombatArea(combat, area1)

local function onCastSpell1(parameters)
    doCombat(parameters.cid, parameters.combat1, parameters.var)
end

function onCastSpell(cid, var)
    local pos1 = {
        x = getPlayerPosition(cid).x + param.pos.x,
        y = getPlayerPosition(cid).y + param.pos.y,
        z = getPlayerPosition(cid).z + param.pos.z
    }
    local parameters = { cid = cid, var = var, combat1 = combat }

    addEvent(onCastSpell1, 0, parameters)
    doSendMagicEffect(pos1, param.magEffect)
    return true
end
