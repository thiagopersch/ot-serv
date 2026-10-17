GameServerOpcodes = GameServerOpcodes or {}
GameServerOpcodes.AutoLoot = 157

local window = nil
local topButton = nil

local catalog = {}        -- { {id, clientId, name, category}, ... } — full admin-curated list
local selectedIds = {}    -- [itemId] = true — player's personal list
local maxSlots = 30
local moneyEnabled = false
local moneyToBank = false

-- Ordem dos grupos nas duas grades e opções do filtro. A chave vem do servidor (4º campo do
-- catálogo/state), classificada pelo items.xml ou forçada no portal (/admin/autoloot-items).
local CATEGORIES = {
  { key = 'helmet', label = 'Helmets' },
  { key = 'armor', label = 'Armors' },
  { key = 'legs', label = 'Legs' },
  { key = 'boots', label = 'Boots' },
  { key = 'shield', label = 'Shields' },
  { key = 'weapon', label = 'Weapons' },
  { key = 'ammo', label = 'Ammunition' },
  { key = 'amulet', label = 'Amulets' },
  { key = 'ring', label = 'Rings' },
  { key = 'potion', label = 'Potions' },
  { key = 'healing', label = 'Healing' },
  { key = 'food', label = 'Foods' },
  { key = 'rune', label = 'Runes' },
  { key = 'fragment', label = 'Fragments' },
  { key = 'quest', label = 'Quest items' },
  { key = 'money', label = 'Money' },
  { key = 'backpack', label = 'Backpacks' },
  { key = 'other', label = 'Others' },
}

local categoryRank = {}
for index, category in ipairs(CATEGORIES) do
  categoryRank[category.key] = index
end

local selectedCategory = nil -- nil = todos os tipos

local function normalizeCategory(category)
  return categoryRank[category] and category or 'other'
end

-- Agrupa por tipo (ordem de CATEGORIES) e, dentro do grupo, em ordem alfabética.
local function sortItems(list)
  table.sort(list, function(a, b)
    local rankA, rankB = categoryRank[a.category], categoryRank[b.category]
    if rankA ~= rankB then return rankA < rankB end
    local nameA, nameB = a.name:lower(), b.name:lower()
    if nameA ~= nameB then return nameA < nameB end
    return a.id < b.id
  end)
end

local function parseItemFields(fields)
  return {
    id = tonumber(fields[1]),
    clientId = tonumber(fields[2]),
    name = fields[3],
    category = normalizeCategory(fields[4]),
  }
end

function init()
  connect(g_game, { onGameEnd = offline, onGameStart = onGameStart })
  ProtocolGame.registerExtendedOpcode(GameServerOpcodes.AutoLoot, onServerOpcode)

  topButton = modules.client_topmenu.addRightGameToggleButton('lootButton', tr('Autoloot'), 'loot', toggle)
  window = g_ui.displayUI('loot')
  window:hide()

  connect(window:recursiveGetChildById('searchEdit'), {
    onTextChange = function() renderLeftGrid() end
  })

  local categoryCombo = window:recursiveGetChildById('categoryCombo')
  categoryCombo:addOption(tr('All types'), '')
  for _, category in ipairs(CATEGORIES) do
    categoryCombo:addOption(tr(category.label), category.key)
  end
  categoryCombo.onOptionChange = function(widget, text, data)
    selectedCategory = (data and data ~= '') and data or nil
    renderLeftGrid()
  end
end

function terminate()
  disconnect(g_game, { onGameEnd = offline, onGameStart = onGameStart })
  ProtocolGame.unregisterExtendedOpcode(GameServerOpcodes.AutoLoot)
  if window then window:destroy() end
  if topButton then topButton:destroy() end
end

function onGameStart()
  local pg = g_game.getProtocolGame()
  if pg then
    pg:sendExtendedOpcode(157, 'catalog')
    pg:sendExtendedOpcode(157, 'state')
  end
end

