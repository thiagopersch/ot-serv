function onSay(cid, words, param, channel)
	if (param == '') then
		doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Command param required.")
		return true
	end

	-- Pass the raw param directly - doBroadcastMessage will handle formatting
	doBroadcastMessage(param, "warning", "top")
	return true
end
