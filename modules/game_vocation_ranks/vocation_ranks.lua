-- Vocation Ranks Module
local rankCache = {}
local vocationRanksWindow = nil
local vocationRanksButton = nil
VOCATION_RANK_OPCODE = 235

local rankNames = {"Bronze", "Prata", "Ouro", "Diamante"}

function init()
  ProtocolGame.registerExtendedOpcode(VOCATION_RANK_OPCODE, onOpcode)

  vocationRanksButton = modules.client_topmenu.addRightGameToggleButton(
    'vocationRanksBtn', tr('Vocation Ranks'),
    '/images/topbuttons/skills', toggleWindow
  )

  vocationRanksWindow = g_ui.loadUI('vocation_ranks', modules.game_interface.getRightPanel())
  vocationRanksWindow:hide()

  connect(g_game, {
    onCreatureAppear = onCreatureAppear,
    onCreatureDisappear = onCreatureDisappear,
    onGameStart = refresh,
    onGameEnd = cleanup
  })
end

function terminate()
  disconnect(g_game, {
    onCreatureAppear = onCreatureAppear,
    onCreatureDisappear = onCreatureDisappear,
    onGameStart = refresh,
    onGameEnd = cleanup
  })

  if vocationRanksWindow then
    vocationRanksWindow:destroy()
    vocationRanksWindow = nil
  end
  if vocationRanksButton then
    vocationRanksButton:destroy()
    vocationRanksButton = nil
  end
  ProtocolGame.unregisterExtendedOpcode(VOCATION_RANK_OPCODE)
end

function onOpcode(protocol, opcode, buffer)
  local data = json.decode(buffer)
  if not data then return end

  rankCache[data.playerId] = {rank=data.rank, stars=data.stars}

  local player = g_game.getLocalPlayer()
  if player and data.playerId == player:getId() then
    refreshUI()
  end

  updateCreatureStars(data.playerId)
end

function updateCreatureStars(playerId)
  local creature = g_game.getCreatureById(playerId)
  if not creature then return end

  local data = rankCache[playerId]
  if not data or data.stars == 0 then return end

  local old = creature:getChildById('rankStars')
  if old then old:destroy() end

  if data.stars <= 0 then return end

  local container = g_ui.createWidget('UIWidget')
  container:setId('rankStars')
  container:setParent(creature)

  local nameWidget = creature:getChildById('name')
  local offsetY = 0
  if nameWidget then
    offsetY = nameWidget:getHeight() + 2
  end

  container:setPosition({x=0, y=offsetY})

  local starWidth = 16
  for i=1,data.stars do
    local star = g_ui.createWidget('UISprite', container)
    local rankName = rankNames[data.rank] or "Bronze"
    star:setImageSource('/images/ranks/' .. string.lower(rankName) .. '_star.png')
    star:setSize({width=16, height=16})
    star:setPosition({x=(i-1)*starWidth, y=0})
  end

  container:setSize({width=data.stars*starWidth, height=16})
end

function onCreatureAppear(creature)
  if creature:isPlayer() then
    local pid = creature:getId()
    if rankCache[pid] then
      updateCreatureStars(pid)
    end
  end
end

function onCreatureDisappear(creature)
  local old = creature:getChildById('rankStars')
  if old then old:destroy() end
end

function refreshUI()
  local player = g_game.getLocalPlayer()
  if not player then return end

  local data = rankCache[player:getId()]
  if not data then return end

  local rankName = rankNames[data.rank] or "Bronze"
  local rankLabel = vocationRanksWindow:getChildById('rankLabel')
  local starsBar = vocationRanksWindow:getChildById('starsBar')
  if rankLabel then
    rankLabel:setText('Rank: ' .. rankName .. ' ' .. data.stars .. '/5')
  end
  if starsBar then
    starsBar:setValue(data.stars)
  end
end

function onUpgrade()
  local protocol = g_game.getProtocolGame()
  if protocol then
    protocol:sendExtendedOpcode(VOCATION_RANK_OPCODE, json.encode({action='upgrade'}))
  end
end

function toggleWindow()
  if vocationRanksWindow:isVisible() then
    vocationRanksWindow:hide()
    vocationRanksButton:setOn(false)
  else
    vocationRanksWindow:show()
    vocationRanksWindow:raise()
    vocationRanksButton:setOn(true)
    refreshUI()
  end
end

function hideWindow()
  vocationRanksWindow:hide()
  vocationRanksButton:setOn(false)
end

function refresh()
  local protocol = g_game.getProtocolGame()
  if protocol then
    protocol:sendExtendedOpcode(VOCATION_RANK_OPCODE, json.encode({action='request'}))
  end
end

function cleanup()
  rankCache = {}
end
