local dailyButton
local dailyOpcode = 155
local pulseEvents = {}
local bonusDays = {5, 10, 15, 20, 25, 30}

local function isBitSet(mask, bit)
  return math.floor(mask / (2 ^ (bit - 1))) % 2 == 1
end

local function startPulse(widget)
  if not widget then return end
  local colors = { "#00aa00", "#004400" }
  local i = 1

  local event = cycleEvent(function()
    if not widget or not widget:isVisible() then
      return
    end
    widget:setBackgroundColor(colors[i])
    i = (i == 1) and 2 or 1
  end, 800)

  table.insert(pulseEvents, event)
end

local function stopPulses()
  for _, event in ipairs(pulseEvents) do
    removeEvent(event)
  end
  pulseEvents = {}
end

function init()
  connect(g_game, {
    onGameStart = create,
    onGameEnd = destroy
  })

  ProtocolGame.registerExtendedOpcode(dailyOpcode, onExtendedOpcode)

  if g_game.isOnline() then
    create()
  end
end

function terminate()
  disconnect(g_game, {
    onGameStart = create,
    onGameEnd = destroy
  })

  ProtocolGame.unregisterExtendedOpcode(dailyOpcode)
  destroy()
end

function create()
  if dailyWindow or dailyButton then return end

  dailyWindow = g_ui.displayUI('dailyreward')
  dailyWindow:hide()

  local claimBtn = dailyWindow:getChildById('claimButton')
  if claimBtn then claimBtn.onClick = claimDaily end

  local closeBtn = dailyWindow:getChildById('closeButton')
  if closeBtn then closeBtn.onClick = toggle end

  dailyButton = modules.client_topmenu.addRightGameButton('dailyRewardButton', tr('Daily Reward'),
    '/images/topbuttons/chest', toggle)
end

function destroy()
  if dailyWindow then
    dailyWindow:destroy()
    dailyWindow = nil
  end

  if dailyButton then
    dailyButton:destroy()
    dailyButton = nil
  end
end

function toggle()
  if not dailyWindow then return end
  if dailyWindow:isVisible() then
    dailyWindow:hide()
  else
    local protocol = g_game.getProtocolGame()
    if protocol then
      protocol:sendExtendedOpcode(dailyOpcode, "open")
    end
    dailyWindow:show()
    dailyWindow:raise()
    dailyWindow:focus()
  end
end

function claimDaily()
  local protocol = g_game.getProtocolGame()
  if protocol then
    protocol:sendExtendedOpcode(dailyOpcode, "claim")
  end
end

function claimBonus(streakDay)
  local protocol = g_game.getProtocolGame()
  if protocol then
    protocol:sendExtendedOpcode(dailyOpcode, "claim_bonus|" .. streakDay)
  end
end

function onExtendedOpcode(protocol, opcode, buffer)
  if opcode ~= dailyOpcode then return end

  local data = buffer:explode("|")
  if #data < 11 then return end

  local currentDay = tonumber(data[1])
  local currentMonth = tonumber(data[2])
  local currentYear = tonumber(data[3])
  local daysInMonth = tonumber(data[4])
  local claimedMask = tonumber(data[5]) or 0
  local missedMask = tonumber(data[6]) or 0
  local consecutive = tonumber(data[7]) or 0
  local itemsStr = data[8]
  local bonusStr = data[9]
  local bonusClaimedMask = tonumber(data[10]) or 0
  local bonusAvailableMask = tonumber(data[11]) or 0

  local monthItems = {}
  if itemsStr then
    for _, itemData in ipairs(itemsStr:explode(";")) do
      local split = itemData:explode(",")
      if #split >= 2 then
        table.insert(monthItems, { id = tonumber(split[1]), count = tonumber(split[2]) })
      end
    end
  end

  local bonusItems = {}
  if bonusStr then
    for _, bData in ipairs(bonusStr:explode(";")) do
      local split = bData:explode(":")
      if #split >= 3 then
        local idCount = split[2]:explode(",")
        if #idCount >= 2 then
          table.insert(bonusItems, {
            streak = tonumber(split[1]),
            id = tonumber(idCount[1]),
            count = tonumber(idCount[2]),
            name = split[3]
          })
        end
      end
    end
  end
  table.sort(bonusItems, function(a, b) return a.streak < b.streak end)

  updateUI(currentDay, daysInMonth, consecutive, claimedMask, missedMask, monthItems, bonusItems, bonusClaimedMask, bonusAvailableMask)
end

