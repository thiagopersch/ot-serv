local dailyButton
local dailyOpcode = 155
local pulseEvents = {}

local function startPulse(widget)
  if not widget then return end
  local colors = { "#008800", "#111111" }
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

  -- Vinculando eventos de clique
  local claimBtn = dailyWindow:getChildById('claimButton')
  if claimBtn then claimBtn.onClick = claim end

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

function claim()
  local protocol = g_game.getProtocolGame()
  if protocol then
    protocol:sendExtendedOpcode(dailyOpcode, "claim")
  end
end

function onExtendedOpcode(protocol, opcode, buffer)
  if opcode ~= dailyOpcode then return end

  local data = buffer:explode("|")
  if #data < 8 then return end

  local currentDay = tonumber(data[1])
  local currentMonth = tonumber(data[2])
  local daysInMonth = tonumber(data[3])
  local consecutive = tonumber(data[4])
  local claimedStr = data[5]
  local lastClaim = tonumber(data[6])
  local itemsStr = data[7]
  local bonusStr = data[8]

  local claimedMask = tonumber(data[5]) or 0
  local claimedDays = {}
  for i = 1, 31 do
    if math.floor(claimedMask / 2 ^ (i - 1)) % 2 == 1 then
      claimedDays[i] = true
    end
  end

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
      local split = bData:explode(",")
      if #split >= 4 then
        table.insert(bonusItems, {
          streak = tonumber(split[1]),
          id = tonumber(split[2]),
          count = tonumber(split[3]),
          name = split[4]
        })
      end
    end
  end
  table.sort(bonusItems, function(a, b) return a.streak < b.streak end)

  updateUI(currentDay, daysInMonth, consecutive, claimedDays, monthItems, bonusItems, lastClaim)
end

function updateUI(currentDay, daysInMonth, consecutive, claimedDays, monthItems, bonusItems, lastClaim)
  if not dailyWindow then return end

  stopPulses()

  -- Habilita claim apenas se hoje não foi coletado
  local canClaim = true
  if lastClaim and lastClaim > 0 then
    local dateLast = os.date("*t", lastClaim)
    local dateNow = os.date("*t")
    if dateLast.day == dateNow.day and dateLast.month == dateNow.month and dateLast.year == dateNow.year then
      canClaim = false
    end
  end

  local claimBtn = dailyWindow:getChildById('claimButton')
  if claimBtn then
    claimBtn:setEnabled(canClaim)
    claimBtn:setCursor(canClaim and 'pointer' or 'default')
  end

  local closeBtn = dailyWindow:getChildById('closeButton')
  if closeBtn then
    closeBtn:setCursor('pointer')
  end
  local daysPanel = dailyWindow:getChildById('daysPanel')
  if daysPanel then
    -- Limpa o painel e garante limite de segurança de 31 dias
    daysPanel:destroyChildren()
    local safeDays = math.min(daysInMonth, 31)
    
    for i = 1, safeDays do
      local widget = g_ui.createWidget('DailyRewardDay', daysPanel)
      if widget then
        widget:getChildById('dayLabel'):setText(tr('Day %d', i))

        local itemWidget = widget:getChildById('item')
        local itemData = monthItems[i]
        if itemData and itemWidget then
          -- IMPORTANTE: O ID enviado aqui já é o clientId (ex: 3043)
          itemWidget:setItemId(itemData.id)
          itemWidget:setItemCount(itemData.count)
        end

        local statusLabel = widget:getChildById('statusLabel')
        local checkIcon = widget:getChildById('checkIcon')
        local lostIcon = widget:getChildById('lostIcon')

        if statusLabel then
          if claimedDays[i] then
            widget:setOpacity(0.8)
            widget:setBackgroundColor('#222222cc')
            widget:setBorderColor('#444444')
            widget.isClaimed = true
            if checkIcon then checkIcon:show() end
            if statusLabel then statusLabel:hide() end
            widget:setCursor('default')
          elseif i < currentDay then
            widget:setOpacity(0.8)
            widget:setBackgroundColor('#440000cc')
            widget:setBorderColor('#660000')
            widget.isLost = true
            if lostIcon then lostIcon:show() end
            if statusLabel then statusLabel:hide() end
            widget:setCursor('default')
          elseif i == currentDay then
            statusLabel:setText(tr('Available'))
            statusLabel:setColor('#ffffff')
            widget:setOpacity(1.0)
            widget:setBorderColor('#ffffff')
            if canClaim then
              startPulse(widget)
              widget:setCursor('pointer')
            else
              widget:setCursor('default')
            end
          else
            statusLabel:setText(tr('Upcoming'))
            statusLabel:setColor('#888888')
            widget:setOpacity(0.4)
            widget.isUpcoming = true
            widget:setCursor('default')
          end
        end
      end
    end
  end

  -- Painel de Bônus (Streak)
  local bonusPanel = dailyWindow:getChildById('bonusPanel')
  if bonusPanel then
    bonusPanel:destroyChildren()
    for _, b in ipairs(bonusItems) do
      local widget = g_ui.createWidget('DailyRewardBonus', bonusPanel)
      if widget then
        widget:getChildById('titleLabel'):setText(tr('%d Days Streak', b.streak))

        local itemWidget = widget:getChildById('item')
        if itemWidget then
          itemWidget:setItemId(b.id)
          itemWidget:setItemCount(b.count)
          itemWidget:setTooltip(b.name)
        end

        local statusLabel = widget:getChildById('statusLabel')
        if consecutive >= b.streak then
          statusLabel:setText(tr('Unlocked'))
          statusLabel:setColor('#00ff00')
          widget:setOpacity(1.0)
          widget:setBorderColor('#ffff00aa')
        else
          statusLabel:setText(tr('Locked (%d/%d)', consecutive, b.streak))
          statusLabel:setColor('#888888')
          widget:setOpacity(0.5)
        end
      end
    end
  end

  local progressLabel = dailyWindow:getChildById('consecutiveLabel')
  if progressLabel then progressLabel:setText(tr('Monthly Progress: %d days', consecutive)) end
end
