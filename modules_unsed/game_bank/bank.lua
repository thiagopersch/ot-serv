-- widgets
local bankWindow
local topButton
local panMain
local uiIcon
local lblBalance
local lblMessage

-- variables
local opcode = 164
local menuMargin = 35
local iconClip = 0
local Actions = {
  balance = 1,
  message = 2
}

-- private functions
local function addMenuButton(name, panel)
  local button = g_ui.createWidget('MenuButton', panMain)

  button:setId(name)
  button:setText(name)
  button:setMarginLeft(menuMargin)
  button:setIconClip(iconClip .. ' 354 50 50')

  local styles = {
    ['$hover']   = {
      ['icon-clip'] = iconClip .. ' 404 50 50'
    },
    ['$!hover']  = {
      ['icon-clip'] = recttostring(button:getIconClip())
    },
    ['$pressed'] = {
      ['icon-clip'] = recttostring(button:getIconClip())
    }
  }

  button:mergeStyle(styles)

  iconClip = iconClip + 50
  menuMargin = menuMargin + 35
  lblInfoMessage = panel:recursiveGetChildById('lblInfoMessage')

  button.onClick = function()
    uiIcon:show()
    uiIcon:setIconClip(button:getIconClip())
    panMain:addChild(panel)
    panel:fill('parent')
    panel:getChildById('btnReturn').onClick = function()
      local selectedWidget = panMain:getLastChild()
      if selectedWidget then
        uiIcon:hide()
        lblInfoMessage:hide()
        panMain:removeChild(selectedWidget)
      end
    end
  end

  return button
end

local function formatMoney(value)
  -- TODO: make monetary formatting script
  return value
end

-- public functions
function init()
  connect(g_game, { onGameEnd = onGameEnd })

  ProtocolGame.registerExtendedOpcode(opcode, function(protocol, opcode, buffer)
    local status, result = pcall(function() return loadstring("return" .. buffer)() end)

    if status then
      return print('[game_bank/bank.lua]: ProtocolGame.registerExtendedOpcode: ' .. tostring(result))
    end


    if not status then
      return print('[game_bank/bank.lua]:[ERROR] -> ProtocolGame.registerExtendedOpcode: ' .. tostring(result))
    end

    local action = result.action
    local data = result.data

    if action == Action.balance then
      moneyBalance(data.money, data.balance)
    elseif action == Action.message then
      infoMessage(data.message)
    end
  end)

  topButton = modules.client_topmenu.addRightGameButton('Bank', tr('Bank'), 'images/bank', toggle)
  bankWindow = g_ui.displayUI('bank')

  uiIcon = bankWindow:getChildById('uiIcon')
  panMain = bankWindow:getChildById('panMain')
  lblBalance = bankWindow:getChildById('lblBalance')

  addMenuButton("Depositar", g_ui.createWidget('Deposit'))
  addMenuButton("Sacar", g_ui.createWidget('Withdraw'))
  addMenuButton("Transferir", g_ui.createWidget('Transfer'))
  addMenuButton("Extrato", g_ui.createWidget('Extract'))
end

function terminate()
  disconnect(g_game, { onGameEnd = onGameEnd })
  ProtocolGame.unregisterExtendedOpcode(opcode)
  bankWindow:destroy()
  topButton:destroy()
end

function onGameEnd()
  bankWindow:hide()
end

function toggle()
  if bankWindow:isVisible() then
    bankWindow:hide()
  else
    bankWindow:show()
    bankWindow:raise()
    bankWindow:focus()
  end
end

function moneyBalance(money, balance)
  lblBalance:setText(formatMoney(balance))
end

function infoMessage(message)
  lblInfoMessage:show()
  lblInfoMessage:setText(message)
end
