local window = nil
local taskButton = nil
local currentTab = nil
local currentType = nil
local allTasks = {}
local playerTasks = {}
local selectedTaskId = nil
g_taskRankData = g_taskRankData or {}

json = json or g_json

local CARDS_PER_ROW = 5

local DIFFICULTY_COLORS = {
    easy = "#00ff00",
    medium = "#ffff00",
    hard = "#ff6600",
    elite = "#ff0000"
}

local DIFFICULTY_NAMES = {
    easy = "Easy",
    medium = "Medium",
    hard = "Hard",
    elite = "Elite"
}

local DIFFICULTY_ORDER = {
    easy = 1,
    medium = 2,
    hard = 3,
    elite = 4
}

local RANK_COLORS = {
    dragonball = {
        Unranked = "#666666",
        Citizen = "#aaaaaa",
        Veteran = "#cd7f32",
        Master = "#c0c0c0",
        Professional = "#ffd700",
        Elite = "#b9f2ff",
        Legendary = "#ff6b6b",
        Immortal = "#ff0000",
        Hero = "#ff4500",
        ["God of Destruction"] = "#8b00ff",
        ["God of Creation"] = "#00bfff",
        ["Supreme God"] = "#ffd700"
    },
    bleach = {
        Unranked = "#666666",
        Human = "#aaaaaa",
        Hollow = "#cd7f32",
        Shinigami = "#c0c0c0",
        Vaizard = "#ffd700",
        Arrancar = "#b9f2ff",
        Espada = "#ff6b6b",
        Captain = "#ff0000",
        ["Elite Captain"] = "#ff4500",
        ["General Captain"] = "#8b00ff",
        ["Head Captain"] = "#00bfff",
        ["King of Shinigami"] = "#ffd700"
    }
}

local TYPE_FILTERS = {
    { id = "typeAll",        value = nil },
    { id = "typeKill",       value = "kill" },
    { id = "typeDelivery",   value = "delivery" },
    { id = "typeSaga",       value = "saga" },
    { id = "typeDaily",      value = "daily" },
    { id = "typeBoss",       value = "boss" },
    { id = "typeRepeatable", value = "repeatable" },
    { id = "typeUnique",     value = "unique" }
}

function init()
    connect(g_game, {
        onGameStart = onGameStart,
        onGameEnd = destroy
    })

    g_keyboard.bindKeyDown('Escape', close)

    taskButton = modules.client_topmenu.addRightGameToggleButton('taskButton', tr('Tasks'), '/images/topbuttons/task',
        toggleWindow)

    ProtocolGame.registerExtendedOpcode(215, parseOpcode)

    currentTab = 'dragonball'
end

function terminate()
    disconnect(g_game, {
        onGameEnd = destroy
    })
    ProtocolGame.unregisterExtendedOpcode(215, parseOpcode)
    if taskButton then
        taskButton:destroy()
        taskButton = nil
    end
    destroy()
end

function onGameStart()
    if not window then
        window = g_ui.displayUI('tasks', modules.game_interface.getRightPanel())
        window:setVisible(false)
        currentTab = 'dragonball'
        local dbTab = window:getChildById('tabDragonBall')
        if dbTab then dbTab:setImageColor('#ffd700') end

        local dp = window:getChildById('detailPanel')
        local tl = window:getChildById('taskList')
        if dp then dp:setVisible(false) end
        if tl then tl:setVisible(true) end
    end
    scheduleEvent(sendRequest, 100)
end

function sendRequest()
    local p = g_game.getProtocolGame()
    if p then
        p:sendExtendedOpcode(215, '{"action":"info"}')
    end
end

function destroy()
    if window then
        window:destroy()
        window = nil
    end
end

function parseOpcode(protocol, opcode, data)
    local decoded = data
    if type(data) == 'string' then
        local success, result = pcall(json.decode, data)
        if success then
            decoded = result
        else
            return
        end
    end

    if decoded.allTasks then
        allTasks = decoded.allTasks
        playerTasks = decoded.playerTasks or {}
        g_taskRankData = decoded.rank or {}
        renderTaskList()
        updateRankDisplay()
    elseif decoded.update then
        updateTaskProgress(decoded.update)
    elseif decoded.complete then
        showCompletePopup(decoded.complete)
    elseif decoded.message then
        showInfo(decoded.message, decoded.color or 'white')
    elseif decoded.rankUpdate then
        g_taskRankData = decoded.rankUpdate
        updateRankDisplay()
        local profileMod = modules.game_player_profile
        if profileMod and profileMod.InspectWindow and profileMod.InspectWindow:isVisible() then
            profileMod.updateProfile()
        end
    end
