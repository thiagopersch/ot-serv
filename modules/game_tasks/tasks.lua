local window = nil
local taskButton = nil
local currentTab = nil
local currentType = nil
local allTasks = {}
local playerTasks = {}
local selectedTaskId = nil
local currentPage = 1
local totalPages = 1
local totalTasks = 0
local searchText = ""
local searchDebounce = nil
g_taskRankData = g_taskRankData or {}
g_taskUI = g_taskUI or {}
g_taskCategoryCounts = g_taskCategoryCounts or { dragonball = 0, bleach = 0 }

local function showLoading()
    if not window then return end
    local loadingLabel = window:getChildById('loadingLabel')
    local taskList = window:getChildById('taskList')
    if loadingLabel then loadingLabel:show() end
    if taskList then taskList:hide() end
end

local function hideLoading()
    if not window then return end
    local loadingLabel = window:getChildById('loadingLabel')
    local taskList = window:getChildById('taskList')
    if loadingLabel then loadingLabel:hide() end
    if taskList then taskList:show() end
end

local function detectUniverse()
    local player = g_game.getLocalPlayer()
    if not player then return 'dragonball' end
    local voc = player:getVocation()
    if voc >= 1 and voc <= 45 then return 'dragonball' end
    if voc >= 47 and voc <= 67 then return 'bleach' end
    return 'dragonball'
end

json = json or g_json

local CARDS_PER_ROW = 5

local DIFFICULTY_COLORS = {
    easy   = "#00ff00",
    medium = "#ffff00",
    hard   = "#ff6600",
    elite  = "#ff0000"
}

local DIFFICULTY_NAMES = {
    easy   = "Easy",
    medium = "Medium",
    hard   = "Hard",
    elite  = "Elite"
}

local DIFFICULTY_ORDER = {
    easy   = 1,
    medium = 2,
    hard   = 3,
    elite  = 4
}

local RANK_COLORS = {
    dragonball = {
        Unranked               = "#666666",
        Citizen                = "#aaaaaa",
        Veteran                = "#cd7f32",
        Master                 = "#c0c0c0",
        Professional           = "#ffd700",
        Elite                  = "#b9f2ff",
        Legendary              = "#ff6b6b",
        Immortal               = "#ff0000",
        Hero                   = "#ff4500",
        ["God of Destruction"] = "#8b00ff",
        ["God of Creation"]    = "#00bfff",
        ["Supreme God"]        = "#ffd700"
    },
    bleach = {
        Unranked              = "#666666",
        Human                 = "#aaaaaa",
        Hollow                = "#cd7f32",
        Shinigami             = "#c0c0c0",
        Vaizard               = "#ffd700",
        Arrancar              = "#b9f2ff",
        Espada                = "#ff6b6b",
        Captain               = "#ff0000",
        ["Elite Captain"]     = "#ff4500",
        ["General Captain"]   = "#8b00ff",
        ["Head Captain"]      = "#00bfff",
        ["King of Shinigami"] = "#ffd700"
    }
}

local TYPE_FILTER_OPTIONS = {
    { label = "All Tasks",   value = nil },
    { label = "Kill",        value = "kill" },
    { label = "Delivery",    value = "delivery" },
    { label = "Saga",        value = "saga" },
    { label = "General",     value = "general" },
    { label = "Daily",       value = "daily" },
    { label = "Boss",        value = "boss" },
    { label = "Repeatable",  value = "repeatable" },
    { label = "Unique",      value = "unique" },
    { label = "Completed",   value = "completed" }
}

-- ============================================================
-- INIT / TERMINATE
-- ============================================================
function init()
    connect(g_game, {
        onGameStart = onGameStart,
        onGameEnd   = destroy
    })

    g_keyboard.bindKeyDown('Escape', close)

    taskButton = modules.client_topmenu.addRightGameToggleButton(
        'taskButton', tr('Tasks'), '/images/topbuttons/task', toggleWindow)

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
    currentPage = 1
    totalPages = 1
    totalTasks = 0
    searchText = ""
    currentTab = detectUniverse()
    currentType = nil
    if not window then
        window = g_ui.displayUI('tasks', modules.game_interface.getRightPanel())
        window:setVisible(false)

        initTypeFilterCombo()
        updateTabVisibility()

        local dp = window:getChildById('detailPanel')
        local tl = window:getChildById('taskList')
        if dp then dp:setVisible(false) end
        if tl then tl:setVisible(true) end

        -- Hide detail scroll initially
        local ds = window:getChildById('detailScroll')
        if ds then ds:setVisible(false) end

        -- Cache intermediate containers for reliable widget lookups
        if dp then
            g_taskUI.detail            = dp
            g_taskUI.topRow            = dp:getChildById('detailTopRow') or findChild(dp, 'detailTopRow')
            local tr                   = g_taskUI.topRow
            g_taskUI.leftPanel         = tr and (tr:getChildById('detailLeftPanel') or findChild(tr, 'detailLeftPanel'))
            g_taskUI.infoPanel         = tr and (tr:getChildById('detailInfoPanel') or findChild(tr, 'detailInfoPanel'))
            g_taskUI.topRewards        = tr and
            (tr:getChildById('detailTopRewards') or findChild(tr, 'detailTopRewards'))
            g_taskUI.buttonRow         = dp:getChildById('detailButtonRow') or findChild(dp, 'detailButtonRow')
            g_taskUI.progressBar       = dp:getChildById('detailProgressBar') or findChild(dp, 'detailProgressBar')
            g_taskUI.bottomRow         = dp:getChildById('detailBottomRow') or findChild(dp, 'detailBottomRow')
            local br                   = g_taskUI.bottomRow
            g_taskUI.monstersPanel     = br and
                (br:getChildById('detailMonstersPanel') or findChild(br, 'detailMonstersPanel'))
            g_taskUI.monstersContainer = br and
                (br:getChildById('detailMonstersContainer') or findChild(br, 'detailMonstersContainer'))
        end
    end
    scheduleEvent(sendRequest, 100)
