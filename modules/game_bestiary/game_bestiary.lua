------------------------------------------------------------------------
-- game_bestiary.lua
-- Bestiary module for OTCv8
-- Extended Opcode: 250
------------------------------------------------------------------------

------------------------------------------------------------------------
-- CONFIG
------------------------------------------------------------------------
local CONFIG             = {
    OPCODE         = 250,
    CARDS_PER_ROW  = 5,
    ROWS_PER_PAGE  = 10,
    CARDS_PER_PAGE = 50,
    CARD_WIDTH     = 104,
    CARD_HEIGHT    = 120,
    GRID_SPACING   = 4,
    WINDOW_WIDTH   = 860,
    WINDOW_HEIGHT  = 640,
    ICON_PATH      = '/images/topbuttons/prey',
    TOOLTIP        = 'Bestiary',
    TAB_MONSTERS   = 'monsters',
    TAB_BOSSES     = 'bosses',
}

local LOOT_RARITY        = {
    { key = 'Common',    color = '#a0a0a0', min = 50000, max = 999999 },
    { key = 'Uncommon',  color = '#ffffff', min = 10000, max = 49999 },
    { key = 'Semi-Rare', color = '#4a8ef5', min = 1000,  max = 9999 },
    { key = 'Rare',      color = '#b060ff', min = 100,   max = 999 },
    { key = 'Very Rare', color = '#ffb840', min = 0,     max = 99 },
}

local ELEMENTS_ORDER     = {
    'physical', 'earth', 'fire', 'ice', 'energy',
    'holy', 'death', 'lifeDrain', 'manaDrain',
}

local ELEMENT_DISPLAY    = {
    physical  = 'Physical',
    earth     = 'Earth',
    fire      = 'Fire',
    ice       = 'Ice',
    energy    = 'Energy',
    holy      = 'Holy',
    death     = 'Death',
    lifeDrain = 'Life Drain',
    manaDrain = 'Mana Drain',
}

------------------------------------------------------------------------
-- MODULE STATE
------------------------------------------------------------------------
local window             = nil
local button             = nil
local cardPool           = {}

local bestiaryData       = nil
local currentTab         = CONFIG.TAB_MONSTERS
local searchQuery        = ''
local currentPage        = 1
local totalPages         = 1
local filteredList       = {}
local selectedMonster    = nil
local selectedCard       = nil

-- Chunked-transfer state (server splits large JSON with S/P/E prefixes)
local chunkBuffer        = nil   -- assembles partial JSON
local chunkMode          = false -- true while receiving multi-part payload

------------------------------------------------------------------------
-- TABLE DECLARATIONS (forward-declare before any function bodies)
------------------------------------------------------------------------
local BestiaryParser     = {}
local BestiaryCache      = {}
local BestiaryUI         = {}
local BestiaryController = {}
local BestiaryNetwork    = {}

------------------------------------------------------------------------
-- PARSER FUNCTIONS
------------------------------------------------------------------------
function BestiaryParser.getRarityKey(chance)
    for _, rarity in ipairs(LOOT_RARITY) do
        if chance >= rarity.min and chance <= rarity.max then
            return rarity.key
        end
    end
    return 'Unknown'
end

function BestiaryParser.getRarityColor(chance)
    for _, rarity in ipairs(LOOT_RARITY) do
        if chance >= rarity.min and chance <= rarity.max then
            return rarity.color
        end
    end
    return '#ffffff'
end

function BestiaryParser.calculatePercent(resistValue)
    return math.min(100, math.max(-100, resistValue))
end

------------------------------------------------------------------------
-- CACHE FUNCTIONS
------------------------------------------------------------------------
function BestiaryCache.set(data)
    BestiaryCache.data = data
end

function BestiaryCache.get()
    return BestiaryCache.data
end

function BestiaryCache.clear()
    BestiaryCache.data = nil
end

function BestiaryCache.hasData()
    return BestiaryCache.data ~= nil
end

