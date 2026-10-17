if not DonateTier then dofile("data/lib/donate_tier.lua") end
if not ServerConfigLib then dofile("data/lib/server_config_lib.lua") end

InspectModule = {
	opcode = 13,
	privacy_storage = 10000, -- storage para checar se o alvo quer mostrar o set
}

-- fix for some servers missing these constants
SKILL_FIRST = SKILL_FIRST or SKILL_FIST or 0
SKILL_LAST = SKILL_LAST or SKILL_FISHING or 6

---@param cid number
---@param opcode number
---@param buffer string
function InspectModule:handleOpcode(cid, opcode, buffer)
	local split = buffer:explode("&")
	local action = split[1]

	if action == "1" then
		-- requested data by creature id
		local creatureID = tonumber(split[2])
		if creatureID then
			self:sendPlayerData(cid, creatureID)
		else
			doPlayerPopupFYI(cid, "invalid creature id.")
		end
	elseif action == "2" and #split > 1 then
		-- requested data by creature name
		local creatureName = table.concat(split, "", 2)
		local creatureID = getPlayerByName(creatureName)
		if creatureID then
			self:sendPlayerData(cid, creatureID)
		else
			doPlayerPopupFYI(cid, "invalid player name.")
		end
	elseif action == "3" and #split > 1 then
		-- requested to change equipments privacy
		local enable = (tonumber(split[2]) or 0) ~= 0
		doCreatureSetStorage(cid, self.privacy_storage, enable and 0 or 1)
	else
		doPlayerPopupFYI(cid, "invalid action.")
	end
end

local PROFILE_MINUTES_PER_YEAR = 60

-- Helper functions for additional stats
local function getProfilePlayerAgeMinutesReal(cid)
	local guid = getPlayerGUID(cid)
	local result = db.getResult("SELECT `age_minutes` FROM `players` WHERE `id` = " .. guid)
	local minutes = 0
	if result and result:getID() ~= -1 then
		minutes = result:getDataInt("age_minutes")
		result:free()
	end
	return minutes
end

local function getProfilePlayerAgeReal(cid)
	local minutes = getProfilePlayerAgeMinutesReal(cid)
	return math.floor(minutes / PROFILE_MINUTES_PER_YEAR)
end

local function getProfilePlayerResets(cid)
	local guid = getPlayerGUID(cid)
	local resets = 0
	local result = db.getResult("SELECT `resets` FROM `players` WHERE `id` = " .. guid)
	if result and result:getID() ~= -1 then
		resets = result:getDataInt("resets")
		result:free()
	end
	return math.max(0, resets)
end

local function getProfilePlayerFrags(cid)
	local guid = getPlayerGUID(cid)
	local timeLimit = os.time() - (30 * 86400)
	local count = 0
	local result = db.getResult(
		"SELECT COUNT(`pk`.`player_id`) as `count` FROM `player_killers` pk " ..
		"LEFT JOIN `killers` k ON `pk`.`kill_id` = `k`.`id` " ..
		"LEFT JOIN `player_deaths` pd ON `k`.`death_id` = `pd`.`id` " ..
		"WHERE `pk`.`player_id` = " .. guid .. " AND `k`.`unjustified` = 1 AND `pd`.`date` >= " .. timeLimit
	)
	if result and result:getID() ~= -1 then
		count = result:getDataInt("count")
		result:free()
	end
	return count
end

local function getProfilePlayerCap(cid)
	local guid = getPlayerGUID(cid)
	local result = db.getResult("SELECT `cap` FROM `players` WHERE `id` = " .. guid)
	local cap = 0
	if result and result:getID() ~= -1 then
		cap = result:getDataInt("cap")
		result:free()
	end
	return cap
end

local function getProfilePlayerBalance(cid)
	local guid = getPlayerGUID(cid)
	local result = db.getResult("SELECT `balance` FROM `players` WHERE `id` = " .. guid)
	local balance = 0
	if result and result:getID() ~= -1 then
		balance = result:getDataInt("balance")
		result:free()
	end
	return balance
end

local function getProfilePlayerOnlineTime(cid)
	local guid = getPlayerGUID(cid)
	local result = db.getResult("SELECT `online_time` FROM `players` WHERE `id` = " .. guid)
	local onlineTime = 0
	if result and result:getID() ~= -1 then
		onlineTime = result:getDataInt("online_time")
		result:free()
	end
	return math.max(0, onlineTime)
end

