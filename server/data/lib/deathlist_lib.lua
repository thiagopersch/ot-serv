if not json then json = dofile("data/lib/json.lua") end

-- Deathlist: historico de mortes (janela game_deathlist do cliente + site /community/deaths)
-- client -> server: {"action":"self","page":1} | {"action":"search","name":"Fulano","page":1}
-- server -> client: {"type":"list","target":"self"|"search","player":"Nome","page":1,"pages":3,"total":25,"deaths":[...]}
--                   {"type":"error","target":"search","message":"..."}
-- Cada morte: {date, blessed, blessings, levelBefore, levelAfter, killers=[{name,type="player"|"monster"}], items=[{id,clientId,count,name}]}
-- blessed/levelAfter/items ficam nil em mortes antigas (sem linha em player_death_details).
Deathlist = {
    OPCODE = 175,
    PAGE_SIZE = 10,
    MAX_PACKET_SIZE = 19000,
    BATCH_SIZE = 3,
    FINALIZE_DELAY = 1000,
    STAFF_GROUP_ID = 3, -- players.group_id >= 3 (GM+) nao aparece na busca, igual ao site
}

function Deathlist.createTables()
    db.query(
    "CREATE TABLE IF NOT EXISTS `player_death_details` (`death_id` INT NOT NULL PRIMARY KEY, `blessed` TINYINT(1) NOT NULL DEFAULT 0, `blessings` TINYINT NOT NULL DEFAULT 0, `level_before` INT NOT NULL DEFAULT 0, `level_after` INT NULL DEFAULT NULL, FOREIGN KEY (`death_id`) REFERENCES `player_deaths` (`id`) ON DELETE CASCADE) ENGINE=InnoDB")
    db.query(
    "CREATE TABLE IF NOT EXISTS `player_death_items` (`id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY, `death_id` INT NOT NULL, `item_id` INT NOT NULL, `count` INT NOT NULL DEFAULT 1, `name` VARCHAR(100) NOT NULL DEFAULT '', KEY `death_id` (`death_id`), FOREIGN KEY (`death_id`) REFERENCES `player_deaths` (`id`) ON DELETE CASCADE) ENGINE=InnoDB")
end

if not Deathlist.tablesCreated then
    Deathlist.tablesCreated = pcall(Deathlist.createTables)
    if not Deathlist.tablesCreated then
        print("[Deathlist] Aviso: nao foi possivel criar as tabelas")
    end
end

-- ===================== Gravacao da morte =====================

-- Chamado no onDeath, antes do engine tirar exp/bless e mover os itens pro corpo.
function Deathlist.snapshot(cid)
    local blessings = 0
    for i = 1, 5 do
        if getPlayerBlessing(cid, i) then
            blessings = blessings + 1
        end
    end

    local slots = {}
    for slot = CONST_SLOT_FIRST, CONST_SLOT_LAST do
        local item = getPlayerSlotItem(cid, slot)
        if item and item.itemid > 0 then
            slots[slot] = {
                id = item.itemid,
                count = isItemStackable(item.itemid) and math.max(1, item.type) or 1,
                name = getItemNameById(item.itemid) or "",
            }
        end
    end

    return {
        guid = getPlayerGUID(cid),
        level = getPlayerLevel(cid),
        blessings = blessings,
        slots = slots,
        date = os.time(),
    }
end

local function getLastDeathId(guid, sinceDate)
    local res = db.getResult("SELECT `id` FROM `player_deaths` WHERE `player_id` = " .. guid ..
        " AND `date` >= " .. (sinceDate - 5) .. " ORDER BY `id` DESC LIMIT 1")
    if res:getID() == -1 then
        return nil
    end
    local id = res:getDataInt("id")
    res:free()
    return id
end

local function hasDetails(deathId)
    local res = db.getResult("SELECT `death_id` FROM `player_death_details` WHERE `death_id` = " .. deathId)
    if res:getID() == -1 then
        return false
    end
    res:free()
    return true
end

-- Grava a morte. currentLevel/currentSlots = estado depois da morte ({[slot] = itemid}).
-- Quando currentLevel e nil a morte fica pendente (level_after NULL) pro login completar.
function Deathlist.store(snap, deathId, currentLevel, currentSlots)
    db.query("INSERT INTO `player_death_details` (`death_id`, `blessed`, `blessings`, `level_before`, `level_after`) VALUES (" ..
        deathId .. ", " .. (snap.blessings > 0 and 1 or 0) .. ", " .. snap.blessings .. ", " .. snap.level .. ", " ..
        (currentLevel and tostring(currentLevel) or "NULL") .. ")")

    if currentLevel then
        Deathlist.storeItems(deathId, snap.slots, currentSlots)
    end