------------------------------------------------------------------------
-- UI FUNCTIONS
------------------------------------------------------------------------
function BestiaryUI.createWindow()
    if window then return end

    local w = g_ui.displayUI('game_bestiary')
    if not w then
        print('[Bestiary] ERRO: nao foi possivel criar a janela (game_bestiary.otui nao encontrado)')
        return
    end
    window = w

    window:setSize({ width = CONFIG.WINDOW_WIDTH, height = CONFIG.WINDOW_HEIGHT })

    local screenW = g_window.getWidth()
    local screenH = g_window.getHeight()
    window:setPosition({
        x = math.floor((screenW - CONFIG.WINDOW_WIDTH) / 2),
        y = math.floor((screenH - CONFIG.WINDOW_HEIGHT) / 2)
    })

    BestiaryUI.createCardPool()
    window:setVisible(false)
end

function BestiaryUI.destroyWindow()
    if window then
        window:destroy()
        window = nil
    end
end

function BestiaryUI.open()
    if not window then
        BestiaryUI.createWindow()
    end
    if not window then return end

    window:setVisible(true)
    window:raise()
    window:focus()

    if BestiaryCache.hasData() then
        -- Data already in cache – render immediately
        BestiaryController.refresh()
    else
        BestiaryUI.showLoading()
        BestiaryNetwork.requestData()
    end
end

function BestiaryUI.close()
    if window then
        window:setVisible(false)
    end
end

function BestiaryUI.isOpen()
    return window and window:isVisible()
end

