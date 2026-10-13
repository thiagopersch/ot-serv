-- Janela CRAFT: evolucao de raridade de itens.
-- Contrato com o servidor (data/creaturescripts/scripts/rarity_opcode.lua, opcode 170, JSON):
--   -> {action='open'}                                  <- {type='open', catalog, owned, materials}
--   -> {action='refresh'}                               <- {type='state', owned, materials}
--   -> {action='evolve', ref, id, guaranteed}           <- {type='result', success, itemName, rarity, ...} + state
--                                                       <- {type='error', message}
local OPCODE = 170

local TABS = {
  { id = 'helmet',  text = 'Helmet' },
  { id = 'armor',   text = 'Armor' },
  { id = 'legs',    text = 'Legs' },
  { id = 'boots',   text = 'Boots' },
  { id = 'weapons', text = 'Weapons' },
  { id = 'shields', text = 'Shields' },
  { id = 'potions', text = 'Potions' },
  { id = 'pets',    text = 'Pets' },
  { id = 'others',  text = 'Others' },
}

local FILTER_ALL = 'All'
local FILTER_MINE = 'Only mine'

local window = nil
local topButton = nil
local tabButtons = {}
local currentTab = TABS[1].id
local currentFilter = FILTER_ALL
local refreshEvent = nil

local catalog = nil       -- recebido no 'open'
local itemsById = {}      -- itemid -> info do catalogo {id, cid, name, group}
local groupsByIndex = {}  -- index -> grupo {category, maxRarity, steps}
local materialInfo = {}   -- itemid -> {id, cid, name}
local materialCounts = {} -- itemid -> quantidade que o jogador possui
local owned = {}          -- instancias do jogador {ref, id, rarity}
local entries = {}        -- linhas visiveis na sidebar
local selected = nil      -- entrada selecionada {key, id, ref, rarity, owned}

-- ===================== util =====================

-- o texto do cliente (fontes cp1252, TextEdit e nomes vindos do servidor) e latin1:
-- mapeia cada byte acentuado para a letra sem acento
local ACCENTS = {}
do
  local ranges = {
    { 192, 197, 'a' }, { 199, 199, 'c' }, { 200, 203, 'e' }, { 204, 207, 'i' }, { 209, 209, 'n' },
    { 210, 214, 'o' }, { 216, 216, 'o' }, { 217, 220, 'u' }, { 221, 221, 'y' },
    { 224, 229, 'a' }, { 231, 231, 'c' }, { 232, 235, 'e' }, { 236, 239, 'i' }, { 241, 241, 'n' },
    { 242, 246, 'o' }, { 248, 248, 'o' }, { 249, 252, 'u' }, { 253, 253, 'y' }, { 255, 255, 'y' },
  }
  for _, range in ipairs(ranges) do
    for byte = range[1], range[2] do
      ACCENTS[string.char(byte)] = range[3]
    end
  end
end

-- minusculas, sem acentos e sem caracteres especiais
local function normalize(text)
  local plain = tostring(text or ''):gsub('[\192-\255]', ACCENTS)
  return (plain:lower():gsub('[^%w]', ''))
end

local function getTier(rarity)
  if not catalog then return nil end
  return catalog.tiers[(rarity or 0) + 1]
end

local function tierName(rarity)
  local tier = getTier(rarity)
  return tier and tier.name or ('Rarity ' .. tostring(rarity))
end

local function tierColor(rarity)
  local tier = getTier(rarity)
  return tier and tier.color or '#c8c8c8'
end

local function createItem(clientId, rarity, count)
  local item = Item.create(clientId, count or 1)
  if item and rarity and rarity > 0 then
    item:setCustomAttribute(RARITY_ATTRIBUTE_KEY, rarity)
  end
  return item
end

-- slot de raridade: mostra o item com borda/fundo na cor do tier
local function setRaritySlot(widget, clientId, rarity)
  widget:setItem(createItem(clientId, rarity))
  local color = tierColor(rarity)
  widget:setBorderColor(color)
  widget:setBorderWidth(2)
  widget:setBackgroundColor(color .. '33')
end

local function getStep(groupIndex, rarity)
  local group = groupsByIndex[groupIndex]
  if not group or rarity >= group.maxRarity then return nil end
  return group.steps[rarity + 1]
end

local function sendAction(data)
  local protocol = g_game.getProtocolGame()
  if protocol then
    protocol:sendExtendedJSONOpcode(OPCODE, data)
  end
end

-- ===================== ciclo de vida =====================