function updateUI(currentDay, daysInMonth, consecutive, claimedMask, missedMask, monthItems, bonusItems, bonusClaimedMask, bonusAvailableMask)
  if not dailyWindow then return end

  stopPulses()

  local canClaim = not isBitSet(claimedMask, currentDay)

  local claimBtn = dailyWindow:getChildById('claimButton')
  if claimBtn then
    claimBtn:setEnabled(canClaim)
    claimBtn:setCursor(canClaim and 'pointer' or 'default')
  end

  local closeBtn = dailyWindow:getChildById('closeButton')
  if closeBtn then
    closeBtn:setCursor('pointer')
  end

  -- Painel de Dias (Calendário Mensal)
  local daysPanel = dailyWindow:getChildById('daysPanel')
  if daysPanel then
    daysPanel:destroyChildren()
    local safeDays = math.min(daysInMonth, 31)

    for i = 1, safeDays do
      local widget = g_ui.createWidget('DailyRewardDay', daysPanel)
      if widget then
        widget:getChildById('dayLabel'):setText(tr('Day %d', i))

        local itemWidget = widget:getChildById('item')
        local itemData = monthItems[i]
        if itemData and itemWidget then
          itemWidget:setItemId(itemData.id)
          itemWidget:setItemCount(itemData.count)
          local name
          pcall(function()
            local t = g_things.getItemType(itemData.id)
            if t then
              if t.getName then
                name = t:getName()
              elseif t.name then
                name = t.name
              end
            end
            if not name then
              name = getItemNameById(itemData.id)
            end
          end)
          if name then
            itemWidget:setTooltip(name)
          end
        end

        local statusLabel = widget:getChildById('statusLabel')
        local checkIcon = widget:getChildById('checkIcon')
        local lostIcon = widget:getChildById('lostIcon')

        if checkIcon then checkIcon:setVisible(false) end
        if lostIcon then lostIcon:setVisible(false) end
        widget:setCursor('default')
        widget:setOpacity(1.0)

        if isBitSet(claimedMask, i) then
          -- RESGATADO: verde + check
          widget:setBackgroundColor('#004400cc')
          widget:setOpacity(0.85)
          if checkIcon then checkIcon:setVisible(true) end
          if statusLabel then statusLabel:setText('') end
        elseif isBitSet(missedMask, i) then
          -- PERDIDO: vermelho + X
          widget:setBackgroundColor('#440000cc')
          widget:setOpacity(0.85)
          if lostIcon then lostIcon:setVisible(true) end
          if statusLabel then statusLabel:setText('') end
        elseif i == currentDay then
          -- HOJE (não resgatado)
          if statusLabel then
            statusLabel:setText(tr('Available'))
            statusLabel:setColor('#ffffff')
          end
          widget:setBorderColor('#ffffff')
          if canClaim then
            startPulse(widget)
            widget:setCursor('pointer')
          end
        else
          -- FUTURO
          if statusLabel then
            statusLabel:setText(tr('Upcoming'))
            statusLabel:setColor('#888888')
          end
          widget:setOpacity(0.35)
        end
      end
    end
  end

  -- Painel de Bônus (Streak)
  local bonusPanel = dailyWindow:getChildById('bonusPanel')
  if bonusPanel then
    bonusPanel:destroyChildren()

    for i, b in ipairs(bonusItems) do
      local widget = g_ui.createWidget('DailyRewardBonusDay', bonusPanel)
      if widget then
        local dayLabel = widget:getChildById('dayLabel')
        if dayLabel then dayLabel:setText(tr('%d Days Streak', b.streak)) end

        local itemWidget = widget:getChildById('item')
        if itemWidget then
          itemWidget:setItemId(b.id)
          itemWidget:setItemCount(b.count)
          if b.name then
            itemWidget:setTooltip(b.name)
          end
        end

        local checkIcon = widget:getChildById('checkIcon')
        local lostIcon = widget:getChildById('lostIcon')
        if checkIcon then checkIcon:setVisible(false) end
        if lostIcon then lostIcon:setVisible(false) end

        local statusLabel = widget:getChildById('statusLabel')
        widget:setCursor('default')
        widget:setOpacity(1.0)

        if isBitSet(bonusClaimedMask, i) then
          -- RESGATADO: verde + check
          widget:setBackgroundColor('#004400cc')
          widget:setOpacity(0.85)
          if checkIcon then checkIcon:setVisible(true) end
          if statusLabel then statusLabel:setText(tr('Claimed')) end
        elseif isBitSet(bonusAvailableMask, i) then
          -- DISPONÍVEL
          widget:setBackgroundColor('#003300cc')
          widget:setBorderColor('#00ff00')
          widget:setCursor('pointer')
          widget.onClick = function()
            claimBonus(b.streak)
          end
          if statusLabel then statusLabel:setText(tr('Click to claim!')) end
        else
          -- TRAVADO
          widget:setOpacity(0.4)
          if lostIcon then lostIcon:setVisible(true) end
          if statusLabel then statusLabel:setText(tr('Locked (%d/%d)', consecutive, b.streak)) end
        end
      end
    end
  end

  local progressLabel = dailyWindow:getChildById('consecutiveLabel')
  if progressLabel then progressLabel:setText(tr('Consecutive Days: %d', consecutive)) end
end