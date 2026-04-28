print("[CV] Loading module...")

local OPCODE          = 230
local win             = nil
local list            = nil
local currentCreature = nil
local currentName     = nil
local changeBtn       = nil
local closeBtn        = nil
local selectedId      = nil
local gameConnected   = false

local function fromHex(s)
  return (s:gsub("%x%x", function(h)
    return string.char(tonumber(h, 16))
  end))
end

-- CORREÇÃO 1: O OTClient usa a propriedade 'type' em vez de 'lookType'.
local function makeOutfit(look)
  if look and look > 0 then
    return { type = look }
  end

  local player = g_game.getLocalPlayer()
  if player then
    local outfit = player:getOutfit()
    if outfit and outfit.type and outfit.type > 0 then
      return outfit
    end
  end

  return { type = 128 }
end

local function clearList()
  if list then list:destroyChildren() end
  selectedId = nil
  if changeBtn then changeBtn:setEnabled(false) end
end

local function resetLeftPanel()
  if currentCreature then currentCreature:setOutfit(makeOutfit(0)) end
  if currentName then currentName:setText("?") end
end

-- Cria cada row da lista
local function buildRow(parentList, id, lookType, name, isCurrent)
  local bgColor = isCurrent and '#1a3a1a' or '#111128'
  local row     = g_ui.createWidget('Panel', parentList)
  row:setId('voc_' .. id)
  row:setHeight(64)
  row:setBackgroundColor(bgColor)
  row.vocId          = id
  row.isCurrent      = isCurrent

  -- CORREÇÃO 2: Substituído 'onClick' por 'onMouseRelease' para forçar o clique em um Panel.
  row.onMouseRelease = function(widget, mousePos, mouseButton)
    if mouseButton == MouseLeft then
      _G.cvSelect(row, id)
      return true
    end
  end

  -- ── Creature box ──────────────
  local cbox         = g_ui.createWidget('Panel', row)
  cbox:addAnchor(AnchorLeft, 'parent', AnchorLeft)
  cbox:addAnchor(AnchorTop, 'parent', AnchorTop)
  cbox:setWidth(58)
  cbox:setHeight(58)
  cbox:setBackgroundColor('#00000000')
  cbox:setMarginTop(3)
  cbox:setMarginLeft(3)
  cbox:setPhantom(true)

  local cw = g_ui.createWidget('UICreature', cbox)
  cw:fill('parent')
  cw:setOutfit(makeOutfit(lookType))
  cw:setFixedCreatureSize(true)
  cw:setPhantom(true)

  -- ── Label nome ───────────────────
  local lName = g_ui.createWidget('Label', row)
  lName:addAnchor(AnchorLeft, 'parent', AnchorLeft)
  lName:addAnchor(AnchorTop, 'parent', AnchorTop)
  lName:setText(name)
  lName:setFont('verdana-11px-rounded')
  lName:setColor(isCurrent and '#88ff88' or '#dddddd')
  lName:setWidth(160)
  lName:setHeight(18)
  lName:setMarginLeft(68)
  lName:setMarginTop(14)
  lName:setPhantom(true)

  -- ── Badge status ─────────────────
  local badgeText  = isCurrent and '[Current]' or '[Available]'
  local badgeColor = isCurrent and '#44bb44' or '#4488cc'

  local lBadge     = g_ui.createWidget('Label', row)
  lBadge:setText(badgeText)
  lBadge:setFont('verdana-11px-rounded')
  lBadge:setColor(badgeColor)
  lBadge:setWidth(84)
  lBadge:setHeight(16)
  lBadge:addAnchor(AnchorRight, 'parent', AnchorRight)
  lBadge:addAnchor(AnchorTop, 'parent', AnchorTop)
  lBadge:setMarginTop(24)
  lBadge:setMarginRight(6)
  lBadge:setPhantom(true)

  return row
end

