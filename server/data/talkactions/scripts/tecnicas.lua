if not json then json = dofile("data/lib/json.lua") end

local spellsCache = nil

local function getSpellsData()
    if spellsCache then
        return spellsCache
    end

    local xmlPath = "data/spells/spells.xml"
    local file = io.open(xmlPath, "r")
    if not file then
        print("[SpellList] Could not open spells.xml at " .. xmlPath)
        return nil
    end
    local content = file:read("*a")
    file:close()

    -- Remove comments safely
    content = string.gsub(content, "<!%-%-.-%-%->", "")

    local newSpellInfo = {}
    local newSpellOrder = {}

    local i = 1
    while true do
        local s, e = string.find(content, "<instant", i)
        if not s then break end

        local attrEnd = string.find(content, ">", e)
        if not attrEnd then break end

        local attributes = string.sub(content, e + 1, attrEnd - 1)
        local isSelfClosing = string.match(attributes, "/%s*$")

        local body = ""
        if isSelfClosing then
            attributes = string.gsub(attributes, "/%s*$", "")
            i = attrEnd + 1
        else
            local bodyEndStart, bodyEndEnd = string.find(content, "</%s*instant%s*>", attrEnd)
            if bodyEndStart then
                body = string.sub(content, attrEnd + 1, bodyEndStart - 1)
                i = bodyEndEnd + 1
            else
                break
            end
        end

        local spellName = string.match(attributes, 'name="(.-)"')
        local spellWords = string.match(attributes, 'words="(.-)"')
        local spellLevel = tonumber(string.match(attributes, 'lvl="(%d+)"')) or
            tonumber(string.match(attributes, 'level="(%d+)"')) or 0
        local spellMana = tonumber(string.match(attributes, 'mana="(%d+)"')) or 0
        local spellPrem = (string.match(attributes, 'prem="(%d+)"') == "1")
        local spellExhaustion = tonumber(string.match(attributes, 'exhaustion="(%d+)"')) or 2000
        local spellDescription = string.match(attributes, 'description="(.-)"')

        local vocations = {}
        for vocIdStr in string.gmatch(body, '<vocation%s+id="(.-)"') do
            if string.find(vocIdStr, "-") then
                local startVoc, endVoc = string.match(vocIdStr, "(%d+)-(%d+)")
                if startVoc and endVoc then
                    for j = tonumber(startVoc), tonumber(endVoc) do
                        table.insert(vocations, j)
                    end
                end
            else
                local num = tonumber(vocIdStr)
                if num then table.insert(vocations, num) end
            end
        end

        local assignedGroups = {}
        local groupStr = string.match(attributes, 'group="(.-)"')
        local valueStr = string.match(attributes, 'value="(.-)"')
        if groupStr then
            for gl in string.gmatch(groupStr:lower(), "%a+") do
                if gl == "attack" or gl == "attacks" then
                    assignedGroups["1"] = spellExhaustion
                elseif gl == "defense" or gl == "defenses" then
                    assignedGroups["2"] = spellExhaustion
                elseif gl == "healing" or gl == "healings" then
                    assignedGroups["3"] = spellExhaustion
                elseif gl == "buffs" or gl == "buff" then
                    assignedGroups["4"] = spellExhaustion
                elseif gl == "support" or gl == "suporte" then
                    assignedGroups["5"] = spellExhaustion
                elseif gl == "especial" or gl == "special" or gl == "specials" then
                    assignedGroups["6"] = spellExhaustion
                elseif gl == "combo" or gl == "combos" then
                    assignedGroups["7"] = spellExhaustion
                end
            end
        elseif valueStr then
            local folder = string.match(valueStr, "^(.-)/")
            if folder then
                folder = folder:lower()
                if folder == "support" or folder == "buffs" then
                    assignedGroups["4"] = spellExhaustion
                elseif folder == "healing" then
                    assignedGroups["3"] = spellExhaustion
                elseif folder == "monsters" or folder == "cannons" then
                    assignedGroups["5"] = spellExhaustion
                else
                    assignedGroups["1"] = spellExhaustion
                end
            end
        end

        if not next(assignedGroups) then
            assignedGroups["1"] = spellExhaustion
        end

        if spellName and spellWords then
            newSpellInfo[spellName] = {
                words = spellWords,
                level = spellLevel,
                mana = spellMana,
                prem = spellPrem,
                exhaustion = spellExhaustion,
                description = spellDescription,
                group = assignedGroups,
                vocations = vocations
            }
            table.insert(newSpellOrder, spellName)
        end
    end

    -- Resolve os nomes reais das vocações (parametrizadas no servidor via vocations.xml) para
    -- todas as vocações referenciadas nas spells, já que o client não tem essa informação.
    local vocationNames = {}
    for _, info in pairs(newSpellInfo) do
        for _, vocId in ipairs(info.vocations) do
            local key = tostring(vocId)
            if not vocationNames[key] then
                local ok, vocInfo = pcall(getVocationInfo, vocId)
                if ok and vocInfo and vocInfo.name then
                    vocationNames[key] = vocInfo.name
                end
            end
        end
    end

    spellsCache = { spellInfo = newSpellInfo, spellOrder = newSpellOrder, vocationNames = vocationNames }
    return spellsCache
end

local MAX_PACKET_SIZE = 19000
local BATCH_SIZE = 3

local function buildSpelllistMessages(encoded)
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

local function sendSpelllistBatch(cid, messages, index)
    if not isPlayer(cid) then return end

    local endIdx = math.min(index + BATCH_SIZE - 1, #messages)
    for i = index, endIdx do
        doPlayerSendExtendedOpcode(cid, 123, messages[i])
    end

    if endIdx < #messages then
        addEvent(sendSpelllistBatch, 150, cid, messages, endIdx + 1)
    end
end

function onSay(cid, words, param)
    local spellsData = getSpellsData()
    if not spellsData then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Erro ao carregar lista de spells.")
        return TRUE
    end

    local playerVocation = getPlayerVocation(cid)
    local vocationNames = spellsData.vocationNames
    local playerVocKey = tostring(playerVocation)
    if not vocationNames[playerVocKey] then
        local ok, vocInfo = pcall(getVocationInfo, playerVocation)
        if ok and vocInfo and vocInfo.name then
            vocationNames[playerVocKey] = vocInfo.name
        end
    end

    local payload = {
        vocation = playerVocation,
        spellInfo = spellsData.spellInfo,
        spellOrder = spellsData.spellOrder,
        vocationNames = vocationNames
    }

    local ok, encoded = pcall(json.encode, payload)
    if not ok or not encoded then
        print("[SpellList] Erro ao codificar JSON: " .. tostring(encoded))
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Erro ao codificar lista de spells.")
        return TRUE
    end

    local messages = buildSpelllistMessages(encoded)
    if #messages > 0 then
        sendSpelllistBatch(cid, messages, 1)
    end
    return TRUE
end
