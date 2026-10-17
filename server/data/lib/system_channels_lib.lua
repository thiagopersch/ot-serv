-- system_channels_lib.lua
-- Canais fixos do sistema (data/XML/channels.xml, todos active="no" = somente leitura):
-- Loot (autoloot), Tasks, Bosses, Deaths e Battle Pass. Abertos automaticamente no login
-- (data/creaturescripts/scripts/system_channels.lua).
-- Mensagens sao enviadas com autor vazio para o cliente nao prefixar "Nome: ".
-- Trechos no formato {texto|#RRGGBB} sao coloridos pelo cliente (game_console).

SYSCHANNEL_LOOT = 10
SYSCHANNEL_TASKS = 11
SYSCHANNEL_BOSSES = 12
SYSCHANNEL_DEATHS = 13
SYSCHANNEL_BATTLEPASS = 14

SYSCHANNEL_ALL = { SYSCHANNEL_LOOT, SYSCHANNEL_TASKS, SYSCHANNEL_BOSSES, SYSCHANNEL_DEATHS, SYSCHANNEL_BATTLEPASS }

function SysChannel_timestamp()
	return os.date("[%d/%m/%Y %H:%M]")
end

local function isInChannel(cid, channelId)
	local users = getChannelUsers(channelId)
	if type(users) ~= "table" then
		return false
	end
	for _, uid in ipairs(users) do
		if uid == cid then
			return true
		end
	end
	return false
end

-- Envia para um jogador. So envia se ele estiver com o canal aberto (o cliente loga
-- warning para mensagem em canal desconhecido).
function SysChannel_send(cid, channelId, text, talkType)
	if not isPlayer(cid) or not isInChannel(cid, channelId) then
		return false
	end
	return doPlayerSendChannelMessage(cid, "", text, talkType or TALKTYPE_CHANNEL_W, channelId)
end

-- Envia para todos que estao com o canal aberto.
function SysChannel_broadcast(channelId, text, talkType)
	local users = getChannelUsers(channelId)
	if type(users) ~= "table" then
		return false
	end
	for _, uid in ipairs(users) do
		if isPlayer(uid) then
			doPlayerSendChannelMessage(uid, "", text, talkType or TALKTYPE_CHANNEL_W, channelId)
		end
	end
	return true
end

function SysChannel_openAll(cid)
	for _, channelId in ipairs(SYSCHANNEL_ALL) do
		if not isInChannel(cid, channelId) then
			doPlayerOpenChannel(cid, channelId)
		end
	end
end

-- Texto colorido no cliente: {texto|#RRGGBB}
function SysChannel_color(text, color)
	if not color or color == "" then
		return text
	end
	return "{" .. text .. "|" .. color .. "}"
end

-- Se um killer (uid) for summon de jogador, retorna o jogador; senao o proprio killer.
function SysChannel_resolveKiller(killer)
	if type(killer) == "number" and isCreature(killer) and not isPlayer(killer) then
		local master = getCreatureMaster(killer)
		if master and master ~= killer and isPlayer(master) then
			return master
		end
	end
	return killer
end

-- "Fulano [150]" / "Trunks SSJ4" / texto livre (ex.: "field item")
function SysChannel_describeKiller(killer)
	if type(killer) == "number" and isCreature(killer) then
		if isPlayer(killer) then
			return getCreatureName(killer) .. " [" .. getPlayerLevel(killer) .. "]", true
		end
		return getCreatureName(killer), false
	end
	return tostring(killer or "desconhecido"), false
end

---------------------------------------------------------------------------
-- Tasks
---------------------------------------------------------------------------
function TaskChannel_send(cid, text, talkType)
	return SysChannel_send(cid, SYSCHANNEL_TASKS, text, talkType)
end

-- Mesma ordem de argumentos do doPlayerSendTextMessage(cid, type, text).
function TaskChannel_message(cid, talkType, text)
	return TaskChannel_send(cid, text, talkType)
end

-- Resumo das tasks ativas, enviado ao abrir o canal no login.
function TaskChannel_sendSummary(cid)
	if not isPlayer(cid) or type(TaskCache_getPlayerCache) ~= "function" or type(TASKS) ~= "table" then
		return
	end

	local cache = TaskCache_getPlayerCache(cid) or {}
	local count = 0
	for taskId, playerTask in pairs(cache) do
		local config = TASKS[taskId]
		if config and type(playerTask) == "table" and playerTask.rewarded ~= 1 then
			count = count + 1
			if playerTask.completed == 1 then
				TaskChannel_send(cid, "[Task] '" .. config.name .. "' completa! Abra a janela de Tasks e resgate a recompensa.",
					TALKTYPE_CHANNEL_O)
			else
				local parts = {}
				if (config.killsRequired or 0) > 0 then
					local names = {}
					for _, m in ipairs(config.monsters or {}) do
						table.insert(names, type(m) == "table" and m.name or m)
					end
					table.insert(parts, "Kills: " .. (playerTask.kills or 0) .. "/" .. config.killsRequired ..
						" (" .. table.concat(names, ", ") .. ")")
				end
				if config.delivery and config.delivery.enabled then
					table.insert(parts, "Entregar: " .. config.delivery.count .. "x " .. getItemNameById(config.delivery.itemId))
				end
				TaskChannel_send(cid, "[Task] Atual: " .. config.name .. " - " .. table.concat(parts, " | "))
			end
		end
	end

	if count == 0 then
		TaskChannel_send(cid, "[Task] Voce nao possui tasks ativas.")
	end

	if type(TaskStorage_getPlayerPoints) == "function" and type(TaskRank_getPlayerCategory) == "function"
			and type(TaskRank_getRankByPoints) == "function" then
		local points = TaskStorage_getPlayerPoints(cid)
		local rank = TaskRank_getRankByPoints(TaskRank_getPlayerCategory(cid), points)
		local rankName = type(rank) == "table" and rank.name or tostring(rank or "-")
		TaskChannel_send(cid, "[Rank] " .. rankName .. " - " .. points .. " task points.")
	end
end