end

function sendRequest()
    local p = g_game.getProtocolGame()
    if p then
        sendListRequest()
    end
end

function sendListRequest()
    showLoading()
    local params = {
        action = "list",
        page = currentPage,
        pageSize = 20,
        search = searchText,
        type = currentType or "",
        difficulty = "",
        category = currentTab or "dragonball"
    }
    local pg = g_game.getProtocolGame()
    if pg then
        pg:sendExtendedOpcode(215, json.encode(params))
    end
end

function destroy()
    if window then
        window:destroy()
        window = nil
    end
end

-- ============================================================
-- OPCODE
-- ============================================================
function parseOpcode(protocol, opcode, data)
    local decoded = data
    if type(data) == 'string' then
        local ok, result = pcall(json.decode, data)
        if ok then decoded = result else return end
    end

    if decoded.allTasks then
        hideLoading()
        allTasks             = decoded.allTasks
        playerTasks          = decoded.playerTasks or {}
        totalPages           = decoded.totalPages or 1
        totalTasks           = decoded.totalTasks or 0
        currentPage          = decoded.currentPage or 1
        g_taskRankData       = decoded.rank or {}
        g_taskCategoryCounts = decoded.categoryCounts or { dragonball = 0, bleach = 0 }
        if decoded.playerCategory then
            currentTab = decoded.playerCategory
            updateTabVisibility()
        end
        updatePaginationDisplay()
        renderTaskList()
        updateRankDisplay()
        if selectedTaskId then
            selectTask(selectedTaskId)
        end
    elseif decoded.update then
        updateTaskProgress(decoded.update)
    elseif decoded.complete then
        showCompletePopup(decoded.complete)
    elseif decoded.message then
        showInfo(decoded.message, decoded.color or 'white')
    elseif decoded.rankUpdate then
        g_taskRankData = decoded.rankUpdate
        updateRankDisplay()
        local pm = modules.game_player_profile
        if pm and pm.InspectWindow and pm.InspectWindow:isVisible() then
            pm.updateProfile()
        end
    end
end

function sendOpcode(data)
    local pg = g_game.getProtocolGame()
    if pg then pg:sendExtendedOpcode(215, data) end
end

-- ============================================================
-- JANELA
-- ============================================================
function toggleWindow()
    if not g_game.isOnline() then return end
    if not window then return end
    if window:isVisible() then
        close()
    else
        currentPage = 1
        searchText = ""
        local searchBar = window:getChildById('searchBar')
        local searchInput = searchBar and searchBar:getChildById('searchInput')
        if searchInput then searchInput:setText('') end
        sendListRequest()
        window:setVisible(true)
        window:focus()
    end
end

function backToList()
    deselectTask()
    currentPage = 1
    searchText = ""
    local searchBar = window and window:getChildById('searchBar')
    local searchInput = searchBar and searchBar:getChildById('searchInput')
    if searchInput then searchInput:setText('') end
    sendListRequest()
end

function close()
    if not window then return end
    selectedTaskId = nil
    currentPage = 1
    searchText = ""
    local searchBar = window:getChildById('searchBar')
    local searchInput = searchBar and searchBar:getChildById('searchInput')
    if searchInput then searchInput:setText('') end
    window:setVisible(false)
end

-- ============================================================
-- TABS / FILTROS
-- ============================================================
function updateTabVisibility()
    if not window then return end
    local dbTab = window:getChildById('tabDragonBall')
    local bTab = window:getChildById('tabBleach')
    if not dbTab or not bTab then return end
    if currentTab == 'dragonball' then
        dbTab:setImageColor('#ffd700')
        dbTab:setVisible(true)
        bTab:setVisible(false)
    else
        bTab:setImageColor('#ffd700')
        bTab:setVisible(true)
        dbTab:setVisible(false)
    end
end

function initTypeFilterCombo()
    if not window then return end
    local searchBar = window:getChildById('searchBar')
    local combo = searchBar and searchBar:getChildById('typeFilter')
    if not combo then return end
    combo:clearOptions()
    for _, opt in ipairs(TYPE_FILTER_OPTIONS) do
        combo:addOption(opt.label, opt.value)
    end
end

