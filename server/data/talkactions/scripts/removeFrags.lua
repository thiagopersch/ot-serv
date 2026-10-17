function onSay(cid, words, param, channel)
	local gskull, white, red, black, frags = getCreatureSkullType(cid), 50000, 150000, 250000,
			100000 -- Basta alterar os 4 últimos valores pelo custo de cada remoção, a sequência de custos é pk(50k)/red(150k)/black(250k)/frags(100k)
	if (param == "") then
		return doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE,
			"Você pode remover suas skulls: !remove skulls ~ ou pode remover seus frags: !remove frags ~ e/ou pode também conferir os custos: !remover custos")
	end
	if (param == "custos") then
		return doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE,
			"Custos ~ PK/WHITE: " .. white .. "k, RED: " .. red .. "k, BLACK: " .. black .. "k, FRAGS: " .. frags .. "k.")
	end
	if (param == "skulls") then
		if (gskull == SKULL_WHITE and doPlayerRemoveMoney(cid, white)) then
			doCreatureSetSkullType(cid, SKULL_NONE)
			doRemoveCondition(cid, CONDITION_INFIGHT)
		elseif (gskull == SKULL_RED and doPlayerRemoveMoney(cid, red)) then
			doCreatureSetSkullType(cid, SKULL_NONE)
		elseif (gskull == SKULL_BLACK and doPlayerRemoveMoney(cid, black)) then
			doCreatureSetSkullType(cid, SKULL_NONE)
		elseif (gskull == SKULL_NONE) then
			doPlayerSendCancel(cid, "Você não está com nenhuma skull.")
		else
			doPlayerSendCancel(cid, "Você não tem dinheiro o suficiente. Digite !remove para conferir os custos.")
		end
	end
	if (param == "frags") then
		if (getPlayerFrags(cid) >= 1 and doPlayerRemoveMoney(cid, frags)) then
			doRemoveCreature(cid)
			db.executeQuery(
				"UPDATE killers SET unjustified = 0 WHERE id IN (SELECT kill_id FROM player_killers WHERE player_id = " ..
				getPlayerGUID(cid) .. ");")
		elseif (getPlayerFrags(cid) == 0) then
			doPlayerSendCancel(cid, "Você não tem nenhum frag.")
		else
			doPlayerSendCancel(cid, "Você não tem dinheiro o suficiente. Digite !remove para conferir os custos.")
		end
	end
	return 1
end
