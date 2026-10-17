local combat = createCombatObject()
setCombatParam(combat, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
setCombatParam(combat, COMBAT_PARAM_DISTANCEEFFECT, 537)
setCombatParam(combat, COMBAT_PARAM_EFFECT, 2291)
setCombatFormula(combat, COMBAT_FORMULA_SKILL, -1, -1, -1, -1500)
function onUseWeapon(cid, var) return doCombat(cid, combat, var) end
