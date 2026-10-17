-- Abre os canais do sistema (Loot, Tasks, Bosses, Deaths) ao logar e envia o resumo das tasks.
if not TaskRank_getPlayerCategory then dofile("data/lib/tasks/task_rank.lua") end

local function openSystemChannels(cid)
	if not isPlayer(cid) then
		return
	end
	SysChannel_openAll(cid)
	TaskChannel_sendSummary(cid)
end

function onLogin(cid)
	-- pequeno atraso: o cliente precisa estar em jogo para criar as abas, e o TaskLogin
	-- precisa ter carregado o cache de tasks antes do resumo.
	addEvent(openSystemChannels, 1000, cid)
	return true
end