end

function sendOpcode(data)
    local protocolGame = g_game.getProtocolGame()
    if protocolGame then
        protocolGame:sendExtendedOpcode(215, data)
    end
end

function toggleWindow()
    if not g_game.isOnline() then return end
    if not window then return end

    if window:isVisible() then
        close()
    else
        sendOpcode('{"action":"info"}')
        window:setVisible(true)
        window:focus()
    end
end

function close()
    if window then
        window:setVisible(false)
    end
end

function switchTab(category)
    currentTab = category
    currentType = nil
    if window then
        local dbTab = window:getChildById('tabDragonBall')
        local bTab = window:getChildById('tabBleach')
        if category == 'dragonball' then
            if dbTab then dbTab:setImageColor('#ffd700') end
            if bTab then bTab:setImageColor('#dfdfdf') end
        else
            if dbTab then dbTab:setImageColor('#dfdfdf') end
            if bTab then bTab:setImageColor('#ffd700') end
        end
    end
    updateTypeFilterHighlights()
    renderTaskList()
end

function setTypeFilter(filterType)
    if currentType == filterType then return end
    currentType = filterType
    updateTypeFilterHighlights()
    renderTaskList()
end

function updateTypeFilterHighlights()
    if not window then return end
    for _, tf in ipairs(TYPE_FILTERS) do
        local btn = window:getChildById(tf.id)
        if btn then
            if tf.value == currentType then
                btn:setImageColor('#ffd700')
            else
                btn:setImageColor('#dfdfdf')
            end
        end
    end
end

function getActiveTasksCount()
    local count = 0
    for _, pt in ipairs(playerTasks) do
        if pt.rewarded ~= 1 then
            count = count + 1
        end
    end
    return count
end

function getActiveTasksList()
    local active = {}
    for _, pt in ipairs(playerTasks) do
        if pt.rewarded ~= 1 then
            local task = findTaskConfig(pt.id)
            if task then
                table.insert(active, task)
            end
        end
    end
    return active
end