---@param cid number
---@param creatureID number
function InspectModule:sendPlayerData(cid, creatureID)
	-- Verifique se o alvo  um jogador valido
	if not isPlayer(creatureID) then
		doPlayerPopupFYI(cid, "This target is not a player.")
		return
	end

	-- Impedir que jogadores com maior acesso tenham suas informaes inspecionadas
	if getPlayerAccess(creatureID) > getPlayerAccess(cid) then
		doPlayerPopupFYI(cid, "You don't have permission to inspect this player.")
		return
	end

	local vocId = getPlayerVocation(creatureID)
	local vocName = getPlayerVocationName(creatureID)
	if VocationRankConfig and VocationRankConfig.Vocations and VocationRankConfig.Vocations[vocId] then
		local archetype = VocationRankConfig.Vocations[vocId].archetype
		if archetype then
			if archetype == "Support" then archetype = "Suporte" end
			vocName = vocName .. " (" .. archetype .. ")"
		end
	end

	local data = {
		getCreatureName(creatureID),          -- 1
		getCreatureMaxHealth(creatureID),     -- 2
		getCreatureMaxMana(creatureID),       -- 3
		getPlayerLevel(creatureID),           -- 4
		vocName,                              -- 5
		getTownName(getPlayerTown(creatureID)), -- 6
		getPlayerStamina(creatureID),         -- 7
		getPlayerGuildName(creatureID),       -- 8
		isPremium(creatureID) and 1 or 0,     -- 9
		getProfilePlayerAgeReal(creatureID),  -- 10 (NEW)
		getProfilePlayerFrags(creatureID),    -- 11 (NEW)
		getProfilePlayerResets(creatureID),   -- 12 (NEW)
		getProfilePlayerBalance(creatureID),  -- 13 (NEW)
		getProfilePlayerCap(creatureID),      -- 14 (NEW)
		math.max(0, getPlayerStorageValue(creatureID, 48700)), -- 15 (DODGE)
		math.max(0, getPlayerStorageValue(creatureID, 48701)), -- 16 (CRITICAL)
	}

	-- Adicionando as habilidades (skills)
	for i = SKILL_FIRST, SKILL_LAST do
		data[#data + 1] = getPlayerSkillLevel(creatureID, i) -- 15-21
	end

	-- Adiciona o nvel mgico do jogador
	data[#data + 1] = getPlayerMagLevel(creatureID, false) -- 22

	-- Verifica se os equipamentos estǜo visveis e se o jogador local estǭ inspecionando a si mesmo
	local showEquipments = getCreatureStorage(creatureID, self.privacy_storage) ~= 1
	data[#data + 1] = cid == creatureID and 1 or 0 -- 23
	data[#data + 1] = showEquipments and 1 or 0   -- 24

	-- Envia os equipamentos se permitido
	for i = CONST_SLOT_FIRST, CONST_SLOT_LAST do
		local slotItem = getPlayerSlotItem(creatureID, i)
		if slotItem.itemid ~= 0 then
			local itemInfo = getItemInfo(slotItem.itemid)
			data[#data + 1] = itemInfo.clientId or 0
			data[#data + 1] = math.max(1, slotItem.type) -- Ajusta a quantidade do item
		else
			data[#data + 1] = 0
			data[#data + 1] = 0
		end
	end

	-- Online Points
	data[#data + 1] = getProfilePlayerOnlineTime(creatureID)

	-- Task Rank Integration
	local rankName = "None"
	local taskPoints = 0
	local nextRankName = ""
	local pointsToNext = 0
	local pointsInThisRank = 0
	local pointsToNextMax = 1

	if TaskRank_getPlayerRankName then
		rankName, taskPoints = TaskRank_getPlayerRankName(creatureID)
		local category = TaskRank_getPlayerCategory(creatureID)
		nextRankName, pointsToNext, pointsInThisRank, pointsToNextMax = TaskRank_getNextRank(creatureID, category)
	end

	data[#data + 1] = rankName        -- 48
	data[#data + 1] = taskPoints       -- 49
	data[#data + 1] = nextRankName     -- 50
	data[#data + 1] = pointsToNext     -- 51
	data[#data + 1] = pointsInThisRank -- 52
	data[#data + 1] = pointsToNextMax  -- 53

	-- Donate tier (ver data/lib/donate_tier.lua)
	local donateTier = DonateTier.getAccountDonateTier(getPlayerAccountId(creatureID))
	data[#data + 1] = donateTier.name                         -- 54
	data[#data + 1] = donateTier.bonusPct                      -- 55
	data[#data + 1] = donateTier.bonusPct > 0 and 1 or 0        -- 56 (bless infinita)

	-- Caps de dodge/critical configuráveis em /admin/settings (lib/server-config.ts) — antes
	-- fixos em 1000 no cliente (modules/game_player_profile/player_profile.lua).
	data[#data + 1] = ServerConfigLib.getDodgeCap()    -- 57 (DODGE CAP)
	data[#data + 1] = ServerConfigLib.getCriticalCap() -- 58 (CRITICAL CAP)

	doPlayerSendExtendedOpcode(cid, self.opcode, table.concat(data, "&"))
end