function init()
  connect(g_game, { onGameEnd = offline })
  connect(LocalPlayer, { onInventoryChange = scheduleRefresh })
  connect(Container, { onAddItem = scheduleRefresh, onRemoveItem = scheduleRefresh, onUpdateItem = scheduleRefresh })
  ProtocolGame.registerExtendedJSONOpcode(OPCODE, onServerData)

  window = g_ui.displayUI('rarity_craft')
  window:hide()

  local tabBar = window:getChildById('tabBar')
  for _, tab in ipairs(TABS) do
    local button = g_ui.createWidget('RarityTabButton', tabBar)
    button:setId('tab_' .. tab.id)
    button:setText(tab.text)
    button.onClick = function() selectTab(tab.id) end
    tabButtons[tab.id] = button
  end

  local combo = window:getChildById('filterCombo')
  combo:addOption(FILTER_ALL)
  combo:addOption(FILTER_MINE)
  combo:setCurrentOption(FILTER_ALL)
  combo.onOptionChange = function(_, text)
    currentFilter = text
    rebuildList()
  end

  local guaranteeCheck = window:recursiveGetChildById('guaranteeCheck')
  guaranteeCheck:setChecked(false)

  topButton = modules.client_topmenu.addRightGameToggleButton('rarityCraftButton', tr('Craft'),
    '/images/topbuttons/tier', toggle)

  selectTab(currentTab, true)
end

function terminate()
  disconnect(g_game, { onGameEnd = offline })
  disconnect(LocalPlayer, { onInventoryChange = scheduleRefresh })
  disconnect(Container, { onAddItem = scheduleRefresh, onRemoveItem = scheduleRefresh, onUpdateItem = scheduleRefresh })
  ProtocolGame.unregisterExtendedJSONOpcode(OPCODE)
  removeEvent(refreshEvent)
  if window then
    window:destroy()
    window = nil
  end
  if topButton then
    topButton:destroy()
    topButton = nil
  end
end

function offline()
  hide()
  catalog, owned, entries, selected = nil, {}, {}, nil
  itemsById, groupsByIndex, materialInfo, materialCounts = {}, {}, {}, {}
end

function toggle()
  if window:isVisible() then
    hide()
  else
    show()
  end
end

function show()
  if not g_game.isOnline() then return end
  window:show()
  window:raise()
  window:focus()
  if topButton then topButton:setOn(true) end
  sendAction({ action = 'open' })
end

function hide()
  if not window then return end
  window:hide()
  if topButton then topButton:setOn(false) end
end

-- inventario/containers mudaram: pede o estado de novo (com debounce)
function scheduleRefresh()
  if not window or not window:isVisible() or not catalog then return end
  removeEvent(refreshEvent)
  refreshEvent = scheduleEvent(function()
    refreshEvent = nil
    sendAction({ action = 'refresh' })
  end, 600)
end

-- ===================== dados do servidor =====================

local function applyState(data)
  owned = data.owned or {}
  materialCounts = {}
  for _, mat in ipairs(data.materials or {}) do
    materialCounts[mat.id] = mat.count
  end
end

local function applyCatalog(data)
  catalog = data
  itemsById, groupsByIndex, materialInfo = {}, {}, {}
  for _, item in ipairs(catalog.items or {}) do
    itemsById[item.id] = item
  end
  for _, group in ipairs(catalog.groups or {}) do
    groupsByIndex[group.index] = group
  end
  for _, mat in ipairs(catalog.materials or {}) do
    materialInfo[mat.id] = mat
  end
  for _, tier in ipairs(catalog.tiers or {}) do
    if tier.id > 0 then
      RarityColors[tier.id] = tier.color
    end
  end

  local multiplier = catalog.guaranteeMultiplier or 10
  window:recursiveGetChildById('guaranteeCheck'):setText(
    string.format('Guarantee 100%% success (costs %dx materials)', multiplier))
end

function onServerData(protocol, opcode, data)
  if type(data) ~= 'table' or not window then return end

  if data.type == 'open' then
    applyCatalog(data.catalog or {})
    applyState(data)
    rebuildList()
  elseif data.type == 'state' then
    applyState(data)
    rebuildList()
  elseif data.type == 'result' then
    showResult(data)
  elseif data.type == 'error' then
    displayErrorBox(tr('Craft'), data.message or 'Could not complete the action.')
  end
end

-- ===================== lista (sidebar) =====================

function selectTab(tabId, silent)
  currentTab = tabId
  for id, button in pairs(tabButtons) do
    button:setOn(id == tabId)
    button:setChecked(id == tabId)
  end
  selected = nil
  if not silent then rebuildList() end
end

function onSearchChange()
  rebuildList()
end

local function entryKey(entry)
  return entry.owned and ('ref:' .. entry.ref) or ('id:' .. entry.id)
