function toColor(c, msgtype)
  if type(c) == 'string' then
    if c:find('#') then
      return c -- already hex string
    else
      local num = tonumber(c)
      if num then
        -- Map numeric IDs to hex colors
        if num == 0 or num == 255 then return '#000000'
        elseif num == 5 then return '#5ff7f7'
        elseif num == 18 then return '#00EB00'
        elseif num == 35 then return '#238a8a'
        elseif num == 66 then return '#66ff66'
        elseif num == 78 or num == 120 then return '#8b4513'
        elseif num == 89 then return '#9f9dfd'
        elseif num == 112 or num == 154 then return '#800080'
        elseif num == 129 then return '#808080'
        elseif num == 144 then return '#8b0000'
        elseif num == 152 then return '#ff1493'
        elseif num == 156 then return '#ff8c00'
        elseif num == 180 then return '#f55e5e'
        elseif num == 190 then return '#ff69b4'
        elseif num == 192 then return '#f36500'
        elseif num == 205 then return '#daa520'
        elseif num == 210 then return '#ffff00'
        elseif num == 215 then return '#ffffff'
        end
      end
    end
  end
  return msgtype.color -- fallback to default color (should be hex string)
end

MessageSettings = {
  none          = {},
  consoleRed    = { color = '#f55e5e', consoleTab = 'Default' },
  consoleOrange = { color = '#f36500', consoleTab = 'Default' },
  consoleBlue   = { color = '#9f9dfd', consoleTab = 'Default' },
  centerRed     = { color = '#f55e5e', consoleTab = 'Server Log', screenTarget = 'lowCenterLabel' },
  centerGreen   = { color = '#00EB00', consoleTab = 'Server Log', screenTarget = 'highCenterLabel', consoleOption = 'showInfoMessagesInConsole' },
  centerWhite   = { color = '#ffffff', consoleTab = 'Server Log', screenTarget = 'middleCenterLabel', consoleOption = 'showEventMessagesInConsole' },
  bottomWhite   = { color = '#ffffff', consoleTab = 'Server Log', screenTarget = 'statusLabel', consoleOption = 'showEventMessagesInConsole' },
  status        = { color = '#ffffff', consoleTab = 'Server Log', screenTarget = 'statusLabel', consoleOption = 'showStatusMessagesInConsole' },
  statusSmall   = { color = '#ffffff', screenTarget = 'statusLabel' },
  private       = { color = '#5ff7f7', screenTarget = 'privateLabel' },
  centerWhiteScreen = { color = '#ffffff', screenTarget = 'middleCenterLabel' } -- so tela, sem Server Log
}

MessageTypes = {
  [MessageModes.MonsterSay] = MessageSettings.consoleOrange,
  [MessageModes.MonsterYell] = MessageSettings.consoleOrange,
  [MessageModes.BarkLow] = MessageSettings.consoleOrange,
  [MessageModes.BarkLoud] = MessageSettings.consoleOrange,
  [MessageModes.Failure] = MessageSettings.statusSmall,
  [MessageModes.Login] = MessageSettings.bottomWhite,
  [MessageModes.Game] = MessageSettings.centerWhite,
  [MessageModes.Status] = MessageSettings.status,
  [MessageModes.Warning] = MessageSettings.centerRed,
  [MessageModes.Look] = MessageSettings.centerGreen,
  [MessageModes.Loot] = MessageSettings.centerGreen,
  [MessageModes.Red] = MessageSettings.consoleRed,
  [MessageModes.Blue] = MessageSettings.consoleBlue,
  [MessageModes.PrivateFrom] = MessageSettings.consoleBlue,

  [MessageModes.GamemasterBroadcast] = MessageSettings.consoleRed,

  [MessageModes.DamageDealed] = MessageSettings.status,
  [MessageModes.DamageReceived] = MessageSettings.status,
  [MessageModes.Heal] = MessageSettings.status,
  [MessageModes.Exp] = MessageSettings.status,

  [MessageModes.DamageOthers] = MessageSettings.none,
  [MessageModes.HealOthers] = MessageSettings.none,
  [MessageModes.ExpOthers] = MessageSettings.none,

  [MessageModes.TradeNpc] = MessageSettings.centerWhite,
  [MessageModes.Guild] = MessageSettings.centerWhite,
  [MessageModes.Party] = MessageSettings.centerGreen,
  [MessageModes.PartyManagement] = MessageSettings.centerWhite,
  [MessageModes.TutorialHint] = MessageSettings.centerWhite,
  [MessageModes.BeyondLast] = MessageSettings.centerWhite,
  [MessageModes.Report] = MessageSettings.consoleRed,
  [MessageModes.HotkeyUse] = MessageSettings.centerGreen,

  [253] = MessageSettings.centerWhiteScreen,
  [254] = MessageSettings.private
}

