local combat = createCombatObject()
setCombatParam(combat, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
setCombatParam(combat, COMBAT_PARAM_DISTANCEEFFECT, 224)
setCombatParam(combat, COMBAT_PARAM_EFFECT, 2437)
setCombatFormula(combat, COMBAT_FORMULA_SKILL, -1, -1000, -1, -3000)
function onUseWeapon(cid, var) return doCombat(cid, combat, var) end
