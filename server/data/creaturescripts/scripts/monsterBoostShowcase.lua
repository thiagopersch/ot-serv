-- Monstro de amostra do Monster Boost (registrado em globalevents/scripts/monsterBoost.lua).
-- Fica só de vitrine na PZ: não causa dano a ninguém e não perde vida/mana.

function onCombat(cid, target)
	return false
end

function onAttack(cid, target)
	return false
end

function onStatsChange(cid, attacker, type, combat, value)
	if type == STATSCHANGE_HEALTHLOSS or type == STATSCHANGE_MANALOSS then
		return false
	end
	return true
end
