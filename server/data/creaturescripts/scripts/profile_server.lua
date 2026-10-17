if not DonateTier then dofile("data/lib/donate_tier.lua") end

local PROFILE_MINUTES_PER_YEAR = 60

local PROFILE_TITLES = {
    { max = 2,      name = "Baby" },
    { max = 10,     name = "Child" },
    { max = 17,     name = "Teenager" },
    { max = 30,     name = "Young" },
    { max = 60,     name = "Adult" },
    { max = 100,    name = "Veteran" },
    { max = 150,    name = "Elder" },
    { max = 999999, name = "Legendary" }
}

local function getProfileAgeTitle(age)
    for _, title in ipairs(PROFILE_TITLES) do
        if age <= title.max then
            return title.name
        end
    end
    return "Unknown"
end

-- Buscar age_minutes do banco
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

-- Buscar age do banco
local function getProfilePlayerAgeReal(cid)
    local minutes = getProfilePlayerAgeMinutesReal(cid)
    return math.floor(minutes / PROFILE_MINUTES_PER_YEAR)
end

-- Buscar resets do banco
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

-- Buscar frags do banco
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

-- Buscar skills do banco (0-6: Fist, Club, Sword, Axe, Distance, Shield, Fish)
local function getProfilePlayerSkills(cid)
    local guid = getPlayerGUID(cid)
    local skills = ""
    for i = 0, 6 do
        local result = db.getResult("SELECT `value` FROM `player_skills` WHERE `player_id` = " ..
            guid .. " AND `skillid` = " .. i)
        local value = 10
        if result and result:getID() ~= -1 then
            value = result:getDataInt("value")
            result:free()
        end
        skills = skills .. value
        if i < 6 then
            skills = skills .. ","
        end
    end
    return skills
end

-- Buscar capacidade do banco
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

-- Buscar balance do banco
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

-- Buscar stamina do banco
local function getProfilePlayerStamina(cid)
    local guid = getPlayerGUID(cid)
    local result = db.getResult("SELECT `stamina` FROM `players` WHERE `id` = " .. guid)
    local stamina = 151200000
    if result and result:getID() ~= -1 then
        stamina = result:getDataInt("stamina")
        result:free()
    end
    return stamina
end

function onExtendedOpcode(cid, opcode, buffer)
    local opcodeId = 155
    if opcode == opcodeId then
        local targetId = tonumber(buffer)
        if not targetId then return true end

        local target = targetId
        if not isPlayer(target) then
            return true
        end

        -- Buscar dados do banco (conforme solicitado: "conforme est salvo no banco")
        local age = getProfilePlayerAgeReal(target)
        local title = getProfileAgeTitle(age)
        local frags = getProfilePlayerFrags(target)
        local resets = getProfilePlayerResets(target)

        -- Vocation Name
        local vocId = getPlayerVocation(target)
        local vocationName = "None"
        local vocInfo = getVocationInfo(vocId)
        if vocInfo and vocInfo.name then
            vocationName = vocInfo.name
        end
        if VocationRankConfig and VocationRankConfig.Vocations and VocationRankConfig.Vocations[vocId] then
            local archetype = VocationRankConfig.Vocations[vocId].archetype
            if archetype then
                if archetype == "Support" then archetype = "Suporte" end
                vocationName = vocationName .. " (" .. archetype .. ")"
            end
        end

        -- Health e Mana (In-game current values)
        local health = getCreatureHealth(target)
        local healthmax = getCreatureMaxHealth(target)
        local mana = getCreatureMana(target)
        local manamax = getCreatureMaxMana(target)

        -- Stamina do banco (em milissegundos -> minutos)
        local staminaMs = getProfilePlayerStamina(target)
        local staminaMinutes = math.floor(staminaMs / 1000 / 60)

        -- Cap e Gold (Balance) do banco
        local cap = getProfilePlayerCap(target)
        local balance = getProfilePlayerBalance(target)

        -- Position via API
        local pos = getCreaturePosition(target)
        local posx = pos.x or 0
        local posy = pos.y or 0
        local posz = pos.z or 0

        -- Skills do banco (incluindo magic level)
        local skills = getProfilePlayerSkills(target)
        -- Adicionando Magic Level as skills (skillid 7 no script original estava falhando)
        local guid = getPlayerGUID(target)
        local magResult = db.getResult("SELECT `maglevel` FROM `players` WHERE `id` = " .. guid)
        local magLevel = 0
        if magResult and magResult:getID() ~= -1 then
            magLevel = magResult:getDataInt("maglevel")
            magResult:free()
        end
        skills = skills .. "," .. magLevel

        -- Donate tier (ver data/lib/donate_tier.lua)
        local donateTier = DonateTier.getAccountDonateTier(getPlayerAccountId(target))

        -- Enviar dados para o cliente
        local data = age .. "|" .. title .. "|" .. frags .. "|" .. resets .. "|" .. vocationName .. "|"
            .. health .. "|" .. healthmax .. "|" .. mana .. "|" .. manamax .. "|" .. staminaMinutes .. "|"
            .. cap .. "|" .. balance .. "|" .. skills .. "|" .. posx .. "|" .. posy .. "|" .. posz .. "|"
            .. donateTier.name .. "|" .. donateTier.bonusPct .. "|" .. (donateTier.bonusPct > 0 and 1 or 0)

        print(data)
        doPlayerSendExtendedOpcode(cid, opcodeId, data)
    elseif opcode == 13 then
        if InspectModule then
            InspectModule:handleOpcode(cid, opcode, buffer)
        else
            print("Error: InspectModule not found. Make sure data/lib/inspect.lua is loaded correctly.")
        end
    end
    return true
end
