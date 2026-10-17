info = {
	BlockMonsters = {},
	BlockItemsList = {2123,2515},
	Max_Slots = {free = 5, premium = 20},
	-- [1] personal item list, [2] money auto-collect toggle, [3] system on/off,
	-- [4] money destination (0 = backpack, 1 = bank)
	Storages = {27000,28001,28002,28003}
}

-- Master catalog of items allowed in the autoloot system, administered on the portal at
-- /admin/autoloot-items (table `autoloot_items`) — not every item in items.xml, only the
-- published ones. Loaded once at boot and refreshed by the globalevent below so portal edits
-- propagate without a restart (same pattern as data/lib/tasks/task_db_loader.lua).
AUTOLOOT_CATALOG = AUTOLOOT_CATALOG or {}
AUTOLOOT_CATALOG_BY_ID = AUTOLOOT_CATALOG_BY_ID or {}

-- Categorias usadas pelo filtro/ordenação do module game_autoloot do OTC. A coluna
-- `autoloot_items.category` (portal) força uma delas; vazia = classificação automática abaixo.
AUTOLOOT_CATEGORIES = {
	helmet = true, armor = true, legs = true, boots = true, shield = true, weapon = true,
	ammo = true, amulet = true, ring = true, potion = true, healing = true, food = true,
	rune = true, fragment = true, quest = true, money = true, backpack = true, other = true
}

-- Moedas (mesmos ids tratados como dinheiro em corpseRetireItems).
local AUTOLOOT_MONEY_IDS = {[2148] = true, [2152] = true, [2160] = true}

-- Lua 5.1 não tem operadores bit a bit: testa o bit `flag` (potência de 2) de `value`.
local function hasFlag(value, flag)
	return math.floor(value / flag) % 2 == 1
end

-- Classifica o item pelo items.xml: group/type (itemloader.h/items.h), weaponType (const.h)
-- e slotPosition (items.h SLOTP_*). Os bits de mão/ammo são ignorados no slotPosition porque
-- são o default de todo item (items.cpp: SLOTP_HAND | SLOTP_AMMO).
function AutolootGetCategory(itemId, override)
	if type(override) == "string" and AUTOLOOT_CATEGORIES[override] then
		return override
	end

	if AUTOLOOT_MONEY_IDS[tonumber(itemId)] then
		return "money"
	end

	local it = getItemInfo(itemId)
	if not it then
		return "other"
	end

	if it.group == 2 then return "backpack" end -- ITEM_GROUP_CONTAINER
	if it.type == 10 then return "rune" end -- ITEM_TYPE_RUNE

	local weaponType = tonumber(it.weaponType) or 0
	if weaponType == 5 then return "shield" end -- WEAPON_SHIELD
	if weaponType == 8 then return "ammo" end -- WEAPON_AMMO
	if weaponType > 0 then return "weapon" end -- sword/club/axe/dist/fist/wand

	local slot = tonumber(it.slotPosition) or 0
	if slot ~= 0xFFFFFFFF then
		if hasFlag(slot, 1) then return "helmet" end -- SLOTP_HEAD
		if hasFlag(slot, 2) then return "amulet" end -- SLOTP_NECKLACE
		if hasFlag(slot, 8) then return "armor" end -- SLOTP_ARMOR
		if hasFlag(slot, 64) then return "legs" end -- SLOTP_LEGS
		if hasFlag(slot, 128) then return "boots" end -- SLOTP_FEET
		if hasFlag(slot, 256) then return "ring" end -- SLOTP_RING
		if hasFlag(slot, 2048) then return "weapon" end -- SLOTP_TWO_HAND
	end

	local name = (it.name or ""):lower()
	if it.group == 12 or name:find("potion", 1, true) then -- ITEM_GROUP_FLUID
		return "potion"
	end
	if name:find("fragment", 1, true) then
		return "fragment"
	end
	-- Quest/missão, comida e cura não têm marca confiável no items.xml (comida é action script):
	-- só via tipo forçado no portal.
	return "other"
end