function renderTaskList()
    if not window then return end

    local detail = window:getChildById('detailPanel')
    if detail then
        detail:setVisible(false)
        pcall(function() detail:scrollToTop() end)
    end
    local detailScroll = window:getChildById('detailScroll')
    if detailScroll then detailScroll:setVisible(false) end
    local taskList = window:getChildById('taskList')
    if taskList then
        taskList:setVisible(true)
        taskList:destroyChildren()
    else
        return
    end

    local taskCount = window:getChildById('taskCount')
    if taskCount then
        local active = getActiveTasksCount()
        taskCount:setText('Active Tasks: ' .. active)
    end

    local filtered = {}
    for _, task in ipairs(allTasks) do
        if task.category == currentTab and (not currentType or task.type == currentType) then
            table.insert(filtered, task)
        end
    end

    table.sort(filtered, function(a, b)
        local orderA = DIFFICULTY_ORDER[a.difficulty] or 99
        local orderB = DIFFICULTY_ORDER[b.difficulty] or 99
        return orderA < orderB
    end)

    if #filtered == 0 then
        local label = g_ui.createWidget('Label', taskList)
        label:setText('No tasks available for this category.')
        label:setColor('#aaaaaa')
        label:setFont('verdana-11px-rounded')
        return
    end

    for i = 1, #filtered, CARDS_PER_ROW do
        local row = g_ui.createWidget('Panel', taskList)
        row:setLayout(UIHorizontalLayout.create(row))
        row:setHeight(156)

        for j = i, math.min(i + CARDS_PER_ROW - 1, #filtered) do
            local task = filtered[j]
            local entry = g_ui.createWidget('TaskEntry', row)
            entry:setId(task.id)

            local playerTask = findPlayerTask(task.id)
            local isActive = playerTask ~= nil and playerTask.rewarded ~= 1
            local isCompleted = playerTask ~= nil and playerTask.completed == 1 and playerTask.rewarded == 0

            local creature = entry:getChildById('creature')
            if creature then
                creature:setOutfit({ type = task.lookType or 21 })
            end

            local nameLabel = entry:getChildById('name')
            if nameLabel then
                nameLabel:setText(task.name)
            end

            local badge = entry:getChildById('difficultyBadge')
            if badge then
                badge:setText(DIFFICULTY_NAMES[task.difficulty] or task.difficulty)
                badge:setColor(DIFFICULTY_COLORS[task.difficulty] or '#ffffff')
            end

            local progressFill = entry:getChildById('progressFill')
            local progressBar = entry:getChildById('progress')

            local statusLabel = entry:getChildById('status')
            if statusLabel then
                if isCompleted then
                    statusLabel:setText('COMPLETED')
                    statusLabel:setColor('#00ff00')
                    if progressFill and progressBar then
                        progressFill:setWidth(math.max(progressBar:getWidth() - 4, 0))
                    end
                elseif isActive then
                    statusLabel:setText('Active')
                    statusLabel:setColor('#00ccff')
                    if progressFill and progressBar and playerTask then
                        local total = task.kills or 1
                        local done = playerTask.done or 0
                        local pct = math.min(done / total, 1)
                        local barWidth = math.max(progressBar:getWidth() - 4, 1)
                        progressFill:setWidth(math.floor(barWidth * pct))
                    end
                elseif task.locked then
                    statusLabel:setText('Locked')
                    statusLabel:setColor('#666666')
                    if progressFill then progressFill:setWidth(0) end
                else
                    statusLabel:setText('Available')
                    statusLabel:setColor('#00ff00')
                    if progressFill then progressFill:setWidth(0) end
                end
            end

            entry.onClick = function()
                selectTask(task.id)
            end
            entry.onDoubleClick = function()
                if not isActive and not task.locked then
                    startTask(task.id)
                end
            end
        end
    end

    updateQuestProgress()
end

function selectTask(taskId)
    selectedTaskId = taskId
    local task = findTaskConfig(taskId)
    if not task then return end

    local taskList = window:getChildById('taskList')
    if taskList then taskList:setVisible(false) end

    local detail = window:getChildById('detailPanel')
    if not detail then return end
    detail:setVisible(true)
    local detailScroll = window:getChildById('detailScroll')
    if detailScroll then detailScroll:setVisible(true) end

    pcall(function() detail:scrollToTop() end)

    local function setText(id, text)
        local w = detail:getChildById(id)
        if w then w:setText(text) end
    end

    -- Monster looktype and name
    local monsterLookType = task.lookType or 21
    local monsterName = ''
    local monsterLevel = nil
    local monsterHp = nil
    local monsterExp = nil
    local monsterTypeStr = nil
    local monsterWeak = nil
    local monsterRes = nil
    local monsterSize = nil

    if task.monsterExtra and type(task.monsterExtra) == 'table' and #task.monsterExtra > 0 then
        local first = task.monsterExtra[1]
        if first.lookType then monsterLookType = first.lookType end
        monsterName = first.name or ''
        monsterLevel = first.level
        monsterHp = first.hp
        monsterExp = first.exp
        monsterTypeStr = first.type
        monsterSize = first.size
        monsterWeak = first.weaknesses
        monsterRes = first.resistances
    elseif task.monsters and #task.monsters > 0 then
        monsterName = task.monsters[1]
    end
    if #(task.monsters or {}) > 1 then
        monsterName = monsterName .. ' +' .. (#task.monsters - 1)
    end

    -- Use monsterDetails for size/level if not in monsterExtra
    if (not monsterLevel or not monsterSize) and task.monsterDetails and #task.monsterDetails > 0 then
        local md = task.monsterDetails[1]
        if not monsterLevel and md.level then monsterLevel = md.level end
        if not monsterSize and md.size then monsterSize = md.size end
    end

    local detailCreature = detail:getChildById('detailCreature')
    if detailCreature then
        detailCreature:setOutfit({ type = monsterLookType })
    end
    setText('detailMonsterName', 'Name: ' .. monsterName)

    -- Difficulty
    local diffName = DIFFICULTY_NAMES[task.difficulty] or task.difficulty
    setText('detailDifficulty', 'Difficulty: ' .. diffName)
    local diffLabel = detail:getChildById('detailDifficulty')
    if diffLabel then
        diffLabel:setColor(DIFFICULTY_COLORS[task.difficulty] or '#ffffff')
    end

    -- Level Required
    setText('detailLevel', 'Level Required: ' .. (task.levelRequired or 1))

    -- Monster Level
    if monsterLevel then
        setText('detailMonsterLevel', 'Monster Level: ' .. monsterLevel)
    else
        setText('detailMonsterLevel', '')
    end

    -- Monster Size
    if monsterSize then
        setText('detailMonsterSize', 'Size: ' .. monsterSize)
    else
        setText('detailMonsterSize', '')
    end

    -- Type (task type)
    local typeStr = task.type and task.type:sub(1, 1):upper() .. task.type:sub(2) or ''
    setText('detailType', 'Type: ' .. typeStr)

    -- Monster Type
    if monsterTypeStr then
        setText('detailMonsterType', 'Monster Type: ' .. monsterTypeStr)
    else
        setText('detailMonsterType', '')
    end

    -- HP
    if monsterHp then
        setText('detailHp', 'HP: ' .. formatExp(monsterHp))
    else
        setText('detailHp', '')
    end

    -- EXP
    if monsterExp then
        setText('detailExp', 'EXP: ' .. formatExp(monsterExp))
    else
        setText('detailExp', '')
    end

    -- Encounter chance
    local chanceStr = ''
    if task.encounterChance then
        chanceStr = 'Chance: ' .. task.encounterChance .. '%'
    elseif task.monsterDetails and task.monsterDetails[1] and task.monsterDetails[1].probability then
        chanceStr = 'Chance: ' .. task.monsterDetails[1].probability .. '%'
    end
    setText('detailChance', chanceStr)

    -- Area / Location
    local areaStr = ''
    if task.primaryArea then
        areaStr = 'Area: ' .. task.primaryArea
    elseif task.spawns and type(task.spawns) == 'table' and #task.spawns > 0 then
        local s = task.spawns[1]
        areaStr = 'Area: ' ..
        (s.area or '') .. ' (' .. (s.x or '?') .. ', ' .. (s.y or '?') .. ', ' .. (s.z or '?') .. ')'
    end
    setText('detailArea', areaStr)

    -- Weaknesses
    if monsterWeak and #monsterWeak > 0 then
        setText('detailWeakness', 'Weak: ' .. table.concat(monsterWeak, '/'))
    else
        setText('detailWeakness', '')
    end

    -- Resistances
    if monsterRes and #monsterRes > 0 then
        setText('detailResist', 'Resist: ' .. table.concat(monsterRes, '/'))
    else
        setText('detailResist', '')
    end

    -- Progress
    local playerTask = findPlayerTask(taskId)
    local isActive = playerTask ~= nil and playerTask.rewarded ~= 1
    local isCompleted = playerTask ~= nil and playerTask.completed == 1 and playerTask.rewarded == 0

    local progBar = detail:getChildById('detailProgressBar')
    local progFill = progBar and progBar:getChildById('detailProgressFill')

    if isActive and playerTask then
        local done = playerTask.done or 0
        local kills = task.kills or 1
        local pct = math.floor((done / kills) * 100)
        setText('detailProgress', 'Progress: ' .. done .. '/' .. kills .. ' (' .. pct .. '%)')
        if progFill and progBar then
            local barWidth = math.max(progBar:getWidth() - 4, 1)
            progFill:setWidth(math.floor(math.max(barWidth, 0) * done / kills))
        end
    elseif isCompleted then
        local kills = task.kills or 1
        setText('detailProgress', 'Progress: ' .. kills .. '/' .. kills .. ' (100%)')
        if progFill and progBar then
            progFill:setWidth(math.max(progBar:getWidth() - 4, 0))
        end
    else
        setText('detailProgress', 'Progress: 0/' .. (task.kills or 0) .. ' (0%)')
        if progFill then progFill:setWidth(0) end
    end

    -- Status
    local statusText = ''
    if isCompleted then
        statusText = 'Status: Completed'
    elseif isActive then
        statusText = 'Status: Active'
    elseif task.locked then
        statusText = 'Status: Locked'
    else
        statusText = 'Status: Available'
    end
    setText('detailStatus', statusText)

    -- Rank Required
    setText('detailRankRequired', 'Rank Required: ' .. (task.rankRequired or 0) .. ' pts')

    -- Points
    local pointsText = 'Task Points: ' .. (task.points or 0)
    if g_taskRankData.pointsPerDifficulty and task.difficulty then
        local earn = g_taskRankData.pointsPerDifficulty[task.difficulty]
        if earn then
            pointsText = pointsText .. ' (earn ' .. earn .. ')'
        end
    end
    setText('detailPoints', pointsText)

    -- Delivery
    local deliveryStr = ''
    if task.delivery and task.delivery.items and #task.delivery.items > 0 then
        deliveryStr = 'Delivery: '
        for i, item in ipairs(task.delivery.items) do
            deliveryStr = deliveryStr .. (item[2] or 1) .. 'x ' .. (getItemName(item[1]) or 'Item #' .. item[1])
            if i < #task.delivery.items then deliveryStr = deliveryStr .. ', ' end
        end
    end
    setText('detailDelivery', deliveryStr)

    -- Rewards
    if task.rewards and task.rewards.items and #task.rewards.items > 0 then
        local itemsStr = 'Rewards: '
        for i, item in ipairs(task.rewards.items) do
            itemsStr = itemsStr .. (item[2] or 1) .. 'x ' .. (getItemName(item[1]) or 'Item #' .. item[1])
            if i < #task.rewards.items then itemsStr = itemsStr .. ', ' end
        end
        setText('detailRewards', itemsStr)
    else
        setText('detailRewards', '')
    end

    -- Localization
    if task.primaryArea then
        setText('detailLocalization', task.primaryArea)
    elseif task.spawns and type(task.spawns) == 'table' and #task.spawns > 0 then
        setText('detailLocalization', task.spawns[1].area or 'Unknown')
    else
        setText('detailLocalization', 'Unknown')
    end

    -- Map preview
    renderMapPreview(task, detail)

    -- 3-button logic
    local startBtn = detail:getChildById('startTaskButton')
    local cancelBtn = detail:getChildById('cancelTaskButton')
    local claimBtn = detail:getChildById('claimRewardsButton')

    if isCompleted then
        if startBtn then
            startBtn:setText('Completed')
            startBtn:setEnabled(false)
            startBtn:setOpacity(0.5)
        end
        if cancelBtn then
            cancelBtn:setEnabled(false)
            cancelBtn:setOpacity(0.5)
        end
        if claimBtn then
            claimBtn:setEnabled(true)
            claimBtn:setOpacity(1.0)
            claimBtn:setImageColor('#00ff00')
        end
    elseif isActive then
        if startBtn then
            startBtn:setText('In Progress')
            startBtn:setEnabled(false)
            startBtn:setOpacity(0.5)
        end
        if cancelBtn then
            cancelBtn:setEnabled(true)
            cancelBtn:setOpacity(1.0)
            cancelBtn:setImageColor('#dfdfdf')
        end
        if claimBtn then
            claimBtn:setEnabled(false)
            claimBtn:setOpacity(0.5)
            claimBtn:setImageColor('#004400')
        end
    elseif task.locked then
        if startBtn then
            startBtn:setText('Locked')
            startBtn:setEnabled(false)
            startBtn:setOpacity(0.5)
        end
        if cancelBtn then
            cancelBtn:setEnabled(false)
            cancelBtn:setOpacity(0.5)
        end
        if claimBtn then
            claimBtn:setEnabled(false)
            claimBtn:setOpacity(0.5)
            claimBtn:setImageColor('#004400')
        end
    else
        if startBtn then
            startBtn:setText('Start Task')
            startBtn:setEnabled(true)
            startBtn:setOpacity(1.0)
            startBtn:setImageColor('#00ff00')
        end
        if cancelBtn then
            cancelBtn:setEnabled(false)
            cancelBtn:setOpacity(0.5)
        end
        if claimBtn then
            claimBtn:setEnabled(false)
            claimBtn:setOpacity(0.5)
            claimBtn:setImageColor('#004400')
        end
    end
end

function renderMapPreview(task, detail)
    if not detail then return end
    local mapImage = detail:getChildById('detailMapImage')
    local mapContainer = detail:getChildById('detailMapContainer')
    if not mapImage then return end
    if not mapContainer then return end

    mapContainer:setVisible(true)
    mapImage:setVisible(true)

    -- Opcao 1: Imagem estatica configurada
    if task.image and g_resources.fileExists(task.image) then
        mapImage:setImageSource(task.image)
        return
    end

    -- Opcao 2: Tentar gerar preview automatico do mapa
    if task.spawns and type(task.spawns) == 'table' and #task.spawns > 0 then
        local s = task.spawns[1]
        if s.x and s.y and s.z then
            local minimap = nil
            local ok = pcall(function()
                minimap = g_map.getMinimapImage({ x = s.x, y = s.y, z = s.z }, 128, 128)
            end)
            if ok and minimap then
                mapImage:setImageSource(minimap)
                return
            end
        end
    end

    -- Fallback: texto de localizacao
    local areaText = 'Unknown'
    if task.primaryArea then
        areaText = task.primaryArea
    elseif task.spawns and type(task.spawns) == 'table' and #task.spawns > 0 then
        areaText = task.spawns[1].area or 'Unknown'
    end
    mapImage:setImageSource('')
    local placeholder = detail:getChildById('detailMapPlaceholder')
    if placeholder then
        placeholder:setText(areaText)
        placeholder:setVisible(true)
    end
end

function startTaskClick()
    if not selectedTaskId then return end
    startTask(selectedTaskId)
    local detail = window and window:getChildById('detailPanel')
    if detail then
        local btn = detail:getChildById('startTaskButton')
        if btn then
            btn:setText('Started')
            btn:setEnabled(false)
            btn:setOpacity(0.5)
        end
    end
end

function cancelTaskClick()
    if not selectedTaskId then return end
    abortTask(selectedTaskId)
end

function claimRewardsClick()
    if not selectedTaskId then return end
    completeTask(selectedTaskId)
end

function findPlayerTask(taskId)
    for _, pt in ipairs(playerTasks) do
        if pt.id == taskId then
            return pt
        end
    end
    return nil
end

function findTaskConfig(taskId)
    for _, task in ipairs(allTasks) do
        if task.id == taskId then
            return task
        end
    end
    return nil
end

function startTask(taskId)
    if not taskId then taskId = selectedTaskId end
    if not taskId then return end

    sendOpcode(json.encode({
        action = 'start',
        taskId = taskId
    }))
end

function completeTask(taskId)
    if not taskId then taskId = selectedTaskId end
    if not taskId then return end

    sendOpcode(json.encode({
        action = 'complete',
        taskId = taskId
    }))
end

function abortTask(taskId)
    if not taskId then taskId = selectedTaskId end
    if not taskId then return end

    local yesFunc = function()
        sendOpcode(json.encode({
            action = 'cancel',
            taskId = taskId
        }))
        selectedTaskId = nil
        renderTaskList()
    end

    local noFunc = function() end

    displayGeneralBox(tr('Tasks'), tr('Do you really want to abort this task?'), {
        { text = tr('Yes'), callback = yesFunc },
        { text = tr('No'),  callback = noFunc },
        anchor = AnchorHorizontalCenter
    }, yesFunc, noFunc)
end

function updateTaskProgress(updateData)
    for i, pt in ipairs(playerTasks) do
        if pt.id == updateData.taskId then
            playerTasks[i].done = updateData.kills or 0
            if updateData.completed then
                playerTasks[i].completed = 1
            end
            renderTaskList()
            if selectedTaskId == updateData.taskId then
                selectTask(updateData.taskId)
            end
            return
        end
    end

    local task = findTaskConfig(updateData.taskId)
    if task then
        local pt = {
            id = updateData.taskId,
            done = updateData.kills or 0,
            kills = updateData.killsRequired or 1,
            completed = updateData.completed and 1 or 0,
            rewarded = 0
        }
        table.insert(playerTasks, pt)
        renderTaskList()
        if selectedTaskId == updateData.taskId then
            selectTask(updateData.taskId)
        end
    end
end

function showCompletePopup(completeData)
    local text = 'TASK COMPLETE!\n\n'
    local pointsText = ''
    if completeData.points then
        pointsText = '+' .. completeData.points .. ' Task Points'
        text = text .. pointsText .. '\n'
    end
    if completeData.exp then text = text .. '+' .. formatExp(completeData.exp) .. ' EXP\n' end
    if completeData.money and completeData.money > 0 then text = text ..
        '+' .. formatMoney(completeData.money) .. ' gold\n' end

    text = text .. '\nReturn to Taskerman to claim your reward.'

    displayGeneralBox(tr('Task Complete!'), tr(text), {
        { text = tr('OK'), callback = function() end, anchor = AnchorHorizontalCenter }
    })
end

function updateRankDisplay()
    if not window then return end

    local rankPanel = window:getChildById('rankPanel')
    if not rankPanel then return end

    local name = g_taskRankData.name or ''
    local points = g_taskRankData.points or 0
    local nextRankName = g_taskRankData.nextRank or ''
    local pointsToNext = g_taskRankData.pointsToNext or 0
    local pointsInThisRank = g_taskRankData.pointsInThisRank or 0
    local pointsToNextMax = g_taskRankData.pointsToNextMax or 1
    local category = g_taskRankData.category or 'dragonball'

    local color = '#ffffff'
    if RANK_COLORS[category] and RANK_COLORS[category][name] then
        color = RANK_COLORS[category][name]
    end

    rankPanel:getChildById('rankName'):setText(name)
    rankPanel:getChildById('rankName'):setColor(color)
    rankPanel:getChildById('rankPoints'):setText('Task Points: ' .. points)

    if nextRankName and nextRankName ~= '' and nextRankName ~= name then
        rankPanel:getChildById('nextRank'):setText('Next: ' .. nextRankName .. ' (' .. pointsToNext .. ' pts away)')
    else
        rankPanel:getChildById('nextRank'):setText('MAX RANK')
    end

    local rankProgFill = window:getChildById('rankProgFill')
    local rankProgBar = window:getChildById('rankProgBar')
    if rankProgFill and rankProgBar then
        if pointsToNextMax > 0 and nextRankName ~= name then
            local pct = math.min(pointsInThisRank / pointsToNextMax, 1)
            local barWidth = math.max(rankProgBar:getWidth(), 300)
            rankProgFill:setWidth(math.floor(barWidth * pct))
        elseif rankProgFill then
            rankProgFill:setWidth(pointsToNextMax > 0 and math.floor(math.max(rankProgBar:getWidth(), 300)) or 0)
        end
    end
end

function updateQuestProgress()
    if not window then return end

    local questProgFill = window:getChildById('questProgFill')
    local questProgBar = window:getChildById('questProgBar')
    if not questProgFill or not questProgBar then return end

    local totalPct = 0
    local activeCount = 0
    for _, pt in ipairs(playerTasks) do
        if pt.completed ~= 1 and pt.rewarded ~= 1 then
            local task = findTaskConfig(pt.id)
            if task then
                local total = task.kills or 1
                local done = pt.done or 0
                totalPct = totalPct + math.min(done / total, 1)
                activeCount = activeCount + 1
            end
        end
    end

    if activeCount > 0 then
        local avgPct = totalPct / activeCount
        local barWidth = math.max(questProgBar:getWidth(), 300)
        questProgFill:setWidth(math.floor(barWidth * avgPct))
    end
end

function showInfo(text, color)
    if not window then return end
    window:getChildById('info'):setText(text)
    window:getChildById('info'):setColor(color or 'white')
end

function formatExp(exp)
    if not exp then return '0' end
    if exp >= 1000000 then
        return string.format('%.1fM', exp / 1000000)
    elseif exp >= 1000 then
        return string.format('%.1fK', exp / 1000)
    end
    return tostring(exp)
end

function formatMoney(money)
    if not money then return '0' end
    if money >= 1000000 then
        return string.format('%.1fM', money / 1000000)
    elseif money >= 1000 then
        return string.format('%.1fK', money / 1000)
    end
    return tostring(money)
end

function getItemName(itemId)
    if not itemId or itemId == 0 then return 'Unknown' end
    local itemType = g_things.getItemType(itemId)
    if itemType then
        local clientId = itemType:getClientId()
        if clientId and clientId > 0 then
            local item = Item.create(clientId)
            if item then
                local name = item:getName()
                if name and name ~= '' then
                    return name
                end
            end
        end
    end
    return 'Item #' .. itemId
end
