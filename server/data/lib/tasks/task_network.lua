if not json then
    json = dofile("data/lib/json.lua")
end
if not TaskRank_getPlayerRankName then
    dofile("data/lib/tasks/task_rank.lua")
end
TASK_OPCODE = 215

local function networkNormalizeMonsters(monsters)
    local result = {}
    if not monsters then return result end
    for _, m in ipairs(monsters) do
        if type(m) == "string" then
            table.insert(result, m)
        elseif type(m) == "table" and m.name then
            table.insert(result, m.name)
        end
    end
    return result
end

TASK_LIST_LEVEL_RANGE = 50
MAX_PAYLOAD_BYTES = 16000
DEFAULT_PAGE_SIZE = 30
MAX_PAGE_SIZE = 50

local DIFFICULTY_ORDER_MAP = {}
do
    local order = TASK_DIFFICULTY_ORDER or { "easy", "medium", "hard", "elite" }
    for i, d in ipairs(order) do
        DIFFICULTY_ORDER_MAP[d] = i
    end
end

function TaskNetwork_sendJSON(cid, data)
    if not isPlayer(cid) then
        return
    end

    local ok, encoded = pcall(json.encode, data)
    if not ok then
        return
    end

    if #encoded > MAX_PAYLOAD_BYTES then
        while #encoded > MAX_PAYLOAD_BYTES and data.allTasks and #data.allTasks > 0 do
            local keep = math.max(1, math.floor(#data.allTasks * 0.7))
            local truncated = {}
            for i = 1, keep do
                table.insert(truncated, data.allTasks[i])
            end
            data.allTasks = truncated
            encoded = json.encode(data)
        end
    end
    doPlayerSendExtendedOpcode(cid, TASK_OPCODE, encoded)
end

TASK_LAST_SEND_TIME = {}

local function getDifficultyIndex(task)
    return DIFFICULTY_ORDER_MAP[task.difficulty] or 99
end

local function getMonsterLevel(task)
    if task.monsterDetails and #task.monsterDetails > 0 then
        return task.monsterDetails[1].level or 0
    end
    return 0
end

function TaskNetwork_sendTaskList(cid, params)
    local now = os.time()
    local last = TASK_LAST_SEND_TIME[cid] or 0
    if now - last < 0.3 then
        return
    end
    TASK_LAST_SEND_TIME[cid] = now

    local cache = TaskCache_getPlayerCache(cid)
    local category = TaskRank_getPlayerCategory(cid)
    local playerLevel = getPlayerLevel(cid)
    local playerPoints = TaskStorage_getPlayerPoints(cid)
    local range = math.max(TASK_LIST_LEVEL_RANGE, math.min(playerLevel * 2, 300))
    local maxLevelToShow = playerLevel + range

    local page = math.max(1, (params and params.page) or 1)
    local pageSize = math.max(1, math.min((params and params.pageSize) or DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE))
    local search = ((params and params.search) or ""):lower()
    local filterType = (params and params.type) or ""
    local filterDifficulty = (params and params.difficulty) or ""
    local sortField = (params and params.sort) or "difficulty"

    local playerTasks = {}
    local matching = {}
    local categoryCounts = { dragonball = 0, bleach = 0, general = 0 }

    for taskId, task in pairs(TASKS) do
        if task.category == category then
            local playerTask = cache[taskId]
            local isActive = playerTask and playerTask.rewarded ~= 1

            if isActive then
                table.insert(playerTasks, {
                    id = taskId,
                    name = task.name,
                    kills = task.killsRequired,
                    done = math.min(playerTask.kills or 0, task.killsRequired),
                    exp = task.experience,
                    points = task.points,
                    completed = playerTask.completed or 0,
                    rewarded = playerTask.rewarded or 0
                })
            end
        end

        do
            local levelFits = task.levelRequired <= maxLevelToShow
            local rankFits = playerPoints >= task.rankRequired
            if levelFits and rankFits then
                if task.category == "dragonball" then
                    categoryCounts.dragonball = categoryCounts.dragonball + 1
                elseif task.category == "bleach" then
                    categoryCounts.bleach = categoryCounts.bleach + 1
                elseif task.category == "general" then
                    categoryCounts.general = categoryCounts.general + 1
                end
            end
        end

        if task.category == category or task.category == "general" then
            local hasActive = cache[taskId] and cache[taskId].rewarded ~= 1
            local isFinished = cache[taskId] and cache[taskId].rewarded == 1
            local isNonRepeatableFinished = isFinished and not task.repeatable
            local levelFits = task.levelRequired <= maxLevelToShow

            local passVisibility = true
            if filterType == "completed" then
                if not isNonRepeatableFinished then
                    passVisibility = false
                end
            else
                if isNonRepeatableFinished then
                    passVisibility = false
                elseif not hasActive and not levelFits then
                    passVisibility = false
                end
            end

            if passVisibility then
                local passSearch = true
                if search ~= "" then
                    passSearch = false
                    if task.name:lower():find(search, 1, true) then
                        passSearch = true
                    else
                        for _, m in ipairs(task.monsters or {}) do
                            local mname = type(m) == "table" and m.name or m
                            if mname and mname:lower():find(search, 1, true) then
                                passSearch = true
                                break
                            end
                        end
                    end
                end

                if passSearch then
                    local passType = true
                    if filterType ~= "" and filterType ~= "completed" then
                        if filterType == "repeatable" then
                            passType = task.repeatable == true
                        elseif filterType == "daily" then
                            passType = task.daily and task.daily.enabled
                        else
                            passType = task.type == filterType
                        end
                    end

                    if passType then
                        local passDiff = true
                        if filterDifficulty ~= "" then
                            passDiff = task.difficulty == filterDifficulty
                        end

                        if passDiff then
                            local isLocked = false
                            if playerLevel < task.levelRequired then isLocked = true end
                            if playerPoints < task.rankRequired then isLocked = true end
                            if hasActive then isLocked = false end

                            table.insert(matching, {
                                taskId = taskId,
                                task = task,
                                diffIdx = getDifficultyIndex(task),
                                monsterLevel = getMonsterLevel(task),
                                isActive = hasActive,
                                isLocked = isLocked,
                                levelRequired = task.levelRequired,
                                rankRequired = task.rankRequired
                            })
                        end
                    end
                end
            end
        end
    end

    table.sort(matching, function(a, b)
        if a.isLocked ~= b.isLocked then
            return not a.isLocked
        end
        if a.diffIdx ~= b.diffIdx then
            return a.diffIdx < b.diffIdx
        end
        if a.levelRequired ~= b.levelRequired then
            return a.levelRequired < b.levelRequired
        end
        return a.rankRequired < b.rankRequired
    end)

    local totalTasks = #matching
    local totalPages = math.max(1, math.ceil(totalTasks / pageSize))
    if page > totalPages then page = totalPages end
    local startIdx = (page - 1) * pageSize + 1
    local endIdx = math.min(startIdx + pageSize - 1, totalTasks)

    local allTasks = {}
    for i = startIdx, endIdx do
        local entry = matching[i]
        local task = entry.task
        local locked = entry.isLocked
        local isRewarded = (cache[entry.taskId] and cache[entry.taskId].rewarded == 1) or false

        table.insert(allTasks, {
            id = entry.taskId,
            name = task.name,
            category = task.category,
            type = task.type,
            difficulty = task.difficulty,
            levelRequired = task.levelRequired,
            rankRequired = task.rankRequired,
            kills = task.killsRequired,
            killsRequired = task.killsRequired,
            exp = task.experience,
            money = task.money,
            points = task.points,
            rewards = task.rewards,
            delivery = task.delivery,
            monsters = networkNormalizeMonsters(task.monsters),
            lookType = task.lookType,
            repeatable = task.repeatable or false,
            unique = task.unique or false,
            daily = task.daily or { enabled = false },
            locked = locked,
            isRewarded = isRewarded
        })
    end

    local rankName, rankColor, rankPoints = TaskRank_getPlayerRank(cid, category)
    local nextRankName, pointsToNext, pointsInThisRank, pointsToNextMax = TaskRank_getNextRank(cid, category)

    local rankTable = TaskRank_getTableForCategory(category)
    local _, rankIdx = TaskRank_getRankByPoints(category, playerPoints)
    local currentRank = rankTable[rankIdx]
    local pointsPerDifficulty = currentRank and currentRank.pointsPerDifficulty or
        { easy = 10, medium = 25, hard = 50, elite = 100 }

    local response = {
        allTasks = allTasks,
        playerTasks = playerTasks,
        totalTasks = totalTasks,
        totalPages = totalPages,
        currentPage = page,
        pageSize = pageSize,
        categoryCounts = categoryCounts,
        playerCategory = category,
        rank = {
            name = rankName,
            color = rankColor,
            points = rankPoints,
            nextRank = nextRankName,
            pointsToNext = pointsToNext,
            pointsInThisRank = pointsInThisRank,
            pointsToNextMax = pointsToNextMax,
            category = category,
            pointsPerDifficulty = pointsPerDifficulty
        }
    }

    TaskNetwork_sendJSON(cid, response)
end

function TaskNetwork_sendTaskUpdate(cid, taskId, kills, killsRequired, completed)
    local response = {
        update = {
            taskId = taskId,
            kills = kills,
            killsRequired = killsRequired,
            completed = completed
        }
    }
    TaskNetwork_sendJSON(cid, response)
end

function TaskNetwork_sendCompletePopup(cid, taskId, taskConfig)
    local actualPoints = TaskRank_getPointsForDifficulty(cid, taskConfig.difficulty)
    local response = {
        complete = {
            taskId = taskId,
            name = taskConfig.name,
            points = actualPoints or taskConfig.points,
            exp = taskConfig.experience,
            money = taskConfig.money,
            rewards = taskConfig.rewards
        }
    }
    TaskNetwork_sendJSON(cid, response)
end

function TaskNetwork_sendMessage(cid, message, color)
    if not color then color = "white" end
    local response = {
        message = message,
        color = color
    }
    TaskNetwork_sendJSON(cid, response)
end

function TaskNetwork_sendRankUpdate(cid)
    local category = TaskRank_getPlayerCategory(cid)
    local rankName, rankColor, rankPoints = TaskRank_getPlayerRank(cid, category)
    local nextRankName, pointsToNext, pointsInThisRank, pointsToNextMax = TaskRank_getNextRank(cid, category)

    local rankTable = TaskRank_getTableForCategory(category)
    local _, rankIdx = TaskRank_getRankByPoints(category, rankPoints)
    local currentRank = rankTable[rankIdx]
    local pointsPerDifficulty = currentRank and currentRank.pointsPerDifficulty or
        { easy = 10, medium = 25, hard = 50, elite = 100 }

    local response = {
        rankUpdate = {
            name = rankName,
            color = rankColor,
            points = rankPoints,
            nextRank = nextRankName,
            pointsToNext = pointsToNext,
            pointsInThisRank = pointsInThisRank,
            pointsToNextMax = pointsToNextMax,
            category = category,
            pointsPerDifficulty = pointsPerDifficulty
        }
    }
    TaskNetwork_sendJSON(cid, response)
end

function TaskNetwork_handleAction(cid, data)
    if not data or not data.action then
        return
    end

    local action = data.action

    if action == "info" or action == "list" then
        TaskNetwork_sendTaskList(cid, data)
    elseif action == "start" then
        if data.taskId then
            local ok, err = pcall(TaskCore_startTask, cid, data.taskId)
        else

        end
    elseif action == "cancel" then
        if data.taskId then
            TaskCore_abortTask(cid, data.taskId)
        end
    elseif action == "complete" then
        if data.taskId then
            TaskCore_claimTask(cid, data.taskId)
        end
    elseif action == "hide" then
    else
    end
end