messagesPanel = nil

function init()
  for messageMode, _ in pairs(MessageTypes) do
    registerMessageMode(messageMode, displayMessage)
  end

  connect(g_game, 'onGameEnd', clearMessages)
  messagesPanel = g_ui.loadUI('textmessage', modules.game_interface.getRootPanel())
end

function terminate()
  for messageMode, _ in pairs(MessageTypes) do
    unregisterMessageMode(messageMode, displayMessage)
  end

  disconnect(g_game, 'onGameEnd', clearMessages)
  clearMessages()
  messagesPanel:destroy()
end

function calculateVisibleTime(text)
  return math.max(#text * 50, 3000)
end

function displayMessage(mode, text)
  if not g_game.isOnline() then return end

  local msgtype = MessageTypes[mode]
  if not msgtype then
    return
  end

  if msgtype == MessageSettings.none then return end

  if mode == MessageModes.Warning then
    local position = 'top'
    local color = msgtype.color

    if (text:find('|')) then
      local parts = text:explode('|')
      if #parts >= 3 then
        position = parts[1]
        color = parts[2]
        text = parts[3]
      elseif #parts == 2 then
        -- 2 parts: "color|text" (default position = top)
        color = parts[1]
        text = parts[2]
      end
    end

    color = toColor(color, msgtype)

    local label
    if position == 'center' then
      label = messagesPanel:recursiveGetChildById('broadcastCenterLabel')
    elseif position == 'bottom' then
      label = messagesPanel:recursiveGetChildById('broadcastBottomLabel')
    else
      label = messagesPanel:recursiveGetChildById('customMessage')
    end

    label:setText(text)
    label:setColor(color)
    label:setBorderColor(color)
    local maxWidth = g_window.getSize().width * 0.8
    local textWidth = label:getTextSize().width + 110
    label:setWidth(math.min(textWidth, maxWidth))
    label:show()

    addEvent(function() g_effects.fadeIn(label, 250) end)
    removeEvent(label.hideEvent)
    label.hideEvent = scheduleEvent(function()
      addEvent(function() g_effects.fadeOut(label, 250) end)
      scheduleEvent(function() label:hide() end, 250)
    end, calculateVisibleTime(text))
    return
  end

  if msgtype.consoleTab ~= nil and (msgtype.consoleOption == nil or modules.client_options.getOption(msgtype.consoleOption)) then
    modules.game_console.addText(text, msgtype, tr(msgtype.consoleTab))
    --TODO move to game_console
  end

  if msgtype.screenTarget then
    local label = messagesPanel:recursiveGetChildById(msgtype.screenTarget)
    label:setText(text)
    label:setColor(msgtype.color)
    label:setVisible(true)
    removeEvent(label.hideEvent)
    label.hideEvent = scheduleEvent(function() label:setVisible(false) end, calculateVisibleTime(text))
  end
end

-- Mesmo visual do displayGameMessage, mas sem registrar no Server Log
function displayScreenMessage(text)
  displayMessage(253, text)
end

function displayPrivateMessage(text)
  displayMessage(254, text)
end

function displayStatusMessage(text)
  displayMessage(MessageModes.Status, text)
end

function displayFailureMessage(text)
  displayMessage(MessageModes.Failure, text)
end

function displayGameMessage(text)
  displayMessage(MessageModes.Game, text)
end

function displayBroadcastMessage(text)
  displayMessage(MessageModes.Warning, text)
end

function clearMessages()
  for _i, child in pairs(messagesPanel:recursiveGetChildren()) do
    if child:getId():match('Label') then
      child:hide()
      removeEvent(child.hideEvent)
    end
  end
end

function LocalPlayer:onAutoWalkFail(player)
  modules.game_textmessage.displayFailureMessage(tr('There is no way.'))
end
