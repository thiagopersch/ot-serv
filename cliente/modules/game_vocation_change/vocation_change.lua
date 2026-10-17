print("[CV] Loading module...")

local OPCODE          = 230
local win             = nil
local list            = nil
local currentCreature = nil
local currentName     = nil
local currentLevel    = nil
local changeBtn       = nil
local closeBtn        = nil

local gameConnected   = false
local selectedId      = nil
local currentVocId    = nil
local cachedData      = ""

local RANK_NAMES = { [0] = "None", [1] = "Bronze", [2] = "Silver", [3] = "Gold", [4] = "Diamond" }
local RANK_COLORS = { [0] = "#aaaaaa", [1] = "#cd7f32", [2] = "#c0c0c0", [3] = "#ffd700", [4] = "#b9f2ff" }
local RANK_STAR_IMAGES = { [1] = "bronze_star.png", [2] = "silver_star.png", [3] = "gold_star.png", [4] = "diamond_star.png" }

local cvSelect
local requestChange
local toggle

local function fromHex(s)
  return (s:gsub("%x%x", function(h)
    return string.char(tonumber(h, 16))
  end))
end

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
  if list then list:destroyChildren() end
  selectedId = nil
  if changeBtn then changeBtn:setEnabled(false) end
end

local function resetLeftPanel()
  if currentCreature then currentCreature:setOutfit(makeOutfit(0)) end
  if currentName then currentName:setText("?") end
  if currentLevel then currentLevel:setText("?") end
  if win then
    local leftPanel = win:recursiveGetChildById('leftPanel')
    if leftPanel then
      local oldRankLabel = leftPanel:recursiveGetChildById('currentRankLabel')
      if oldRankLabel then oldRankLabel:destroy() end
      local oldStarsPanel = leftPanel:recursiveGetChildById('currentStarsPanel')
      if oldStarsPanel then oldStarsPanel:destroy() end
    end
  end
end

