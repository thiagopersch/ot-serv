-- Profile Library for Character Data
STORAGE_AGE = 1000
USE_DB_RESETS = true -- Set to false if using storage for resets
MINUTES_PER_YEAR = 60

TITLES = {
    { max = 2,         name = "Baby" },
    { max = 10,        name = "Child" },
    { max = 17,        name = "Teenager" },
    { max = 30,        name = "Young" },
    { max = 60,        name = "Adult" },
    { max = 100,       name = "Veteran" },
    { max = 150,       name = "Elder" },
    { max = math.huge, name = "Legendary" }
}

function getAgeTitle(age)
    for _, title in ipairs(TITLES) do
        if age <= title.max then
            return title.name
        end
    end
    return "Unknown"
end

function getPlayerResets(cid)
    local guid = getPlayerGUID(cid)
    local resets = 0

    if USE_DB_RESETS then
        local result = db.getResult("SELECT `resets` FROM `players` WHERE `id` = " .. guid)
        if result:getID() ~= -1 then
            resets = result:getDataInt("resets")
            result:free()
        end
    else
        resets = getPlayerStorageValue(cid, 500)
    end

    return math.max(0, resets)
end

function getPlayerFrags(cid)
    local guid = getPlayerGUID(cid)
    local timeLimit = os.time() - (30 * 86400)
    local count = 0

    local result = db.getResult(
        "SELECT COUNT(`pk`.`player_id`) as `count` FROM `player_killers` pk " ..
        "LEFT JOIN `killers` k ON `pk`.`kill_id` = `k`.`id` " ..
        "LEFT JOIN `player_deaths` pd ON `k`.`death_id` = `pd`.`id` " ..
        "WHERE `pk`.`player_id` = " .. guid .. " AND `k`.`unjustified` = 1 AND `pd`.`date` >= " .. timeLimit
    )

    if result:getID() ~= -1 then
        count = result:getDataInt("count")
        result:free()
    end

    return count
end

function getPlayerAgeMinutesReal(cid)
    local guid = getPlayerGUID(cid)
    local result = db.getResult("SELECT `age_minutes` FROM `players` WHERE `id` = " .. guid)
    local minutes = 0
    if result:getID() ~= -1 then
        minutes = result:getDataInt("age_minutes")
        result:free()
    end
    return minutes
end

function getPlayerAgeReal(cid)
    local minutes = getPlayerAgeMinutesReal(cid)
    return math.floor(minutes / MINUTES_PER_YEAR)
end