function offline()
  catalog = {}
  selectedIds = {}
  if window then
    window:hide()
    local leftGrid = window:recursiveGetChildById('leftGrid')
    local rightGrid = window:recursiveGetChildById('rightGrid')
    if leftGrid then leftGrid:destroyChildren() end
    if rightGrid then rightGrid:destroyChildren() end
    local slotsLabel = window:recursiveGetChildById('slotsLabel')
    if slotsLabel then slotsLabel:setText('0/' .. maxSlots) end
    local moneyCheckbox = window:recursiveGetChildById('moneyCheckbox')
    if moneyCheckbox then moneyCheckbox:setChecked(false) end
    local categoryCombo = window:recursiveGetChildById('categoryCombo')
    if categoryCombo then categoryCombo:setCurrentIndex(1) end
  end
end

function toggle()
  if window:isVisible() then
    window:hide()
  else
    window:show()
    window:raise()
    window:focus()

    local pg = g_game.getProtocolGame()
    if pg then pg:sendExtendedOpcode(157, 'catalog') end
  end
end

function onServerOpcode(protocol, opcode, buffer)
  if opcode ~= GameServerOpcodes.AutoLoot then return end

  if buffer:find('^catalog') then
    parseCatalog(buffer)
  elseif buffer:find('^state') then
    parseState(buffer)
  end
end

function parseCatalog(buffer)
  local parts = buffer:split('|')
  catalog = {}
  for i = 2, #parts do
    local fields = parts[i]:split(';')
    if #fields >= 3 then
      table.insert(catalog, parseItemFields(fields))
    end
  end
  sortItems(catalog)
  renderLeftGrid()
end

function parseState(buffer)
  local parts = buffer:split('|')
  -- state|maxSlots|moneyEnabled|moneyToBank|id;clientId;name;category@id;clientId;name;category@...
  maxSlots = tonumber(parts[2]) or 30
  moneyEnabled = (parts[3] == '1')
  moneyToBank = (parts[4] == '1')

  selectedIds = {}
  local items = {}
  if parts[5] and parts[5] ~= '' then
    for _, entry in ipairs(parts[5]:split('@')) do
      local fields = entry:split(';')
      if #fields >= 3 then
        local item = parseItemFields(fields)
        selectedIds[item.id] = true
        table.insert(items, item)
      end
    end
  end
  sortItems(items)

  if window then
    window:getChildById('slotsLabel'):setText(#items .. '/' .. maxSlots)
    window:getChildById('moneyCheckbox'):setChecked(moneyEnabled)
  end

  renderRightGrid(items)
  renderLeftGrid()
end

function renderLeftGrid()
  if not window then return end
  local leftGrid = window:recursiveGetChildById('leftGrid')
  leftGrid:destroyChildren()

  local query = window:recursiveGetChildById('searchEdit'):getText():lower()
  for _, item in ipairs(catalog) do
    if not selectedIds[item.id]
        and (not selectedCategory or item.category == selectedCategory)
        and (query == '' or item.name:lower():find(query, 1, true)) then
      local slot = g_ui.createWidget('AutolootItemSlot', leftGrid)
      slot:setItemId(item.clientId)
      slot:setTooltip(item.name)
      slot.onClick = function()
        local pg = g_game.getProtocolGame()
        if pg then pg:sendExtendedOpcode(157, 'add, ' .. item.id) end
      end
    end
  end
end

function renderRightGrid(items)
  if not window then return end
  local rightGrid = window:recursiveGetChildById('rightGrid')
  rightGrid:destroyChildren()

  for _, item in ipairs(items) do
    local slot = g_ui.createWidget('AutolootItemSlot', rightGrid)
    slot:setItemId(item.clientId)
    slot:setTooltip(item.name)
    slot.onClick = function()
      local pg = g_game.getProtocolGame()
      if pg then pg:sendExtendedOpcode(157, 'remove, ' .. item.id) end
    end
  end
end

function toggleMoney()
  local pg = g_game.getProtocolGame()
  if pg then pg:sendExtendedOpcode(157, 'money') end
end

function clearAll()
  local pg = g_game.getProtocolGame()
  if pg then pg:sendExtendedOpcode(157, 'clean') end
end
