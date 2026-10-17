if not TaskStorage_getPlayerPoints then dofile("data/lib/tasks/task_storage.lua") end

TASK_RANK_DRAGONBALL = {
    { requiredPoints = 0,      name = "Unranked",           color = "#666666", pointsPerDifficulty = { easy = 5, medium = 10, hard = 20, elite = 40 } },
    { requiredPoints = 50,     name = "Citizen",            color = "#aaaaaa", pointsPerDifficulty = { easy = 10, medium = 25, hard = 50, elite = 100 } },
    { requiredPoints = 200,    name = "Veteran",            color = "#cd7f32", pointsPerDifficulty = { easy = 15, medium = 35, hard = 70, elite = 140 } },
    { requiredPoints = 500,    name = "Master",             color = "#c0c0c0", pointsPerDifficulty = { easy = 20, medium = 50, hard = 100, elite = 200 } },
    { requiredPoints = 1000,   name = "Professional",       color = "#ffd700", pointsPerDifficulty = { easy = 30, medium = 70, hard = 140, elite = 280 } },
    { requiredPoints = 2000,   name = "Elite",              color = "#b9f2ff", pointsPerDifficulty = { easy = 40, medium = 90, hard = 180, elite = 360 } },
    { requiredPoints = 4000,   name = "Legendary",          color = "#ff6b6b", pointsPerDifficulty = { easy = 50, medium = 110, hard = 220, elite = 440 } },
    { requiredPoints = 7000,   name = "Immortal",           color = "#ff0000", pointsPerDifficulty = { easy = 60, medium = 130, hard = 260, elite = 520 } },
    { requiredPoints = 12000,  name = "Hero",               color = "#ff4500", pointsPerDifficulty = { easy = 80, medium = 170, hard = 340, elite = 680 } },
    { requiredPoints = 25000,  name = "God of Destruction", color = "#8b00ff", pointsPerDifficulty = { easy = 100, medium = 210, hard = 420, elite = 840 } },
    { requiredPoints = 60000,  name = "God of Creation",    color = "#00bfff", pointsPerDifficulty = { easy = 120, medium = 250, hard = 500, elite = 1000 } },
    { requiredPoints = 120000, name = "Supreme God",        color = "#ffd700", pointsPerDifficulty = { easy = 150, medium = 300, hard = 600, elite = 1200 } }
}

TASK_RANK_BLEACH = {
    { requiredPoints = 0,      name = "Unranked",          color = "#666666", pointsPerDifficulty = { easy = 5, medium = 10, hard = 20, elite = 40 } },
    { requiredPoints = 50,     name = "Human",             color = "#aaaaaa", pointsPerDifficulty = { easy = 10, medium = 25, hard = 50, elite = 100 } },
    { requiredPoints = 200,    name = "Hollow",            color = "#cd7f32", pointsPerDifficulty = { easy = 15, medium = 35, hard = 70, elite = 140 } },
    { requiredPoints = 500,    name = "Shinigami",         color = "#c0c0c0", pointsPerDifficulty = { easy = 20, medium = 50, hard = 100, elite = 200 } },
    { requiredPoints = 1000,   name = "Vaizard",           color = "#ffd700", pointsPerDifficulty = { easy = 30, medium = 70, hard = 140, elite = 280 } },
    { requiredPoints = 2000,   name = "Arrancar",          color = "#b9f2ff", pointsPerDifficulty = { easy = 40, medium = 90, hard = 180, elite = 360 } },
    { requiredPoints = 4000,   name = "Espada",            color = "#ff6b6b", pointsPerDifficulty = { easy = 50, medium = 110, hard = 220, elite = 440 } },
    { requiredPoints = 7000,   name = "Captain",           color = "#ff0000", pointsPerDifficulty = { easy = 60, medium = 130, hard = 260, elite = 520 } },
    { requiredPoints = 12000,  name = "Elite Captain",     color = "#ff4500", pointsPerDifficulty = { easy = 80, medium = 170, hard = 340, elite = 680 } },
    { requiredPoints = 25000,  name = "General Captain",   color = "#8b00ff", pointsPerDifficulty = { easy = 100, medium = 210, hard = 420, elite = 840 } },
    { requiredPoints = 60000,  name = "Head Captain",      color = "#00bfff", pointsPerDifficulty = { easy = 120, medium = 250, hard = 500, elite = 1000 } },
    { requiredPoints = 120000, name = "King of Shinigami", color = "#ffd700", pointsPerDifficulty = { easy = 150, medium = 300, hard = 600, elite = 1200 } }
}

function TaskRank_getTableForCategory(category)
    if category == "bleach" then return TASK_RANK_BLEACH end
    return TASK_RANK_DRAGONBALL
end

function TaskRank_getRankByPoints(category, points)
    local ranks = TaskRank_getTableForCategory(category)
    local current = ranks[1]
    for i = #ranks, 1, -1 do
        if points >= ranks[i].requiredPoints then
            return ranks[i], i
        end
    end
    return current, 1