function BestiaryUI.createCardPool()
    if not window then return end
    local gridPanel = window:recursiveGetChildById('gridPanel')
    if not gridPanel then
        print('[Bestiary] ERRO: gridPanel nao encontrado no OTUI')
        return
    end
    BestiaryUI.destroyCardPool()

    cardPool = {}
    for i = 1, CONFIG.CARDS_PER_PAGE do
        local card = g_ui.createWidget('BestiaryCard', gridPanel)
        if not card then
            print('[Bestiary] ERRO: falhou ao criar BestiaryCard #' .. i)
            break
        end
        card.index = i
        card.monsterData = nil
        card:hide() -- hide until data is set
        table.insert(cardPool, card)
    end
    print('[Bestiary] Pool criado: ' .. #cardPool .. ' cards')
end

function BestiaryUI.updateGridHeight(visibleCount)
    if not window then return end
    local gridPanel = window:recursiveGetChildById('gridPanel')
    if not gridPanel then return end
    local rows = math.max(1, math.ceil(visibleCount / CONFIG.CARDS_PER_ROW))
    local h = rows * CONFIG.CARD_HEIGHT + (rows - 1) * CONFIG.GRID_SPACING
    gridPanel:setHeight(h)
end

function BestiaryUI.destroyCardPool()
    for _, card in ipairs(cardPool) do
        pcall(function() card:destroy() end)
    end
    cardPool = {}
end

function BestiaryUI.renderGrid()
    if not window or not window:isVisible() then return end

    local gridPanel = window:recursiveGetChildById('gridPanel')
    if not gridPanel then
        print('[Bestiary] ERRO: gridPanel nao encontrado ao renderizar')
        return
    end

    -- Guard: if card pool is empty, recreate it
    if #cardPool == 0 then
        BestiaryUI.createCardPool()
    end

    filteredList = BestiaryController.getFilteredMonsters()
    totalPages   = math.max(1, math.ceil(#filteredList / CONFIG.CARDS_PER_PAGE))

    if currentPage > totalPages then currentPage = totalPages end
    if currentPage < 1 then currentPage = 1 end

    local startIdx = (currentPage - 1) * CONFIG.CARDS_PER_PAGE + 1

    -- BUG FIX: guard disableUpdates – not all layout types expose it
    local layout = gridPanel:getLayout()
    local layoutOk = layout and pcall(function() layout:disableUpdates() end)

    for i, card in ipairs(cardPool) do
        local monsterIdx = startIdx + i - 1
        if monsterIdx <= #filteredList then
            local monster = filteredList[monsterIdx]
            card.monsterData = monster
            card:show()

            -- Sprite
            local icon = card:recursiveGetChildById('icon')
            if icon then
                icon:setOutfit({
                    type   = monster.lookType or 0,
                    head   = monster.lookHead or 0,
                    body   = monster.lookBody or 0,
                    legs   = monster.lookLegs or 0,
                    feet   = monster.lookFeet or 0,
                    addons = monster.lookAddons or 0,
                })
            end

            -- Name
            local nameLabel = card:recursiveGetChildById('nameLabel')
            if nameLabel then
                nameLabel:setText(monster.name or '???')
            end

            -- Selection highlight
            if selectedMonster and selectedMonster.name == monster.name then
                card:setChecked(true)
                selectedCard = card
            else
                card:setChecked(false)
            end
        else
            card:hide()
            card.monsterData = nil
        end
    end

    if layoutOk then
        pcall(function() layout:enableUpdates() end)
    end

    -- Ensure gridPanel has the correct height (fallback for layouts that
    -- don't auto-resize their parent with fit-children)
    local visibleCount = math.min(#filteredList - (currentPage - 1) * CONFIG.CARDS_PER_PAGE,
        CONFIG.CARDS_PER_PAGE)
    BestiaryUI.updateGridHeight(math.max(0, visibleCount))

    BestiaryUI.updatePagination()
    BestiaryUI.updateScroll()
end

function BestiaryUI.updateScroll()
    if not window then return end
    local scrollPanel = window:recursiveGetChildById('scrollPanel')
    if scrollPanel then
        pcall(function() scrollPanel:scrollToTop() end)
    end
end

function BestiaryUI.showLoading()
    if not window then return end
    local loadingLabel = window:recursiveGetChildById('loadingLabel')
    local scrollPanel = window:recursiveGetChildById('scrollPanel')
    if loadingLabel then loadingLabel:show() end
    if scrollPanel then scrollPanel:hide() end
end

function BestiaryUI.hideLoading()
    if not window then return end
    local loadingLabel = window:recursiveGetChildById('loadingLabel')
    local scrollPanel = window:recursiveGetChildById('scrollPanel')
    if loadingLabel then loadingLabel:hide() end
    if scrollPanel then scrollPanel:show() end
end

function BestiaryUI.updatePagination()
    if not window then return end
    local pageLabel = window:recursiveGetChildById('pageLabel')
    local prevBtn   = window:recursiveGetChildById('prevPageBtn')
    local nextBtn   = window:recursiveGetChildById('nextPageBtn')

    if pageLabel then pageLabel:setText(tr('Page %d of %d', currentPage, totalPages)) end
    if prevBtn then prevBtn:setEnabled(currentPage > 1) end
    if nextBtn then nextBtn:setEnabled(currentPage < totalPages) end
end

function BestiaryUI.renderDetail(monster)
    if not window then return end

    local detailPanel = window:recursiveGetChildById('detailPanel')
    if not detailPanel then return end

    if not monster then
        detailPanel:setVisible(false)
        return
    end

    detailPanel:setVisible(true)

    local sprite = detailPanel:recursiveGetChildById('detailSprite')
    if sprite then
        local outfitType = monster.lookType or 0
        if outfitType == 0 and monster.lookTypeEx and monster.lookTypeEx > 0 then
            outfitType = monster.lookTypeEx
        end
        sprite:setOutfit({
            type   = outfitType,
            head   = monster.lookHead or 0,
            body   = monster.lookBody or 0,
            legs   = monster.lookLegs or 0,
            feet   = monster.lookFeet or 0,
            addons = monster.lookAddons or 0,
        })
    end

    local nameLabel = detailPanel:recursiveGetChildById('detailName')
    if nameLabel then nameLabel:setText(monster.name or '???') end

    local progress = detailPanel:recursiveGetChildById('detailProgress')
    if progress then progress:setPercent(100) end

    -- local progressLabel = detailPanel:recursiveGetChildById('detailProgressLabel')
    -- if progressLabel then progressLabel:setText(monster.count .. ' / ' .. monster.requiredKills) end

    BestiaryUI.renderStats(detailPanel, monster)
    BestiaryUI.renderResistances(detailPanel, monster)
    BestiaryUI.renderLoot(detailPanel, monster)

    -- Force anchor layout to recalc positions after dynamic children added
    BestiaryUI.forceDetailContentLayout(detailPanel)
    -- Then compute the correct height for the scrollable area
    BestiaryUI.updateDetailContentHeight(detailPanel)

    -- Scroll detail view to top (delayed for layout to settle)
    addEvent(function()
        local ds = detailPanel:recursiveGetChildById('detailScroll')
        if ds then pcall(function() ds:scrollToTop() end) end
    end)
end

function BestiaryUI.forceDetailContentLayout(detailPanel)
    if not detailPanel then return end
    local detailContent = detailPanel:recursiveGetChildById('detailContent')
    if not detailContent then return end
    local w = detailContent:getWidth()
    if w and w > 0 then
        -- Toggle width to dirty the layout and force recalc
        detailContent:setWidth(w + 1)
        detailContent:setWidth(w)
    end
end

function BestiaryUI.updateDetailContentHeight(detailPanel)
    if not detailPanel then return end
    local detailContent = detailPanel:recursiveGetChildById('detailContent')
    if not detailContent then return end

    -- Recursively find the deepest visible child's bottom edge
    local maxBottom = 200
    local function measureRecursive(widget, offsetY)
        offsetY = offsetY or 0
        local children = widget:getChildren()
        if children then
            for _, child in ipairs(children) do
                if child:isVisible() then
                    local cy = offsetY + child:getY()
                    local cb = cy + child:getHeight()
                    if cb > maxBottom then maxBottom = cb end
                    measureRecursive(child, cy)
                end
            end
        end
    end
    measureRecursive(detailContent)

    local contentH = maxBottom + 16
    detailContent:setHeight(contentH)

    -- Engine auto-hides via $!on style on the scrollbar
    local detailScroll = detailPanel:recursiveGetChildById('detailScroll')
    if detailScroll then
        detailScroll:updateScrollBars()
    end
end

function BestiaryUI.renderStats(detailPanel, monster)
    -- IDs match the new OTUI grid labels
    local function setVal(id, val)
        local w = detailPanel:recursiveGetChildById(id)
        if w then w:setText(tostring(val)) end
    end
    setVal('statHealthValue', monster.health or 0)
    setVal('statExpValue', monster.experience or 0)
    setVal('statSpeedValue', monster.speed or 0)
    setVal('statArmorValue', monster.armor or 0)
    setVal('statRaceValue', monster.race or 'unknown')
end

function BestiaryUI.renderResistances(detailPanel, monster)
    local resistPanel = detailPanel:recursiveGetChildById('resistPanel')
    if not resistPanel then return end

    local layout = resistPanel:getLayout()
    pcall(function() if layout then layout:disableUpdates() end end)
    resistPanel:destroyChildren()

    local resistances = monster.resistances or {}

    for _, elem in ipairs(ELEMENTS_ORDER) do
        local val = resistances[elem]
        if val ~= nil then
            local bar = g_ui.createWidget('BestiaryResistBar', resistPanel)
            if bar then
                local lbl = bar:recursiveGetChildById('label')
                if lbl then lbl:setText(ELEMENT_DISPLAY[elem] or elem) end

                local fill = bar:recursiveGetChildById('fill')
                if fill then
                    local pct = BestiaryParser.calculatePercent(val)
                    if pct >= 0 then
                        fill:setBackgroundColor('#40b040')
                    else
                        fill:setBackgroundColor('#b04040')
                    end

                    -- Compute fill width as percentage of actual track width
                    local track = fill:getParent()
                    local trackW = track and track:getWidth() or 100
                    if trackW <= 0 then trackW = 100 end
                    local fillW = math.floor(math.min(math.abs(pct) / 100 * trackW, trackW))
                    fill:setWidth(fillW)
                end

                local sign = (val > 0 and '+') or ''
                local vLbl = bar:recursiveGetChildById('valueLabel')
                if vLbl then vLbl:setText(sign .. tostring(val) .. '%') end
            end
        end
    end

    pcall(function() if layout then layout:enableUpdates() end end)
end

function BestiaryUI.renderLoot(detailPanel, monster)
    local lootPanel = detailPanel:recursiveGetChildById('lootPanel')
    if not lootPanel then return end

    lootPanel:destroyChildren()

    local loot = monster.loot or {}
    local categorized = {}

    for _, rarityCfg in ipairs(LOOT_RARITY) do
        categorized[rarityCfg.key] = {}
    end

    for _, item in ipairs(loot) do
        local rarityKey = BestiaryParser.getRarityKey(item.chance or 0)
        if not categorized[rarityKey] then categorized[rarityKey] = {} end
        table.insert(categorized[rarityKey], item)
    end

    for _, rarityCfg in ipairs(LOOT_RARITY) do
        local items = categorized[rarityCfg.key]
        if items and #items > 0 then
            local catWidget = g_ui.createWidget('BestiaryLootCategory', lootPanel)
            if catWidget then
                -- Set rarity title inside the rarityRow panel
                local rarityLabel = catWidget:recursiveGetChildById('rarityLabel')
                if rarityLabel then
                    rarityLabel:setText(rarityCfg.key)
                    rarityLabel:setColor(rarityCfg.color)
                end

                -- Populate items grid inside itemsPanel
                local itemsPanel = catWidget:recursiveGetChildById('itemsPanel')
                if itemsPanel then
                    -- Compute rows needed and set height
                    local cols = 6
                    local cellSize = 34
                    local rows = math.ceil(#items / cols)
                    local panelH = rows * cellSize + math.max(0, rows - 1) * 2
                    itemsPanel:setHeight(panelH)

                    -- Set category total height so verticalBox allocates space
                    local catH = 18 + 2 + panelH -- rarityLabel + margin-top + grid
                    catWidget:setHeight(catH)

                    for _, item in ipairs(items) do
                        local slot = g_ui.createWidget('BestiaryLootSlot', itemsPanel)
                        if slot then
                            local itemWidget = slot:getChildById('lootItem')
                            if itemWidget then
                                itemWidget:setItemId(item.clientId or item.id or 0)
                                itemWidget:setOpacity(1.0)

                                local cm = item.countmax or 1
                                if cm > 1 then
                                    local cl = slot:getChildById('countLabel')
                                    if cl then
                                        cl:setText('x' .. tostring(cm))
                                        cl:show()
                                    end
                                end

                                local pct = (item.chance or 0) / 100000 * 100
                                itemWidget:setTooltip(
                                    string.format('%s\n%.2f%%',
                                        item.name or 'unknown',
                                        pct
                                    )
                                )
                            end
                        end
                    end
                end
            end
        end
    end
end

------------------------------------------------------------------------
-- CONTROLLER FUNCTIONS
------------------------------------------------------------------------
function BestiaryController.init()
    BestiaryNetwork.init()
end

function BestiaryController.terminate()
    BestiaryNetwork.terminate()
end

function BestiaryController.refresh()
    bestiaryData = BestiaryCache.get()
    if not bestiaryData then
        print('[Bestiary] refresh() chamado mas sem dados em cache')
        return
    end
    if not window then return end

    -- Reset state
    selectedMonster   = nil
    selectedCard      = nil
    currentPage       = 1
    searchQuery       = ''

    local searchField = window:recursiveGetChildById('searchField')
    if searchField then searchField:setText('') end

    -- Update tab buttons visual state
    local tabMonsters = window:recursiveGetChildById('tabMonsters')
    local tabBosses   = window:recursiveGetChildById('tabBosses')
    if tabMonsters then pcall(function() tabMonsters:setChecked(currentTab == CONFIG.TAB_MONSTERS) end) end
    if tabBosses then pcall(function() tabBosses:setChecked(currentTab == CONFIG.TAB_BOSSES) end) end

    BestiaryUI.hideLoading()
    BestiaryUI.renderGrid()

    local detailPanel = window:recursiveGetChildById('detailPanel')
    if detailPanel then detailPanel:setVisible(false) end

    print(string.format('[Bestiary] Grid renderizada: %d itens na aba atual', #filteredList))
end

function BestiaryController.getFilteredMonsters()
    local data = BestiaryCache.get()
    if not data then return {} end

    local sourceList = {}
    if currentTab == CONFIG.TAB_BOSSES then
        sourceList = data.bosses or {}
    else
        sourceList = data.monsters or {}
    end

    if searchQuery == '' then
        return sourceList
    end

    local query = BestiaryController.normalizeText(searchQuery:lower())

    local results = {}
    for _, monster in ipairs(sourceList) do
        local monsterName = BestiaryController.normalizeText((monster.name or ''):lower())
        if monsterName:find(query, 1, true) then
            table.insert(results, monster)
        end
    end
    return results
end

function BestiaryController.normalizeText(text)
    local normalized = text
    local replacements = {
        { '[àáâãäå]', 'a' }, { '[èéêë]', 'e' }, { '[ìíîï]', 'i' },
        { '[òóôõö]',  'o' }, { '[ùúûü]', 'u' }, { '[ñ]', 'n' },
        { '[ç]', 'c' }, { '[ýÿ]', 'y' },
    }
    for _, pair in ipairs(replacements) do
        normalized = normalized:gsub(pair[1], pair[2])
    end
    return normalized
end

function BestiaryController.selectMonster(monster)
    selectedMonster = monster
    BestiaryUI.renderGrid()
    BestiaryUI.renderDetail(monster)
end

------------------------------------------------------------------------
-- NETWORK FUNCTIONS
-- BUG FIX: The server sends large JSON split into chunks prefixed with
--   "S" (Start), "P" (Part/middle), "E" (End).
--   Single-chunk payloads are sent raw (no prefix).
--   registerExtendedJSONOpcode would try json.decode on "S{..." which
--   fails. We use registerExtendedOpcode and reassemble manually.
------------------------------------------------------------------------
function BestiaryNetwork.init()
    -- Use raw opcode handler so we can deal with chunked transport
    ProtocolGame.registerExtendedOpcode(CONFIG.OPCODE, BestiaryNetwork.onReceiveRaw)
end

function BestiaryNetwork.terminate()
    ProtocolGame.unregisterExtendedOpcode(CONFIG.OPCODE)
end

function BestiaryNetwork.requestData()
    local pg = g_game.getProtocolGame()
    if pg then
        -- Reset chunk state before requesting
        chunkBuffer = nil
        chunkMode   = false
        pg:sendExtendedOpcode(CONFIG.OPCODE, 'request')
        print('[Bestiary] Dados solicitados ao servidor...')
    else
        print('[Bestiary] ERRO: sem ProtocolGame ativo para solicitar dados')
    end
end

function BestiaryNetwork.onReceiveRaw(protocol, opcode, buffer)
    if not buffer or buffer == '' then
        print('[Bestiary] Buffer vazio recebido')
        return
    end

    local prefix = buffer:sub(1, 1)

    -- ── Chunked multi-part payload ─────────────────────────────────────
    if prefix == 'S' then
        -- Start of multi-part sequence
        chunkBuffer = buffer:sub(2)
        chunkMode   = true
        return
    elseif prefix == 'P' then
        -- Middle part
        if chunkMode and chunkBuffer then
            chunkBuffer = chunkBuffer .. buffer:sub(2)
        else
            -- Received middle without start – reset and ignore
            print('[Bestiary] AVISO: chunk P recebido sem S anterior, ignorando')
            chunkBuffer = nil
            chunkMode   = false
        end
        return
    elseif prefix == 'E' then
        -- End part – assemble full JSON
        if chunkMode and chunkBuffer then
            chunkBuffer    = chunkBuffer .. buffer:sub(2)
            local fullJson = chunkBuffer
            chunkBuffer    = nil
            chunkMode      = false
            BestiaryNetwork.processJson(fullJson)
        else
            print('[Bestiary] AVISO: chunk E recebido sem S anterior, ignorando')
            chunkBuffer = nil
            chunkMode   = false
        end
        return
    end

    -- ── Single-packet (no prefix, raw JSON) ───────────────────────────
    -- Reset any in-progress chunk
    chunkBuffer = nil
    chunkMode   = false
    BestiaryNetwork.processJson(buffer)
end

function BestiaryNetwork.processJson(jsonStr)
    -- Sanity: must start with '{' or '['
    local firstChar = jsonStr:match('^%s*(.)')
    if firstChar ~= '{' and firstChar ~= '[' then
        print('[Bestiary] ERRO: payload nao e JSON valido. Primeiros 40 chars: ' .. jsonStr:sub(1, 40))
        return
    end

    local ok, data = pcall(json.decode, jsonStr)
    if not ok or type(data) ~= 'table' then
        print('[Bestiary] ERRO ao decodificar JSON: ' .. tostring(data))
        return
    end

    local monCount  = data.totalMonsters or (data.monsters and #data.monsters) or 0
    local bossCount = data.totalBosses or (data.bosses and #data.bosses) or 0
    print(string.format('[Bestiary] Dados recebidos: %d monstros, %d bosses', monCount, bossCount))

    BestiaryCache.set(data)

    -- BUG FIX: refresh regardless of whether window is currently visible.
    -- open() already made it visible before requesting; if user opened
    -- before data arrived refresh() will now populate the grid correctly.
    BestiaryController.refresh()
end

------------------------------------------------------------------------
-- EVENT HANDLERS (exported for OTUI binding)
------------------------------------------------------------------------
function onTabClick(tab)
    if tab == currentTab then return end
    currentTab        = tab
    currentPage       = 1
    selectedMonster   = nil
    selectedCard      = nil

    local tabMonsters = window and window:recursiveGetChildById('tabMonsters')
    local tabBosses   = window and window:recursiveGetChildById('tabBosses')

    if tabMonsters then pcall(function() tabMonsters:setChecked(tab == CONFIG.TAB_MONSTERS) end) end
    if tabBosses then pcall(function() tabBosses:setChecked(tab == CONFIG.TAB_BOSSES) end) end

    BestiaryUI.renderGrid()

    local detailPanel = window and window:recursiveGetChildById('detailPanel')
    if detailPanel then detailPanel:setVisible(false) end
end

function onSearchChange(widget)
    searchQuery     = widget and widget:getText() or ''
    currentPage     = 1
    selectedMonster = nil
    selectedCard    = nil
    BestiaryUI.renderGrid()

    local detailPanel = window and window:recursiveGetChildById('detailPanel')
    if detailPanel then detailPanel:setVisible(false) end
end

function onCardClick(cardWidget)
    if not cardWidget or not cardWidget.monsterData then return end
    BestiaryController.selectMonster(cardWidget.monsterData)
end

function onCardHover(cardWidget, hovered)
    if not cardWidget then return end
    if hovered then
        cardWidget:setBackgroundColor('#353535')
    else
        cardWidget:setBackgroundColor('#252525')
    end
end

function onPrevPage()
    if currentPage > 1 then
        currentPage     = currentPage - 1
        selectedMonster = nil
        selectedCard    = nil
        BestiaryUI.renderGrid()
        local detailPanel = window and window:recursiveGetChildById('detailPanel')
        if detailPanel then detailPanel:setVisible(false) end
    end
end

function onNextPage()
    if currentPage < totalPages then
        currentPage     = currentPage + 1
        selectedMonster = nil
        selectedCard    = nil
        BestiaryUI.renderGrid()
        local detailPanel = window and window:recursiveGetChildById('detailPanel')
        if detailPanel then detailPanel:setVisible(false) end
    end
end

function onWindowClose()
    BestiaryUI.close()
    if button then button:setOn(false) end
end

------------------------------------------------------------------------
-- MODULE LIFECYCLE
------------------------------------------------------------------------
local function toggle()
    if BestiaryUI.isOpen() then
        BestiaryUI.close()
        if button then button:setOn(false) end
    else
        BestiaryUI.open()
        if button then button:setOn(true) end
    end
end

function init()
    BestiaryController.init()

    local imgPath   = CONFIG.ICON_PATH
    local imgExists = g_resources.fileExists(imgPath .. '.png')
        or g_resources.fileExists(imgPath .. '.gif')
        or g_resources.fileExists(imgPath .. '.jpg')
    if not imgExists then
        imgPath = '/images/topbuttons/battle'
    end

    button = modules.client_topmenu.addRightGameToggleButton(
        'bestiaryButton',
        tr(CONFIG.TOOLTIP),
        imgPath,
        toggle,
        false,
        5
    )
end

function terminate()
    BestiaryController.terminate()
    BestiaryUI.destroyCardPool()
    BestiaryUI.destroyWindow()
    BestiaryCache.clear()

    if button then
        button:destroy()
        button = nil
    end
end

------------------------------------------------------------------------
-- EXPOSED FOR OTUI BINDING
------------------------------------------------------------------------
modules.game_bestiary = {
    onTabClick     = onTabClick,
    onSearchChange = onSearchChange,
    onCardClick    = onCardClick,
    onCardHover    = onCardHover,
    onPrevPage     = onPrevPage,
    onNextPage     = onNextPage,
    onWindowClose  = onWindowClose,
}
