local combat = createCombatObject()
setCombatParam(combat, COMBAT_PARAM_EFFECT, CONST_ME_MAGIC_BLUE)
setCombatParam(combat, COMBAT_PARAM_AGGRESSIVE, false)

local condition = createConditionObject(CONDITION_HASTE)
setConditionParam(condition, CONDITION_PARAM_TICKS, 10 * 1000) -- 10 segundos
setConditionFormula(condition, 0.5, -15, 0.5, -15)
setCombatCondition(combat, condition)

function onCastSpell(cid, var) return doCombat(cid, combat, var) end
