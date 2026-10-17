dofile('data/lib/autoloot_lib.lua')

function onLogin(cid)
	if not getConfigValue("enableAutoLoot") then
		return true
	end

	registerCreatureEvent(cid, "AutoLootOpcode")
	registerCreatureEvent(cid, "AutoLootKill")
	return true
end

function onKill(cid, target)
	if not getConfigValue("enableAutoLoot") then
		return true
	end

	if isPlayer(cid) and isMonster(target) and getPlayerStorageValue(cid, info.Storages[3]) <= 0
			and not isInArray(info.BlockMonsters, getCreatureName(target):lower()) then
		local monsterName = getCreatureName(target)
		local monsterInfo = getMonsterInfo(monsterName)
		local monsterDesc = (monsterInfo and monsterInfo.description ~= "") and monsterInfo.description or monsterName
		addEvent(corpseRetireItems, 300, cid, getThingPos(target), monsterDesc)
	end
	return true
end

local function isInCatalog(itemId)
	for _, item in ipairs(AUTOLOOT_CATALOG) do
		if item.id == itemId then return true end
	end
	return false
end

local function sendCatalog(cid)
	local resp = "catalog"
	for _, item in ipairs(AUTOLOOT_CATALOG) do
		resp = resp .. "|" .. item.id .. ";" .. item.clientId .. ";" .. item.name .. ";" .. (item.category or "other")
	end
	doPlayerSendExtendedOpcode(cid, 157, resp)
end

function onExtendedOpcode(cid, opcode, buffer)
	if opcode ~= 157 then
		return true
	end

	local param = buffer:match("^%s*(.-)%s*$") or ""

	if param == "" or param == "catalog" then
		sendCatalog(cid)
	elseif param == "clean" then
		setPlayerStorageTable(cid, info.Storages[1], {})
		doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "[Auto Loot] Your list has been cleaned.")
	elseif isInArray({ "on", "off" }, param:lower()) then
		local current = getPlayerStorageValue(cid, info.Storages[3])
		setPlayerStorageValue(cid, info.Storages[3], current <= 0 and 1 or 0)
		doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE,
			"[Auto Loot] " .. (current <= 0 and "Started" or "Stopped") .. ".")
	elseif param:lower() == "money" then
		local current = getPlayerStorageValue(cid, info.Storages[2])
		setPlayerStorageValue(cid, info.Storages[2], current > 0 and 0 or 1)
	elseif param:lower() == "moneydest" then
		local current = getPlayerStorageValue(cid, info.Storages[4])
		setPlayerStorageValue(cid, info.Storages[4], current > 0 and 0 or 1)
	else
		local parts = string.explode(param, ",")
		local command = parts[1]:lower()
		local rest = (parts[2] or ""):match("^%s*(.-)%s*$") or ""

		if command == "add" then
			local itemId = tonumber(rest)
			if not itemId then
				itemId = getItemIdFromCache(rest)
			end

			if not itemId or itemId <= 0 or not isInCatalog(itemId) then
				doPlayerSendCancel(cid, "This item is not available for autoloot.")
				return true
			end

			if isInArray(info.BlockItemsList, itemId) then
				doPlayerSendCancel(cid, "You can not add this item in the list!")
				return true
			end

			local slots = isPremium(cid) and info.Max_Slots.premium or info.Max_Slots.free
			local currentCount = #getPlayerStorageTable(cid, info.Storages[1])

			if currentCount >= slots then
				doPlayerSendCancel(cid, "max " .. slots .. " from auto loot")
				return true
			end

			if not isInTable(cid, itemId) then
				addItemTable(cid, itemId)
			else
				doPlayerSendCancel(cid, "This item is already in your list.")
			end

		elseif command == "remove" then
			local itemId = tonumber(rest)
			if not itemId then
				itemId = getItemIdFromCache(rest)
			end

			if not itemId or itemId <= 0 then
				doPlayerSendCancel(cid, "This item does not exist.")
				return true
			end

			removeItemTable(cid, itemId)
		end
	end

	sendAutolootList(cid)
	return true
end

function sendAutolootList(cid)
	local maxSlots = isPremium(cid) and info.Max_Slots.premium or info.Max_Slots.free
	local moneyEnabled = getPlayerStorageValue(cid, info.Storages[2]) > 0 and 1 or 0
	local moneyToBank = getPlayerStorageValue(cid, info.Storages[4]) > 0 and 1 or 0
	local loot = "state|" .. maxSlots .. "|" .. moneyEnabled .. "|" .. moneyToBank .. "|"

	local storageTable = getPlayerStorageTable(cid, info.Storages[1])
	for i = 1, #storageTable do
		local storedItemId = storageTable[i]
		local itemInfo = getItemInfo(storedItemId)
		local clientId = (itemInfo and itemInfo.clientId and itemInfo.clientId > 0) and itemInfo.clientId or storedItemId
		local itemName = getItemNameById(storedItemId)
		local catalogEntry = AUTOLOOT_CATALOG_BY_ID[tonumber(storedItemId)]
		local category = catalogEntry and catalogEntry.category or AutolootGetCategory(storedItemId)
		loot = loot .. storedItemId .. ";" .. clientId .. ";" .. itemName .. ";" .. category .. '@'
	end
	doPlayerSendExtendedOpcode(cid, 157, loot)
end
