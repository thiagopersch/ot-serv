-- =============================================================================
-- data/lib/extoutfit_lib.lua
-- Biblioteca central do sistema extoutfit — wrapper das funções C++ do TFS
-- =============================================================================

if extoutfit and extoutfit.__loaded then
  return extoutfit
end

extoutfit          = {}
extoutfit.__loaded = true

local VALID_TYPES  = { wing = true, aura = true, shader = true, healthbar = true, manabar = true }
local LOG_TAG      = "[extoutfit_lib]"

-- =============================================================================
-- UTILITÁRIOS
-- =============================================================================
local function logError(msg) print(LOG_TAG .. " ERROR: " .. tostring(msg)) end
local function logInfo(msg) print(LOG_TAG .. " " .. tostring(msg)) end

-- Log para arquivo (logs/aura_system.log)
local logFileHandle = nil
local function ensureLogDir()
  pcall(function()
    local ok, attr = pcall(lfs.attributes, "logs")
    if not ok or not attr then
      -- no Linux (Docker) o `2>nul` criaria um arquivo chamado "nul"
      if package.config:sub(1, 1) == "\\" then
        os.execute("mkdir logs 2>nul")
      else
        os.execute("mkdir -p logs 2>/dev/null")
      end
    end
  end)
end
local function writeLog(level, msg)
  local text = os.date("[%Y-%m-%d %H:%M:%S]") .. " [" .. level .. "]" .. LOG_TAG .. " " .. tostring(msg)
  print(text)
  if not logFileHandle then
    ensureLogDir()
    local ok, fh = pcall(io.open, "logs/aura_system.log", "a")
    if ok and fh then
      logFileHandle = fh
    end
  end
  if logFileHandle then
    pcall(function()
      logFileHandle:write(text .. "\n"); logFileHandle:flush()
    end)
  end
end
local function logFile(msg) writeLog("INFO", msg) end
local function logFileError(msg) writeLog("ERROR", msg) end
local function logFileWarn(msg) writeLog("WARN", msg) end

-- Expõe logging para outros scripts
extoutfit.logFile = logFile
extoutfit.logFileError = logFileError
extoutfit.logFileWarn = logFileWarn

local function isValidType(t)
  return VALID_TYPES[t] == true
end

-- Wrapper seguro para evitar crash se a função C++ não existir
local function safeCall(fn, ...)
  if type(fn) ~= "function" then
    logError("Função C++ não encontrada: " .. tostring(fn))
    return false
  end
  local ok, result = pcall(fn, ...)
  if not ok then
    logError("Erro na chamada C++: " .. tostring(result))
    return false
  end
  return result
end

-- =============================================================================
-- OPERAÇÕES GENÉRICAS (delegam para funções C++ do TFS extendido)
-- =============================================================================

function extoutfit.addUnlock(cid, t, id)
  if not isPlayer(cid) then return false end
  if not isValidType(t) then
    logError("addUnlock: tipo inválido '" .. tostring(t) .. "'")
    return false
  end
  if not id or type(id) ~= "number" or id <= 0 then
    logError("addUnlock: id inválido " .. tostring(id))
    return false
  end
  return safeCall(doPlayerAddExtoutfitUnlock, cid, t, id)
end

function extoutfit.removeUnlock(cid, t, id)
  if not isPlayer(cid) then return false end
  if not isValidType(t) then return false end
  return safeCall(doPlayerRemoveExtoutfitUnlock, cid, t, id)
end

function extoutfit.hasUnlock(cid, t, id)
  if not isPlayer(cid) then return false end
  if not isValidType(t) then return false end
  local result = safeCall(doPlayerHasExtoutfitUnlock, cid, t, id)
  return result == true
end

function extoutfit.getUnlocks(cid, t)
  if not isPlayer(cid) then return {} end
  if not isValidType(t) then return {} end
  local result = safeCall(doPlayerGetExtoutfitUnlocks, cid, t)
  if type(result) ~= "table" then return {} end
  return result
end

-- =============================================================================
-- AURAS
-- =============================================================================

function extoutfit.addAura(cid, id)
  return extoutfit.addUnlock(cid, "aura", id)
end

function extoutfit.removeAura(cid, id)
  return extoutfit.removeUnlock(cid, "aura", id)
end

function extoutfit.hasAura(cid, id)
  return extoutfit.hasUnlock(cid, "aura", id)
end

function extoutfit.getAuras(cid)
  return extoutfit.getUnlocks(cid, "aura")
end

-- Retorna o looktype da aura equipada atualmente
function extoutfit.getEquippedAura(cid)
  if not isPlayer(cid) then return 0 end
  local outfit = getCreatureOutfit(cid)
  if not outfit then return 0 end
  return outfit.aura or 0
end

-- Equipa uma aura no jogador (por looktype) e salva
function extoutfit.equipAura(cid, auraLooktype)
  if not isPlayer(cid) then return false end
  local outfit = getCreatureOutfit(cid)
  if not outfit then return false end
  outfit.aura = auraLooktype or 0
  local ok = pcall(doCreatureChangeOutfit, cid, outfit)
  if ok then
    doPlayerSave(cid)
    return true
  end
  logError("equipAura: doCreatureChangeOutfit falhou para player " .. getPlayerName(cid))
  return false
end