end

local function buildEntries()
  local result = {}
  local ownedIds = {}
  local search = normalize(window:getChildById('searchEdit'):getText())

  local function accepts(info)
    local group = groupsByIndex[info.group]
    if not group or group.category ~= currentTab then return false end
    if search == '' then return true end
    return normalize(info.name):find(search, 1, true) ~= nil
      or tostring(info.cid):find(search, 1, true) ~= nil
      or tostring(info.id):find(search, 1, true) ~= nil
  end

  for _, inst in ipairs(owned) do
    local info = itemsById[inst.id]
    if info then
      ownedIds[inst.id] = true
      if accepts(info) then
        table.insert(result, { id = inst.id, ref = inst.ref, rarity = inst.rarity or 0, owned = true, info = info })
      end
    end
  end

  if currentFilter ~= FILTER_MINE then
    for _, info in ipairs(catalog and catalog.items or {}) do
      if not ownedIds[info.id] and accepts(info) then
        table.insert(result, { id = info.id, rarity = 0, owned = false, info = info })
      end
    end
  end

  table.sort(result, function(a, b)
    if a.owned ~= b.owned then return a.owned end
    if a.info.name ~= b.info.name then return a.info.name < b.info.name end
    return a.rarity > b.rarity
  end)

  for _, entry in ipairs(result) do
    entry.key = entryKey(entry)
  end
  return result
end

