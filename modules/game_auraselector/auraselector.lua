-- =============================================================================
-- game_auraselector/auraselector.lua
-- Sistema completo de Aura Selector para OTCv8
-- Opcode 249 — Isolado do Shader Selector (opcode 248)
-- =============================================================================

local OPCODE = 249

-- Estado local — isolado por módulo, sem variáveis globais
local win = nil
local selectedAuraId = nil
local auraList = {}
local unlockedAuras = {}
local gameConnected = false
local confirmDebounce = false
local opcodeRegistered = false
local lastOpcodeTime = 0
local OPCODE_THROTTLE_MS = 500

-- Exibe modal no client com fallback para displayInfoBox
local function showModal(title, msg)
  if not msg or #msg == 0 then return end
  local ok, err = pcall(displayInfoBox, title, msg)
  if not ok then
    pcall(g_game.showMessageBox, title, msg)
  end
end

-- =============================================================================
-- OUTFIT HELPERS — Auras usam outfit.aura, não outfit.type
-- =============================================================================
local function getPlayerBaseOutfit()
  local player = g_game.getLocalPlayer()
  if player then
    local outfit = player:getOutfit()
    if outfit and outfit.type and outfit.type > 0 then
      return outfit
    end
  end
  return { type = 128, addons = 0, aura = 0, wings = 0, shader = "" }
end

-- Monta um outfit para preview de aura: mantém o outfit base, troca só a aura
local function makeAuraPreviewOutfit(auraLooktype)
  local base = getPlayerBaseOutfit()
  base.aura = auraLooktype or 0
  base.wings = base.wings or 0
  base.shader = base.shader or ""
  return base
end

-- =============================================================================
-- HELPERS DE UI
-- =============================================================================
local function isUnlocked(id)
  for _, uid in ipairs(unlockedAuras) do
    if uid == id then return true end
  end
  return false
end

local function setConfirmEnabled(state)
  if not win then return end
  local btn = win:recursiveGetChildById('confirmButton')
  if btn then btn:setEnabled(state) end
end

local function setUnlockedCount()
  if not win then return end
  local lbl = win:recursiveGetChildById('unlockedCountLabel')
  if not lbl then return end
  local count = #unlockedAuras
  if count > 0 then
    lbl:setText(count .. ' unlocked')
    lbl:setColor('#8888cc')
  else
    lbl:setText('')
  end
end

local function setSelectedName(name)
  if not win then return end
  local lbl = win:recursiveGetChildById('selectedName')
  if lbl then lbl:setText(name or "None selected") end
end

local function setPreviewOutfit(auraLooktype)
  if not win then return end
  local prev = win:recursiveGetChildById('preview')
  if not prev then return end
  local outfit = makeAuraPreviewOutfit(auraLooktype)
  pcall(function() prev:setOutfit(outfit) end)
end

local function setLoadingState(loading)
  if not win then return end
  local loadingLbl = win:recursiveGetChildById('loadingLabel')
  local errorPnl   = win:recursiveGetChildById('errorPanel')
  local list        = win:recursiveGetChildById('auraList')
  if loadingLbl then loadingLbl:setVisible(loading) end
  if errorPnl   then errorPnl:setVisible(false) end
  if list       then list:setVisible(not loading) end
  setConfirmEnabled(false)
end

local function setErrorState(msg)
  if not win then return end
  local loadingLbl = win:recursiveGetChildById('loadingLabel')
  local errorPnl   = win:recursiveGetChildById('errorPanel')
  local errorLbl   = win:recursiveGetChildById('errorLabel')
  local list        = win:recursiveGetChildById('auraList')
  if loadingLbl then loadingLbl:setVisible(false) end
  if errorPnl   then errorPnl:setVisible(true) end
  if errorLbl   then errorLbl:setText(msg or "An error occurred.") end
  if list       then list:setVisible(false) end
end

-- =============================================================================
-- CONSTRUÇÃO DA LISTA DE AURAS
-- =============================================================================
local function onItemFocusChange(list, focusedChild)
  if not focusedChild then return end
  local idStr = focusedChild:getId()
  local id = tonumber(idStr)
  if not id then return end

  selectedAuraId = id
  for _, aura in ipairs(auraList) do
    if aura.id == id then
      setPreviewOutfit(aura.looktype)
      setSelectedName(aura.name)
      break
    end
  end
  -- Habilita confirmar apenas se a aura NÃO está desbloqueada
  setConfirmEnabled(not isUnlocked(id))