-- Retorna true se o jogador tem a aura cujo looktype é o informado
function extoutfit.hasAuraByLooktype(cid, looktype)
  if not isPlayer(cid) then return false end
  -- Precisa do parser para mapear id -> looktype
  -- Evita dependência circular: carrega com pcall
  if not extoutfit_parser then
    local ok = pcall(dofile, "data/lib/extoutfit_parser.lua")
    if not ok then return false end
  end
  local allAuras = (extoutfit_parser and extoutfit_parser.loadAuras) and extoutfit_parser.loadAuras() or {}
  local ownedIds = extoutfit.getAuras(cid)
  local ownedSet = {}
  for _, uid in ipairs(ownedIds) do ownedSet[uid] = true end
  for _, aura in ipairs(allAuras) do
    if aura.looktype == looktype and ownedSet[aura.id] then
      return true
    end
  end
  return false
end

-- =============================================================================
-- WINGS
-- =============================================================================

function extoutfit.addWing(cid, id) return extoutfit.addUnlock(cid, "wing", id) end

function extoutfit.removeWing(cid, id) return extoutfit.removeUnlock(cid, "wing", id) end

function extoutfit.hasWing(cid, id) return extoutfit.hasUnlock(cid, "wing", id) end

function extoutfit.getWings(cid) return extoutfit.getUnlocks(cid, "wing") end

function extoutfit.getEquippedWing(cid)
  if not isPlayer(cid) then return 0 end
  local outfit = getCreatureOutfit(cid)
  return outfit and outfit.wings or 0
end

-- =============================================================================
-- SHADERS
-- =============================================================================

function extoutfit.addShader(cid, id) return extoutfit.addUnlock(cid, "shader", id) end

function extoutfit.removeShader(cid, id) return extoutfit.removeUnlock(cid, "shader", id) end

function extoutfit.hasShader(cid, id) return extoutfit.hasUnlock(cid, "shader", id) end

function extoutfit.getShaders(cid) return extoutfit.getUnlocks(cid, "shader") end

-- =============================================================================
-- HEALTH BARS
-- =============================================================================

function extoutfit.addHealthBar(cid, id) return extoutfit.addUnlock(cid, "healthbar", id) end

function extoutfit.removeHealthBar(cid, id) return extoutfit.removeUnlock(cid, "healthbar", id) end

function extoutfit.hasHealthBar(cid, id) return extoutfit.hasUnlock(cid, "healthbar", id) end

function extoutfit.getHealthBars(cid) return extoutfit.getUnlocks(cid, "healthbar") end

-- =============================================================================
-- MANA BARS
-- =============================================================================

function extoutfit.addManaBar(cid, id) return extoutfit.addUnlock(cid, "manabar", id) end

function extoutfit.removeManaBar(cid, id) return extoutfit.removeUnlock(cid, "manabar", id) end

function extoutfit.hasManaBar(cid, id) return extoutfit.hasUnlock(cid, "manabar", id) end

function extoutfit.getManaBars(cid) return extoutfit.getUnlocks(cid, "manabar") end

-- =============================================================================
-- EQUIP GENÉRICO (por tipo)
-- =============================================================================

function extoutfit.equip(cid, extraType, extraId)
  if not isPlayer(cid) then return false end
  local outfit = getCreatureOutfit(cid)
  if not outfit then return false end

  if extraType == "wing" then
    outfit.wings = extraId
  elseif extraType == "aura" then
    outfit.aura = extraId
  elseif extraType == "shader" then
    outfit.shader = extraId
  elseif extraType == "healthbar" then
    outfit.healthBar = extraId
  elseif extraType == "manabar" then
    outfit.manaBar = extraId
  else
    logError("equip: tipo desconhecido '" .. tostring(extraType) .. "'")
    return false
  end

  local ok = pcall(doCreatureChangeOutfit, cid, outfit)
  if ok then
    doPlayerSave(cid)
    return true
  end
  logError("equip: doCreatureChangeOutfit falhou")
  return false
end

-- =============================================================================
-- AURA OFFSET OVERRIDE — por vocation ID ou looktype do outfit
-- Substitui completamente o posx/posy base definido em extoutfits.xml
-- =============================================================================

-- Override por vocation ID
vocationAuraOffsetOverride = {
  -- [vocationId] = { posx = N, posy = N }
  -- Exemplo:
  -- [17] = { posx = 0, posy = -32 },  -- Goku
  -- [40] = { posx = -64, posy = 0 },  -- Vegeta
}

-- Override por looktype do outfit do jogador
looktypeAuraOffsetOverride = {
  -- [looktype] = { posx = N, posy = N }
  -- Exemplo:
  -- [1881] = { posx = 0, posy = -32 },  -- Base form looktype 1881
  [3479] = { posx = 64, posy = 42 }, -- Grey aura
  [3517] = { posx = 65, posy = 24 }, -- Yellow Ki
}

-- Calcula o offset final da aura aplicando overrides.
-- Prioridade: looktype > vocation > base (posx/posy do extoutfits.xml)
function extoutfit.getAuraOffsetWithOverride(cid, basePosX, basePosY)
  local outfit = getCreatureOutfit(cid)
  local looktype = outfit and outfit.lookType or 0

  local override = looktypeAuraOffsetOverride[looktype]
  if override then
    return override.posx or 0, override.posy or 0
  end

  local vocId = getPlayerVocation(cid)
  local override = vocationAuraOffsetOverride[vocId]
  if override then
    return override.posx or 0, override.posy or 0
  end

  return basePosX or 0, basePosY or 0
end

return extoutfit
