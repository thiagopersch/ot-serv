-- Spawn automatico de bosses - configuracao em data/lib/boss_system_lib.lua
local lastMinute = nil

function onThink(interval, lastExecution)
	-- garante uma execucao por minuto mesmo com atraso/adiantamento do intervalo
	local minute = os.date("%Y%m%d%H%M")
	if minute == lastMinute then
		return true
	end
	lastMinute = minute

	BossSystem_onMinute()
	return true
end
