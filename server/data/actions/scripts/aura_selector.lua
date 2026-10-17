-- =============================================================================
-- data/actions/scripts/aura_selector.lua
-- Action do item 56541 — abre o Aura Selector no client via opcode 249
-- =============================================================================

dofile("data/lib/extoutfit_lib.lua")
dofile("data/lib/extoutfit_parser.lua")
local json = dofile("data/lib/json.lua")

local AURA_OPCODE = 249

-- Storages internos do sistema (faixa 81000+)
local ST_AURA_ITEM     = 81002
local ST_AURA_OPEN     = 81003
local ST_AURA_COOLDOWN = 81004

local COOLDOWN_SECONDS = 2
local ITEM_ID          = 56541

-- Envia mensagem modal como opcode
local function sendModal(cid, msg)
  doPlayerSendExtendedOpcode(cid, AURA_OPCODE, "a_msg|" .. tostring(msg))
  doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, msg)
end

-- =============================================================================
-- onUse — disparado ao clicar/usar o item 56541
-- =============================================================================
function onUse(cid, item, fromPosition, itemEx, toPosition)
  if not isPlayer(cid) then
    return false
  end

  local playerName = getPlayerName(cid)

  -- ── Proteção: janela já aberta (com timeout de 30s p/ sessão stale) ────
  if getPlayerStorageValue(cid, ST_AURA_OPEN) == 1 then
    local cooldownVal = getPlayerStorageValue(cid, ST_AURA_COOLDOWN)
    local stale = (type(cooldownVal) ~= "number" or os.time() > cooldownVal + 30)
    if stale then
      setPlayerStorageValue(cid, ST_AURA_OPEN, -1)
      setPlayerStorageValue(cid, ST_AURA_ITEM, -1)
    else
      sendModal(cid, "You already have an aura selection open.")
      return true
    end
  end

  -- ── Proteção: cooldown ────────────────────────────────────────────────────
  local cooldown = getPlayerStorageValue(cid, ST_AURA_COOLDOWN)
  if type(cooldown) == "number" and cooldown > os.time() then
    local remaining = cooldown - os.time()
    sendModal(cid, "Please wait " .. remaining .. " second(s) before using again.")
    return true
  end

  -- ── Carrega auras do XML ──────────────────────────────────────────────────
  local auras = extoutfit_parser.loadAuras()
  if not auras or #auras == 0 then
    sendModal(cid, "No auras available at this time. Please try again later.")
    return true
  end

  -- ── Monta JSON seguro ─────────────────────────────────────────────────────
  local ok, aurasJson = pcall(json.encode, auras)
  if not ok or not aurasJson then
    sendModal(cid, "Failed to load aura list. Please try again.")
    return true
  end

  -- ── Salva estado da sessão ────────────────────────────────────────────────
  setPlayerStorageValue(cid, ST_AURA_ITEM, item.uid)
  setPlayerStorageValue(cid, ST_AURA_OPEN, 1)
  setPlayerStorageValue(cid, ST_AURA_COOLDOWN, os.time() + COOLDOWN_SECONDS)

  -- ── Envia ao client: "a_open|{JSON}" ─────────────────────────────────────
  doPlayerSendExtendedOpcode(cid, AURA_OPCODE, "a_open|" .. aurasJson)

  return true
end