end

function Deathlist.storeItems(deathId, before, after)
    for slot, item in pairs(before) do
        if after[slot] ~= item.id then
            db.query("INSERT INTO `player_death_items` (`death_id`, `item_id`, `count`, `name`) VALUES (" ..
                deathId .. ", " .. item.id .. ", " .. item.count .. ", " .. db.escapeString(item.name) .. ")")
        end
    end
end

-- Roda alguns instantes depois da morte: o engine ja inseriu o player_deaths e salvou o
-- player (logout no relogin), entao level e slots do banco sao o estado pos-morte.
function Deathlist.finalize(snap)
    local deathId = getLastDeathId(snap.guid, snap.date)
    if not deathId or hasDetails(deathId) then
        return
    end

    local level
    local res = db.getResult("SELECT `level` FROM `players` WHERE `id` = " .. snap.guid)
    if res:getID() ~= -1 then
        level = res:getDataInt("level")
        res:free()
    end

    local slots = {}
    res = db.getResult("SELECT `pid`, `itemtype` FROM `player_items` WHERE `player_id` = " .. snap.guid ..
        " AND `pid` BETWEEN " .. CONST_SLOT_FIRST .. " AND " .. CONST_SLOT_LAST)
    if res:getID() ~= -1 then
        repeat
            slots[res:getDataInt("pid")] = res:getDataInt("itemtype")
        until not res:next()
        res:free()
    end

    if level then
        Deathlist.pending[snap.guid] = nil
    end
    Deathlist.store(snap, deathId, level, slots)
end

Deathlist.pending = Deathlist.pending or {}

function Deathlist.onPlayerDeath(cid)
    local snap = Deathlist.snapshot(cid)
    Deathlist.pending[snap.guid] = snap
    addEvent(function() pcall(Deathlist.finalize, snap) end, Deathlist.FINALIZE_DELAY)
end

-- Fallback no login: completa uma morte que ficou sem level_after.
function Deathlist.onLogin(cid)
    local guid = getPlayerGUID(cid)
    local res = db.getResult("SELECT d.`death_id` FROM `player_death_details` d INNER JOIN `player_deaths` p ON p.`id` = d.`death_id` WHERE p.`player_id` = " ..
        guid .. " AND d.`level_after` IS NULL ORDER BY d.`death_id` DESC LIMIT 1")
    if res:getID() == -1 then
        return
    end
    local deathId = res:getDataInt("death_id")
    res:free()

    db.query("UPDATE `player_death_details` SET `level_after` = " .. getPlayerLevel(cid) .. " WHERE `death_id` = " .. deathId)

    local snap = Deathlist.pending[guid]
    if snap then
        local slots = {}
        for slot = CONST_SLOT_FIRST, CONST_SLOT_LAST do
            local item = getPlayerSlotItem(cid, slot)
            if item and item.itemid > 0 then
                slots[slot] = item.itemid
            end
        end
        Deathlist.storeItems(deathId, snap.slots, slots)
        Deathlist.pending[guid] = nil
    end
end

-- ===================== Consulta =====================

local function getClientId(itemId)
    local info = getItemInfo(itemId)
    return info and info.clientId or itemId
end

local function fetchKillers(deathId)
    local killers, seen = {}, {}
    local res = db.getResult(
        "SELECT environment_killers.name AS monster_name, players.name AS player_name FROM killers" ..
        " LEFT JOIN environment_killers ON killers.id = environment_killers.kill_id" ..
        " LEFT JOIN player_killers ON killers.id = player_killers.kill_id" ..
        " LEFT JOIN players ON players.id = player_killers.player_id" ..
        " WHERE killers.death_id = " .. deathId .. " ORDER BY killers.final_hit DESC, killers.id ASC")
    if res:getID() == -1 then
        return killers
    end

    repeat
        local playerName = res:getDataString("player_name")
        local entry
        if playerName ~= "" then
            entry = { name = playerName, type = "player" }
        else
            local monster = res:getDataString("monster_name")
            if monster ~= "" then
                entry = { name = monster, type = "monster" }
            end
        end
        if entry and not seen[entry.type .. entry.name] then
            seen[entry.type .. entry.name] = true
            table.insert(killers, entry)
        end
    until not res:next()
    res:free()
    return killers
end

local function fetchItems(deathId)
    local items = {}
    local res = db.getResult("SELECT `item_id`, `count`, `name` FROM `player_death_items` WHERE `death_id` = " .. deathId .. " ORDER BY `id` ASC")
    if res:getID() == -1 then
        return items
    end
    repeat
        local id = res:getDataInt("item_id")
        table.insert(items, {
            id = id,
            clientId = getClientId(id),
            count = res:getDataInt("count"),
            name = res:getDataString("name"),
        })
    until not res:next()
    res:free()
    return items
