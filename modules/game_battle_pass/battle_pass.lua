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

function confirmBuyLevel()
  if not cachedData then return end
  local season = cachedData.season
  if not season or season.levelPurchaseItemId == 0 then
    return
  end

  displayGeneralBox(tr('Buy level'),
    tr('Do you want to buy the next Battle Pass level for %d of item #%d?', season.levelPurchaseCost,
      season.levelPurchaseItemId), {
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
  window:getChildById('passBadge'):setImageSource(progress.hasGoldPass and '/images/battle_pass/badge_gold' or
    '/images/battle_pass/badge_bronze')

  local lastDay = lastDayOfMonth(season.month, season.year)
  window:getChildById('passExpiresLabel'):setText(string.format('%s %02d/%02d/%04d', tr('Acaba em:'), lastDay,
    season.month, season.year))

  window:getChildById('levelNumberLabel'):setText(tostring(progress.level))

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

function renderRewardTrack(scroll, track, season, progress)
  if not scroll then return end
  scroll:destroyChildren()

  local rewards = cachedData.rewards or {}
  local claimedList = track == 'gold' and progress.claimedGold or progress.claimedBronze
  local claimedSet = {}
  for _, l in ipairs(claimedList) do claimedSet[l] = true end

  for level = 1, season.maxLevel do
    local reward = rewards[track .. '_' .. level]
    if reward then
      local slot = g_ui.createWidget('BattlePassRewardSlot', scroll)
      slot:setItemId(reward.itemId)
      slot:setItemCount(reward.count)

      local reachable = progress.level >= level
      local claimed = claimedSet[level] == true

      if claimed then
        slot:setOn(true)
        slot:setTooltip(string.format('%s %d - %s', tr('Level'), level, tr('claimed')))
        slot.onClick = nil
      elseif reachable then
        slot:setTooltip(string.format('%s %d - %s', tr('Level'), level, tr('click to claim')))
        slot.onClick = function() claim(level, track) end
      else
        slot:setOpacity(0.4)
        slot:setTooltip(string.format('%s %d', tr('Level'), level))
        slot.onClick = nil
      end
    end
  end
end

function updateMissionsWindow()
  if not missionsWindow or not cachedData then return end
  local progress = cachedData.progress

  local grid = missionsWindow:getChildById('missionsGrid')
  grid:destroyChildren()

  for _, mission in ipairs(cachedData.missions or {}) do
    local current = progress.missionProgress[tostring(mission.id)] or 0
    local required = mission.target.amount or 1
    local done = current >= required

    local card = g_ui.createWidget('BattlePassMissionCard', grid)
    card:getChildById('cardTitle'):setText(mission.description)
    local creature = card:getChildById('cardCreature')
    creature:setOutfit({ type = mission.lookType or 21 })
    creature:setTooltip(string.format('%d %s %d %s', current, tr('of'), required, mission.target.monster or ''))
    card:getChildById('cardXp'):setText('+' .. tostring(mission.xpReward or 0))
    card:getChildById('cardProgress'):setText(string.format('%d %s %d', current, tr('de'), required))

    local check = card:getChildById('cardCheck')
    if done then
      check:setColor('#2ecc71')
    else
      check:setColor('#666666')
    end
  end
end
