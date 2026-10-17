-- =============================================================================
-- data/lib/extoutfit_parser.lua
-- Parser do extoutfits.xml com cache, validação e logs detalhados
-- =============================================================================

if extoutfit_parser and extoutfit_parser.__loaded then
  return extoutfit_parser
end

extoutfit_parser = {}
extoutfit_parser.__loaded   = true
extoutfit_parser.__cache    = {}
extoutfit_parser.__cacheTime = 0
extoutfit_parser.__cacheTTL  = 60  -- segundos

local EXT_OUTFIT_PATH = "data/XML/extoutfits.xml"
local LOG_TAG         = "[extoutfit_parser]"

-- =============================================================================
-- LOGGING
-- =============================================================================
local function logError(msg) print(LOG_TAG .. " ERROR: " .. tostring(msg)) end
local function logWarn(msg)  print(LOG_TAG .. " WARN: "  .. tostring(msg)) end
local function logInfo(msg)  print(LOG_TAG .. " "        .. tostring(msg)) end

-- =============================================================================
-- LEITURA DO XML
-- =============================================================================
local function readXmlFile()
  local file, err = io.open(EXT_OUTFIT_PATH, "r")
  if not file then
    logError("Falha ao abrir " .. EXT_OUTFIT_PATH .. ": " .. tostring(err))
    return nil
  end
  local content = file:read("*all")
  file:close()
  if not content or #content == 0 then
    logError(EXT_OUTFIT_PATH .. " está vazio")
    return nil
  end
  return content
end

-- =============================================================================
-- CACHE
-- =============================================================================
local function isCacheValid()
  return extoutfit_parser.__cacheTime > 0
      and (os.time() - extoutfit_parser.__cacheTime) < extoutfit_parser.__cacheTTL
end

local function invalidateAll()
  extoutfit_parser.__cache    = {}
  extoutfit_parser.__cacheTime = 0
end

-- =============================================================================
-- EXTRAÇÃO DE ATRIBUTO — case-insensitive para looktype/lookType
-- Tenta todas as variações de capitalização comuns
-- =============================================================================
local function extractLooktype(entry)
  -- Tenta 'looktype' (minúsculo)
  local v = entry:match(' looktype="(%d+)"')
  if v then return tonumber(v) end
  -- Tenta 'lookType' (camelCase)
  v = entry:match(' lookType="(%d+)"')
  if v then return tonumber(v) end
  -- Tenta 'LookType'
  v = entry:match(' LookType="(%d+)"')
  if v then return tonumber(v) end
  return nil
end

local function extractAttr(entry, attrName)
  return entry:match(' ' .. attrName .. '="([^"]*)"')
end

-- =============================================================================
-- PARSER GENÉRICO DE TAG
-- =============================================================================
local function parseTags(content, tagName, required)
  local results  = {}
  local seenIds  = {}
  local errors   = 0

  -- Itera sobre todas as tags <tagName .../>
  for entry in content:gmatch('<' .. tagName .. ' [^/]*/?>') do
    local idStr   = extractAttr(entry, 'id')
    local nameStr = extractAttr(entry, 'name')
    local numId   = tonumber(idStr)

    -- Valida ID
    if not numId or numId <= 0 then
      logWarn("ID inválido '" .. tostring(idStr) .. "' em <" .. tagName .. ">")
      errors = errors + 1
    elseif seenIds[numId] then
      logWarn("ID duplicado " .. numId .. " em <" .. tagName .. "> (ignorado)")
      errors = errors + 1
    elseif not nameStr or nameStr == "" then
      logWarn("Nome vazio para " .. tagName .. " id=" .. numId)
      errors = errors + 1
    else
      -- Coleta atributos adicionais conforme requerido
      local row = { id = numId, name = nameStr }
      local valid = true

      for _, req in ipairs(required or {}) do
        if req == "looktype" then
          local lk = extractLooktype(entry)
          if not lk or lk <= 0 then
            logWarn("looktype inválido para " .. tagName .. " id=" .. numId)
            errors = errors + 1
            valid = false
            break
          end
          row.looktype = lk
        elseif req == "shadername" then
          local sn = extractAttr(entry, 'shadername')
          if not sn or sn == "" then
            logWarn("shadername vazio para " .. tagName .. " id=" .. numId)
            errors = errors + 1
            valid = false
            break
          end
          row.shadername = sn
        elseif req == "image" then
          local img = extractAttr(entry, 'image')
          if not img or img == "" then
            logWarn("image vazio para " .. tagName .. " id=" .. numId)
            errors = errors + 1
            valid = false
            break
          end
          row.image = img
        end
      end

      if valid then
        -- Optional attributes
        row.posx = tonumber(extractAttr(entry, 'posx')) or 0
        row.posy = tonumber(extractAttr(entry, 'posy')) or 0

        seenIds[numId] = true
        table.insert(results, row)
      end
    end
  end

  return results, errors
