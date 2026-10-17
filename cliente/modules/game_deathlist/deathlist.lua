-- Janela Deathlist: mortes do proprio jogador (esquerda) e busca por outro jogador (direita).
-- Contrato com o servidor (opcode 175, JSON):
--   -> {action='self', page}
--   -> {action='search', name, page}
--   <- {type='list', target='self'|'search', player, page, pages, total, deaths={...}}
--   <- {type='error', target, message}
-- Cada morte: {date, blessed (true/false/nil), blessings, levelBefore, levelAfter (nil = desconhecido),
--   killers={{name, type='player'|'monster'}}, items={{id, clientId, count, name}} ou nil (sem registro)}
local OPCODE = 175
local REQUEST_TIMEOUT = 8000

local COLOR_BLESSED = '#7fd17f'
local COLOR_UNBLESSED = '#ff6060'
local COLOR_UNKNOWN = '#8a8a8a'
local COLOR_TEXT = '#bfbfbf'
local COLOR_PLAYER = '#ff4040'
local COLOR_MONSTER = '#ff9922'

local window = nil
local topButton = nil

-- estado de cada lado: painel da lista, pagina atual, total de paginas, jogador exibido
local sides = {
  self = { page = 1, pages = 1, player = nil },
  search = { page = 1, pages = 1, player = nil, query = nil },
}

local function sendAction(data)
  local protocol = g_game.getProtocolGame()
  if protocol then
    protocol:sendExtendedJSONOpcode(OPCODE, data)
  end
end

-- sem resposta do servidor: troca o 'Carregando...' por um aviso
local function clearTimeout(target)
  local side = sides[target]
  if side.timeoutEvent then
    removeEvent(side.timeoutEvent)
    side.timeoutEvent = nil
  end
end

local function startTimeout(target)
  clearTimeout(target)
  sides[target].timeoutEvent = scheduleEvent(function()
    sides[target].timeoutEvent = nil
    if window and sides[target].panel then
      setEmpty(target, 'O servidor n\227o respondeu. Tente novamente.')
    end
  end, REQUEST_TIMEOUT)
end

local function requestSelf(page)
  startTimeout('self')
  sendAction({ action = 'self', page = page })
end

local function requestSearch(name, page)
  startTimeout('search')
  sendAction({ action = 'search', name = name, page = page })
end

-- ===================== ciclo de vida =====================

function init()
  connect(g_game, { onGameStart = online, onGameEnd = offline })
  ProtocolGame.registerExtendedJSONOpcode(OPCODE, onServerData)

  topButton = modules.client_topmenu.addRightGameToggleButton('deathlistButton', tr('Deathlist'),
    '/images/topbuttons/deathlist', toggle)

  -- recarga do modulo com o personagem ja logado
  if g_game.isOnline() then
    online()
  end
end

function terminate()
  disconnect(g_game, { onGameStart = online, onGameEnd = offline })
  ProtocolGame.unregisterExtendedJSONOpcode(OPCODE)
  destroyWindow()
  if topButton then
    topButton:destroy()
    topButton = nil
  end
end

-- a janela so existe enquanto o personagem esta logado
local function createWindow()
  if window then return true end

  local ok, result = pcall(g_ui.displayUI, 'deathlist')
  if not ok or not result then
    g_logger.error('[Deathlist] failed to load deathlist.otui: ' .. tostring(result) .. '; module disabled')
    window = nil
    return false
  end
  window = result
  window:hide()

  sides.self.panel = window:getChildById('selfPanel')
  sides.search.panel = window:getChildById('searchPanel')

  for target, side in pairs(sides) do
    local pageBar = side.panel:getChildById('listPanel'):getChildById('pageBar')
    pageBar:getChildById('prevPageButton').onClick = function() changePage(target, -1) end
    pageBar:getChildById('nextPageButton').onClick = function() changePage(target, 1) end
  end

  local searchEdit = sides.search.panel:getChildById('searchEdit')
  searchEdit.onKeyPress = function(widget, keyCode, keyboardModifiers)
    if keyCode == KeyEnter and keyboardModifiers == KeyboardNoModifier then
      search()
      return true
    end
    return false
  end

  resetSides()
  return true
end

function destroyWindow()
  clearTimeout('self')
  clearTimeout('search')
  if window then
    window:destroy()
    window = nil
  end
  sides.self.panel, sides.search.panel = nil, nil
  if topButton then topButton:setOn(false) end
end

function online()
  createWindow()
end

function offline()
  destroyWindow()
  resetSides()
end

function toggle()
  if not g_game.isOnline() or not window then return end
  if window:isVisible() then
    hide()
  else
    show()
  end
end

function show()
  if not g_game.isOnline() or not window then return end
  window:show()
  window:raise()
  window:focus()
  if topButton then topButton:setOn(true) end

  local name = g_game.getCharacterName()
  sides.self.player = name
  setTitle('self', name)
  setEmpty('self', 'Carregando...')
  requestSelf(1)
end

function hide()
  if not window then return end
  window:hide()
  if topButton then topButton:setOn(false) end
end

-- ===================== estado / UI de cada lado =====================

local function getList(target)
  return sides[target].panel:getChildById('listPanel'):getChildById('list')
end

function setTitle(target, name)
  local label = sides[target].panel:getChildById('titleLabel')
  if name and name ~= '' then
    label:setText('Deathlist: ' .. name)
  else
    label:setText(target == 'self' and 'Deathlist' or '')
  end
end

function setEmpty(target, message)
  local listPanel = sides[target].panel:getChildById('listPanel')
  listPanel:getChildById('list'):destroyChildren()
  local label = listPanel:getChildById('emptyLabel')
  label:setText(message or '')
  label:setVisible(message ~= nil and message ~= '')