end

local function clearList()
  if not win then return end
  local list = win:recursiveGetChildById('auraList')
  if list then
    list.onChildFocusChange = nil
    list:destroyChildren()
  end
  selectedAuraId = nil
  setConfirmEnabled(false)
  setSelectedName("None selected")
  setPreviewOutfit(0)
end

local function buildList(data)
  if not win then return end

  setLoadingState(false)

  if not data or #data == 0 then
    setErrorState("No auras available.")
    return
  end

  clearList()
  auraList = data

  local list = win:recursiveGetChildById('auraList')
  if not list then
    setErrorState("UI error: auraList not found.")
    return
  end

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

  for _, aura in ipairs(data) do
    local ok, btn = pcall(function()
      return g_ui.createWidget('AuraButton', list)
    end)

    if not ok or not btn then
      -- skip failed button creation
    else
      btn:setId(tostring(aura.id))

      -- Outfit para preview da aura no botão da lista
      local previewOutfit = makeAuraPreviewOutfit(aura.looktype)
      local outfitWidget = btn:recursiveGetChildById('outfit')
      if outfitWidget then
        pcall(function()
          outfitWidget:setOutfit(previewOutfit)
          outfitWidget:setAnimate(true)
        end)
      end

      local nameLabel = btn:recursiveGetChildById('name')
      if nameLabel then
        if isUnlocked(aura.id) then
          nameLabel:setText(aura.name .. "\n[Unlocked]")
          nameLabel:setColor('#55aa55')
          btn:setBackgroundColor('#1a2a1a')
        else
          nameLabel:setText(aura.name)
          nameLabel:setColor('#cccccc')
        end
      end
    end
  end

  list.onChildFocusChange = onItemFocusChange

  -- Foca o primeiro item
  if data[1] then
    addEvent(function()
      if not win then return end
      local l = win:recursiveGetChildById('auraList')
      if not l then return end
      local first = l:getChildById(tostring(data[1].id))
      if first then
        first:focus()
      end
    end)
  end

  setUnlockedCount()

  if width <= 0 then
    addEvent(function()
      if not win then return end
      local l = win:recursiveGetChildById('auraList')
      if not l then return end
      local w2 = l:getWidth()
      if w2 <= 0 then return end
      local spacing = 5
      local cellWidth = math.floor((w2 - spacing) / 2)
      local grid = l:getLayout()
      if grid then
        grid:setCellWidth(cellWidth)
        grid:setCellHeight(145)
      end
    end)
  end
end

-- =============================================================================
-- JANELA — show / hide / destroy
-- =============================================================================
function aura_destroy()
  if win then
    win:destroy()
    win = nil
  end
  selectedAuraId = nil
end

function aura_show()
  if not win then return end
  pcall(function() win:show() end)
  pcall(function() win:raise() end)
  pcall(function() win:focus() end)
end

function aura_hide()
  if win then win:hide() end
  selectedAuraId = nil
end

function aura_retry()
  aura_hide()
end

-- =============================================================================
-- AÇÕES DO JOGADOR — confirm / cancel
-- =============================================================================
function aura_confirm()
  if confirmDebounce then return end
  if not selectedAuraId then return end

  -- Throttle de opcode
  local now = g_clock.millis()
  if now - lastOpcodeTime < OPCODE_THROTTLE_MS then return end
  lastOpcodeTime = now

  confirmDebounce = true
  addEvent(function() confirmDebounce = false end, 1000)

  local pg = g_game.getProtocolGame()
  if not pg then return end

  local ok, err = pcall(function()
    pg:sendExtendedOpcode(OPCODE, "a_pick|" .. selectedAuraId)
  end
  )
  aura_hide()
end

function aura_cancel()
  local pg = g_game.getProtocolGame()
  if pg then
    pcall(function()
      pg:sendExtendedOpcode(OPCODE, "a_cancel")
    end)
  end
  aura_hide()
end

-- =============================================================================
-- BOTÕES — setup
-- =============================================================================
local function setupButtons()
  if not win then return end
  local confirmBtn = win:recursiveGetChildById('confirmButton')
  if confirmBtn then
    confirmBtn.onClick = aura_confirm
    confirmBtn:setEnabled(false)
  end
  local cancelBtn = win:recursiveGetChildById('cancelButton')
  if cancelBtn then cancelBtn.onClick = aura_cancel end
  local retryBtn = win:recursiveGetChildById('retryButton')
  if retryBtn then retryBtn.onClick = aura_retry end

  -- ESC fecha sem consumir item
  win.onEscape = aura_cancel