local function buildRow(parentList, id, lookType, displayName, level, isCurrent, rank, stars)
  local row = g_ui.createWidget('Panel', parentList)
  row:setId('voc_' .. id)
  row:setHeight(84)
  row:setFocusable(true)

  row.vocId         = id
  row.isCurrent     = isCurrent

  local baseBgColor = isCurrent and '#1a3a1a' or '#111128'
  local baseBorder  = isCurrent and '#44bb44' or '#00000000'

  row:setBackgroundColor(baseBgColor)
  row:setBorderWidth(2)
  row:setBorderColor(baseBorder)

  row.onHoverChange = function(widget, hovered)
    if selectedId == id then return end
    if hovered then
      widget:setBackgroundColor('#2a2a4a')
    else
      widget:setBackgroundColor(widget.isCurrent and '#1a3a1a' or '#111128')
    end
  end

  row.onMouseRelease = function(widget, mousePos, mouseButton)
    if mouseButton == 1 or mouseButton == MouseLeftButton then
      cvSelect(widget, id)
      return true
    end
  end

  row.onDoubleClick = function(widget, mousePos, mouseButton)
    if mouseButton == 1 or mouseButton == MouseLeftButton then
      if not isCurrent then
        cvSelect(widget, id)
        requestChange()
      end
      return true
    end
  end

  local cbox = g_ui.createWidget('Panel', row)
  cbox:addAnchor(AnchorLeft, 'parent', AnchorLeft)
  cbox:addAnchor(AnchorVerticalCenter, 'parent', AnchorVerticalCenter)
  cbox:setWidth(58)
  cbox:setHeight(58)
  cbox:setBackgroundColor('#00000000')
  cbox:setMarginLeft(15)
  cbox:setPhantom(true)

  local cw = g_ui.createWidget('UICreature', cbox)
  cw:fill('parent')
  cw:setOutfit(makeOutfit(lookType))
  cw:setFixedCreatureSize(true)
  cw:setPhantom(true)

  local lName = g_ui.createWidget('Label', row)
  lName:setId('nameLabel')
  lName:setTextAutoResize(true)
  lName:addAnchor(AnchorHorizontalCenter, 'parent', AnchorHorizontalCenter)
  lName:addAnchor(AnchorTop, 'parent', AnchorTop)
  lName:setMarginTop(18)
  lName:setTextAlign(AlignHCenter)
  lName:setText(displayName)
  lName:setFont('verdana-11px-rounded')
  lName:setColor(isCurrent and '#88ff88' or '#dddddd')
  lName:setPhantom(true)

  local lLevel = g_ui.createWidget('Label', row)
  lLevel:setId('levelLabel')
  lLevel:setTextAutoResize(true)
  lLevel:addAnchor(AnchorHorizontalCenter, 'parent', AnchorHorizontalCenter)
  lLevel:addAnchor(AnchorTop, 'prev', AnchorBottom)
  lLevel:setMarginTop(2)
  lLevel:setTextAlign(AlignHCenter)
  lLevel:setText("Level " .. level)
  lLevel:setFont('verdana-9px')
  lLevel:setColor('#aaaaaa')
  lLevel:setPhantom(true)

  local badgeText  = isCurrent and '[Current]' or '[Available]'
  local badgeColor = isCurrent and '#44bb44' or '#4488cc'

  local lRank = g_ui.createWidget('Label', row)
  lRank:setId('rankLabel')
  lRank:setTextAutoResize(true)
  lRank:addAnchor(AnchorHorizontalCenter, 'parent', AnchorHorizontalCenter)
  lRank:addAnchor(AnchorTop, 'prev', AnchorBottom)
  lRank:setMarginTop(2)
  lRank:setTextAlign(AlignHCenter)
  lRank:setText(rank > 0 and (RANK_NAMES[rank] or "None") or "No Rank")
  lRank:setColor(RANK_COLORS[rank] or '#aaaaaa')
  lRank:setFont('verdana-9px')
  lRank:setPhantom(true)

  if rank > 0 then
    local starsPanel = g_ui.createWidget('Panel', row)
    starsPanel:setId('starsPanel')
    starsPanel:addAnchor(AnchorHorizontalCenter, 'parent', AnchorHorizontalCenter)
    starsPanel:addAnchor(AnchorTop, lRank, AnchorBottom)
    starsPanel:setMarginTop(1)
    starsPanel:setPhantom(true)

    local starImg = RANK_STAR_IMAGES[rank] or "bronze_star.png"
    for i = 1, 5 do
      local s = g_ui.createWidget('UIWidget', starsPanel)
      s:setImageSource('/images/ranks/' .. starImg)
      s:setImageColor(i <= stars and '#ffffff' or '#444444')
      s:setSize({ width = 10, height = 10 })
      s:addAnchor(AnchorLeft, i == 1 and 'parent' or 'prev', i == 1 and AnchorLeft or AnchorRight)
      s:addAnchor(AnchorTop, 'parent', AnchorTop)
      s:setPhantom(true)
    end
  end

  local lBadge     = g_ui.createWidget('Label', row)
  lBadge:setText(badgeText)
  lBadge:setFont('verdana-11px-rounded')
  lBadge:setColor(badgeColor)
  lBadge:addAnchor(AnchorRight, 'parent', AnchorRight)
  lBadge:addAnchor(AnchorVerticalCenter, 'parent', AnchorVerticalCenter)
  lBadge:setMarginRight(20)
  lBadge:setPhantom(true)

  return row
end

cvSelect = function(widget, id)
  if not list then return end
  for _, child in pairs(list:getChildren()) do
    local isCur = child.isCurrent
    child:setBackgroundColor(isCur and '#1a3a1a' or '#111128')
    child:setBorderWidth(2)
    child:setBorderColor(isCur and '#44bb44' or '#00000000')
  end

  widget:setBackgroundColor('#1a3a5a')
  if not widget.isCurrent then
    widget:setBorderColor('#4488cc')
  end

  selectedId = id
  if changeBtn then
    changeBtn:setEnabled(not widget.isCurrent)
  end
end

requestChange = function()
  if not selectedId then return end
  local msg = string.char(1) .. string.char(selectedId % 256) .. string.char(math.floor(selectedId / 256))
  g_game.getProtocolGame():sendExtendedOpcode(OPCODE, msg)
  if win then win:hide() end
end

toggle = function()
  if not win then return end
  if win:isVisible() then
    win:hide()
  else
    win:centerIn(g_ui.getRootWidget())
    win:show(); win:raise(); win:focus()
  end
end