function rebuildList()
  if not window then return end
  local list = window:recursiveGetChildById('itemList')
  list:destroyChildren()

  if not catalog then
    window:recursiveGetChildById('emptyListLabel'):setVisible(true)
    updateDetail()
    return
  end

  entries = buildEntries()
  window:recursiveGetChildById('emptyListLabel'):setVisible(#entries == 0)

  local focusRow = nil
  local stillSelected = nil
  for _, entry in ipairs(entries) do
    local row = g_ui.createWidget('RarityListRow', list)
    row.entry = entry
    row:getChildById('item'):setItem(createItem(entry.info.cid, entry.rarity))
    row:getChildById('name'):setText(entry.info.name)
    row:getChildById('rarity'):setText(tierName(entry.rarity))
    row:getChildById('rarity'):setColor(tierColor(entry.rarity))
    if not entry.owned then
      row:setOpacity(0.4)
    end
    row.onClick = function() selectEntry(entry, row) end
    if selected and selected.key == entry.key then
      focusRow, stillSelected = row, entry
    end
  end

  selected = stillSelected
  if focusRow then
    list:focusChild(focusRow, ActiveFocusReason)
    list:ensureChildVisible(focusRow)
  end
  updateDetail()
end

function selectEntry(entry, row)
  selected = entry
  if row then
    row:getParent():focusChild(row, MouseFocusReason)
  end
  updateDetail()
end

-- ===================== detalhe =====================

local function computeRequirements(entry, guaranteed)
  local step = getStep(entry.info.group, entry.rarity)
  if not step then return nil end

  local multiplier = guaranteed and (catalog.guaranteeMultiplier or 10) or 1
  local reqs, canAfford = {}, true
  for _, mat in ipairs(step.materials or {}) do
    local need = mat.count * multiplier
    local have = materialCounts[mat.id] or 0
    if have < need then canAfford = false end
    table.insert(reqs, { id = mat.id, need = need, have = have })
  end
  return step, reqs, canAfford
end

function updateDetail()
  if not window then return end
  local detail = window:getChildById('detailPanel')
  local content = detail:getChildById('content')
  local emptyLabel = detail:getChildById('emptyDetailLabel')

  if not selected or not catalog then
    content:setVisible(false)
    emptyLabel:setVisible(true)
    return
  end
  content:setVisible(true)
  emptyLabel:setVisible(false)

  local entry = selected
  local info = entry.info
  local group = groupsByIndex[info.group]
  local guaranteed = content:getChildById('guaranteeCheck'):isChecked()

  content:getChildById('titleLabel'):setText(info.name)
  setRaritySlot(content:getChildById('preview'), info.cid, entry.rarity)
  content:getChildById('ownedLabel'):setText(entry.owned and 'You own this item' or "You don't own this item")
  content:getChildById('ownedLabel'):setColor(entry.owned and '#7fd17f' or '#d17f7f')

  local rarityRow = content:getChildById('rarityRow')
  local current = entry.rarity
  setRaritySlot(rarityRow:getChildById('currentSlot'), info.cid, current)
  rarityRow:getChildById('currentName'):setText(tierName(current))
  rarityRow:getChildById('currentName'):setColor(tierColor(current))
  local currentTier = getTier(current)
  rarityRow:getChildById('currentBonus'):setText(
    (currentTier and currentTier.bonus > 0) and string.format('+%d%% attributes', currentTier.bonus) or 'Base attributes')

  local isMax = not group or current >= group.maxRarity
  rarityRow:getChildById('arrow'):setVisible(not isMax)
  rarityRow:getChildById('nextSlot'):setVisible(not isMax)
  rarityRow:getChildById('nextName'):setVisible(not isMax)
  rarityRow:getChildById('nextBonus'):setVisible(not isMax)
  content:getChildById('maxRarityLabel'):setVisible(isMax)
  content:getChildById('materialsTitle'):setVisible(not isMax)

  local materialsList = content:getChildById('materialsList')
  materialsList:destroyChildren()

  local evolveButton = content:getChildById('evolveButton')
  local chanceLabel = content:getChildById('chanceLabel')
  local guaranteeCheck = content:getChildById('guaranteeCheck')
  guaranteeCheck:setVisible(not isMax)

  if isMax then
    chanceLabel:setText('')
    evolveButton:setEnabled(false)
    return
  end

  local nextRarity = current + 1
  setRaritySlot(rarityRow:getChildById('nextSlot'), info.cid, nextRarity)
  rarityRow:getChildById('nextName'):setText(tierName(nextRarity))
  rarityRow:getChildById('nextName'):setColor(tierColor(nextRarity))
  local nextTier = getTier(nextRarity)
  rarityRow:getChildById('nextBonus'):setText(string.format('+%d%% attributes', nextTier and nextTier.bonus or 0))

  local step, reqs, canAfford = computeRequirements(entry, guaranteed)
  local configured = step and step.configured ~= false
  for _, req in ipairs(reqs or {}) do
    local mat = materialInfo[req.id] or { cid = 0, name = 'item ' .. req.id }
    local row = g_ui.createWidget('RarityMaterialRow', materialsList)
    row:getChildById('item'):setItem(Item.create(mat.cid, 1))
    row:getChildById('name'):setText(mat.name)
    local countLabel = row:getChildById('count')
    countLabel:setText(string.format('%d / %d', req.have, req.need))
    countLabel:setColor(req.have >= req.need and '#7fd17f' or '#ff6060')
  end

  if not configured then
    chanceLabel:setText('This upgrade is not configured yet.')
    chanceLabel:setColor('#ff6060')
  else
    local chance = guaranteed and 100 or step.chance
    chanceLabel:setText(string.format('Success chance: %d%%', chance))
    chanceLabel:setColor(chance >= 100 and '#7fd17f' or '#dfdfdf')
  end

  evolveButton:setEnabled(entry.owned and configured and canAfford)
end

function onGuaranteeChange()
  updateDetail()
end

-- ===================== evolucao =====================

local confirmBox = nil

function onEvolveClick()
  if not selected or not selected.owned or confirmBox then return end
  local entry = selected
  local guaranteed = window:recursiveGetChildById('guaranteeCheck'):isChecked()
  local step, _, canAfford = computeRequirements(entry, guaranteed)
  if not step or not canAfford then return end

  local message = string.format('Do you really want to upgrade %s from %s to %s?', entry.info.name,
    tierName(entry.rarity), tierName(entry.rarity + 1))
  if guaranteed then
    message = message .. '\nGuaranteed success (100%).'
  else
    message = message .. string.format('\nSuccess chance: %d%%. Materials are lost on failure.', step.chance)
  end

  local function close()
    if confirmBox then
      confirmBox:destroy()
      confirmBox = nil
    end
    if window and window:isVisible() then
      window:raise()
      window:focus()
    end
  end

  local function confirm()
    close()
    sendAction({ action = 'evolve', ref = entry.ref, id = entry.id, guaranteed = guaranteed })
  end

  confirmBox = displayGeneralBox('Confirm upgrade', message, {
    { text = 'Cancel', callback = close },
    { text = 'Confirm', callback = confirm },
    anchor = AnchorHorizontalCenter
  }, confirm, close)
end

function showResult(data)
  -- mantem o item selecionado apos a atualizacao da lista
  if data.ref then
    selected = { key = 'ref:' .. data.ref }
  end

  if data.success then
    displayInfoBox('Congratulations!', string.format('You upgraded %s to %s rarity!', data.itemName or 'the item',
      tierName(data.rarity)))
  else
    local message = string.format('The upgrade of %s failed. Materials were consumed.', data.itemName or 'the item')
    if data.downgraded then
      message = message .. string.format('\nThe item dropped to %s rarity.', tierName(data.rarity))
    end
    displayInfoBox('Upgrade failed', message)
  end
end
