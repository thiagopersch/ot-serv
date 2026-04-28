-- Vocation Change Module
print("[CV] Loading module...")

local OPCODE = 230

local win = nil
local list = nil
local scrollBar = nil
local currentCreature = nil
local currentName = nil
local changeBtn = nil
local closeBtn = nil
local selectedId = nil
local gameConnected = false

function init()
  print("[CV] ========== INIT START ==========")

  if win then
    print("[CV] WARNING: Already initialized!")
    return
  end

  win = g_ui.displayUI('vocation_change')
  if not win then
    print("[CV] ERROR: Failed to load UI")
    return
  end
  win:hide()

  -- Use vocationsScroll agora (UIScrollArea), não vocationsList
  list            = win:recursiveGetChildById('vocationsScroll')
  currentCreature = win:recursiveGetChildById('vocationPanel')
  currentName     = win:recursiveGetChildById('nameLabel')
  changeBtn       = win:recursiveGetChildById('changeButton')
  closeBtn        = win:recursiveGetChildById('closeButton')

  -- SEM setVerticalScrollBar — UIScrollArea gerencia sozinho

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
      print("[CV] Game started, registering opcode " .. OPCODE)
      pcall(function() ProtocolGame.unregisterExtendedOpcode(OPCODE) end)
      ProtocolGame.registerExtendedOpcode(OPCODE, onOpcode)
      print("[CV] Opcode registered!")
    end,
    onGameEnd = function()
      gameConnected = false
      print("[CV] Game ended")
      if win then win:hide() end
      pcall(function() ProtocolGame.unregisterExtendedOpcode(OPCODE) end)
    end
  })

  print("[CV] ========== INIT END ==========")
end

function terminate()
  print("[CV] Terminating...")
  pcall(function() ProtocolGame.unregisterExtendedOpcode(OPCODE) end)
  if win then
    win:destroy()
    win = nil
  end
  print("[CV] Terminated")
end

local function fromHex(s)
  return (s:gsub("%x%x", function(h)
    return string.char(tonumber(h, 16))
  end))
end

function onOpcode(protocol, opcode, buffer)
  print("[CV] >>> RECEIVED OPCODE " .. opcode .. " LEN: " .. #buffer)
  if opcode ~= OPCODE then return end
  if #buffer < 1 then return end

  -- Decodifica hex → binário
  local bin = fromHex(buffer)
  print("[CV] Decoded binary len: " .. #bin)

  if #bin < 1 then
    print("[CV] ERROR: decode failed")
    return
  end

  local action = bin:byte(1)
  print("[CV] Action: " .. action)

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

function processData(data)
  print("[CV] processData len: " .. #data)
  if #data < 4 then
    print("[CV] ERROR: Data too short! (need 4, got " .. #data .. ")")
    return
  end

  local pos = 1

  local function rU8()
    local v = data:byte(pos) or 0
    pos = pos + 1
    return v
  end

  -- Big-endian U16 (high byte primeiro)
  local function rU16()
    local hi = rU8()
    local lo = rU8()
    return hi * 256 + lo
  end

  local function rStr()
    local len = rU16()
    if len <= 0 then return "" end
    local s = data:sub(pos, pos + len - 1)
    pos = pos + len
    return s
  end

  local currentId = rU16()
  local count     = rU16()
  print("[CV] currentId=" .. currentId .. " count=" .. count)

  if list then list:destroyChildren() end
  selectedId = nil
  if changeBtn then changeBtn:setEnabled(false) end

  for i = 1, count do
    if pos > #data then
      print("[CV] WARNING: out of data at " .. i)
      break
    end

    local id       = rU16()
    local lookType = rU16()
    local name     = rStr()
    print("[CV] Voc " .. i .. ": " .. name .. " id=" .. id .. " look=" .. lookType)

    if list then
      local item = g_ui.createWidget('Panel', list)
      item:setId('voc_' .. id)
      item:setHeight(52)
      item:setBackgroundColor('#1a1a1a')
      item.vocId = id
      item.onClick = function() selectVoc(item, id) end

      local ok, creature = pcall(function()
        return g_ui.createWidget('UICreature', item)
      end)
      if ok and creature then
        creature:setOutfit({ lookType = lookType })
        creature:setSize({ width = 40, height = 40 })
        creature:setMarginLeft(6)
        creature:setMarginTop(6)
        creature:setFixedCreatureSize(true)
        creature:setPhantom(true)
      end

      local label = g_ui.createWidget('Label', item)
      label:setText(name)
      label:setColor('#ffffff')
      label:setMarginLeft(54)
      label:setMarginTop(16)
      label:setPhantom(true)

      if id == currentId then
        item:setBackgroundColor('#003300')
        if currentCreature then currentCreature:setOutfit({ lookType = lookType }) end
        if currentName then currentName:setText(name) end
      end
    end
  end
end

function selectVoc(widget, id)
  if not list then return end
  for _, child in pairs(list:getChildren()) do
    -- Keep green highlight for current vocation, gray for others
    if child.vocId and child:getId() ~= ('voc_' .. id) then
      child:setBackgroundColor('#1a1a1a')
    end
  end
  widget:setBackgroundColor('#2a4a6a')
  selectedId = id
  if changeBtn then changeBtn:setEnabled(true) end
  print("[CV] Selected voc: " .. id)
end

function requestChange()
  if not selectedId then return end
  print("[CV] Requesting change to voc: " .. selectedId)
  local msg = string.char(1)
      .. string.char(selectedId % 256)
      .. string.char(math.floor(selectedId / 256))
  g_game.getProtocolGame():sendExtendedOpcode(OPCODE, msg)
  if win then win:hide() end
end

function toggle()
  if win then
    if win:isVisible() then
      win:hide()
    else
      win:show()
      win:raise()
      win:focus()
    end
  end
end
