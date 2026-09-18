local OPCODE = 251

local window = nil
local missionsWindow = nil
local topButton = nil
local cachedData = nil

-- Progresso de cada missão no snapshot anterior (por id), usado só para detectar avanço em
-- `notifyMissionProgress` e disparar a mensagem de tela na hora certa (não no primeiro opcode
-- recebido após o login, que só estabelece a baseline).
local previousMissionProgress = nil

local MONTH_DAYS = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 }

local function isLeapYear(year)
  return (year % 4 == 0 and year % 100 ~= 0) or (year % 400 == 0)
end

local function lastDayOfMonth(month, year)
  if month == 2 and isLeapYear(year) then return 29 end
  return MONTH_DAYS[month] or 30
end

function init()
  connect(g_game, { onGameStart = onGameStart, onGameEnd = offline })
  ProtocolGame.registerExtendedOpcode(OPCODE, onOpcode)
  topButton = modules.client_topmenu.addRightGameToggleButton('battlePassButton', tr('Battle Pass'),
    '/images/topbuttons/tier', toggle)
end

function terminate()
  disconnect(g_game, { onGameStart = onGameStart, onGameEnd = offline })
  ProtocolGame.unregisterExtendedOpcode(OPCODE)
  destroyWindow()
  closeMissions()
  if topButton then topButton:destroy() end
end

function onGameStart()
  scheduleEvent(requestUpdate, 200)
end

function offline()
  cachedData = nil
  previousMissionProgress = nil
  destroyWindow()
  closeMissions()
end

function toggle()
  if window then
    destroyWindow()
    return
  end
  window = g_ui.displayUI('battle_pass')
  if cachedData then updateWindow() end
end

function destroyWindow()
  if window then
    window:destroy()
    window = nil
  end
end

function openMissions()
  if missionsWindow then
    missionsWindow:raise()
    missionsWindow:focus()
    return
  end
  missionsWindow = g_ui.displayUI('battle_pass_missions')
  updateMissionsWindow()
end

function closeMissions()
  if missionsWindow then
    missionsWindow:destroy()
    missionsWindow = nil
  end
end

function requestUpdate()
  local pg = g_game.getProtocolGame()
  if not pg then return end
  pg:sendExtendedOpcode(OPCODE, json.encode({ action = 'request' }))
end

function claim(level, track)
  local pg = g_game.getProtocolGame()
  if not pg then return end
  pg:sendExtendedOpcode(OPCODE, json.encode({ action = 'claim', level = level, track = track }))
end

function buyGoldPass()
  local pg = g_game.getProtocolGame()
  if not pg then return end
  pg:sendExtendedOpcode(OPCODE, json.encode({ action = 'buyGoldPass' }))
end

function buyLevel()
  local pg = g_game.getProtocolGame()
  if not pg then return end
  pg:sendExtendedOpcode(OPCODE, json.encode({ action = 'buyLevel' }))
end

--- `id` deve ser o clientId (id do .dat/.otb do cliente) — o servidor manda tanto o itemId
-- (server id, usado em doPlayerAddItem) quanto o clientId (usado aqui e em UIItem:setItemId).
-- `ItemType:getName()` não existe nesse build do OTC (só getServerId/getClientId/isWritable
-- estão vinculados em luafunctions_client.cpp) — chamar direto sempre lança "attempt to call
-- method 'getName' (a nil value)". Mesmo padrão já usado (e funcional) em
-- modules/game_tasks/tasks.lua:getItemName: resolve o clientId e cria um Item de verdade
-- (Item:getName() esse sim está vinculado).
local function getItemName(id)
  if type(id) ~= 'number' or id == 0 then return 'Unknown' end
  local itemType = g_things.getItemType(id)
  if itemType then
    local clientId = itemType:getClientId()
    if clientId and clientId > 0 then
      local item = Item.create(clientId)
      if item then
        local name = item:getName()
        if name and name ~= '' then return name end
      end
    end
  end
  return 'Unknown'
end

--- Prioriza o nome que o servidor já manda pronto (`items.xml`, sempre correto) — o
-- `items.otb` local do client quase nunca tem o atributo de nome embutido (confirmado: só
-- ~0.7% dos itens têm nome no OTB do client, incluindo a maioria dos itens customizados), o
-- que fazia `getItemName` cair em 'Unknown' mesmo com o item existindo e resolvendo certo no
-- servidor. `getItemName(id)` continua como fallback só pra dados antigos/sem o campo novo.
local function resolveItemName(serverName, id)
  if type(serverName) == 'string' and serverName ~= '' then return serverName end
  return getItemName(id)
end