end

-- =============================================================================
-- API PÚBLICA
-- =============================================================================

function extoutfit_parser.loadAuras()
  if isCacheValid() and extoutfit_parser.__cache.auras then
    return extoutfit_parser.__cache.auras
  end
  local content = readXmlFile()
  if not content then return {} end

  local auras, errors = parseTags(content, "auras", { "looktype" })

  if #auras == 0 then
    logWarn("Nenhuma aura encontrada em " .. EXT_OUTFIT_PATH)
  else
    logInfo("Carregadas " .. #auras .. " auras" .. (errors > 0 and (" (" .. errors .. " com erro)") or ""))
  end

  extoutfit_parser.__cache.auras  = auras
  extoutfit_parser.__cacheTime    = os.time()
  return auras
end

function extoutfit_parser.loadWings()
  if isCacheValid() and extoutfit_parser.__cache.wings then
    return extoutfit_parser.__cache.wings
  end
  local content = readXmlFile()
  if not content then return {} end

  local wings, errors = parseTags(content, "wings", { "looktype" })

  if #wings == 0 then
    logWarn("Nenhuma wing encontrada")
  else
    logInfo("Carregadas " .. #wings .. " wings")
  end

  extoutfit_parser.__cache.wings = wings
  extoutfit_parser.__cacheTime   = os.time()
  return wings
end

function extoutfit_parser.loadShaders()
  if isCacheValid() and extoutfit_parser.__cache.shaders then
    return extoutfit_parser.__cache.shaders
  end
  local content = readXmlFile()
  if not content then return {} end

  local shaders, errors = parseTags(content, "shaders", { "shadername" })

  if #shaders == 0 then
    logWarn("Nenhum shader encontrado")
  else
    logInfo("Carregados " .. #shaders .. " shaders")
  end

  extoutfit_parser.__cache.shaders = shaders
  extoutfit_parser.__cacheTime      = os.time()
  return shaders
end

function extoutfit_parser.loadHealthBars()
  if isCacheValid() and extoutfit_parser.__cache.healthbars then
    return extoutfit_parser.__cache.healthbars
  end
  local content = readXmlFile()
  if not content then return {} end

  local bars, errors = parseTags(content, "healthbars", { "image" })
  extoutfit_parser.__cache.healthbars = bars
  extoutfit_parser.__cacheTime        = os.time()
  return bars
end

function extoutfit_parser.loadManaBars()
  if isCacheValid() and extoutfit_parser.__cache.manabars then
    return extoutfit_parser.__cache.manabars
  end
  local content = readXmlFile()
  if not content then return {} end

  local bars, errors = parseTags(content, "manabars", { "image" })
  extoutfit_parser.__cache.manabars = bars
  extoutfit_parser.__cacheTime      = os.time()
  return bars
end

-- =============================================================================
-- BUSCA POR ID
-- =============================================================================
function extoutfit_parser.findAura(auras, auraId)
  if not auras or not auraId then return nil end
  for _, aura in ipairs(auras) do
    if aura.id == auraId then return aura end
  end
  return nil
end

function extoutfit_parser.findAuraByLooktype(auras, looktype)
  if not auras or not looktype then return nil end
  for _, aura in ipairs(auras) do
    if aura.looktype == looktype then return aura end
  end
  return nil
end

function extoutfit_parser.findWing(wings, wingId)
  if not wings or not wingId then return nil end
  for _, wing in ipairs(wings) do
    if wing.id == wingId then return wing end
  end
  return nil
end

function extoutfit_parser.findShader(shaders, shaderId)
  if not shaders or not shaderId then return nil end
  for _, shader in ipairs(shaders) do
    if shader.id == shaderId then return shader end
  end
  return nil
end

-- =============================================================================
-- INVALIDAÇÃO DE CACHE
-- =============================================================================
function extoutfit_parser.invalidateCache()
  invalidateAll()
  logInfo("Cache invalidado")
end

-- Força reload completo (útil após editar o XML em runtime)
function extoutfit_parser.reload()
  invalidateAll()
  extoutfit_parser.loadAuras()
  extoutfit_parser.loadWings()
  extoutfit_parser.loadShaders()
  logInfo("Reload completo")
end

return extoutfit_parser