function onTypeFilterChanged()
    local searchBar = window and window:getChildById('searchBar')
    local combo = searchBar and searchBar:getChildById('typeFilter')
    if not combo then return end
    local option = combo:getCurrentOption()
    if not option then return end
    local data = option.data
    if currentType == data then return end
    deselectTask()
    setTypeFilter(data)
end

function deselectTask()
    selectedTaskId = nil
    if not window then return end
    local detail = window:getChildById('detailPanel')
    if detail then detail:setVisible(false) end
    local detailScroll = window:getChildById('detailScroll')
    if detailScroll then detailScroll:setVisible(false) end
    local taskScroll = window:getChildById('taskScroll')
    if taskScroll then taskScroll:setVisible(true) end
    local taskList = window:getChildById('taskList')
    if taskList then taskList:setVisible(true) end
    local searchBar = window:getChildById('searchBar')
    if searchBar then searchBar:setVisible(true) end
    local paginationBar = window:getChildById('paginationBar')
    if paginationBar then paginationBar:setVisible(true) end
end

function switchTab(category)
    if category ~= detectUniverse() then return end
    deselectTask()
    currentTab        = category
    currentType       = nil
    currentPage       = 1
    searchText        = ""
    local searchBar   = window and window:getChildById('searchBar')
    local searchInput = searchBar and searchBar:getChildById('searchInput')
    if searchInput then searchInput:setText('') end
    updateTabVisibility()
    local combo = searchBar and searchBar:getChildById('typeFilter')
    if combo then combo:setCurrentOption('All Tasks', true) end
    sendListRequest()
end

function setTypeFilter(filterType)
    if currentType == filterType then return end
    currentType = filterType
    currentPage = 1
    sendListRequest()
end

-- ============================================================
-- SEARCH
-- ============================================================
function onSearchChanged(text)
    if searchText == text then return end
    searchText = text
    currentPage = 1
    if searchDebounce then
        removeEvent(searchDebounce)
    end
    searchDebounce = scheduleEvent(sendListRequest, 100)
end

-- ============================================================
-- PAGINATION
-- ============================================================
function updatePaginationDisplay()
    if not window then return end
    local pageLabel = findChild(window, 'pageLabel')
    if pageLabel then
        pageLabel:setText('Page ' .. currentPage .. ' of ' .. totalPages)
    end
    local totalLabel = findChild(window, 'totalTasksLabel')
    if totalLabel then
        totalLabel:setText(totalTasks .. ' tasks found')
    end
    local prevBtn = findChild(window, 'prevPageBtn')
    local nextBtn = findChild(window, 'nextPageBtn')
    if prevBtn then
        prevBtn:setEnabled(currentPage > 1)
        prevBtn:setOpacity(currentPage > 1 and 1.0 or 0.4)
    end
    if nextBtn then
        nextBtn:setEnabled(currentPage < totalPages)
        nextBtn:setOpacity(currentPage < totalPages and 1.0 or 0.4)
    end
end

function prevPage()
    if currentPage > 1 then
        currentPage = currentPage - 1
        sendListRequest()
    end
end

function nextPage()
    if currentPage < totalPages then
        currentPage = currentPage + 1
        sendListRequest()
    end
end

-- ============================================================
-- HELPERS
-- ============================================================
function getActiveTasksCount()
    local count = 0
    for _, pt in ipairs(playerTasks) do
        if pt.rewarded ~= 1 then count = count + 1 end
    end
    return count
end

function findPlayerTask(taskId)
    for _, pt in ipairs(playerTasks) do
        if pt.id == taskId then return pt end
    end
    return nil
end

function findTaskConfig(taskId)
    for _, task in ipairs(allTasks) do
        if task.id == taskId then return task end
    end
    return nil
end

function isRepeatable(task)
    if not task then return false end
    return task.repeatable == true
        or task.type == "repeatable"
        or task.type == "daily"
        or (task.daily and task.daily.enabled)
end