function confirmBuyLevel()
  if not cachedData then return end
  local season = cachedData.season
  if not season or season.levelPurchaseItemId == 0 then
    return
  end

  -- `UIMessageBox:addButton` only fires the button's callback — it never closes the box itself
  -- (compare displayInfoBox/displayCancelBox, which wrap their callback in `messageBox:ok()` /
  -- `messageBox:cancel()` for exactly this reason). Passing `buyLevel` / `function() end` here
  -- directly left the dialog open after "Yes" and made "No" look like it did nothing at all.
  local messageBox
  local function onYes()
    buyLevel()
    messageBox:ok()
  end
  local function onNo()
    messageBox:cancel()
  end
  messageBox = displayGeneralBox(tr('Buy level'),
    string.format('Do you want to buy the next Battle Pass level for %d of %s?', season.levelPurchaseCost,
      resolveItemName(season.levelPurchaseItemName, season.levelPurchaseClientId or season.levelPurchaseItemId)), {
      { text = tr('Yes'), callback = onYes },
      { text = tr('No'),  callback = onNo },
      anchor = AnchorHorizontalCenter
    }, onYes, onNo)
end

-- Compara o `missionProgress` recebido agora com o snapshot anterior e avisa na tela quando uma
-- missão ainda incompleta avançou (ou seja, o jogador acabou de matar um monstro que conta pra
-- ela) — não dispara no primeiro opcode da sessão, que só estabelece a baseline inicial.
local function notifyMissionProgress(data)
  local missions = data.missions
  local progress = data.progress
  if not missions or not progress or not progress.missionProgress then return end

  if previousMissionProgress then
    for _, mission in ipairs(missions) do
      local key = tostring(mission.id)
      local required = mission.target.amount or 1
      local current = progress.missionProgress[key] or 0
      local previous = previousMissionProgress[key] or 0

      if current > previous and current < required then
        modules.game_textmessage.displayGameMessage(string.format(
          'Keep killing %s [%d of %d] to complete the Battle Pass mission',
          mission.target.monster or mission.description, current, required))
      end
    end
  end

  previousMissionProgress = progress.missionProgress
end

-- Popup modal (precisa ser fechado, sempre chama atenção) disparado pelo servidor quando uma
-- mission é concluída (`action = "missionComplete"`, separado do `action = "update"` de
-- notifyMissionProgress/cachedData) — texto sempre em inglês americano, não usa tr().
local function showMissionCompleteBox(data)
  local message = string.format('You completed the mission:\n%s\n\n+%d XP earned.',
    data.description or '', data.xpReward or 0)

  if data.hasClaimable then
    message = message .. '\n\nYou have a reward available to claim in the Battle Pass!'
    local box
    local function openBattlePass()
      box:ok()
      if not window then toggle() end
    end
    local function close()
      box:cancel()
    end
    box = displayGeneralBox('Mission Complete', message, {
      { text = 'Open Battle Pass', callback = openBattlePass },
      { text = 'Close',            callback = close },
      anchor = AnchorHorizontalCenter
    }, openBattlePass, close)
  else
    displayInfoBox('Mission Complete', message)
  end
end

function onOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then return end
  if not buffer or buffer == '' then return end

  local ok, data = pcall(json.decode, buffer)
  if not ok or type(data) ~= 'table' then return end

  if data.action == 'missionComplete' then
    showMissionCompleteBox(data)
    return
  end

  if data.action ~= 'update' then return end

  notifyMissionProgress(data)

  cachedData = data
  if window then updateWindow() end
  if missionsWindow then updateMissionsWindow() end
end

function updateWindow()
  if not window or not cachedData then return end
  local season = cachedData.season
  local progress = cachedData.progress

  window:getChildById('passNameLabel'):setText(progress.hasGoldPass and tr('Gold Pass') or tr('Bronze Pass'))

  local lastDay = lastDayOfMonth(season.month, season.year)
  window:getChildById('passExpiresLabel'):setText(string.format('%s %02d/%02d/%04d', tr('Acaba em:'), lastDay,
    season.month, season.year))

  window:recursiveGetChildById('levelNumberLabel'):setText(tostring(progress.level))

  -- Barra única mostrando o progresso de XP rumo ao próximo level do battle pass (XP vem das
  -- missões completadas, via BattlePassLib.addXp no servidor) — no máximo (level de topo) a
  -- barra fica cheia e sem XP restante a acumular.
  local xpBar = window:getChildById('xpBar')
  local atMaxLevel = progress.level >= season.maxLevel
  local xpPercent = atMaxLevel and 100 or (season.xpPerLevel > 0 and math.floor((progress.xp / season.xpPerLevel) * 100) or 0)
  xpBar:setPercent(xpPercent)
  xpBar:setText(atMaxLevel and tr('Max level') or (progress.xp .. ' / ' .. season.xpPerLevel .. ' XP'))

  local goldPassButton = window:getChildById('goldPassButton')
  if progress.hasGoldPass then
    goldPassButton:setText(tr('Gold Pass active'))
    goldPassButton:setEnabled(false)
  else
    goldPassButton:setText(tr('Buy Gold Pass'))
    goldPassButton:setEnabled(true)
  end

  local refreshPassButton = window:getChildById('refreshPassButton')
  local canBuyLevel = season.levelPurchaseItemId > 0 and progress.level < season.maxLevel
  refreshPassButton:setEnabled(canBuyLevel)

  renderRewardTrack(window:getChildById('bronzeTrackScroll'), 'bronze', season, progress)
  renderRewardTrack(window:getChildById('goldTrackScroll'), 'gold', season, progress)