end

function Deathlist.fetch(playerId, page)
    local total = 0
    local res = db.getResult("SELECT COUNT(*) AS `total` FROM `player_deaths` WHERE `player_id` = " .. playerId)
    if res:getID() ~= -1 then
        total = res:getDataInt("total")
        res:free()
    end

    local pages = math.max(1, math.ceil(total / Deathlist.PAGE_SIZE))
    page = math.max(1, math.min(tonumber(page) or 1, pages))

    local deaths = {}
    res = db.getResult(
        "SELECT p.`id`, p.`date`, p.`level`, d.`death_id` AS `has_details`, d.`blessed`, d.`blessings`, d.`level_before`, d.`level_after`, (d.`level_after` IS NULL) AS `after_null`" ..
        " FROM `player_deaths` p LEFT JOIN `player_death_details` d ON d.`death_id` = p.`id`" ..
        " WHERE p.`player_id` = " .. playerId .. " ORDER BY p.`date` DESC, p.`id` DESC" ..
        " LIMIT " .. Deathlist.PAGE_SIZE .. " OFFSET " .. ((page - 1) * Deathlist.PAGE_SIZE))
    if res:getID() ~= -1 then
        repeat
            local id = res:getDataInt("id")
            local death = {
                date = res:getDataLong("date"),
                levelBefore = res:getDataInt("level"),
                killers = fetchKillers(id),
            }
            if res:getDataInt("has_details") ~= 0 then
                death.blessed = res:getDataInt("blessed") == 1
                death.blessings = res:getDataInt("blessings")
                death.levelBefore = res:getDataInt("level_before")
                if res:getDataInt("after_null") == 0 then
                    death.levelAfter = res:getDataInt("level_after")
                end
                death.items = fetchItems(id)
            end
            table.insert(deaths, death)
        until not res:next()
        res:free()
    end

    return { page = page, pages = pages, total = total, deaths = deaths }
end

-- ===================== Envio =====================

function Deathlist.buildMessages(encoded)
    local size = Deathlist.MAX_PACKET_SIZE
    if #encoded <= size then
        return { encoded }
    end

    local chunks = {}
    for pos = 1, #encoded, size do
        table.insert(chunks, encoded:sub(pos, pos + size - 1))
    end

    local messages = { "S" .. chunks[1] }
    for i = 2, #chunks - 1 do
        table.insert(messages, "P" .. chunks[i])
    end
    table.insert(messages, "E" .. chunks[#chunks])
    return messages
end

function Deathlist.sendBatch(cid, messages, index)
    if not isPlayer(cid) then
        return
    end

    local last = math.min(index + Deathlist.BATCH_SIZE - 1, #messages)
    for i = index, last do
        doPlayerSendExtendedOpcode(cid, Deathlist.OPCODE, messages[i])
    end

    if last < #messages then
        addEvent(Deathlist.sendBatch, 100, cid, messages, last + 1)
    end
end

function Deathlist.send(cid, data)
    local ok, encoded = pcall(json.encode, data)
    if not ok or not encoded then
        print("[Deathlist] Erro ao codificar JSON: " .. tostring(encoded))
        return
    end
    Deathlist.sendBatch(cid, Deathlist.buildMessages(encoded), 1)
end

function Deathlist.sendList(cid, target, playerId, playerName, page)
    local data = Deathlist.fetch(playerId, page)
    data.type = "list"
    data.target = target
    data.player = playerName
    Deathlist.send(cid, data)
end

function Deathlist.sendSelf(cid, page)
    Deathlist.sendList(cid, "self", getPlayerGUID(cid), getCreatureName(cid), page)
end

function Deathlist.sendSearch(cid, name, page)
    name = tostring(name or ""):gsub("^%s+", ""):gsub("%s+$", "")
    if name == "" or #name > 30 then
        Deathlist.send(cid, { type = "error", target = "search", message = "Digite o nome de um jogador." })
        return
    end

    local res = db.getResult("SELECT `id`, `name` FROM `players` WHERE `name` = " .. db.escapeString(name) ..
        " AND `group_id` < " .. Deathlist.STAFF_GROUP_ID .. " AND `name` <> 'Account Manager' AND `deleted` = 0 LIMIT 1")
    if res:getID() == -1 then
        Deathlist.send(cid, { type = "error", target = "search", message = "Jogador nao encontrado." })
        return
    end
    local playerId, playerName = res:getDataInt("id"), res:getDataString("name")
    res:free()

    Deathlist.sendList(cid, "search", playerId, playerName, page)
end