-- ============================================================
-- RENDER LISTA DE TASKS (página inicial)
-- ============================================================
function renderTaskList()
    if not window then return end

    -- Hide detail panel, show list
    local detail = window:getChildById('detailPanel')
    if detail then detail:setVisible(false) end
    local detailScroll = window:getChildById('detailScroll')
    if detailScroll then detailScroll:setVisible(false) end
    local taskScroll = window:getChildById('taskScroll')
    if taskScroll then taskScroll:setVisible(true) end

    -- Show search and pagination bars
    local searchBar = window:getChildById('searchBar')
    if searchBar then searchBar:setVisible(true) end
    local paginationBar = window:getChildById('paginationBar')
    if paginationBar then paginationBar:setVisible(true) end

    local taskList = window:getChildById('taskList')
    if not taskList then return end
    taskList:setVisible(true)
    taskList:destroyChildren()

    -- Active task count
    local taskCount = window:getChildById('taskCount')
    if taskCount then
        taskCount:setText('Active Tasks: ' .. getActiveTasksCount())
    end

    -- Update tab labels with available task counts from server
    local dbTab = window:getChildById('tabDragonBall')
    local bTab = window:getChildById('tabBleach')
    if dbTab then
        dbTab:setText('Dragon Ball (' .. (g_taskCategoryCounts.dragonball or 0) .. ')')
    end
    if bTab then
        bTab:setText('Bleach (' .. (g_taskCategoryCounts.bleach or 0) .. ')')
    end

    if #allTasks == 0 then
        local label = g_ui.createWidget('Label', taskList)
        if totalTasks == 0 then
            label:setText('No tasks available for this category.')
        elseif searchText ~= "" then
            label:setText('No tasks match your search.')
        elseif currentType then
            label:setText('No ' .. currentType .. ' tasks available.')
        else
            label:setText('All tasks are locked. Increase your level and rank points.')
        end
        label:setColor('#aaaaaa')
        label:setFont('verdana-11px-rounded')
        return
    end

    -- Renderiza cards em linhas
    for i = 1, #allTasks, CARDS_PER_ROW do
        local row = g_ui.createWidget('Panel', taskList)
        row:setLayout(UIHorizontalLayout.create(row))
        row:setHeight(170)

        for j = i, math.min(i + CARDS_PER_ROW - 1, #allTasks) do
            local task  = allTasks[j]
            local entry = g_ui.createWidget('TaskEntry', row)
            entry:setId(task.id)

            local playerTask  = findPlayerTask(task.id)
            local isActive    = playerTask ~= nil and playerTask.rewarded ~= 1
            local isCompleted = playerTask ~= nil and playerTask.completed == 1 and playerTask.rewarded == 0
            local isRewarded  = task.isRewarded or (playerTask ~= nil and playerTask.rewarded == 1)

            -- Looktype do monstro
            local creature    = entry:getChildById('creature')
            if creature then
                creature:setOutfit({ type = task.lookType or 21 })
            end

            -- Dificuldade
            local badge = entry:getChildById('difficultyBadge')
            if badge then
                badge:setText(DIFFICULTY_NAMES[task.difficulty] or task.difficulty)
                badge:setColor(DIFFICULTY_COLORS[task.difficulty] or '#ffffff')
            end

            -- Nome e Tipo
            local nameLabel = entry:getChildById('name')
            if nameLabel then nameLabel:setText(task.name) end

            local typeLabel = entry:getChildById('taskType')
            if typeLabel then
                local t = task.type or "unknown"
                typeLabel:setText('Type: ' .. t:sub(1,1):upper() .. t:sub(2))
            end

            -- Repeatable
            local repLabel = entry:getChildById('repeatable')
            if repLabel then
                local rep = isRepeatable(task)
                repLabel:setText('Repeatable: ' .. (rep and 'Yes' or 'No'))
                repLabel:setColor(rep and '#debc09' or '#aaaaaa')
            end

            -- Status
            local statusLabel  = entry:getChildById('status')
            if statusLabel then
                if isCompleted then
                    statusLabel:setText('COMPLETED')
                    statusLabel:setColor('#00ff00')
                elseif isActive then
                    statusLabel:setText('Active')
                    statusLabel:setColor('#00ccff')
                elseif isRewarded and not isRepeatable(task) then
                    statusLabel:setText('Finished')
                    statusLabel:setColor('#aaaaaa')
                elseif task.locked then
                    statusLabel:setText('Locked')
                    statusLabel:setColor('#666666')
                else
                    statusLabel:setText('Available')
                    statusLabel:setColor('#00ff00')
                end
            end

            entry.onClick = function()
                selectTask(task.id)
            end
            entry.onDoubleClick = function()
                if not isActive and not task.locked and not (isRewarded and not isRepeatable(task)) then
                    local hasSameTypeActive = hasActiveTaskOfSameType(task.id)
                    if not hasSameTypeActive then
                        startTask(task.id)
                    end
                end
            end
        end
    end

    updateQuestProgress()
    updatePaginationDisplay()
end

-- ============================================================
-- WIDGET HELPER (recursive walk bypassing ScrollablePanel content panel)
-- ============================================================
function findChild(parent, id)
    for _, c in ipairs(parent:getChildren()) do
        if c:getId() == id then return c end
        local found = findChild(c, id)
        if found then return found end
    end
    return nil
end

-- ============================================================
-- PAINEL DE DETALHES
-- ============================================================
function selectTask(taskId)
    selectedTaskId = taskId
    local task = findTaskConfig(taskId)
    if not task then return end

    -- Toggle visibility
    local taskList = window:getChildById('taskList')
    if taskList then taskList:setVisible(false) end

    -- Hide search and pagination bars in detail view
    local searchBar = window:getChildById('searchBar')
    if searchBar then searchBar:setVisible(false) end
    local paginationBar = window:getChildById('paginationBar')
    if paginationBar then paginationBar:setVisible(false) end

    local detail = g_taskUI.detail or window:getChildById('detailPanel')
    if not detail then return end
    detail:setVisible(true)

    local detailScroll = window:getChildById('detailScroll')
    if detailScroll then detailScroll:setVisible(true) end

    local taskScroll = window:getChildById('taskScroll')
    if taskScroll then taskScroll:setVisible(false) end

    pcall(function() detail:scrollToTop() end)

    -- Use cached containers, fallback to window lookup
    local topRow         = g_taskUI.topRow or window:getChildById('detailTopRow')
    local leftPanel      = g_taskUI.leftPanel or (topRow and topRow:getChildById('detailLeftPanel'))
    local infoPanel      = g_taskUI.infoPanel or (topRow and topRow:getChildById('detailInfoPanel'))

    -- --------------------------------------------------------
    -- ESQUERDA: Looktype principal
    -- --------------------------------------------------------
    local detailCreature = leftPanel and leftPanel:getChildById('detailCreature')
    if detailCreature then
        detailCreature:setOutfit({ type = task.lookType or 21 })
    end

    -- --------------------------------------------------------
    -- DIREITA: Informações
    -- --------------------------------------------------------
    local function setText(id, text)
        local w = infoPanel and infoPanel:getChildById(id)
        if not w then w = findChild(detail, id) end
        if w then
            w:setText(tostring(text or ''))
            w:setVisible(true)
        end
    end

    setText('detailName', task.name or '')

    local diffName = DIFFICULTY_NAMES[task.difficulty] or task.difficulty or ''
    setText('detailDifficulty', 'Difficulty: ' .. diffName)
    local diffLabel = (infoPanel and infoPanel:getChildById('detailDifficulty')) or findChild(detail, 'detailDifficulty')
    if diffLabel then diffLabel:setColor(DIFFICULTY_COLORS[task.difficulty] or '#ffffff') end

    local catStr = task.category and (task.category:sub(1, 1):upper() .. task.category:sub(2)) or ''
    setText('detailCategory', 'Category: ' .. catStr)
    setText('detailLevel', 'Level Required: ' .. (task.levelRequired or 1))
    setText('detailRankRequired', 'Rank Required: ' .. (task.rankRequired or 0) .. ' pts')

    local killsReq = task.killsRequired or task.kills or 0
    setText('detailKillsRequired', 'Kills Required: ' .. killsReq)
    local actualPoints = task.points
    if g_taskRankData.pointsPerDifficulty and task.difficulty then
        actualPoints = g_taskRankData.pointsPerDifficulty[task.difficulty] or task.points
    end
    setText('detailPoints', 'Rank Points: +' .. (actualPoints or 0))
    setText('detailMoney', 'Gold Reward: ' .. formatMoney(task.money or 0) .. ' gold')

    local rep = isRepeatable(task)
    local repLabel = (infoPanel and infoPanel:getChildById('detailRepeatable')) or findChild(detail, 'detailRepeatable')
    if repLabel then
        repLabel:setText('Repeatable: ' .. (rep and 'Yes' or 'No'))
        repLabel:setColor(rep and '#00ff88' or '#aaaaaa')
    end

    -- --------------------------------------------------------
    -- RECOMPENSAS (painel superior direito)
    -- --------------------------------------------------------
    local rewardsPanel = g_taskUI.topRewards or findChild(detail, 'detailTopRewards')
    local goldLabel = rewardsPanel and rewardsPanel:getChildById('detailTopRewardsGold')
    if goldLabel then
        goldLabel:setText('Gold: ' .. formatMoney(task.money or 0))
    end
    local expLabel = rewardsPanel and rewardsPanel:getChildById('detailTopRewardsExp')
    if expLabel then
        expLabel:setText('XP: ' .. formatExp(task.exp or 0))
    end

    -- --------------------------------------------------------
    -- BARRA DE XP
    -- --------------------------------------------------------
    local playerTask  = findPlayerTask(taskId)
    local isActive    = playerTask ~= nil and playerTask.rewarded ~= 1
    local isCompleted = playerTask ~= nil and playerTask.completed == 1 and playerTask.rewarded == 0

    local expTotal    = task.exp or 0
    local done        = (playerTask and playerTask.done) or 0
    local kills       = killsReq > 0 and killsReq or 1
    local pctKills    = math.min(done / kills, 1)

    local isRewarded = task.isRewarded or (playerTask ~= nil and playerTask.rewarded == 1)
    if isRewarded then
        pctKills = 1
        done = kills
    end

    local expEarned   = math.floor(expTotal * pctKills)
    setText('detailXpLabel', 'XP: ' .. formatExp(expTotal))

    -- --------------------------------------------------------
    -- PROGRESSO DE KILLS
    -- --------------------------------------------------------
    local pct = (isCompleted or isRewarded) and 100 or (isActive and math.floor(pctKills * 100) or 0)
    setText('detailProgress', 'Progress: ' .. done .. '/' .. kills .. ' (' .. pct .. '%)')

    local progBar  = g_taskUI.progressBar or findChild(detail, 'detailProgressBar')
    local progFill = progBar and progBar:getChildById('detailProgressFill')
    if progFill and progBar then
        if isCompleted or isRewarded then
            progFill:setWidth(math.max(progBar:getWidth() - 4, 0))
        elseif isActive then
            local bw = math.max(progBar:getWidth() - 4, 1)
            progFill:setWidth(math.floor(bw * pctKills))
        else
            progFill:setWidth(0)
        end
    end

    -- Status
    local statusText = ''
    if isCompleted then
        statusText = 'Status: Completed'
    elseif isActive then
        statusText = 'Status: Active'
    elseif isRewarded and not isRepeatable(task) then
        statusText = 'Status: Finished'
    elseif task.locked then
        statusText = 'Status: Locked'
    else
        statusText = 'Status: Available'
    end
    setText('detailStatus', statusText)

    -- --------------------------------------------------------
    -- MONSTROS DETALHADOS + LOCALIZAÇÃO
    -- --------------------------------------------------------
    renderDetailMonsters(task, detail)

    -- --------------------------------------------------------
    -- BOTÕES
    -- --------------------------------------------------------
    local buttonRow = g_taskUI.buttonRow or findChild(detail, 'detailButtonRow')
    local startBtn  = buttonRow and buttonRow:getChildById('startTaskButton')
    local cancelBtn = buttonRow and buttonRow:getChildById('cancelTaskButton')
    local claimBtn  = buttonRow and buttonRow:getChildById('claimRewardsButton')

    if isCompleted then
        if startBtn then
            startBtn:setText('Completed'); startBtn:setEnabled(false); startBtn:setOpacity(0.5)
        end
        if cancelBtn then
            cancelBtn:setEnabled(false); cancelBtn:setOpacity(0.5); cancelBtn:setImageColor('#550000')
        end
        if claimBtn then
            claimBtn:setText('Claim Rewards'); claimBtn:setEnabled(true); claimBtn:setOpacity(1.0); claimBtn
                :setImageColor('#00aa00')
        end
    elseif isActive then
        if startBtn then
            startBtn:setText('In Progress'); startBtn:setEnabled(false); startBtn:setOpacity(0.5); startBtn
                :setImageColor('#005500')
        end
        if cancelBtn then
            cancelBtn:setText('Cancel Task'); cancelBtn:setEnabled(true); cancelBtn:setOpacity(1.0); cancelBtn
                :setImageColor('#aa0000')
        end
        if claimBtn then
            claimBtn:setEnabled(false); claimBtn:setOpacity(0.5); claimBtn:setImageColor('#005500')
        end
    elseif isRewarded and not isRepeatable(task) then
        if startBtn then
            startBtn:setText('Finished'); startBtn:setEnabled(false); startBtn:setOpacity(0.5); startBtn:setImageColor('#444444')
        end
        if cancelBtn then
            cancelBtn:setText('Cancel'); cancelBtn:setEnabled(false); cancelBtn:setOpacity(0.5); cancelBtn:setImageColor('#550000')
        end
        if claimBtn then
            claimBtn:setEnabled(false); claimBtn:setOpacity(0.5); claimBtn:setImageColor('#005500')
        end
    elseif task.locked then
        if startBtn then
            startBtn:setText('Locked'); startBtn:setEnabled(false); startBtn:setOpacity(0.5); startBtn:setImageColor(
            '#444444')
        end
        if cancelBtn then
            cancelBtn:setText('Cancel'); cancelBtn:setEnabled(false); cancelBtn:setOpacity(0.5); cancelBtn:setImageColor(
            '#550000')
        end
        if claimBtn then
            claimBtn:setEnabled(false); claimBtn:setOpacity(0.5); claimBtn:setImageColor('#005500')
        end
    else
        local hasSameTypeActive = hasActiveTaskOfSameType(taskId)
        if startBtn then
            if hasSameTypeActive then
                startBtn:setText('Already Active');
                startBtn:setEnabled(false);
                startBtn:setOpacity(0.5);
                startBtn:setImageColor('#888888')
            else
                startBtn:setText('Start Task');
                startBtn:setEnabled(true);
                startBtn:setOpacity(1.0);
                startBtn:setImageColor('#00aa00')
            end
        end
        if cancelBtn then
            cancelBtn:setText('Cancel'); cancelBtn:setEnabled(false); cancelBtn:setOpacity(0.5); cancelBtn:setImageColor(
            '#550000')
        end
        if claimBtn then
            claimBtn:setEnabled(false);
            claimBtn:setOpacity(0.5);
            claimBtn:setImageColor('#005500')
        end
    end

    scheduleEvent(function()
        local currentTask = findTaskConfig(selectedTaskId)
        if currentTask then
            renderDetailRewards(currentTask, g_taskUI.detail or window:getChildById('detailPanel'))
        end
    end, 0)
end

-- ============================================================
-- RENDERIZA RECOMPENSAS COM LOOKTYPE
-- ============================================================
function renderDetailRewards(task, detail)
    local container = findChild(detail, 'detailTopRewardsContainer')
    if not container then return end
    container:destroyChildren()

    if not task.rewards or not task.rewards.items or #task.rewards.items == 0 then
        local lbl = g_ui.createWidget('Label', container)
        lbl:setText('Rewards: none')
        lbl:setFont('verdana-11px-rounded')
        lbl:setColor('#aaaaaa')
        return
    end

    local SLOT_SIZE = 36
    local SLOT_MARGIN = 4

    local containerWidth = math.max(container:getWidth(), 80)
    local itemsPerRow = math.max(math.floor(containerWidth / (SLOT_SIZE + SLOT_MARGIN)), 1)

    local currentRow = nil
    local itemCount = 0

    for _, item in ipairs(task.rewards.items) do
        local serverId = item[1]
        local itemQty = item[2] or 1
        local col = itemCount % itemsPerRow

        if col == 0 then
            currentRow = g_ui.createWidget('Panel', container)
            currentRow:setLayout(UIHorizontalLayout.create(currentRow))
            currentRow:setHeight(SLOT_SIZE + SLOT_MARGIN)
        end

        local slot = g_ui.createWidget('Panel', currentRow)
        slot:setSize({ width = SLOT_SIZE, height = SLOT_SIZE })
        slot:setMargin(2)
        slot:setImageSource('/images/ui/panel_flat')
        slot:setImageBorder(1)
        slot:setTooltip(getItemName(serverId))

        local itemWidget = g_ui.createWidget('UIItem', slot)
        itemWidget:setSize({ width = SLOT_SIZE - 2, height = SLOT_SIZE - 2 })
        local itemType = g_things.getItemType(serverId)
        local clientId = (itemType and itemType:getClientId()) or serverId
        itemWidget:setItemId(clientId)

        local qtyLbl = g_ui.createWidget('Label', slot)
        qtyLbl:setText('x' .. itemQty)
        qtyLbl:setFont('verdana-11px-rounded')
        qtyLbl:setColor('#ffffff')
        qtyLbl:setHeight(12)
        qtyLbl:addAnchor(AnchorTop, slot, AnchorTop)
        qtyLbl:addAnchor(AnchorLeft, slot, AnchorLeft)

        itemCount = itemCount + 1
    end
end

-- ============================================================
-- RENDERIZA MONSTROS DETALHADOS + LOCALIZAÇÕES
-- ============================================================
function renderDetailMonsters(task, detail)
    local container = findChild(detail, 'detailMonstersContainer')
    if not container then return end
    container:destroyChildren()

    if task.monsters and #task.monsters > 0 then
        for _, m in ipairs(task.monsters) do
            local mName
            local mKills
            if type(m) == "string" then
                mName = m
                mKills = task.kills or task.killsRequired or 0
            else
                mName = m.name or "Unknown"
                mKills = m.kills or task.kills or task.killsRequired or 0
            end

            local row = g_ui.createWidget('Panel', container)
            row:setLayout(UIHorizontalLayout.create(row))
            row:setHeight(22)
            row:setMarginTop(1)

            local lbl = g_ui.createWidget('Label', row)
            lbl:setText(mKills .. 'x ' .. mName)
            lbl:setFont('verdana-11px-rounded')
            lbl:setColor('#dddddd')
            lbl:setTextAutoResize(true)
        end
    end
end

-- ============================================================
-- BOTÕES DO DETALHE
-- ============================================================
function startTaskClick()
    if not selectedTaskId then return end
    startTask(selectedTaskId)
end

function cancelTaskClick()
    if not selectedTaskId then return end
    pcall(abortTask, selectedTaskId)
end

function claimRewardsClick()
    if not selectedTaskId then return end
    local pt = findPlayerTask(selectedTaskId)
    if not pt or pt.completed ~= 1 or pt.rewarded ~= 0 then
        showInfo('Task is not completed yet.', '#ff4444')
        return
    end
    local ok, err = pcall(completeTask, selectedTaskId)
    if not ok then
        showInfo('Error: ' .. tostring(err), 'red')
    end
end

-- ============================================================
-- AÇÕES DE TASK
-- ============================================================
function hasActiveTaskOfSameType(taskId)
    local task = findTaskConfig(taskId)
    if not task or not task.type then return false, nil end
    for _, pt in ipairs(playerTasks) do
        if pt.rewarded ~= 1 then
            local otherTask = findTaskConfig(pt.id)
            if otherTask and otherTask.type == task.type and pt.id ~= taskId then
                return true, otherTask
            end
        end
    end
    return false, nil
end

function startTask(taskId)
    if not taskId then taskId = selectedTaskId end
    if not taskId then return end

    local hasActive, activeTask = hasActiveTaskOfSameType(taskId)
    if hasActive and activeTask then
        displayInfoBox(tr('Warning'),
            tr('You already have an active ' .. (activeTask.type or '') .. ' task:\n"' .. (activeTask.name or '') .. '"\n\nFinish it before starting a new one of the same type.'))
        return
    end

    sendOpcode(json.encode({ action = 'start', taskId = taskId }))
end

function completeTask(taskId)
    if not taskId then taskId = selectedTaskId end
    if not taskId then return end
    sendOpcode(json.encode({ action = 'complete', taskId = taskId }))
end

function abortTask(taskId)
    if not taskId then taskId = selectedTaskId end
    if not taskId then return end

    local popup
    popup = displayGeneralBox(tr('Tasks'), tr('Do you really want to abort this task?'), {
        {
            text = tr('Yes'),
            callback = function()
                popup:ok()
                local ok, err = pcall(function()
                    sendOpcode(json.encode({ action = 'cancel', taskId = taskId }))
                    showInfo('Task canceled successfully', '#00ff00')
                    backToList()
                end)
                if not ok then
                    showInfo('Error: ' .. tostring(err), 'red')
                end
            end
        },
        { text = tr('No'), callback = function() popup:ok() end }
    })
end

-- ============================================================
-- ATUALIZAÇÃO DE PROGRESSO
-- ============================================================
function updateTaskProgress(updateData)
    for i, pt in ipairs(playerTasks) do
        if pt.id == updateData.taskId then
            playerTasks[i].done = updateData.kills or 0
            if updateData.completed == 1 then playerTasks[i].completed = 1 end
            renderTaskList()
            if selectedTaskId == updateData.taskId then
                selectTask(updateData.taskId)
            end
            return
        end
    end

    local task = findTaskConfig(updateData.taskId)
    if task then
        table.insert(playerTasks, {
            id        = updateData.taskId,
            done      = updateData.kills or 0,
            kills     = updateData.killsRequired or 1,
            completed = (updateData.completed == 1) and 1 or 0,
            rewarded  = 0
        })
        renderTaskList()
        if selectedTaskId == updateData.taskId then
            selectTask(updateData.taskId)
        end
    end
end

-- ============================================================
-- POPUP DE CONCLUSÃO
-- ============================================================
function showCompletePopup(completeData)
    local text = 'TASK COMPLETE!\n\n'
    if completeData.points then text = text .. '+' .. completeData.points .. ' Rank Points\n' end
    if completeData.exp then text = text .. '+' .. formatExp(completeData.exp) .. ' XP\n' end
    if completeData.money and completeData.money > 0 then
        text = text .. '+' .. formatMoney(completeData.money) .. ' gold\n'
    end
    text = text .. '\nOpen the Tasks window and claim your reward.'

    local popup
    popup = displayGeneralBox(tr('Task Complete!'), tr(text), {
        { text = tr('OK'), callback = function() popup:ok() end, anchor = AnchorHorizontalCenter }
    })
end

-- ============================================================
-- RANK DISPLAY
-- ============================================================
function updateRankDisplay()
    if not window then return end
    local rankPanel = window:getChildById('rankPanel')
    if not rankPanel then return end

    local name            = g_taskRankData.name or ''
    local points          = g_taskRankData.points or 0
    local nextRankName    = g_taskRankData.nextRank or ''
    local pointsToNext    = g_taskRankData.pointsToNext or 0
    local pointsInThis    = g_taskRankData.pointsInThisRank or 0
    local pointsToNextMax = g_taskRankData.pointsToNextMax or 1
    local category        = g_taskRankData.category or 'dragonball'

    local color           = '#ffffff'
    if RANK_COLORS[category] and RANK_COLORS[category][name] then
        color = RANK_COLORS[category][name]
    end

    rankPanel:getChildById('rankName'):setText(name)
    rankPanel:getChildById('rankName'):setColor(color)
    rankPanel:getChildById('rankPoints'):setText('Points: ' .. points)

    if nextRankName and nextRankName ~= '' and nextRankName ~= name then
        rankPanel:getChildById('nextRank'):setText('Next: ' .. nextRankName .. ' (' .. pointsToNext .. ' pts)')
    else
        rankPanel:getChildById('nextRank'):setText('MAX RANK')
    end

    local rankProgFill = window:getChildById('rankProgFill')
    local rankProgBar  = window:getChildById('rankProgBar')
    if rankProgFill and rankProgBar then
        if pointsToNextMax > 0 and nextRankName ~= name then
            local pct = math.min(pointsInThis / pointsToNextMax, 1)
            local bw  = math.max(rankProgBar:getWidth(), 300)
            rankProgFill:setWidth(math.floor(bw * pct))
        else
            local bw = pointsToNextMax > 0 and math.floor(math.max(rankProgBar:getWidth(), 300)) or 0
            rankProgFill:setWidth(bw)
        end
        rankProgBar:setTooltip('Rank: ' ..
        name .. ' (' .. points .. ' pts)\nNext: ' .. nextRankName .. ' (' .. pointsToNext .. ' pts needed)')
    end
end

function updateQuestProgress()
    if not window then return end
    local questProgFill = window:getChildById('questProgFill')
    local questProgBar  = window:getChildById('questProgBar')
    if not questProgFill or not questProgBar then return end

    local totalPct    = 0
    local activeCount = 0
    for _, pt in ipairs(playerTasks) do
        if pt.completed ~= 1 and pt.rewarded ~= 1 then
            local task = findTaskConfig(pt.id)
            if task then
                local total = task.killsRequired or task.kills or 1
                totalPct    = totalPct + math.min((pt.done or 0) / total, 1)
                activeCount = activeCount + 1
            end
        end
    end

    if activeCount > 0 then
        local avg = totalPct / activeCount
        local bw  = math.max(questProgBar:getWidth(), 300)
        questProgFill:setWidth(math.floor(bw * avg))
        questProgBar:setTooltip('Quest Progress: ' .. math.floor(avg * 100) .. '% (' .. activeCount .. ' active tasks)')
    else
        questProgBar:setTooltip('No active tasks')
    end
end

-- ============================================================
-- UTILITÁRIOS
-- ============================================================
function showInfo(text, color)
    if not window then return end
    local info = window:getChildById('info')
    if info then
        info:setText(text)
        info:setColor(color or 'white')
    end
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
                if name and name ~= '' then return name end
            end
        end
    end
    return 'Item #' .. itemId
end