end

local BATTLE_PASS_RARITY_ORDER = { comum = 0, incomum = 1, raro = 2, super_raro = 3, lendario = 4, mitico = 5 }

--- Ordena os itens de um mesmo level+trilha: respeita o `order` configurado no CRUD do site
-- quando presente; caso contrário cai para level (já agrupado) -> raridade -> nome do item.
local function sortLevelRewards(rewards)
  local hasExplicitOrder = false
  for _, reward in ipairs(rewards) do
    if (reward.order or 0) ~= 0 then
      hasExplicitOrder = true
      break
    end
  end

  table.sort(rewards, function(a, b)
    if hasExplicitOrder then
      return (a.order or 0) < (b.order or 0)
    end
    local ra, rb = BATTLE_PASS_RARITY_ORDER[a.rarity] or 0, BATTLE_PASS_RARITY_ORDER[b.rarity] or 0
    if ra ~= rb then return ra < rb end
    return resolveItemName(a.name, a.clientId or a.itemId) < resolveItemName(b.name, b.clientId or b.itemId)
  end)
  return rewards
end

function renderRewardTrack(scroll, track, season, progress)
  if not scroll then return end
  scroll:destroyChildren()

  local rewards = cachedData.rewards or {}
  local claimedList = track == 'gold' and progress.claimedGold or progress.claimedBronze
  local claimedSet = {}
  for _, l in ipairs(claimedList) do claimedSet[l] = true end

  for level = 1, season.maxLevel do
    local levelRewards = rewards[track .. '_' .. level]
    if levelRewards and #levelRewards > 0 then
      sortLevelRewards(levelRewards)

      local reachable = progress.level >= level
      local claimed = claimedSet[level] == true

      for _, reward in ipairs(levelRewards) do
        local slot = g_ui.createWidget('BattlePassRewardSlot', scroll)
        slot:setItemId(reward.clientId or reward.itemId)
        slot:setItemCount(reward.count)

        local itemLabel = string.format('%dx %s', reward.count, resolveItemName(reward.name, reward.clientId or reward.itemId))
        if claimed then
          slot:setOn(true)
          slot.onClick = nil
        elseif reachable then
          slot.onClick = function() claim(level, track) end
        else
          slot:setOpacity(0.4)
          slot.onClick = nil
        end
        slot:setTooltip(itemLabel)
      end
    end
  end
end

function updateMissionsWindow()
  if not missionsWindow or not cachedData then return end
  local progress = cachedData.progress

  local grid = missionsWindow:recursiveGetChildById('missionsGrid')
  grid:destroyChildren()

  -- Cópia ordenada (não mexe em cachedData.missions, usado em outro lugar sem depender de ordem)
  -- por quantidade a matar crescente, da mais fácil pra mais difícil.
  local missions = {}
  for _, mission in ipairs(cachedData.missions or {}) do
    table.insert(missions, mission)
  end
  table.sort(missions, function(a, b) return (a.target.amount or 1) < (b.target.amount or 1) end)

  for _, mission in ipairs(missions) do
    local current = progress.missionProgress[tostring(mission.id)] or 0
    local required = mission.target.amount or 1
    local done = current >= required

    local card = g_ui.createWidget('BattlePassMissionCard', grid)
    card:getChildById('cardTitle'):setText(mission.description)
    local creature = card:getChildById('cardCreature')
    -- `mission.lookType` vem sempre como number (0 quando a looktype vinculada no site não tem
    -- o campo "Número" configurado) — `or 21` nunca disparava porque 0 é truthy em Lua, deixando
    -- a criatura vazia. Padrão alinhado ao definido no site: looktype 136 quando não configurado.
    local lookType = (mission.lookType and mission.lookType > 0) and mission.lookType or 136
    creature:setOutfit({ type = lookType })
    card:setTooltip(string.format('%s\n%d %s %d %s', mission.description, current, tr('of'), required,
      mission.target.monster or ''))
    card:getChildById('cardXp'):setText('+' .. tostring(mission.xpReward or 0) .. ' XP')
    card:getChildById('cardProgress'):setText(string.format('%d %s %d', current, tr('de'), required))

    local check = card:getChildById('cardCheck')
    if done then
      check:setColor('#2ecc71')
    else
      check:setColor('#666666')
    end
  end
end
