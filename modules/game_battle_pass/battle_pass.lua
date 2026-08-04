local OPCODE = 251

local window = nil
local missionsWindow = nil
local topButton = nil
local cachedData = nil

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

function confirmBuyLevel()
  if not cachedData then return end
  local season = cachedData.season
  if not season or season.levelPurchaseItemId == 0 then
    return
  end

  displayGeneralBox(tr('Buy level'),
    string.format('Do you want to buy the next Battle Pass level for %d of %s?', season.levelPurchaseCost,
      getItemName(season.levelPurchaseClientId or season.levelPurchaseItemId)), {
      { text = tr('Yes'), callback = buyLevel },
      { text = tr('No'),  callback = function() end },
      anchor = AnchorHorizontalCenter
    }, buyLevel, function() end)
end

function onOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then return end
  if not buffer or buffer == '' then return end

  local ok, data = pcall(json.decode, buffer)
  if not ok or type(data) ~= 'table' or data.action ~= 'update' then return end

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

  local xpBar = window:getChildById('xpBar')
  if progress.level >= season.maxLevel then
    xpBar:setPercent(100)
    xpBar:setText('MAX LEVEL')
  else
    local percent = season.xpPerLevel > 0 and math.floor((progress.xp / season.xpPerLevel) * 100) or 0
    xpBar:setPercent(percent)
    xpBar:setText(progress.xp .. ' / ' .. season.xpPerLevel .. ' XP')
  end

  local goldPassButton = window:getChildById('goldPassButton')
  if progress.hasGoldPass then
    goldPassButton:setText(tr('Gold Pass active'))
    goldPassButton:setEnabled(false)
  else
    goldPassButton:setText(tr('Buy Gold Pass'))
    goldPassButton:setEnabled(true)
  end

  local lvUpButton = window:getChildById('lvUpButton')
  local refreshPassButton = window:getChildById('refreshPassButton')
  local canBuyLevel = season.levelPurchaseItemId > 0 and progress.level < season.maxLevel
  lvUpButton:setEnabled(canBuyLevel)
  refreshPassButton:setEnabled(canBuyLevel)

  renderRewardTrack(window:getChildById('bronzeTrackScroll'), 'bronze', season, progress)
  renderRewardTrack(window:getChildById('goldTrackScroll'), 'gold', season, progress)

  -- Missions (compact summary list)
  local missionsList = window:getChildById('missionsList')
  missionsList:destroyChildren()
  for _, mission in ipairs(cachedData.missions or {}) do
    local current = progress.missionProgress[tostring(mission.id)] or 0
    local required = mission.target.amount or 1
    local row = g_ui.createWidget('BattlePassMissionRow', missionsList)
    local status = current >= required and '[DONE]' or string.format('%d/%d', current, required)
    row:setText(mission.description .. ' - ' .. status)
    if current >= required then
      row:setColor('#55ff55')
    end
  end
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
    return getItemName(a.clientId or a.itemId) < getItemName(b.clientId or b.itemId)
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

      local column = g_ui.createWidget('BattlePassRewardColumn', scroll)

      local reachable = progress.level >= level
      local claimed = claimedSet[level] == true

      for _, reward in ipairs(levelRewards) do
        local slot = g_ui.createWidget('BattlePassRewardSlot', column)
        slot:setItemId(reward.clientId or reward.itemId)
        slot:setItemCount(reward.count)

        local itemLabel = string.format('%dx %s', reward.count, getItemName(reward.clientId or reward.itemId))
        local statusLabel
        if claimed then
          slot:setOn(true)
          statusLabel = string.format('%s %d - %s', tr('Level'), level, tr('claimed'))
          slot.onClick = nil
        elseif reachable then
          statusLabel = string.format('%s %d - %s', tr('Level'), level, tr('click to claim'))
          slot.onClick = function() claim(level, track) end
        else
          slot:setOpacity(0.4)
          statusLabel = string.format('%s %d', tr('Level'), level)
          slot.onClick = nil
        end
        slot:setTooltip(itemLabel .. '\n' .. statusLabel)
      end
    end
  end
end

function updateMissionsWindow()
  if not missionsWindow or not cachedData then return end
  local progress = cachedData.progress

  local grid = missionsWindow:recursiveGetChildById('missionsGrid')
  grid:destroyChildren()

  for _, mission in ipairs(cachedData.missions or {}) do
    local current = progress.missionProgress[tostring(mission.id)] or 0
    local required = mission.target.amount or 1
    local done = current >= required

    local card = g_ui.createWidget('BattlePassMissionCard', grid)
    card:getChildById('cardTitle'):setText(mission.description)
    local creature = card:getChildById('cardCreature')
    -- `mission.lookType` vem sempre como number (0 quando o monstro não foi encontrado na tabela
    -- `monsters`) — `or 21` nunca disparava porque 0 é truthy em Lua, deixando a criatura vazia.
    local lookType = (mission.lookType and mission.lookType > 0) and mission.lookType or 21
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
