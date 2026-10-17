local combat = createCombatObject()
setCombatParam(combat, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
setCombatParam(combat, COMBAT_PARAM_DISTANCEEFFECT, 155)
setCombatParam(combat, COMBAT_PARAM_EFFECT, 282)

function onGetFormulaValues(cid, level, maglevel)
    return getCombatFormulaValues(cid, level, maglevel, 1, 2, 10, 1, 1, 50)
end

setCombatCallback(combat, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues")

function onCastSpell(cid, var)
    local target = getCreatureTarget(cid)
    if not target or not isCreature(target) or getCreatureHealth(target) <= 0 then
        return false
    end
    return doCombat(cid, combat, var)
end
