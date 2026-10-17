local OPCODE = 248
local win = nil
local selectedShader = nil
local shaderList = {}
local gameConnected = false
local playerOutfit = nil

local function makeOutfit(look)
  if look and look > 0 then return { type = look } end
  local player = g_game.getLocalPlayer()
  if player then
    local outfit = player:getOutfit()
    if outfit and outfit.type and outfit.type > 0 then return outfit end
  end
  return { type = 128 }
end

local function clearList()
  local list = win:recursiveGetChildById('shaderList')
  if list then list:destroyChildren() end
  selectedShader = nil
  local btn = win:recursiveGetChildById('confirmButton')
  if btn then btn:setEnabled(false) end
end

local function onShaderSelect(self, focusedChild)
  if not focusedChild then return end
  local shaderName = focusedChild:getId()
  if shaderName == "" then return end
  selectedShader = shaderName
  local confirmBtn = win:recursiveGetChildById('confirmButton')
  if confirmBtn then confirmBtn:setEnabled(true) end
  local preview = win:recursiveGetChildById('preview')
  if preview then
    playerOutfit = playerOutfit or makeOutfit(0)
    preview:setOutfit({ type = playerOutfit.type, addons = playerOutfit.addons or 0, shader = shaderName })
  end
  local nameLabel = win:recursiveGetChildById('selectedName')
  if nameLabel then
    for _, sd in ipairs(shaderList) do
      if sd.shadername == shaderName then
        nameLabel:setText(sd.name)
        break
      end
    end
  end
end

local function confirm()
  if not selectedShader then return end
  local shaderId = nil
  for _, sd in ipairs(shaderList) do
    if sd.shadername == selectedShader then
      shaderId = sd.id
      break
    end
  end
  if not shaderId then return end
  local pg = g_game.getProtocolGame()
  if pg then
    pg:sendExtendedOpcode(OPCODE, "pick|" .. shaderId)
  end
  hide()
end

function cancel()
  local pg = g_game.getProtocolGame()
  if pg then
    pg:sendExtendedOpcode(OPCODE, "cancel")
  end
  hide()
end

function hide()
  if win then win:hide() end
end

function destroy()
  if win then
    win:destroy()
    win = nil
  end
end

function show()
  if not win then return end
  win:show()
  win:raise()
  win:focus()
end

local function buildList(data)
  clearList()
  shaderList = data
  playerOutfit = makeOutfit(0)
  local list = win:recursiveGetChildById('shaderList')
  if not list then return end
  list.onChildFocusChange = nil

  local width = list:getWidth()
  if width > 0 then
    local spacing = 5
    local cellWidth = math.floor((width - spacing) / 2)
    local grid = list:getLayout()
    if grid then
      grid:setCellWidth(cellWidth)
      grid:setCellHeight(145)
    end
  end

  for _, sd in ipairs(data) do
    local button = g_ui.createWidget("SelectionButton", list)
    button:setId(sd.shadername)
    button.outfit:setSize({ width = 80, height = 80 })
    button.outfit:setOutfit({ type = playerOutfit.type, addons = playerOutfit.addons or 0, shader = sd.shadername })
    button.name:setText(sd.name)
  end

  local focused = data[1] and data[1].shadername or nil

  list.onChildFocusChange = onShaderSelect
  if focused then
    local w = list[focused]
    if w then
      w:focus()
      addEvent(function()
        list:ensureChildVisible(w, { x = 0, y = 100 })
      end)
    end
  end

  if width <= 0 then
    addEvent(function()
      local w2 = list:getWidth()
      if w2 <= 0 then return end
      local spacing = 5
      local cellWidth = math.floor((w2 - spacing) / 2)
      local grid = list:getLayout()
      if grid then
        grid:setCellWidth(cellWidth)
        grid:setCellHeight(145)
      end
    end)
  end

  show()
end

local function ensureWindow()
  if win then
    local root = g_ui.getRootWidget()
    if root and root:recursiveGetChildById('shaderSelectorWindow') then
      return true
    end
    win = nil
  end
  win = g_ui.displayUI('sharderselector')
  if not win then
    return false
  end
  win:hide()
  local confirmBtn = win:recursiveGetChildById('confirmButton')
  if confirmBtn then confirmBtn.onClick = confirm end
  local cancelBtn = win:recursiveGetChildById('cancelButton')
  if cancelBtn then cancelBtn.onClick = cancel end
  return true
end

local function onOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then return end
  if not buffer or #buffer < 1 then return end
  local action, rest = buffer:match("^(%w+)%|(.+)$")
  if not action then
    action = buffer
    rest = nil
  end
  if action == "open" then
    if not ensureWindow() then return end
    if rest then
      local status, data = pcall(function() return json.decode(rest) end)
      if status and type(data) == "table" then
        pcall(buildList, data)
      end
    end
  end
end

function init()
  connect(g_game, {
    onGameStart = function()
      if gameConnected then return end
      gameConnected = true
      local pg = g_game.getProtocolGame()
      if pg then pg:sendExtendedOpcode(OPCODE, "cleanup") end
      pcall(function() ProtocolGame.unregisterExtendedOpcode(OPCODE) end)
      ProtocolGame.registerExtendedOpcode(OPCODE, onOpcode)
    end,
    onGameEnd = function()
      gameConnected = false
      if win then win:hide() end
      pcall(function() ProtocolGame.unregisterExtendedOpcode(OPCODE) end)
    end
  })
end

function terminate()
  pcall(function() ProtocolGame.unregisterExtendedOpcode(OPCODE) end)
  if win then
    win:destroy()
    win = nil
  end
end
