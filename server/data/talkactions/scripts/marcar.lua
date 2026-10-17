local config = {
	storage = 30002,
	version = 1, 
	marks = {
		{mark = 2, pos = {x = 1023, y = 1034, z = 7}, desc = "Bueiro Pt. 1"},
		{mark = 2, pos = {x = 1023, y = 1034, z = 7}, desc = "Bueiro Pt. 2"},
		{mark = 2, pos = {x = 1089, y = 1027, z = 7}, desc = "Thomas Psyduck"},
		{mark = 2, pos = {x = 839, y = 1012, z = 7}, desc = "Bike Pt. 1"},
		{mark = 2, pos = {x = 951, y = 916, z = 7}, desc = "Bike Pt. 2"},
		{mark = 2, pos = {x = 952, y = 1066, z = 7}, desc = "Poison Hole"},
		{mark = 2, pos = {x = 1001, y = 1099, z = 7}, desc = "Electric Hole"},
		{mark = 2, pos = {x = 1051, y = 944, z = 7}, desc = "Three Stones"},
		{mark = 2, pos = {x = 1107, y = 1064, z = 7}, desc = "BOX+2"},
		{mark = 2, pos = {x = 1137, y = 936, z = 7}, desc = "Rock Tunnel"},
		{mark = 2, pos = {x = 751, y = 877, z = 7}, desc = "Desert Island"},
		{mark = 2, pos = {x = 1202, y = 1140, z = 7}, desc = "Ash Pikachu"},
		{mark = 2, pos = {x = 1028, y = 956, z = 7}, desc = "Waterfall Pt. 1"},
		{mark = 2, pos = {x = 1028, y = 956, z = 7}, desc = "Waterfall Pt. 2"},
		{mark = 2, pos = {x = 1088, y = 891, z = 7}, desc = "Earth Hole"},
		{mark = 2, pos = {x = 1041, y = 831, z = 7}, desc = "Plant Cave"},
		{mark = 2, pos = {x = 1288, y = 1034, z = 7}, desc = "Ghost Plague"}
	}
}

local f_addMark = doPlayerAddMapMark
if not f_addMark then f_addMark = doAddMapMark end

function onSay(cid, words, param)
	if words ~= "!marcar" or not param or param == "" then
		return false
	end

	if not isPlayer(cid) then
		return false
	end

	local description = param:trim()
	local found = false

	for _, mark in pairs(config.marks) do
		if mark.desc:lower() == description:lower() then
			f_addMark(cid, mark.pos, mark.mark, mark.desc)
			found = true
			break
		end
	end

	if not found then
		doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Marca��o '" .. description .. "' n�o encontrada.")
	else
		doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "A localiza��o foi marcada no seu mapa na camada do ch�o '" .. description .. "' adicionada ao mapa!")
		setPlayerStorageValue(cid, config.storage, config.version)
	end

	return true
end