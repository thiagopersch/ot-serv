-- =============================================================================
-- data/creaturescripts/scripts/aura_selector.lua
-- Handler do opcode 249 — processa respostas do client (a_pick, a_cancel, etc)
-- =============================================================================

dofile("data/lib/extoutfit_lib.lua")
dofile("data/lib/extoutfit_parser.lua")
local json = dofile("data/lib/json.lua")

local AURA_OPCODE = 249
local ITEM_ID     = 56541

-- Storages
local ST_AURA_ITEM     = 81002
local ST_AURA_OPEN     = 81003
local ST_AURA_COOLDOWN = 81004

-- Anti-spam
local PICK_COOLDOWN_SECONDS = 2

-- Envia mensagem modal ao client
local function sendModal(cid, msg)
  doPlayerSendExtendedOpcode(cid, AURA_OPCODE, "a_msg|" .. tostring(msg))
  doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, msg)
end

-- Reseta estado da sessão
local function resetSession(cid)
  setPlayerStorageValue(cid, ST_AURA_ITEM, -1)
  setPlayerStorageValue(cid, ST_AURA_OPEN, -1)
end

-- Divide buffer no PRIMEIRO pipe apenas
local function splitAction(buffer)
  local pipePos = string.find(buffer, '|', 1, true)
  if pipePos then
    return buffer:sub(1, pipePos - 1), buffer:sub(pipePos + 1)
  end
  return buffer, nil
end

-- Sincroniza lista de auras desbloqueadas com o client
local function syncAuras(cid)
  local list = extoutfit.getAuras(cid)
  if list and #list > 0 then
    doPlayerSendExtendedOpcode(cid, AURA_OPCODE, "a_sync|" .. table.concat(list, ","))
  else
    doPlayerSendExtendedOpcode(cid, AURA_OPCODE, "a_sync|")
  end
end

-- =============================================================================
-- HANDLER PRINCIPAL
-- =============================================================================
function onExtendedOpcode(cid, opcode, buffer)
  if opcode ~= AURA_OPCODE then
    return false
  end

  if not isPlayer(cid) then
    return false
  end

  if not buffer or #buffer == 0 then
    return false
  end

  local playerName = getPlayerName(cid)
  local action, rest = splitAction(buffer)

  -- a_cleanup — client iniciou nova sessão de jogo
  if action == "a_cleanup" then
    resetSession(cid)
    return true
  end

  -- a_cancel — jogador fechou/cancelou sem confirmar (não remove item)
  if action == "a_cancel" then
    if getPlayerStorageValue(cid, ST_AURA_OPEN) ~= 1 then
      return true
    end
    resetSession(cid)
    sendModal(cid, "Aura selection cancelled. You can use the item again at any time.")
    return true
  end

  -- a_pick — jogador confirmou uma aura
  if action == "a_pick" then

    -- Anti-spam
    local cooldown = getPlayerStorageValue(cid, ST_AURA_COOLDOWN)
    if type(cooldown) == "number" and cooldown > os.time() then
      return true
    end
    setPlayerStorageValue(cid, ST_AURA_COOLDOWN, os.time() + PICK_COOLDOWN_SECONDS)

    -- Validação: ID da aura
    local auraId = tonumber(rest)
    if not auraId or auraId <= 0 then
      sendModal(cid, "Invalid aura selection.")
      resetSession(cid)
      return true
    end

    -- Validação: janela estava aberta
    if getPlayerStorageValue(cid, ST_AURA_OPEN) ~= 1 then
      sendModal(cid, "You don't have an active aura selection.")
      return true
    end

    -- Validação: uid do item na sessão
    local itemUid = getPlayerStorageValue(cid, ST_AURA_ITEM)
    if not itemUid or itemUid <= 0 then
      sendModal(cid, "Aura item not found. Please try again.")
      resetSession(cid)
      return true
    end

    -- Validação: aura existe no XML
    local allAuras = extoutfit_parser.loadAuras()
    local auraData = extoutfit_parser.findAura(allAuras, auraId)
    if not auraData then
      sendModal(cid, "This aura does not exist on the server.")
      resetSession(cid)
      return true
    end

    -- Proteção: aura já desbloqueada
    if extoutfit.hasAura(cid, auraId) then
      sendModal(cid, 'You already have the aura "' .. auraData.name .. '" unlocked.')
      resetSession(cid)
      return true
    end

    -- Adiciona a aura ao banco de dados
    local success = extoutfit.addAura(cid, auraId)
    if not success then
      sendModal(cid, "Failed to unlock aura. Please try again.")
      return true
    end

    -- Remove 1 item do inventário
    if not doPlayerRemoveItem(cid, ITEM_ID, 1) then
      -- Item already consumed or not found — aura was granted, continue
    end

    -- Limpa sessão
    resetSession(cid)

    -- Equipa a aura imediatamente
    local outfit = getCreatureOutfit(cid)
    outfit.aura = auraData.looktype
    doCreatureChangeOutfit(cid, outfit)
    doPlayerSave(cid)

    -- Feedback: quantidade total desbloqueada
    local updatedList = extoutfit.getAuras(cid)
    local totalUnlocked = updatedList and #updatedList or 1

    local msg = 'Aura "' .. auraData.name .. '" unlocked successfully!\nYou now have ' .. totalUnlocked .. ' aura(s) unlocked.'
    sendModal(cid, msg)

    -- Sincroniza lista com o client
    syncAuras(cid)

    -- Notifica looktype equipado (game_auraoffset no client gerencia o offset)
    doPlayerSendExtendedOpcode(cid, AURA_OPCODE, "a_equipped|" .. auraData.looktype)

    -- Reabre outfit window
    addEvent(function()
      if isPlayer(cid) then
        doPlayerSendOutfitWindow(cid)
      end
    end, 300)

    return true
  end

  return false
end
