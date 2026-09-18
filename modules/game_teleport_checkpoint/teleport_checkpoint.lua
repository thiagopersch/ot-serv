-- Teleport checkpoint window: monument (server item 53225) sends the full list of
-- configured points on use. Server contract (data/creaturescripts/scripts/teleport_checkpoint_opcode.lua,
-- data/actions/scripts/teleport_checkpoint.lua):
--   <- {action='list', points=[{id,name,position,purchased,costs=[{itemId,clientId,count,name}]}]}
--   -> {action='buy', pointId=N}          <- {action='result', success, message} or {action='list', ...}
--   -> {action='teleport', pointId=N}     <- {action='result', success, message}
local OPCODE = 253
local MAX_MONUMENT_DISTANCE = 1
local DEFAULT_POINT_ID = 1

local window = nil
local points = {}
local selectedId = nil
local monumentPosition = nil

function init()
  connect(g_game, { onGameEnd = offline })
  connect(LocalPlayer, { onPositionChange = onLocalPlayerPositionChange })
  ProtocolGame.registerExtendedOpcode(OPCODE, onOpcode)
end

function terminate()
  disconnect(g_game, { onGameEnd = offline })
  disconnect(LocalPlayer, { onPositionChange = onLocalPlayerPositionChange })
  ProtocolGame.unregisterExtendedOpcode(OPCODE)
  destroyWindow()
end

function offline()
  points = {}
  selectedId = nil
  monumentPosition = nil
  destroyWindow()
end

function destroyWindow()
  if window then
    window:destroy()
    window = nil
  end
  monumentPosition = nil
end

-- Auto-closes the window once the player walks away from the monument used to open it.
function onLocalPlayerPositionChange(player, newPos, oldPos)
  if not window or not monumentPosition then return end

  if newPos.z ~= monumentPosition.z
      or math.abs(newPos.x - monumentPosition.x) > MAX_MONUMENT_DISTANCE
      or math.abs(newPos.y - monumentPosition.y) > MAX_MONUMENT_DISTANCE then
    destroyWindow()
  end
end

function close()
  destroyWindow()
end

local function findSelectedPoint()
  for _, point in ipairs(points) do
    if point.id == selectedId then return point end
  end
  return nil
end

function selectPoint(pointId)
  selectedId = pointId
  updateWindow()
end

-- One cost per line ("250x Crystal Coin\n1x Banana") so the message box grows in
-- height, not width, when a point also requires an extra item.
local function formatCostLines(costs)
  local lines = {}
  for _, cost in ipairs(costs) do
    table.insert(lines, string.format('%dx %s', cost.count or 1, cost.name or ''))
  end
  return table.concat(lines, '\n')
end

-- Only sends the 'buy' opcode after the player confirms the cost in a separate
-- dialog (UIMessageBox:addButton never closes the box itself, hence the explicit
-- messageBox:ok()/:cancel() calls — same pattern as game_battle_pass.confirmBuyLevel).
function buySelected()
  local point = findSelectedPoint()
  if not point then return end

  local messageBox
  local function onYes()
    local pg = g_game.getProtocolGame()
    if pg then
      pg:sendExtendedOpcode(OPCODE, json.encode({ action = 'buy', pointId = point.id }))
    end
    messageBox:ok()
  end
  local function onNo()
    messageBox:cancel()
  end

  messageBox = displayGeneralBox(tr('Buy Teleport Point'),
    tr('Do you want to buy the teleport point to\n%s?\n\nCost:\n%s', point.name, formatCostLines(point.costs)), {
      { text = tr('Yes'), callback = onYes },
      { text = tr('No'),  callback = onNo },
      anchor = AnchorHorizontalCenter
    }, onYes, onNo)
end

function teleportSelected()
  local point = findSelectedPoint()
  if not point or not point.purchased then return end
  local pg = g_game.getProtocolGame()
  if not pg then return end
  pg:sendExtendedOpcode(OPCODE, json.encode({ action = 'teleport', pointId = point.id }))
end

function onOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then return end
  if not buffer or buffer == '' then return end

  local ok, data = pcall(json.decode, buffer)
  if not ok or type(data) ~= 'table' then return end

  if data.action == 'list' then
    points = data.points or {}
    if data.monumentPosition then monumentPosition = data.monumentPosition end
    if not window then
      selectedId = DEFAULT_POINT_ID
      window = g_ui.displayUI('teleport_checkpoint')
    end
    if not findSelectedPoint() then selectedId = points[1] and points[1].id or nil end
    updateWindow()
  elseif data.action == 'result' then
    if not window then return end
    if data.success then
      -- Only the 'teleport' action replies with success — the player has moved, close the window.
      destroyWindow()
    else
      displayErrorBox(tr('Teleport Checkpoint'), data.message or tr('Something went wrong.'))
    end
  end
end

local function renderList()
  local listPanel = window:recursiveGetChildById('pointList')
  listPanel:destroyChildren()

  for _, point in ipairs(points) do
    local entry = g_ui.createWidget('TeleportCheckpointEntry', listPanel)
    entry:setId('point' .. point.id)
    entry:getChildById('nameLabel'):setText(point.name)
    entry:getChildById('lockIcon'):setVisible(not point.purchased)
    entry:setOn(point.id == selectedId)
    entry.onClick = function() selectPoint(point.id) end
  end
end

function updateWindow()
  if not window then return end

  renderList()

  local minimapWidget = window:recursiveGetChildById('minimap')
  local buyButton = window:getChildById('buyButton')
  local teleportButton = window:getChildById('teleportButton')
  local nameLabel = window:recursiveGetChildById('selectedNameLabel')

  local point = findSelectedPoint()
  if not point then
    nameLabel:setText(tr('Select a destination'))
    buyButton:setVisible(false)
    teleportButton:setVisible(false)
    teleportButton:setEnabled(false)
    return
  end

  nameLabel:setText(point.name)
  minimapWidget:setCameraPosition(point.position)
  minimapWidget:setCrossPosition(point.position)
  minimapWidget:setZoom(0)

  if point.purchased then
    buyButton:setVisible(false)
    teleportButton:setVisible(true)
    teleportButton:setEnabled(true)
  else
    buyButton:setVisible(true)
    teleportButton:setVisible(false)
    teleportButton:setEnabled(false)
  end
end
