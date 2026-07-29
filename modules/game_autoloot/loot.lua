GameServerOpcodes = GameServerOpcodes or {}
GameServerOpcodes.AutoLoot = 157

local window = nil
local topButton = nil

local catalog = {}        -- { {id, clientId, name}, ... } — full admin-curated list
local selectedIds = {}    -- [itemId] = true — player's personal list
local maxSlots = 30
local moneyEnabled = false
local moneyToBank = false

function init()
  connect(g_game, { onGameEnd = offline, onGameStart = onGameStart })
  ProtocolGame.registerExtendedOpcode(GameServerOpcodes.AutoLoot, onServerOpcode)

  topButton = modules.client_topmenu.addRightGameToggleButton('lootButton', tr('Autoloot'), 'loot', toggle)
  window = g_ui.displayUI('loot')
  window:hide()

  connect(window:getChildById('searchEdit'), {
    onTextChange = function() renderLeftGrid() end
  })
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
    pg:sendExtendedOpcode(157, '')
  end
end

function offline()
  catalog = {}
  selectedIds = {}
  if window then window:hide() end
end

function toggle()
  if window:isVisible() then
    window:hide()
  else
    window:show()
    window:raise()
    window:focus()
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
      table.insert(catalog, {
        id = tonumber(fields[1]),
        clientId = tonumber(fields[2]),
        name = fields[3],
      })
    end
  end
  renderLeftGrid()
end

function parseState(buffer)
  local parts = buffer:split('|')
  -- state|maxSlots|moneyEnabled|moneyToBank|id;clientId;name@id;clientId;name@...
  maxSlots = tonumber(parts[2]) or 30
  moneyEnabled = (parts[3] == '1')
  moneyToBank = (parts[4] == '1')

  selectedIds = {}
  local items = {}
  if parts[5] and parts[5] ~= '' then
    for _, entry in ipairs(parts[5]:split('@')) do
      local fields = entry:split(';')
      if #fields >= 3 then
        local id = tonumber(fields[1])
        selectedIds[id] = true
        table.insert(items, { id = id, clientId = tonumber(fields[2]), name = fields[3] })
      end
    end
  end

  if window then
    window:getChildById('slotsLabel'):setText(#items .. '/' .. maxSlots)
    window:getChildById('moneyCheckbox'):setChecked(moneyEnabled)
    window:getChildById('moneyDestCheckbox'):setChecked(moneyToBank)
  end

  renderRightGrid(items)
  renderLeftGrid()
end

function renderLeftGrid()
  if not window then return end
  local leftGrid = window:getChildById('leftGrid')
  leftGrid:destroyChildren()

  local query = window:getChildById('searchEdit'):getText():lower()
  for _, item in ipairs(catalog) do
    if not selectedIds[item.id] and (query == '' or item.name:lower():find(query, 1, true)) then
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
  local rightGrid = window:getChildById('rightGrid')
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

function toggleMoneyDest()
  local pg = g_game.getProtocolGame()
  if pg then pg:sendExtendedOpcode(157, 'moneydest') end
end