-- ─── init ────────────────────────────────────────────────────────────────────
function init()
  print("[CV] INIT")
  if win then return end

  win = g_ui.displayUI('vocation_change')
  if not win then
    print("[CV] ERROR: no UI")
    return
  end
  win:hide()

  list            = win:recursiveGetChildById('vocationsScroll')
  currentCreature = win:recursiveGetChildById('vocationPanel')
  currentName     = win:recursiveGetChildById('nameLabel')
  changeBtn       = win:recursiveGetChildById('changeButton')
  closeBtn        = win:recursiveGetChildById('closeButton')

  resetLeftPanel()

  if changeBtn then
    changeBtn:setEnabled(false)
    changeBtn.onClick = function() requestChange() end
  end
  if closeBtn then
    closeBtn.onClick = function() toggle() end
  end

  connect(g_game, {
    onGameStart = function()
      if gameConnected then return end
      gameConnected = true
      pcall(function() ProtocolGame.unregisterExtendedOpcode(OPCODE) end)
      ProtocolGame.registerExtendedOpcode(OPCODE, onOpcode)
      print("[CV] opcode " .. OPCODE .. " registered")
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

-- ─── opcode ──────────────────────────────────────────────────────────────────
function onOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then return end
  if #buffer < 1 then return end

  local bin    = fromHex(buffer)
  local action = bin:byte(1)
  print("[CV] action=" .. action .. " binlen=" .. #bin)

  if action == 1 then
    if win then
      win:show()
      win:raise()
      win:focus()
    end
  elseif action == 2 then
    processData(bin:sub(2))
  elseif action == 3 then
    if win then
      win:show()
      win:raise()
      win:focus()
    end
    processData(bin:sub(2))
  end
end

-- ─── processData ─────────────────────────────────────────────────────────────
function processData(data)
  print("[CV] processData len=" .. #data)
  if #data < 4 then
    print("[CV] ERROR: too short")
    return
  end

  local pos = 1
  local function rU8()
    local v = data:byte(pos) or 0; pos = pos + 1; return v
  end
  local function rU16() return rU8() * 256 + rU8() end
  local function rStr()
    local n = rU16()
    if n <= 0 then return "" end
    local s = data:sub(pos, pos + n - 1); pos = pos + n; return s
  end

  local currentId = rU16()
  local count     = rU16()
  print("[CV] currentId=" .. currentId .. " count=" .. count)

  clearList()
  resetLeftPanel()

  for i = 1, count do
    if pos > #data then break end
    local id        = rU16()
    local lookType  = rU16()
    local name      = rStr()
    local isCurrent = (id == currentId)

    print("[CV] voc " .. i .. ": " .. name
      .. " id=" .. id
      .. " look=" .. lookType
      .. " cur=" .. tostring(isCurrent))

    -- Painel esquerdo: voc atual
    if isCurrent then
      if currentCreature then currentCreature:setOutfit(makeOutfit(lookType)) end
      if currentName then currentName:setText(name) end
    end

    if list then
      buildRow(list, id, lookType, name, isCurrent)
    end
  end
end

-- ─── selectVoc (global para ser acessível no onClick) ────────────────────────
function cvSelect(widget, id)
  if not list then return end
  for _, child in pairs(list:getChildren()) do
    child:setBackgroundColor(child.isCurrent and '#1a3a1a' or '#111128')
  end
  widget:setBackgroundColor('#1a3a5a')
  selectedId = id
  if changeBtn then
    changeBtn:setEnabled(not widget.isCurrent)
  end
  print("[CV] selected id=" .. id .. " isCurrent=" .. tostring(widget.isCurrent))
end

-- ─── requestChange ───────────────────────────────────────────────────────────
function requestChange()
  if not selectedId then return end
  print("[CV] change to " .. selectedId)
  local msg = string.char(1)
      .. string.char(selectedId % 256)
      .. string.char(math.floor(selectedId / 256))
  g_game.getProtocolGame():sendExtendedOpcode(OPCODE, msg)
  if win then win:hide() end
end

-- ─── toggle ──────────────────────────────────────────────────────────────────
function toggle()
  if not win then return end
  if win:isVisible() then
    win:hide()
  else
    win:show()
    win:raise()
    win:focus()
  end
end