function AutolootCatalog_reload()
	local catalog, byId = {}, {}
	-- `category` vem do portal; se a coluna ainda não existir no banco, cai no SELECT antigo.
	local hasCategory = true
	local res = db.getResult("SELECT `item_id`, `name`, `category` FROM `autoloot_items` WHERE `published` = 1 ORDER BY `name` ASC")
	if res == -1 then
		hasCategory = false
		res = db.getResult("SELECT `item_id`, `name` FROM `autoloot_items` WHERE `published` = 1 ORDER BY `name` ASC")
	end
	-- `db.getResult` only returns -1 on a hard query error — a SELECT matching zero rows still
	-- returns a "valid" handle, and reading a field from it returns `false` instead of erroring,
	-- so always check the read value's type before trusting it.
	if res ~= -1 and type(result.getDataInt(res, "item_id")) == "number" then
		repeat
			local itemId = result.getDataInt(res, "item_id")
			local name = result.getDataString(res, "name")
			if type(itemId) == "number" and type(name) == "string" then
				local itemInfo = getItemInfo(itemId)
				local clientId = (itemInfo and itemInfo.clientId and itemInfo.clientId > 0) and itemInfo.clientId or itemId
				local override = hasCategory and result.getDataString(res, "category") or nil
				local entry = {id = itemId, name = name, clientId = clientId,
					category = AutolootGetCategory(itemId, override)}
				table.insert(catalog, entry)
				byId[itemId] = entry
			end
		until not result.next(res)
	end
	if res ~= -1 then result.free(res) end

	AUTOLOOT_CATALOG = catalog
	AUTOLOOT_CATALOG_BY_ID = byId
	-- print("[AutoLoot] Loaded " .. #catalog .. " items from the admin catalog.")
end

if #AUTOLOOT_CATALOG == 0 then
	AutolootCatalog_reload()
end

function getItemIdFromCache(itemName)
	local queryLower = itemName:lower()
	for _, item in ipairs(AUTOLOOT_CATALOG) do
		if item.name:lower() == queryLower then
			return item.id
		end
	end
	return nil
end

function searchItemsByQuery(query)
	local results = {}
	local queryLower = query:lower()
	for _, item in ipairs(AUTOLOOT_CATALOG) do
		if item.name:lower():find(queryLower, 1, true) then
			table.insert(results, item)
			if #results >= 100 then break end
		end
	end
	return results
end
function setPlayerStorageTable(cid, storage, tab)
	local tabstr = "&"
	for i,x in pairs(tab) do
		tabstr = tabstr .. i .. "," .. x .. ";"
	end
	setPlayerStorageValue(cid, storage, tabstr:sub(1, #tabstr-1))
end
function getPlayerStorageTable(cid, storage)
	local tabstr = getPlayerStorageValue(cid, storage)
	local tab = {}
	if type(tabstr) ~= "string" then
		return {}
	end
	if tabstr:sub(1,1) ~= "&" then
		return {}
	end
	local tabstr = tabstr:sub(2, #tabstr)
	local a = string.explode(tabstr, ";")
	for i,x in pairs(a) do
		local b = string.explode(x, ",")
		tab[tonumber(b[1]) or b[1]] = tonumber(b[2]) or b[2]
	end
	return tab
end
function isInTable(cid, item)
	for _,i in pairs(getPlayerStorageTable(cid, info.Storages[1]))do
		if tonumber(i) == tonumber(item) then
			return true
		end
	end
	return false
end
function addItemTable(cid, item)
	local x = {}
	for i = 1,#getPlayerStorageTable(cid, info.Storages[1]) do
		table.insert(x,getPlayerStorageTable(cid, info.Storages[1])[i])
	end
	if x ~= 0 then
		table.insert(x,tonumber(item))
		setPlayerStorageTable(cid, info.Storages[1], x)
	else
		setPlayerStorageTable(cid, info.Storages[1], {item})
	end
end
function removeItemTable(cid, item)
	local x = {}
	for i = 1,#getPlayerStorageTable(cid, info.Storages[1]) do
		table.insert(x,getPlayerStorageTable(cid, info.Storages[1])[i])
	end
	for i,v in ipairs(x) do
		if tonumber(v) == tonumber(item) then
			table.remove(x,i)
		end
	end
	return setPlayerStorageTable(cid, info.Storages[1], x)
end
function ShowItemsTabble(cid)
	local n,str = 0,"[+] Auto Loot Commands [+]\n\n!autoloot item name --> To add ou Remove item from list.\n!autoloot money --> To collect gold automatically.\n!autoloot clear --> To clear the list.\n!autoloot on/off --> To enable or disable the collecting of items in the system.\n\n[+] Auto Loot Info [+]\n\nSystem: "..(getPlayerStorageValue(cid, info.Storages[3]) <= 0 and "Activated" or "Disabled")..".\nGold Collecting: "..(getPlayerStorageValue(cid, info.Storages[2]) > 0 and "Activated" or "Disabled")..".\nBalance Total: ["..getPlayerBalance(cid).."] gp's.\nMaximum Slots: ["..#getPlayerStorageTable(cid, info.Storages[1]).."/"..(isPremium(cid) and info.Max_Slots.premium or info.Max_Slots.free).."]\n\n[+] Auto Loot Slots [+]\n\n"
	for i = 1,#getPlayerStorageTable(cid, info.Storages[1]) do
		n = n + 1
		str = str.."Slot "..n.." - "..getItemNameById(getPlayerStorageTable(cid, info.Storages[1])[i]).."\n"
	end
	return doPlayerPopupFYI(cid, str)
end
function getContainerItems(containeruid)
	local items = {}
	local containers = {}
	if type(getContainerSize(containeruid)) ~= "number" then
		return false
	end
	for slot = 0, getContainerSize(containeruid)-1 do
		local item = getContainerItem(containeruid, slot)
		if item.itemid == 0 then
			break
		end
		if isContainer(item.uid) then
			table.insert(containers, item.uid)
		end
		table.insert(items, item)
	end
	if #containers > 0 then
		for i,x in ipairs(getContainerItems(containers[1])) do
			table.insert(items, x)
		end
		table.remove(containers, 1)
	end
	return items
end
-- `doTransformItem(uid, itemId, count)` recebe `count` como o valor ABSOLUTO do novo subtype,
-- não um delta — e o engine C++ (luascript.cpp: `if(it.stackable and count > 100) count = 100`)
-- trava esse valor absoluto em 100 pra qualquer item empilhável, sempre, mesmo passando o total
-- acumulado (150, 200, ...) em passos de <=100 por chamada. Por isso a stack nunca passava de
-- 100 ("autoloot para de coletar depois de 100"): cada chamada seguinte simplesmente reduzia o
-- item de volta a 100. `doPlayerAddItem` nativo não tem esse problema — ele cria o item em
-- pedaços de <=100 internamente (luascript.cpp:luaDoPlayerAddItem) e usa o pipeline normal de
-- adicionar item (game.cpp/container.cpp), que já mescla esses pedaços na stack existente do
-- jogador respeitando ITEM_STACK_SIZE (10000). Delegar direto resolve sem reinventar a stack.
function doPlayerAddItemStacking(cid, itemid, amount)
	return doPlayerAddItem(cid, itemid, amount)
end
function AutomaticDeposit(cid,item,n)
	local deposit = item == tonumber(2160) and (n*10000) or tonumber(item) == 2152 and (n*100) or (n*1)
	return doPlayerDepositMoney(cid, deposit)
end
-- Cores dos itens no canal Loot (itens com raridade usam a cor do tier em rarity.xml).
LOOT_ITEM_COLORS = {
	[2160] = "#5a9bff", -- crystal coin
	[2152] = "#3fcf3f", -- platinum coin
}

local function lootItemText(itemid, count)
	local info = getItemInfo(itemid)
	local name = info and info.name or getItemNameById(itemid)
	if count > 1 then
		local plural = (info and info.plural ~= "") and info.plural or (name .. "s")
		return count .. " " .. plural
	end
	local article = (info and info.article ~= "") and (info.article .. " ") or ""
	return article .. name
end

-- Envia "Loot of <monstro>: ..." no canal Loot com o que o autoloot coletou.
function sendAutolootChannel(cid, monsterDesc, collected)
	if #collected == 0 or not isPlayer(cid) then
		return
	end
	local parts = {}
	for _, entry in ipairs(collected) do
		local color = LOOT_ITEM_COLORS[entry.itemid]
		if entry.rarity > 0 and Rarity and Rarity.getTier then
			local tier = Rarity.getTier(entry.rarity)
			color = tier and tier.color or color
		end
		table.insert(parts, SysChannel_color(lootItemText(entry.itemid, entry.count), color))
	end
	SysChannel_send(cid, SYSCHANNEL_LOOT, "Loot of " .. (monsterDesc or "a creature") .. ": " ..
		table.concat(parts, ", "), TALKTYPE_CHANNEL_W)
end

function corpseRetireItems(cid, pos, monsterDesc)
	local check = false
	local tile
	for i = 0, 255 do
		pos.stackpos = i
		tile = getTileThingByPos(pos)
		if tile.uid > 0 and isCorpse(tile.uid) then
			check = true break
		end
	end
	-- isCorpse() só olha o itemid (faixa de corpos) — não garante que o item já seja um
	-- Container de verdade no engine (ex.: corpo ainda não "aberto"/convertido). Sem esse guard,
	-- getContainerItems() chama getContainerSize() e o engine loga
	-- "(luaGetContainerSize) Container not found" no console mesmo já tratando o retorno sem
	-- crashar — isContainer() evita a tentativa (e o log) quando não há nada pra coletar mesmo.
	if check == true and isContainer(tile.uid) then
		local items = getContainerItems(tile.uid)
		if type(items) ~= "table" then
			return
		end
		local moneyEnabled = getPlayerStorageValue(cid, info.Storages[2]) > 0
		local toBank = getPlayerStorageValue(cid, info.Storages[4]) > 0
		local collected, collectedIndex = {}, {}
		for i,x in pairs(items) do
			local isMoney = isInArray({2148,2152,2160}, tonumber(x.itemid))
			if isInArray(getPlayerStorageTable(cid, info.Storages[1]), tonumber(x.itemid)) or (moneyEnabled and isMoney) then
				local rarity = tonumber(getItemRarity and getItemRarity(x.uid)) or 0
				local count = isItemStackable(x.itemid) and math.max(1, x.type) or 1
				local key = x.itemid .. ":" .. rarity
				if collectedIndex[key] then
					collectedIndex[key].count = collectedIndex[key].count + count
				else
					collectedIndex[key] = {itemid = x.itemid, count = count, rarity = rarity}
					table.insert(collected, collectedIndex[key])
				end
				if isMoney and toBank then
					AutomaticDeposit(cid, x.itemid, x.type)
				elseif isItemStackable(x.itemid) then
					doPlayerAddItemStacking(cid, x.itemid, x.type)
				else
					doPlayerAddItem(cid, x.itemid, x.type)
				end
				doRemoveItem(x.uid)
			end
		end
		sendAutolootChannel(cid, monsterDesc, collected)
	end
end
