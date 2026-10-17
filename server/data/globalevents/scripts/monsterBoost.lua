local monsterPosition = { x = 31910, y = 32211, z = 7 }
local lootBoostPosition = { x = 31911, y = 32212, z = 7 }
local expBoostPosition = { x = 31909, y = 32212, z = 7 }

local BOOST_SYSTEM_MONSTER_NAME_STORAGE = 12380
local BOOST_SYSTEM_LOOT_BONUS_STORAGE = 12381
local BOOST_SYSTEM_EXP_BONUS_STORAGE = 12382
local BOOST_SYSTEM_SHOWCASE_UID_STORAGE = 12383 -- uid do monstro de amostra (PZ)

string.upperAllFirst = string.upperAllFirst or function(str)
	return string.gsub(' ' .. str, '%W%l', string.upper):sub(2)
end

local monsters = { "Aegzen", "Aegzengiven", "Aegzengun", "Aizen", "Ancestral guardian", "Ancient dinosaur hollow",
	"Android", "Aqua", "Aqua corrupted", "Assassin", "Bandit hollow", "Bardock oozaru", "Bardock ssj supreme",
	"Bardock ssj3", "Bardock ssj4", "Bardock ssj5", "Bojack", "Botamo", "Cell", "Cell jr", "Cell perfect", "Demon",
	"Demonic soldier", "Dragon", "Dragon baby", "Dragon lord", "Fat buu", "Fat janemba", "Fishbone d", "Furios scorpion",
	"Ghost hollow", "Giant spider", "Gilian", "Gogeta", "Gohan ssj2", "Gohan ssj4", "Gohan ssj5", "Goku ssj", "Goku ssj2",
	"Goku ssj3", "Goku ssj4", "Goku ssj5", "Golden oozaru", "Grand fisher", "Hollow", "Ikomikidomoe", "Janemba",
	"Kid janemba", "King vegeta", "Leader of the guardian of the forest of menos", "Namekjin", "Numb chandelier", "Oozaru",
	"Paikuhan", "Purple robocop", "Raditz ssj4", "Raditz ssj5", "Red red robocop", "Robotron", "Saibamen", "Space soldier",
	"Spider hollow", "Spopovitch", "Super c17", "Super c18", "Tank", "Triceratops", "Trunks ssj2", "Trunks ssj4",
	"Trunks ssj5", "Tsuful baby", "Tsuful oozaru", "Tsuful ssj5", "Turles ssj4", "Turles ssj5", "Tyrannosaurus rex",
	"Tyrannosaurus rex hollow", "Undead dragon", "Undead dragon baby", "Vegeta ssj blue", "Vegeta ssj4", "Vegetto", "Wolf",
	"Wolf hollow", "Yakon", "Zangetsu", "Zarbon" }

local days = {
	["Sunday"]    = monsters,
	["Monday"]    = monsters,
	["Tuesday"]   = monsters,
	["Wednesday"] = monsters,
	["Thursday"]  = monsters,
	["Friday"]    = monsters,
	["Saturday"]  = monsters,
}

-- Remove qualquer monstro parado no tile de amostra (nunca players), garantindo um único showcase.
local function clearShowcaseTile()
	for i = 255, 1, -1 do
		local pos = { x = monsterPosition.x, y = monsterPosition.y, z = monsterPosition.z, stackpos = i }
		local thing = getTileThingByPos(pos)
		if thing and thing.uid > 0 and isMonster(thing.uid) then
			doRemoveCreature(thing.uid)
		end
	end
end

-- Cria o monstro de amostra: forçado no tile exato (funciona em PZ), parado, sem atacar e imortal.
local function spawnShowcase(name)
	clearShowcaseTile()
	doSetStorage(BOOST_SYSTEM_SHOWCASE_UID_STORAGE, 0)

	local uid = doCreateMonster(name, monsterPosition, false, true, false)
	if type(uid) ~= "number" or uid <= 0 then
		print("[Monster Boost] Nao foi possivel criar o monstro de amostra: " .. tostring(name))
		return false
	end

	doCreatureSetNoMove(uid, true)
	doCreatureSetDropLoot(uid, false)
	doCreatureSetLookDirection(uid, SOUTH)
	registerCreatureEvent(uid, "MBShowcaseCombat")
	registerCreatureEvent(uid, "MBShowcaseStats")
	registerCreatureEvent(uid, "MBShowcaseAttack")
	doSetStorage(BOOST_SYSTEM_SHOWCASE_UID_STORAGE, uid)
	return true
end

local function samePosition(a, b)
	return a.x == b.x and a.y == b.y and a.z == b.z
end

function onStartup()
	local monster = days[os.date("%A")]
	if not monster then
		return true
	end
	local monsterToday = monster[math.random(1, #monster)]
	doSetStorage(BOOST_SYSTEM_MONSTER_NAME_STORAGE, string.upperAllFirst(monsterToday))
	doSetStorage(BOOST_SYSTEM_LOOT_BONUS_STORAGE, math.random(10, 50))
	doSetStorage(BOOST_SYSTEM_EXP_BONUS_STORAGE, math.random(25, 50))
	spawnShowcase(monsterToday)
	db.query("INSERT INTO monster_boost (monster, loot, exp) VALUES ('" ..
		monsterToday ..
		"', '" .. getStorage(BOOST_SYSTEM_LOOT_BONUS_STORAGE) .. "', '" .. getStorage(BOOST_SYSTEM_EXP_BONUS_STORAGE) .. "')")
	return true
end

function onThink()
	local monsterName = getStorage(BOOST_SYSTEM_MONSTER_NAME_STORAGE)
	if monsterName == EMPTY_STORAGE then
		return true
	end

	local uid = tonumber(getStorage(BOOST_SYSTEM_SHOWCASE_UID_STORAGE)) or 0
	if uid <= 0 or not isCreature(uid) then
		spawnShowcase(monsterName)
	elseif getCreatureName(uid):lower() ~= tostring(monsterName):lower()
		or not samePosition(getThingPos(uid), monsterPosition) then
		doRemoveCreature(uid)
		spawnShowcase(monsterName)
	elseif getCreatureLookDirection(uid) ~= SOUTH then
		doCreatureSetLookDirection(uid, SOUTH)
	end

	doSendAnimatedText(lootBoostPosition, "Loot +" .. getStorage(BOOST_SYSTEM_LOOT_BONUS_STORAGE) .. "%", 194)
	doSendAnimatedText(expBoostPosition, "Exp +" .. getStorage(BOOST_SYSTEM_EXP_BONUS_STORAGE) .. "%", 194)

	return true
end