function init()
  if win then return end
  win = g_ui.displayUI('vocation_change')
  if not win then return end
  win:hide()

  list            = win:recursiveGetChildById('vocationsScroll')
  currentCreature = win:recursiveGetChildById('vocationPanel')
  currentName     = win:recursiveGetChildById('nameLabel')
  currentLevel    = win:recursiveGetChildById('levelLabel')
  changeBtn       = win:recursiveGetChildById('changeButton')
  closeBtn        = win:recursiveGetChildById('closeButton')

  resetLeftPanel()

  if changeBtn then
    changeBtn:setEnabled(false)
    changeBtn.onClick = function() requestChange() end
  end
  if closeBtn then closeBtn.onClick = function() toggle() end end

  connect(g_game, {
    onGameStart = function()
      if gameConnected then return end
      gameConnected = true
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
    win:destroy(); win = nil
  end
end

function onOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE or #buffer < 1 then return end
  local bin    = fromHex(buffer)
  local action = bin:byte(1)

  if action == 1 then
    if win then
      win:centerIn(g_ui.getRootWidget())
      win:show(); win:raise(); win:focus()
    end
  elseif action == 2 then
    processData(bin:sub(2))
  elseif action == 3 then
    if win then
      win:centerIn(g_ui.getRootWidget())
      win:show(); win:raise(); win:focus()
    end
    processData(bin:sub(2))
  elseif action == 4 then
    if win then win:hide() end
  elseif action == 5 then -- Recebe o comando de Kick Limpo do servidor
    if win then win:hide() end
    if g_game.isOnline() then
      g_game.forceLogout() -- Joga o player suavemente pra lista de personagens
    end
  end
end

function processData(data)
  if #data < 4 then return end
  local pos = 1
  local function rU8()
    local v = data:byte(pos) or 0; pos = pos + 1; return v
  end
  local function rU16() return rU8() * 256 + rU8() end
  local function rU32() return rU16() * 65536 + rU16() end
  local function rStr()
    local n = rU16()
    if n <= 0 then return "" end
    local s = data:sub(pos, pos + n - 1); pos = pos + n; return s
  end

  local currentId = rU16()
  local count     = rU16()

  clearList()
  resetLeftPanel()

  for i = 1, count do
    if pos > #data then break end
    local id          = rU16()
    local lookType    = rU16()
    local name        = rStr()
    local classType   = rStr()
    local level       = rU32()
    local rank        = rU16()
    local stars       = rU16()
    local isCurrent   = (id == currentId)

    local displayName = name .. " (" .. classType .. ")"

    if isCurrent then
      if currentCreature then currentCreature:setOutfit(makeOutfit(lookType)) end
      if currentName then currentName:setText(displayName) end
      if currentLevel then currentLevel:setText("Level " .. level) end

      local leftPanel = win:recursiveGetChildById('leftPanel')
      if leftPanel then
        local oldRankLabel = leftPanel:recursiveGetChildById('currentRankLabel')
        if oldRankLabel then oldRankLabel:destroy() end
        local oldStarsPanel = leftPanel:recursiveGetChildById('currentStarsPanel')
        if oldStarsPanel then oldStarsPanel:destroy() end

        local lRank = g_ui.createWidget('Label', leftPanel)
        lRank:setId('currentRankLabel')
        lRank:setTextAutoResize(true)
        lRank:addAnchor(AnchorHorizontalCenter, 'parent', AnchorHorizontalCenter)
        lRank:addAnchor(AnchorTop, currentLevel, AnchorBottom)
        lRank:setMarginTop(4)
        lRank:setTextAlign(AlignHCenter)
        lRank:setText(rank > 0 and (RANK_NAMES[rank] or "None") or "No Rank")
        lRank:setColor(RANK_COLORS[rank] or '#aaaaaa')
        lRank:setFont('verdana-9px')

        if rank > 0 then
          local sPanel = g_ui.createWidget('Panel', leftPanel)
          sPanel:setId('currentStarsPanel')
          sPanel:addAnchor(AnchorHorizontalCenter, 'parent', AnchorHorizontalCenter)
          sPanel:addAnchor(AnchorTop, lRank, AnchorBottom)
          sPanel:setMarginTop(2)

          local starImg = RANK_STAR_IMAGES[rank] or "bronze_star.png"
          for i = 1, 5 do
            local s = g_ui.createWidget('UIWidget', sPanel)
            s:setImageSource('/images/ranks/' .. starImg)
            s:setImageColor(i <= stars and '#ffffff' or '#444444')
            s:setSize({ width = 14, height = 14 })
            s:addAnchor(AnchorLeft, i == 1 and 'parent' or 'prev', i == 1 and AnchorLeft or AnchorRight)
            s:addAnchor(AnchorTop, 'parent', AnchorTop)
          end
        end
      end
    end

    if list then buildRow(list, id, lookType, displayName, level, isCurrent, rank, stars) end
  end
end