end

function TaskRank_getPlayerRank(cid, category)
    local points = TaskStorage_getPlayerPoints(cid)
    local rank, idx = TaskRank_getRankByPoints(category or TaskRank_getPlayerCategory(cid), points)
    return rank.name, rank.color, points
end

function TaskRank_getNextRank(cid, category)
    local points = TaskStorage_getPlayerPoints(cid)
    local ranks = TaskRank_getTableForCategory(category or TaskRank_getPlayerCategory(cid))
    local _, idx = TaskRank_getRankByPoints(category or TaskRank_getPlayerCategory(cid), points)

    local currentRank = ranks[idx]
    local nextRank = ranks[idx + 1]

    if nextRank then
        local pointsInThisRank = points - currentRank.requiredPoints
        local pointsToNextMax = nextRank.requiredPoints - currentRank.requiredPoints
        return nextRank.name, nextRank.requiredPoints - points, pointsInThisRank, pointsToNextMax
    end

    local pointsInThisRank = points - currentRank.requiredPoints
    local pointsToNextMax = pointsInThisRank
    return currentRank.name, 0, pointsInThisRank, pointsToNextMax
end

function TaskRank_checkAndRankUp(cid)
    local category = TaskRank_getPlayerCategory(cid)
    local points = TaskStorage_getPlayerPoints(cid)
    local ranks = TaskRank_getTableForCategory(category)
    local _, idx = TaskRank_getRankByPoints(category, points)

    local currentRank = ranks[idx]
    local nextRank = ranks[idx + 1]

    if nextRank and points >= nextRank.requiredPoints then
        TaskChannel_message(cid, TALKTYPE_CHANNEL_O,
            "[Rank] Congratulations! You advanced to " .. nextRank.name .. "!")
        doSendMagicEffect(getCreaturePosition(cid), CONST_ME_HOLYDAMAGE)

        TaskNetwork_sendRankUpdate(cid)

        return true, nextRank.name
    end

    return false, currentRank.name
end

function TaskRank_getPointsForDifficulty(cid, difficulty)
    local category = TaskRank_getPlayerCategory(cid)
    local points = TaskStorage_getPlayerPoints(cid)
    local rank = TaskRank_getRankByPoints(category, points)
    return rank.pointsPerDifficulty[difficulty] or rank.pointsPerDifficulty["easy"] or 0
end

local VOCATION_UNIVERSE_MAP = {}

local function loadVocationUniverses()
    local f = io.open("data/XML/vocations.xml", "r")
    if not f then
        return
    end
    local content = f:read("*a")
    f:close()

    for tag in content:gmatch('<vocation[^>]+>') do
        local id = tonumber(tag:match('id="(%d+)"'))
        local universe = tag:match('type_universe="([^"]+)"')
        if id and id > 0 and universe then
            -- Mesma normalização usada no site pra `Category` das tasks
            -- (lib/validations/admin/task-definition.ts: normalizeTaskCategory) — sem isso, uma
            -- grafia diferente de "Dragon Ball"/"Bleach" no cadastro de Universo (maiúscula,
            -- espaço extra, etc.) faz toda vocação daquele universo cair no fallback
            -- "dragonball" e as tasks do universo real ficarem invisíveis pra ela.
            local normalized = universe:trim():lower():gsub('%s+', '')
            if normalized == "dragonball" then
                VOCATION_UNIVERSE_MAP[id] = "dragonball"
            elseif normalized == "bleach" then
                VOCATION_UNIVERSE_MAP[id] = "bleach"
            end
        end
    end
end

function TaskRank_getPlayerVocationCategory(cid)
    if next(VOCATION_UNIVERSE_MAP) == nil then
        loadVocationUniverses()
    end
    local voc = getPlayerVocation(cid)
    local category = VOCATION_UNIVERSE_MAP[voc]
    if category then return category end
    return "dragonball"
end

function TaskRank_getPlayerRankName(cid)
    local category = TaskRank_getPlayerVocationCategory(cid)
    local name, _, points = TaskRank_getPlayerRank(cid, category)
    return name, points
end

function TaskRank_getPlayerRankColor(cid)
    local category = TaskRank_getPlayerVocationCategory(cid)
    local _, color = TaskRank_getPlayerRank(cid, category)
    return color
end

function TaskRank_formatLookDescription(cid)
    local name, points = TaskRank_getPlayerRankName(cid)
    if points > 0 then
        return "\nRank: " .. name .. " (" .. points .. " Task Points)"
    end
    return ""
end

function TaskRank_hasRequiredRank(cid, requiredPoints)
    local points = TaskStorage_getPlayerPoints(cid)
    return points >= requiredPoints
end

function TaskRank_getPlayerCategory(cid)
    return TaskRank_getPlayerVocationCategory(cid)
end
