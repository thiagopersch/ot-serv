local vocWindow = nil
local vocations = {}
local selectedVocation = nil
local OPCODE_OPEN = 100
local OPCODE_CLOSE = 101

function init()
  connect(g_game, { onExtendedOpcode = onExtendedOpcode })
  ProtocolGame.registerExtendedOpcode(OPCODE_OPEN, onExtendedOpcode)
  ProtocolGame.registerExtendedOpcode(OPCODE_CLOSE, onExtendedOpcode)
end

function terminate()
  disconnect(g_game, { onExtendedOpcode = onExtendedOpcode })
  ProtocolGame.unregisterExtendedOpcode(OPCODE_OPEN)
  ProtocolGame.unregisterExtendedOpcode(OPCODE_CLOSE)
  if vocWindow then vocWindow:destroy() end
end

local function split(str, sep)
  if not str or type(str) ~= "string" then return {} end
  local t = {}
  for field in string.gmatch(str, "([^" .. sep .. "]+)") do
    table.insert(t, field)
  end
  return t
end

function onExtendedOpcode(protocol, opcode, buffer)
  if opcode == OPCODE_CLOSE then
    if vocWindow then vocWindow:destroy() end
    return
  end

  if opcode ~= OPCODE_OPEN then return end
  if vocWindow then vocWindow:destroy() end
  if not buffer or buffer == "" then return end

  vocations = {}
  for _, vocData in ipairs(split(buffer, "|")) do
    local info = split(vocData, ";")
    if #info >= 7 then
      local voc = {
        id = tonumber(info[1]),
        name = info[2],
        info = info[3],
        class = info[4],
        type = info[5],
        element = info[6],
        outfitId = tonumber(info[7])
      }
      table.insert(vocations, voc)
    end
  end

  if #vocations == 0 then return end

  vocWindow = g_ui.loadUI('multivoc.otui', g_ui.getRootWidget())
  if not vocWindow then
    print("[multivoc] ERRO: Falha ao carregar UI")
    return
  end

  -- CENTRALIZA
  local root = g_ui.getRootWidget()
  if root then
    local screenW = root:getWidth()
    local screenH = root:getHeight()
    local winW = vocWindow:getWidth()
    local winH = vocWindow:getHeight()
    vocWindow:setX((screenW - winW) / 2)
    vocWindow:setY((screenH - winH) / 2)
  end

  vocWindow:show()
  vocWindow:raise()
  vocWindow:focus()

  populateVocList()
  setSelectedVocation(vocations[1])

  vocWindow.onClose = function() vocWindow:destroy() end
  vocWindow.onDestroy = function() vocWindow = nil end
end

function populateVocList()
  local vocList = vocWindow:getChildById('centerPanel'):getChildById('vocList')
  if not vocList then
    print("[multivoc] ERRO: vocList não encontrado!")
    return
  end
  vocList:destroyChildren()

  for _, v in ipairs(vocations) do
    local item = g_ui.createWidget('VocItem', vocList)
    if not item then
      print("[multivoc] ERRO: Falha ao criar VocItem")
      return
    end

    item:getChildById('vocName'):setText(v.name or "???")
    item:getChildById('vocClass'):setText("Classe: " .. (v.class or "???"))
    item:getChildById('vocType'):setText("Type: " .. (v.type or "???"))
    item:getChildById('vocElement'):setText("Element: " .. (v.element or "???"))

    local outfit = item:getChildById('outfitView')
    if outfit then
      outfit:setOutfit({
        lookType = v.outfitId or 128,
        lookHead = 94,
        lookBody = 94,
        lookLegs = 94,
        lookFeet = 94
      })
    end

    item.onClick = function() setSelectedVocation(v) end
  end
end

function setSelectedVocation(voc)
  selectedVocation = voc
  if not vocWindow then return end

  local left = vocWindow:getChildById('leftPanel')
  if not left then return end

  left:getChildById('charName'):setText(voc.name or "Unknown")
  left:getChildById('charClass'):setText("Classe: " .. (voc.class or "???"))
  left:getChildById('charType'):setText("Type: " .. (voc.type or "???"))
  left:getChildById('charElement'):setText("Element: " .. (voc.element or "???"))

  local portrait = left:getChildById('charPortrait')
  if portrait then
    portrait:setOutfit({
      lookType = voc.outfitId or 128,
      lookHead = 94,
      lookBody = 94,
      lookLegs = 94,
      lookFeet = 94
    })
  end

  local btn = left:getChildById('confirmButton')
  if btn then
    btn.onClick = function()
      if selectedVocation then
        g_game.talk("/setvoc " .. selectedVocation.id)
        if vocWindow then vocWindow:destroy() end
      end
    end
  end
end
