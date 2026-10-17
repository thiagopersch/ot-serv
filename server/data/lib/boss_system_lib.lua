-- boss_system_lib.lua
-- Spawn automatico de bosses (data/globalevents/scripts/boss_system.lua, roda a cada minuto)
-- com anuncio no canal Bosses. A morte e anunciada por data/creaturescripts/scripts/boss_death.lua.
--
--   name     : nome do monstro (data/monster/monsters.xml)
--   place    : nome do local exibido no anuncio
--   pos      : posicao do spawn  (PREENCHER - {x = 0, y = 0} fica desativado)
--   days     : dias da semana em ingles ("Monday" ... "Sunday"); vazio/nil = todos os dias
--   hours    : horarios "HH:MM" em que o boss e convocado
--   duration : minutos ate o boss sumir se ninguem matar (0/nil = fica ate morrer)
--
-- Lembre de colocar <script><event name="BossChannelDeath"/></script> no XML do boss.
-- Os estados de script (globalevents x creaturescripts) sao separados, por isso o boss vivo
-- e guardado em global storage ("bosssystem_uid_<nome>"), nao em tabela Lua.

BOSS_SYSTEM = {
	{ name = "Hawk", place = "Hawk's Lair", pos = { x = 0, y = 0, z = 7 },
		days = { "Saturday" }, hours = { "20:00" }, duration = 60 },
	{ name = "Mama bird", place = "Mama Bird's Nest", pos = { x = 0, y = 0, z = 7 },
		days = { "Wednesday", "Sunday" }, hours = { "18:00" }, duration = 60 },
	{ name = "Fire elemental supremo", place = "Fire Temple", pos = { x = 0, y = 0, z = 7 },
		days = {}, hours = { "12:00", "22:00" }, duration = 60 },
}

local function storageKey(name, suffix)
	return "bosssystem_" .. suffix .. "_" .. name:lower()
end

-- uid do boss vivo convocado pelo sistema, ou nil
function BossSystem_getAlive(name)
	local uid = tonumber(getStorage(storageKey(name, "uid")))
	if uid and uid > 0 and isMonster(uid) then
		return uid
	end
	return nil
end

function BossSystem_clearAlive(name, uid)
	local stored = tonumber(getStorage(storageKey(name, "uid")))
	if not uid or stored == uid then
		doSetStorage(storageKey(name, "uid"), -1)
		doSetStorage(storageKey(name, "expire"), -1)
	end
end

function BossSystem_spawn(boss)
	if BossSystem_getAlive(boss.name) then
		return false
	end

	local uid = doCreateMonster(boss.name, boss.pos, false, true)
	if not uid or uid == 0 or not isMonster(uid) then
		print("[BossSystem] Falha ao convocar " .. boss.name .. " em " ..
			boss.pos.x .. "," .. boss.pos.y .. "," .. boss.pos.z)
		return false
	end

	doSetStorage(storageKey(boss.name, "uid"), uid)
	doSetStorage(storageKey(boss.name, "expire"),
		(boss.duration and boss.duration > 0) and (os.time() + boss.duration * 60) or -1)

	SysChannel_broadcast(SYSCHANNEL_BOSSES, SysChannel_timestamp() .. " O boss " .. getCreatureName(uid) ..
		" foi convocado em " .. (boss.place or "local desconhecido") .. "!", TALKTYPE_CHANNEL_O)
	return true
end

-- Remove bosses que passaram do tempo (duration) sem morrer.
function BossSystem_checkExpired(boss)
	local uid = BossSystem_getAlive(boss.name)
	if not uid then
		return
	end
	local expire = tonumber(getStorage(storageKey(boss.name, "expire")))
	if expire and expire > 0 and os.time() >= expire then
		local name = getCreatureName(uid)
		doRemoveCreature(uid)
		BossSystem_clearAlive(boss.name)
		SysChannel_broadcast(SYSCHANNEL_BOSSES, SysChannel_timestamp() .. " O boss " .. name ..
			" desapareceu sem ser derrotado.", TALKTYPE_CHANNEL_W)
	end
end

local function isScheduled(boss, day, hour)
	if boss.days and #boss.days > 0 and not isInArray(boss.days, day) then
		return false
	end
	return isInArray(boss.hours or {}, hour)
end

function BossSystem_onMinute()
	local day, hour = os.date("%A"), os.date("%H:%M")
	for _, boss in ipairs(BOSS_SYSTEM) do
		BossSystem_checkExpired(boss)
		if boss.pos and (boss.pos.x or 0) > 0 and isScheduled(boss, day, hour) then
			BossSystem_spawn(boss)
		end
	end
end