end

-- =============================================================================
-- ENSURE WINDOW — cria ou reutiliza a janela
-- =============================================================================
local function ensureWindow()
  -- Verifica se a janela existente ainda está no root
  if win then
    local root = g_ui.getRootWidget()
    if root and root:recursiveGetChildById('auraSelectorWindow') then
      return true
    end
    win = nil
  end

  local ok, created = pcall(function()
    return g_ui.displayUI('auraselector')
  end)
  if not ok or not created then
    return false
  end
  win = created
  win:hide()
  setupButtons()
  return true
end

-- =============================================================================
-- PARSER DE OPCODE
-- A separação usa apenas o PRIMEIRO pipe para evitar quebra com JSON contendo '|'
-- =============================================================================
local function splitAction(buffer)
  local pipePos = buffer:find('|', 1, true)
  if pipePos then
    return buffer:sub(1, pipePos - 1), buffer:sub(pipePos + 1)
  end
  return buffer, nil
end

local function onExtendedOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then return end
  if not buffer or #buffer == 0 then return end

  local action, rest = splitAction(buffer)

  -- ── a_open — abre a janela com lista de auras ──────────────────────────────
  if action == "a_open" then
    if not ensureWindow() then
      showModal("Aura Selector", "Failed to open the selection window. Check your client files.")
      return
    end
    setLoadingState(true)
    aura_show()

    if not rest or #rest == 0 then
      setErrorState("Empty aura data received from server.")
      return
    end

    local ok, data = pcall(json.decode, rest)
    if not ok or type(data) ~= "table" then
      setErrorState("Failed to parse aura data. Please try again.")
      return
    end

    if #data == 0 then
      setErrorState("No auras available at this time.")
      return
    end

    buildList(data)
    return
  end

  -- ── a_sync — sincroniza lista de desbloqueadas ────────────────────────────
  if action == "a_sync" then
    unlockedAuras = {}
    if rest then
      for idStr in rest:gmatch("(%d+)") do
        local id = tonumber(idStr)
        if id and id > 0 then
          table.insert(unlockedAuras, id)
        end
      end
    end

    -- Atualiza visualmente a lista se a janela estiver aberta
    if win and win:isVisible() and #auraList > 0 then
      buildList(auraList)
    end
    return
  end

  -- ── a_equipped — aura equipada após confirmação ───────────────────────────
  if action == "a_equipped" then
    return
  end

  -- ── a_msg — mensagem modal do servidor (erro, sucesso, aviso) ─────────────
  if action == "a_msg" then
    showModal("Aura Selector", rest or "")
    return
  end
end

-- =============================================================================
-- INIT / TERMINATE
-- =============================================================================
function init()
  -- Garante que não há opcode duplicado registrado
  pcall(function()
    ProtocolGame.unregisterExtendedOpcode(OPCODE)
  end)
  opcodeRegistered = false

  connect(g_game, {
    onGameStart = function()
      if gameConnected then return end
      gameConnected = true
      unlockedAuras = {}
      selectedAuraId = nil
      confirmDebounce = false
      lastOpcodeTime = 0

      -- Registra opcode uma única vez por sessão
      pcall(function()
        ProtocolGame.unregisterExtendedOpcode(OPCODE)
      end)
      local ok, err = pcall(function()
        ProtocolGame.registerExtendedOpcode(OPCODE, onExtendedOpcode)
      end)
      if ok then
        opcodeRegistered = true
      end

      -- Notifica o servidor para limpar estado pendente
      local pg = g_game.getProtocolGame()
      if pg then
        pcall(function()
          pg:sendExtendedOpcode(OPCODE, "a_cleanup")
        end)
      end
    end,

    onGameEnd = function()
      gameConnected = false
      unlockedAuras = {}
      selectedAuraId = nil
      auraList = {}
      confirmDebounce = false
      aura_hide()
      pcall(function()
        ProtocolGame.unregisterExtendedOpcode(OPCODE)
      end)
      opcodeRegistered = false
    end
  })
end

function aura_terminate()
  pcall(function()
    ProtocolGame.unregisterExtendedOpcode(OPCODE)
  end)
  opcodeRegistered = false

  aura_destroy()

  auraList = {}
  unlockedAuras = {}
  selectedAuraId = nil
  gameConnected = false
  confirmDebounce = false

  disconnect(g_game, {
    onGameStart = true,
    onGameEnd = true
  })
end
