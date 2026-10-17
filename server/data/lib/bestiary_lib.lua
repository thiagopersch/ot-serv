if not json then json = dofile("data/lib/json.lua") end

BestiaryData = nil
BestiaryLastSend = {}

local MONSTER_BASE_DIR = "data/monster/"

local LOOT_RARITY = {
    { name = "Very Rare",  min = 0,     max = 99    },
    { name = "Rare",       min = 100,   max = 999   },
    { name = "Semi-Rare",  min = 1000,  max = 9999  },
    { name = "Uncommon",   min = 10000, max = 49999 },
    { name = "Common",     min = 50000, max = 999999 },
}

local ELEMENT_MAP = {
    physicalPercent    = "physical",
    earthPercent       = "earth",
    firePercent        = "fire",
    icePercent         = "ice",
    energyPercent      = "energy",
    holyPercent        = "holy",
    deathPercent       = "death",
    lifeDrainPercent   = "lifeDrain",
    manaDrainPercent   = "manaDrain",
    drownPercent       = "drown",
    healPercent        = "heal",
    undefinedPercent   = "undefined",
}

function Bestiary_buildData()
    local monsters = {}
    local bosses = {}
    local scanned = {}

    -- Windows (exe nativo) usa `dir`; Linux/macOS (Docker) usa `find`
    local isWindows = package.config:sub(1, 1) == "\\"
    local ok, result = pcall(function()
        local cmd
        if isWindows then
            cmd = 'dir "' .. MONSTER_BASE_DIR .. '" /s /b /a-d 2>nul'
        else
            cmd = 'find "' .. MONSTER_BASE_DIR .. '" -type f -iname "*.xml" 2>/dev/null'
        end
        local handle = io.popen(cmd)
        if not handle then return nil end
        local content = handle:read("*a")
        handle:close()
        return content
    end)

    if ok and result and result ~= "" then
        for filepath in string.gmatch(result, '[^\r\n]+') do
            -- monsters.xml é o índice, não um monstro
            if filepath:lower():match('%.xml$') and not filepath:lower():match('[/\\]monsters%.xml$') then
                local fullPath = isWindows and filepath:gsub('/', '\\') or filepath
                local data = Bestiary_parseMonsterFile(fullPath, nil)
                if data and not scanned[data.name:lower()] then
                    scanned[data.name:lower()] = true
                    if data.bestiary == "boss" then
                        table.insert(bosses, data)
                    else
                        table.insert(monsters, data)
                    end
                end
            end
        end
    else
        print("[Bestiary] io.popen indisponivel, tentando monsters.xml...")
        local fallbackPath = MONSTER_BASE_DIR .. "monsters.xml"
        local file, err = io.open(fallbackPath, "r")
        if file then
            local content = file:read("*a")
            file:close()
            for name, filepath in string.gmatch(content, '<monster name="(.-)" file="(.-)"/>') do
                local fullPath = MONSTER_BASE_DIR .. filepath
                local data = Bestiary_parseMonsterFile(fullPath, name)
                if data and not scanned[data.name:lower()] then
                    scanned[data.name:lower()] = true
                    if data.bestiary == "boss" then
                        table.insert(bosses, data)
                    else
                        table.insert(monsters, data)
                    end
                end
            end
        else
            print("[Bestiary] Erro ao abrir " .. fallbackPath .. ": " .. tostring(err))
            return nil
        end
    end

    table.sort(monsters, function(a, b) return a.name:lower() < b.name:lower() end)
    table.sort(bosses, function(a, b) return a.name:lower() < b.name:lower() end)

    BestiaryData = {
        monsters = monsters,
        bosses = bosses,
        totalMonsters = #monsters,
        totalBosses = #bosses,
    }

    print("[Bestiary] Dados carregados: " .. #monsters .. " monstros, " .. #bosses .. " bosses")
    return BestiaryData
end

function Bestiary_parseMonsterFile(filepath, fallbackName)
    local file, err = io.open(filepath, "r")
    if not file then
        print("[Bestiary] Erro ao abrir " .. filepath .. ": " .. tostring(err))
        return nil
    end

    local content = file:read("*a")
    file:close()

    local data = {
        name = fallbackName or "Unknown",
        health = 0,
        experience = 0,
        speed = 0,
        armor = 0,
        race = "unknown",
        lookType = 0,
        lookTypeEx = 0,
        lookHead = 0,
        lookBody = 0,
        lookLegs = 0,
        lookFeet = 0,
        lookAddons = 0,
        bestiary = "monster",
        resistances = {},
        loot = {},
    }

    -- Nome
    local nameMatch = string.match(content, '<monster.-name="(.-)"')
    if nameMatch then data.name = nameMatch end

    -- Bestiary attribute
    local bestiaryMatch = string.match(content, '<monster.-bestiary="(.-)"')
    if bestiaryMatch then data.bestiary = bestiaryMatch end

    -- Race
    local raceMatch = string.match(content, '<monster.-race="(.-)"')
    if raceMatch then data.race = raceMatch end

    -- Experience
    local expMatch = string.match(content, 'experience="(%d+)"')
    if expMatch then data.experience = tonumber(expMatch) end

    -- Speed
    local speedMatch = string.match(content, 'speed="(%d+)"')
    if speedMatch then data.speed = tonumber(speedMatch) end

    -- Health
    local healthMatch = string.match(content, '<health.-max="(%d+)"')
    if healthMatch then data.health = tonumber(healthMatch) end

    -- Armor (de <defenses armor="...")
    local armorMatch = string.match(content, '<defenses.-armor="(%d+)"')
    if armorMatch then data.armor = tonumber(armorMatch) end

    -- Look type + outfit detalhes
    local lookType = string.match(content, '<look.-type="(%d+)"')
    if lookType then data.lookType = tonumber(lookType) end

    local lookTypeEx = string.match(content, '<look.-typeex="(%d+)"')
    if lookTypeEx then data.lookTypeEx = tonumber(lookTypeEx) end

    data.lookHead = tonumber(string.match(content, '<look.-head="(%d+)"') or "0")
    data.lookBody = tonumber(string.match(content, '<look.-body="(%d+)"') or "0")
    data.lookLegs = tonumber(string.match(content, '<look.-legs="(%d+)"') or "0")
    data.lookFeet = tonumber(string.match(content, '<look.-feet="(%d+)"') or "0")
    data.lookAddons = tonumber(string.match(content, '<look.-addons="(%d+)"') or "0")

    -- Resistances (elements)
    local elementsSection = string.match(content, "<elements>(.-)</elements>")
    if elementsSection then
        for elemAttr, displayName in pairs(ELEMENT_MAP) do
            local pattern = '<element.-' .. elemAttr .. '="([%-%d]+)"'
            local val = string.match(elementsSection, pattern)
            if val then
                data.resistances[displayName] = tonumber(val)
            end
        end
    end

    -- Loot
    local lootSection = string.match(content, "<loot>(.-)</loot>")
    if lootSection then
        local seenItems = {}

        for itemTag in string.gmatch(lootSection, '<item[^>]*>') do
            local itemId = tonumber(string.match(itemTag, 'id="(%d+)"'))
            if not itemId then itemId = tonumber(string.match(itemTag, 'id="(%d+)"')) end
            if itemId then
                local countmax = tonumber(string.match(itemTag, 'countmax="(%d+)"') or '1')
                local count = tonumber(string.match(itemTag, 'count="(%d+)"') or countmax)
                local chance = tonumber(string.match(itemTag, 'chance="(%d+)"'))

                if chance then
                    local key = itemId .. "_" .. chance .. "_" .. countmax
                    if not seenItems[key] then
                        seenItems[key] = true
                        local itemInfo = getItemInfo(itemId)
                        local clientId = itemId
                        local itemName = "unknown"
                        if itemInfo then
                            if itemInfo.clientId and itemInfo.clientId > 0 then
                                clientId = itemInfo.clientId
                            end
                            itemName = itemInfo.name or "unknown"
                        end
                        table.insert(data.loot, {
                            id = itemId,
                            clientId = clientId,
                            name = itemName,
                            countmax = countmax,
                            chance = chance,
                        })
                    end
                end
            end
        end
    end

    -- Só tenta getMonsterInfo se faltar dados essenciais do XML
    if data.health == 0 or data.lookType == 0 then
        local hasMonster = pcall(getMonsterInfo, data.name)
        if hasMonster then
            local monsterInfo = getMonsterInfo(data.name)
            if monsterInfo then
                if data.health == 0 then data.health = monsterInfo.healthMax or monsterInfo.health or 0 end
                if data.experience == 0 then data.experience = monsterInfo.experience or 0 end
                if data.speed == 0 then data.speed = monsterInfo.baseSpeed or 0 end
                if data.armor == 0 then data.armor = monsterInfo.armor or 0 end
                if data.lookType == 0 and monsterInfo.outfit then
                    data.lookType = monsterInfo.outfit.lookType or 0
                    data.lookHead = monsterInfo.outfit.lookHead or 0
                    data.lookBody = monsterInfo.outfit.lookBody or 0
                    data.lookLegs = monsterInfo.outfit.lookLegs or 0
                    data.lookFeet = monsterInfo.outfit.lookFeet or 0
                    data.lookAddons = monsterInfo.outfit.lookAddons or 0
                end

                if #data.loot == 0 and monsterInfo.loot then
                    for _, lootEntry in ipairs(monsterInfo.loot) do
                        local itemInfo = getItemInfo(lootEntry.id)
                        local clientId = lootEntry.id
                        local itemName = "unknown"
                        if itemInfo then
                            if itemInfo.clientId and itemInfo.clientId > 0 then
                                clientId = itemInfo.clientId
                            end
                            itemName = itemInfo.name or "unknown"
                        end
                        table.insert(data.loot, {
                            id = lootEntry.id,
                            clientId = clientId,
                            name = itemName,
                            countmax = lootEntry.count or 1,
                            chance = lootEntry.chance or 0,
                        })
                    end
                end
            end
        end
    end

    return data
end

function Bestiary_getData()
    if not BestiaryData then
        Bestiary_buildData()
    end
    return BestiaryData
end

function Bestiary_getLootRarity(chance)
    for _, rarity in ipairs(LOOT_RARITY) do
        if chance >= rarity.min and chance <= rarity.max then
            return rarity.name
        end
    end
    return "Unknown"
end

function Bestiary_debounce(cid)
    local now = os.time()
    local last = BestiaryLastSend[cid] or 0
    if now - last < 2 then
        return false
    end
    BestiaryLastSend[cid] = now
    return true
end

local MAX_PACKET_SIZE = 19000
local BATCH_SIZE = 3

function Bestiary_buildMessages(encoded)
    if #encoded <= MAX_PACKET_SIZE then
        return { encoded }
    end

    local rawChunks = {}
    local pos = 1
    while pos <= #encoded do
        local chunk = string.sub(encoded, pos, pos + MAX_PACKET_SIZE - 1)
        table.insert(rawChunks, chunk)
        pos = pos + MAX_PACKET_SIZE
    end

    local messages = {}
    if #rawChunks == 1 then
        messages = { rawChunks[1] }
    else
        table.insert(messages, "S" .. rawChunks[1])
        for i = 2, #rawChunks - 1 do
            table.insert(messages, "P" .. rawChunks[i])
        end
        table.insert(messages, "E" .. rawChunks[#rawChunks])
    end
    return messages
end

function Bestiary_sendBatch(cid, messages, index)
    if not isPlayer(cid) then return end

    local endIdx = math.min(index + BATCH_SIZE - 1, #messages)
    for i = index, endIdx do
        doPlayerSendExtendedOpcode(cid, 250, messages[i])
    end

    if endIdx < #messages then
        addEvent(Bestiary_sendBatch, 150, cid, messages, endIdx + 1)
    end
end

function Bestiary_sendToPlayer(cid)
    if not isPlayer(cid) then return end
    local data = Bestiary_getData()
    if not data then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "[Bestiary] Erro ao carregar dados.")
        return
    end
    local ok, encoded = pcall(json.encode, data)
    if not ok or not encoded then
        print("[Bestiary] Erro ao codificar JSON: " .. tostring(encoded))
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "[Bestiary] Erro ao codificar dados.")
        return
    end

    local messages = Bestiary_buildMessages(encoded)
    if #messages == 0 then return end

    Bestiary_sendBatch(cid, messages, 1)
end