end

function updatePageBar(target)
  local side = sides[target]
  local pageBar = side.panel:getChildById('listPanel'):getChildById('pageBar')
  local pages = math.max(1, side.pages or 1)
  pageBar:getChildById('pageLabel'):setText(string.format('P\225gina %d de %d', side.page, pages))
  pageBar:getChildById('prevPageButton'):setEnabled(side.page > 1)
  pageBar:getChildById('nextPageButton'):setEnabled(side.page < pages)
end

function resetSides()
  for target, side in pairs(sides) do
    side.page, side.pages, side.player = 1, 1, nil
    if target == 'search' then side.query = nil end
    if side.panel then
      setTitle(target, nil)
      setEmpty(target, nil)
      updatePageBar(target)
    end
  end
  if window then
    sides.search.panel:getChildById('searchEdit'):setText('')
    setEmpty('search', 'Digite o nome de um jogador para ver suas mortes.')
  end
end

function search()
  if not window or not g_game.isOnline() then return end
  local name = sides.search.panel:getChildById('searchEdit'):getText():gsub('^%s+', ''):gsub('%s+$', '')
  if name == '' then return end
  local side = sides.search
  side.query, side.page, side.pages = name, 1, 1
  setTitle('search', name)
  setEmpty('search', 'Carregando...')
  updatePageBar('search')
  requestSearch(name, 1)
end

function changePage(target, delta)
  local side = sides[target]
  local page = side.page + delta
  if page < 1 or page > (side.pages or 1) then return end
  if target == 'self' then
    requestSelf(page)
  elseif side.query then
    requestSearch(side.query, page)
  end
end

-- ===================== dados do servidor =====================

function onServerData(protocol, opcode, data)
  if type(data) ~= 'table' or not window then return end
  local target = data.target == 'search' and 'search' or 'self'
  clearTimeout(target)

  if data.type == 'list' then
    showList(target, data)
  elseif data.type == 'error' then
    local side = sides[target]
    side.page, side.pages = 1, 1
    updatePageBar(target)
    setEmpty(target, data.message or 'N\227o foi poss\237vel carregar a deathlist.')
  end
end

local function formatLevel(death)
  local before, after = tonumber(death.levelBefore), tonumber(death.levelAfter)
  if not before then
    return after and ('Level ' .. after) or 'Level ?'
  end
  if after and after ~= before then
    return string.format('Level %d -> %d', before, after)
  end
  return 'Level ' .. before
end

local function fillCard(card, death)
  local header = card:getChildById('header')
  local date = tonumber(death.date)
  header:getChildById('date'):setText(date and os.date('%d/%m/%Y %H:%M:%S', date) or '?')

  local bless = header:getChildById('bless')
  if death.blessed == true then
    bless:setText('com bless')
    bless:setColor(COLOR_BLESSED)
  elseif death.blessed == false then
    bless:setText('sem bless')
    bless:setColor(COLOR_UNBLESSED)
  else
    bless:setText('bless: ?')
    bless:setColor(COLOR_UNKNOWN)
  end

  card:getChildById('level'):setText(formatLevel(death))

  local killers = type(death.killers) == 'table' and death.killers or {}
  local colored = { 'para: ', COLOR_TEXT }
  if #killers == 0 then
    table.insert(colored, 'desconhecido')
    table.insert(colored, COLOR_UNKNOWN)
  end
  for i, killer in ipairs(killers) do
    if i > 1 then
      table.insert(colored, ', ')
      table.insert(colored, COLOR_TEXT)
    end
    table.insert(colored, tostring(killer.name or '?'))
    table.insert(colored, killer.type == 'player' and COLOR_PLAYER or COLOR_MONSTER)
  end
  card:getChildById('killers'):setColoredText(colored)

  local itemsLabel = card:getChildById('items')
  local itemList = card:getChildById('itemList')
  local items = death.items
  if type(items) ~= 'table' then
    itemsLabel:setText('perdeu: sem registro')
    itemList:setVisible(false)
  elseif #items == 0 then
    itemsLabel:setText('perdeu: nenhum item')
    itemList:setVisible(false)
  else
    itemsLabel:setText('perdeu:')
    for _, info in ipairs(items) do
      local widget = g_ui.createWidget('DeathItem', itemList)
      widget:setItemId(tonumber(info.clientId) or 0)
      local count = tonumber(info.count) or 1
      widget:setItemCount(count)
      local name = tostring(info.name or ('item ' .. tostring(info.id)))
      widget:setTooltip(count > 1 and (count .. 'x ' .. name) or name)
    end
  end
end

function showList(target, data)
  local side = sides[target]
  side.page = tonumber(data.page) or 1
  side.pages = math.max(1, tonumber(data.pages) or 1)
  if data.player and data.player ~= '' then
    side.player = data.player
    setTitle(target, data.player)
  end
  updatePageBar(target)

  local deaths = type(data.deaths) == 'table' and data.deaths or {}
  if #deaths == 0 then
    if target == 'self' then
      setEmpty(target, 'N\227o foi encontrado nenhuma morte do seu personagem.')
    else
      setEmpty(target, 'N\227o foi encontrado nenhuma morte deste jogador.')
    end
    return
  end
  setEmpty(target, nil)

  local list = getList(target)
  for _, death in ipairs(deaths) do
    local card = g_ui.createWidget('DeathCard', list)
    fillCard(card, death)
  end
  local scroll = sides[target].panel:getChildById('listPanel'):getChildById('listScroll')
  scroll:setValue(0)
end
