function onSay(cid, words, param)
	local parameters = param.explode(param, ',')
	if parameters then
		if isPlayer(getCreatureByName(parameters[1])) == TRUE then
			doPlayerSendTextMessage(getCreatureByName(parameters[1]), 22, "Você acabou de receber um item do ADM!")
			doPlayerAddItem(getCreatureByName(parameters[1]), parameters[2], parameters[3])
		end
	end
	if (param == '' or param == nil or param == ' ') then
		doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Command param required.")
	end
	return TRUE
end
