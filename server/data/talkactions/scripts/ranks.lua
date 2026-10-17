function getPlayerNameByGUID(playerId)
    local result = db.getResult("SELECT `name` FROM `players` WHERE `id` = " .. db.escapeString(playerId) .. ";")
    if result:getID() == -1 then
        result:free()
        return "SQL_ERROR[" .. playerId .. "]"
    end
    local name = result:getDataString("name")
    result:free()
    return name
end

function onSay(cid, words, param, channel)
    local maxRanks = 10
    local nameLength = 25
    local skills = {
        fist = 0,
        club = 1,
        sword = 2,
        axe = 3,
        distance = 4,
        shielding = 5,
        fishing = 6,
        dist = 4,
        shield = 5,
        fish = 6,
        maglevel = 10,
        resets = 11
    }

    param = param:lower()
    local highscore = "Highscore\n\n"
    local query, header, valueField

    if param == "" or param == "level" then
        header = "Rank Level - Player Name\n"
        query =
        "SELECT `name`, `level`, `experience` FROM `players` WHERE `group_id` < 3 ORDER BY `experience` DESC LIMIT " ..
        maxRanks .. ";"
        valueField = "level"
    elseif param == "magic" or param == "ml" then
        header = "Rank Magic - Player Name\n"
        query = "SELECT `name`, `maglevel` FROM `players` WHERE `group_id` < 3 ORDER BY `maglevel` DESC LIMIT " ..
        maxRanks .. ";"
        valueField = "maglevel"
    elseif param == "reset" or param == "resets" then
        header = "Rank Reset - Player Name\n"
        query = "SELECT `name`, `resets` FROM `players` WHERE `group_id` < 3 ORDER BY `resets` DESC LIMIT " ..
        maxRanks .. ";"
        valueField = "resets"
    elseif skills[param] then
        header = "Rank " .. param:gsub("^%l", string.upper) .. " - Player Name\n"
        query = "SELECT `player_id`, `value` FROM `player_skills` WHERE `skillid` = " ..
        skills[param] .. " ORDER BY `value` DESC LIMIT " .. maxRanks .. ";"
        valueField = "value"
    else
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE,
            "Invalid parameter. Use: level, magic, reset, fist, club, sword, axe, distance, shielding, fishing.")
        return true
    end

    highscore = highscore .. header
    local result = db.getResult(query)
    if result:getID() == -1 then
        result:free()
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Error retrieving highscore data.")
        return true
    end

    local rank = 0
    repeat
        rank = rank + 1
        local playerName, value
        if skills[param] and param ~= "maglevel" and param ~= "resets" then
            playerName = getPlayerNameByGUID(result:getDataInt("player_id"))
            value = result:getDataInt("value")
        else
            playerName = result:getDataString("name")
            value = result:getDataInt(valueField)
        end

        local spaces = string.rep(" ", nameLength - #playerName)
        highscore = highscore .. rank .. ". " .. value .. "  -  " .. playerName .. spaces .. "\n"
    until not result:next() or rank >= maxRanks

    result:free()
    doPlayerPopupFYI(cid, highscore)
    return true
end
