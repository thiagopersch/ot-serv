-- =============================================================================
-- game_auraselector/auraselector.lua
-- Sistema completo de Aura Selector para OTCv8
-- Opcode 249 — Isolado do Shader Selector (opcode 248)
-- =============================================================================

local OPCODE = 249
local LOG_TAG = "[AuraSelector]"

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

-- =============================================================================
-- LOGGING (console + g_logger + arquivo)
-- =============================================================================
local logFileHandle
local function log(msg)
  local text = LOG_TAG .. " " .. tostring(msg)
  print(text)
  pcall(function() g_logger.info(text) end)
  if not logFileHandle then
    pcall(function()
      local logsDir = g_resources.getWriteDir() .. "/logs"
      if not g_resources.directoryExists(logsDir) then
        g_resources.makeDir(logsDir)
      end
      logFileHandle = io.open(logsDir .. "/aura_selector.log", "a")
    end)
  end
  if logFileHandle then
    pcall(function()
      logFileHandle:write(os.date("[%Y-%m-%d %H:%M:%S] ") .. text .. "\n")
      logFileHandle:flush()
    end)
  end
end

-- Exibe modal no client com fallback para displayInfoBox
local function showModal(title, msg)
  if not msg or #msg == 0 then return end
  local ok, err = pcall(displayInfoBox, title, msg)
  if not ok then
    log("showModal error: " .. tostring(err))
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
    lbl:setText(count .. ' desbloqueada(s)')
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
  local ok, err = pcall(function() prev:setOutfit(outfit) end)
  if not ok then
    log("setPreviewOutfit error: " .. tostring(err))
  end
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
  log("ERROR STATE: " .. tostring(msg))
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
  if not win then
    log("buildList: win is nil")
    return
  end

  setLoadingState(false)

  if not data or #data == 0 then
    setErrorState("No auras available.")
    return
  end

  clearList()
  auraList = data

  local list = win:recursiveGetChildById('auraList')
  if not list then
    log("buildList: 'auraList' widget not found")
    setErrorState("UI error: auraList not found.")
    return
  end

  list.onChildFocusChange = nil

  for _, aura in ipairs(data) do
    local ok, btn = pcall(function()
      return g_ui.createWidget('AuraButton', list)
    end)

    if not ok or not btn then
      log("buildList: failed to create AuraButton for aura " .. tostring(aura.id) .. ": " .. tostring(btn))
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
          nameLabel:setText(aura.name .. "\n[Desbloqueada]")
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
  log("buildList: " .. #data .. " auras adicionadas")
end

-- =============================================================================
-- JANELA — show / hide / destroy
-- =============================================================================
function destroy()
  if win then
    win:destroy()
    win = nil
  end
  selectedAuraId = nil
end

function show()
  if not win then
    log("show: win is nil")
    return
  end
  win:show()
  win:raise()
  win:focus()
end

function hide()
  if win then win:hide() end
  selectedAuraId = nil
end

function retry()
  log("retry: fechando janela — servidor deve reenviar a_open")
  hide()
end

-- =============================================================================
-- AÇÕES DO JOGADOR — confirm / cancel
-- =============================================================================
function confirm()
  if confirmDebounce then
    log("confirm: debounce ativo, ignorando")
    return
  end
  if not selectedAuraId then
    log("confirm: nenhuma aura selecionada")
    return
  end

  -- Throttle de opcode
  local now = g_clock.millis()
  if now - lastOpcodeTime < OPCODE_THROTTLE_MS then
    log("confirm: throttle ativo")
    return
  end
  lastOpcodeTime = now

  confirmDebounce = true
  addEvent(function() confirmDebounce = false end, 1000)

  local pg = g_game.getProtocolGame()
  if not pg then
    log("confirm: sem protocolo de jogo")
    return
  end

  log("confirm: enviando a_pick|" .. selectedAuraId)
  local ok, err = pcall(function()
    pg:sendExtendedOpcode(OPCODE, "a_pick|" .. selectedAuraId)
  end)
  if not ok then
    log("confirm: sendExtendedOpcode falhou: " .. tostring(err))
  end
  hide()
end

function cancel()
  log("cancel: enviando a_cancel")
  local pg = g_game.getProtocolGame()
  if pg then
    pcall(function()
      pg:sendExtendedOpcode(OPCODE, "a_cancel")
    end)
  end
  hide()
end

-- =============================================================================
-- BOTÕES — setup
-- =============================================================================
local function setupButtons()
  if not win then return end
  local confirmBtn = win:recursiveGetChildById('confirmButton')
  if confirmBtn then
    confirmBtn.onClick = confirm
    confirmBtn:setEnabled(false)
  end
  local cancelBtn = win:recursiveGetChildById('cancelButton')
  if cancelBtn then cancelBtn.onClick = cancel end
  local retryBtn = win:recursiveGetChildById('retryButton')
  if retryBtn then retryBtn.onClick = retry end

  -- ESC fecha sem consumir item
  win.onEscape = cancel
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
    log("janela foi destruída externamente, recriando")
  end

  local ok, created = pcall(function()
    return g_ui.displayUI('auraselector')
  end)
  if not ok or not created then
    log("displayUI('auraselector') falhou: " .. tostring(created))
    return false
  end
  win = created
  win:hide()
  setupButtons()
  log("janela criada com sucesso")
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
  if not buffer or #buffer == 0 then
    log("buffer vazio ignorado")
    return
  end

  -- Log truncado para não poluir console
  log("recebido: " .. buffer:sub(1, 100) .. (#buffer > 100 and "..." or ""))

  local action, rest = splitAction(buffer)

  -- ── a_open — abre a janela com lista de auras ──────────────────────────────
  if action == "a_open" then
    if not ensureWindow() then
      log("a_open: falha ao criar janela")
      showModal("Aura Selector", "Falha ao abrir a janela de seleção. Verifique os arquivos do cliente.")
      return
    end

    setLoadingState(true)
    show()

    if not rest or #rest == 0 then
      setErrorState("Dados de aura vazios recebidos do servidor.")
      return
    end

    local ok, data = pcall(json.decode, rest)
    if not ok or type(data) ~= "table" then
      log("a_open: falha no JSON decode: " .. tostring(data))
      setErrorState("Falha ao parsear dados de aura. Tente novamente.")
      return
    end

    if #data == 0 then
      setErrorState("Nenhuma aura disponível no momento.")
      return
    end

    log("a_open: " .. #data .. " auras recebidas do servidor")
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
    log("a_sync: " .. #unlockedAuras .. " auras desbloqueadas")

    -- Atualiza visualmente a lista se a janela estiver aberta
    if win and win:isVisible() and #auraList > 0 then
      buildList(auraList)
    end
    return
  end

  -- ── a_equipped — aura equipada após confirmação ───────────────────────────
  if action == "a_equipped" then
    local looktype = tonumber(rest)
    log("a_equipped: looktype=" .. tostring(looktype))
    -- O servidor atualiza o outfit via doCreatureChangeOutfit, o client recebe
    -- automaticamente pelo protocolo normal. Apenas logamos.
    return
  end

  -- ── a_msg — mensagem modal do servidor (erro, sucesso, aviso) ─────────────
  if action == "a_msg" then
    showModal("Aura Selector", rest or "")
    return
  end

  log("ação desconhecida: '" .. tostring(action) .. "'")
end

-- =============================================================================
-- INIT / TERMINATE
-- =============================================================================
function init()
  log("init")

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
        log("opcode " .. OPCODE .. " registrado")
      else
        log("falha ao registrar opcode: " .. tostring(err))
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
      hide()
      pcall(function()
        ProtocolGame.unregisterExtendedOpcode(OPCODE)
      end)
      opcodeRegistered = false
    end
  })

  -- Pré-carrega a janela para evitar lag na primeira abertura
  ensureWindow()
  log("init concluído")
end

function terminate()
  log("terminate")
  pcall(function()
    ProtocolGame.unregisterExtendedOpcode(OPCODE)
  end)
  opcodeRegistered = false

  if win then
    win:destroy()
    win = nil
  end

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