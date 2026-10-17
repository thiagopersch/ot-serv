local STORAGE_AGE = 1000
local MINUTES_PER_YEAR = 60
local opcode = 50

local config = {
    effects = {
        [1] = 491,
        [2] = 491,
        [3] = 491,
        [4] = 491,
        [5] = 491,
        [6] = 491,
        [7] = 491,
        [8] = 491
    }
}

local function getTitleByAge(age)
    if age <= 2 then
        return "Baby"
    elseif age <= 10 then
        return "Child"
    elseif age <= 17 then
        return "Teenager"
    elseif age <= 30 then
        return "Young"
    elseif age <= 60 then
        return "Adult"
    elseif age <= 100 then
        return "Veteran"
    elseif age <= 150 then
        return "Elder"
    else
        return "Legendary"
    end
end

local function getEffectIndex(age)
    if age <= 2 then
        return 1
    elseif age <= 10 then
        return 2
    elseif age <= 17 then
        return 3
    elseif age <= 30 then
        return 4
    elseif age <= 60 then
        return 5
    elseif age <= 100 then
        return 6
    elseif age <= 150 then
        return 7
    else
        return 8
    end
end

local function getPlayerAgeMinutesReal(cid)
    local guid = getPlayerGUID(cid)
    local result = db.getResult("SELECT `age_minutes` FROM `players` WHERE `id` = " .. guid)
    local minutes = 0
    if result and result:getID() ~= -1 then
        minutes = result:getDataInt("age_minutes")
        result:free()
    end
    return minutes
end

local function updatePlayerAgeDB(cid, minutes, age)
    local guid = getPlayerGUID(cid)
    local query = "UPDATE `players` SET `age_minutes` = " .. minutes .. ", `age` = " .. age .. " WHERE `id` = " .. guid
    db.query(query)
end

local function getAgeFromMinutes(minutes)
    return math.floor(minutes / MINUTES_PER_YEAR)
end

function onThink(interval, lastExecution)
    local players = getPlayersOnline()

    for i = 1, #players do
        local cid = players[i]

        local minutes = getPlayerAgeMinutesReal(cid)
        local age = getAgeFromMinutes(minutes)

        if minutes < 0 then minutes = 0 end
        if age < 0 then age = 0 end

        local agingPoints = isPremium(cid) and 2 or 1
        local newMinutes = minutes + agingPoints
        local newAge = math.floor(newMinutes / MINUTES_PER_YEAR)
        local title = getTitleByAge(newAge)

        if newAge > age then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
                "You aged! Now you have " .. newAge .. " years. (" .. title .. ")")

            local effectId = config.effects[getEffectIndex(newAge)]
            if effectId then
                doSendMagicEffect(getCreaturePosition(cid), effectId)
            end

            local ageData = newAge .. "|" .. title
            doPlayerSendExtendedOpcode(cid, opcode, ageData)
        end

        updatePlayerAgeDB(cid, newMinutes, newAge)
    end

    return true
end
