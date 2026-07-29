local OPCODE = 251

local window = nil
local topButton = nil
local cachedData = nil

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
  if topButton then topButton:destroy() end
end

function onGameStart()
  scheduleEvent(requestUpdate, 200)
end

function offline()
  cachedData = nil
  destroyWindow()
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

function onOpcode(protocol, opcode, buffer)
  if opcode ~= OPCODE then return end
  if not buffer or buffer == '' then return end

  local ok, data = pcall(json.decode, buffer)
  if not ok or type(data) ~= 'table' or data.action ~= 'update' then return end

  cachedData = data
  if window then updateWindow() end
end

function updateWindow()
  if not window or not cachedData then return end
  local season = cachedData.season
  local progress = cachedData.progress

  window:getChildById('titleLabel'):setText(string.format('Battle Pass — %d/%d — Level %d',
    season.month, season.year, progress.level))

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

  -- Reward tracks: one slot per level reached, bronze row + gold row
  local rewardsScroll = window:getChildById('rewardsScroll')
  rewardsScroll:destroyChildren()
  for level = 1, season.maxLevel do
    local reachable = progress.level >= level
    for _, track in ipairs({ 'bronze', 'gold' }) do
      local claimedList = track == 'gold' and progress.claimedGold or progress.claimedBronze
      local claimed = false
      for _, l in ipairs(claimedList) do
        if l == level then claimed = true end
      end

      if reachable and not claimed then
        local slot = g_ui.createWidget('BattlePassRewardSlot', rewardsScroll)
        slot:setTooltip(string.format('Level %d (%s) — click to claim', level, track))
        slot.onClick = function() claim(level, track) end
      end
    end
  end

  -- Missions
  local missionsList = window:getChildById('missionsList')
  missionsList:destroyChildren()
  for _, mission in ipairs(cachedData.missions or {}) do
    local current = progress.missionProgress[tostring(mission.id)] or 0
    local required = mission.target.amount or 1
    local row = g_ui.createWidget('BattlePassMissionRow', missionsList)
    local status = current >= required and '[DONE]' or string.format('%d/%d', current, required)
    row:setText(mission.description .. ' — ' .. status)
    if current >= required then
      row:setColor('#55ff55')
    end
  end
end
