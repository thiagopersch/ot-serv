local BOOST_SYSTEM_MONSTER_NAME_STORAGE = 12380
local BOOST_SYSTEM_LOOT_BONUS_STORAGE = 12381
local BOOST_SYSTEM_EXP_BONUS_STORAGE = 12382
local BOOST_SYSTEM_SHOWCASE_UID_STORAGE = 12383

function onLogin(cid)
	registerCreatureEvent(cid, "MBKill")
	local monsterName = getStorage(BOOST_SYSTEM_MONSTER_NAME_STORAGE)
	if monsterName == EMPTY_STORAGE then
		return true
	end
	local msg = "top|"
	msg = msg .. TEXTCOLOR_YELLOW .. "|"
	msg = msg .. "[Monster Boost]: Today's monster boosted is: >> " .. monsterName .. " <<"
	doBroadcastMessage(msg)
	return true
end

local function itemText(itemid, count)
	local info = getItemInfo(itemid)
	local name = info and info.name or getItemNameById(itemid)
	if count > 1 then
		local plural = (info and info.plural ~= "") and info.plural or (name .. "s")
		return count .. " " .. plural
	end
	local article = (info and info.article ~= "") and (info.article .. " ") or ""
	return article .. name
end

-- Loot normal gerado pelo engine: percorre o corpo (e bags dentro dele) e agrupa stackáveis por itemid.
-- Containers em si não contam como loot, só o conteúdo.
local function collectCorpseLoot(containerUid, list, index, depth)
	local size = getContainerSize(containerUid)
	if type(size) ~= "number" or depth > 5 then
		return
	end
	for slot = 0, size - 1 do
		local item = getContainerItem(containerUid, slot)
		if not item or item.itemid == 0 then
			break
		end
		if isContainer(item.uid) then
			collectCorpseLoot(item.uid, list, index, depth + 1)
		elseif isItemStackable(item.itemid) then
			local count = math.max(1, item.type)
			if index[item.itemid] then
				index[item.itemid].count = index[item.itemid].count + count
			else
				index[item.itemid] = { itemid = item.itemid, count = count, stackable = true }
				table.insert(list, index[item.itemid])
			end
		else
			table.insert(list, { itemid = item.itemid, count = 1, stackable = false })
		end
	end
end

local function addBonusLoot(cid, position, name)
	if not isPlayer(cid) then
		return
	end

	local corpse
	for i = 0, 255 do
		position.stackpos = i
		local thing = getTileThingByPos(position)
		if thing and thing.uid > 0 and isCorpse(thing.uid) then
			corpse = thing
			break
		end
	end
	if not corpse or not isContainer(corpse.uid) then
		return
	end

	local normalLoot = {}
	collectCorpseLoot(corpse.uid, normalLoot, {}, 0)
	local normalItems = {}
	for _, entry in ipairs(normalLoot) do
		table.insert(normalItems, itemText(entry.itemid, entry.count))
	end

	-- Bônus sobre o que realmente caiu: stackáveis ganham +X% da quantidade (mín. 1),
	-- itens únicos têm X% de chance de vir uma cópia extra.
	local loot_bonus = tonumber(getStorage(BOOST_SYSTEM_LOOT_BONUS_STORAGE)) or 0
	local bonusLoot = {}
	if loot_bonus > 0 then
		for _, entry in ipairs(normalLoot) do
			if entry.stackable then
				table.insert(bonusLoot, { itemid = entry.itemid, count = math.max(1, math.ceil(entry.count * loot_bonus / 100)), stackable = true })
			elseif math.random(1, 100) <= loot_bonus then
				table.insert(bonusLoot, { itemid = entry.itemid, count = 1, stackable = false })
			end
		end
	end

	local bonusItems = {}
	if #bonusLoot > 0 then
		local mainbp = doCreateItemEx(1987, 1)
		for _, entry in ipairs(bonusLoot) do
			local uid = doAddContainerItem(mainbp, entry.itemid, entry.count)
			if not entry.stackable and type(uid) == "number" and uid > 0 and doItemRollRarity then
				doItemRollRarity(uid)
			end
			table.insert(bonusItems, itemText(entry.itemid, entry.count))
		end
		doAddContainerItemEx(corpse.uid, mainbp)
	end

	doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "[Monster Boost] Loot monster: " ..
		(#normalItems > 0 and table.concat(normalItems, ", ") or "nothing") .. ".")
	doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "[Monster Boost] Loot bonus (+" .. loot_bonus .. "%): " ..
		(#bonusItems > 0 and table.concat(bonusItems, ", ") or "nothing") .. ".")
end

function onKill(cid, target, damage, flags)
	if not isPlayer(cid) or not isMonster(target) then
		return true
	end

	-- summons de player e o monstro de amostra não contam
	local master = getCreatureMaster(target)
	if master ~= target and isPlayer(master) then
		return true
	end
	if target == (tonumber(getStorage(BOOST_SYSTEM_SHOWCASE_UID_STORAGE)) or 0) then
		return true
	end

	local bonusMonster = getStorage(BOOST_SYSTEM_MONSTER_NAME_STORAGE)
	if bonusMonster == EMPTY_STORAGE then
		return true
	end
	local targetName = string.lower(getCreatureName(target))
	if targetName ~= string.lower(tostring(bonusMonster)) then
		return true
	end

	local monsterInfo = getMonsterInfo(targetName)
	if monsterInfo and monsterInfo.experience then
		local rate = getExperienceStage(getPlayerLevel(cid))
		local expBonus = tonumber(getStorage(BOOST_SYSTEM_EXP_BONUS_STORAGE)) or 0
		local exp = math.ceil(monsterInfo.experience * rate * expBonus / 100)
		if exp > 0 then
			doPlayerAddExperience(cid, exp)
			addEvent(doSendAnimatedText, 50, getThingPos(cid), "+" .. exp .. " exp", 19)
		end
	end

	-- loot bônus e mensagem só para quem deu o último hit (evita bag duplicada no corpo)
	-- flags bit 1 = último hit (CreatureEvent::executeKill)
	if (tonumber(flags) or 0) % 2 == 1 then
		addEvent(addBonusLoot, 10, cid, getThingPos(target), targetName)
	end
	return true
end
