local OPCODE_CLIENT_CONFIG = 160

function onLogin(cid)
	local lifeManaPercent = getConfigValue("lifeManaInPercent") and "1" or "0"
	doPlayerSendExtendedOpcode(cid, OPCODE_CLIENT_CONFIG, lifeManaPercent)
	return true
end
