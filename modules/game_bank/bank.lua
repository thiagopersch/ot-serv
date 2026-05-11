local bankWindow
local balanceLabel
local inventoryTotal
local depositBtn
local withdrawBtn
local depositAllBtn
local withdrawAllBtn
local transferBtn
local transferAllBtn
local topButton

local confirmWindow

local EXTENDED_OPCODE = 164
local COOLDOWN_TIME = 3000 -- 3 seconds
local lastActionTime = 0

local function displayFailureMessage(msg)
  modules.game_textmessage.displayFailureMessage(msg)
end

local function formatNumber(value)
  local formatted = tostring(value or 0)
  local k
  while true do
    formatted, k = string.gsub(formatted, "^(-?%d+)(%d%d%d)", "%1,%2")
    if k == 0 then break end
  end
  return formatted
end

local function updateUI(data)
  if not bankWindow then return end

  if data.balance ~= nil then
    balanceLabel:setText('$' .. formatNumber(data.balance))
    if confirmWindow and (confirmWindow.actionType == 'withdraw' or confirmWindow.actionType == 'transfer') then
      confirmWindow:getChildById('balanceLabel'):setText(tr('Your balance: $%s', formatNumber(data.balance)))
    end
  end

  if data.money ~= nil then
    inventoryTotal:setText('$' .. formatNumber(data.money))
    if confirmWindow and confirmWindow.actionType == 'deposit' then
      confirmWindow:getChildById('balanceLabel'):setText(tr('Your balance: $%s', formatNumber(data.money)))
    end
  end
end

local function checkCooldown()
  local now = g_clock.millis()
  if now - lastActionTime < COOLDOWN_TIME then
    local remaining = math.ceil((COOLDOWN_TIME - (now - lastActionTime)) / 1000)
    modules.game_textmessage.displayFailureMessage(tr('Please wait %d seconds.', remaining))
    return false
  end
  lastActionTime = now
  return true
end

local function requestBalance()
  local protocolGame = g_game.getProtocolGame()
  if protocolGame then
    -- requestBalance should not have cooldown
    protocolGame:sendExtendedJSONOpcode(EXTENDED_OPCODE, { action = "get_balance" })
  end
end

local function sendDepositAll()
  if not checkCooldown() then return end
  local protocolGame = g_game.getProtocolGame()
  if protocolGame then
    protocolGame:sendExtendedJSONOpcode(EXTENDED_OPCODE, { action = "deposit_all" })
  end
end

local function sendWithdrawAll()
  if not checkCooldown() then return end
  local protocolGame = g_game.getProtocolGame()
  if protocolGame then
    protocolGame:sendExtendedJSONOpcode(EXTENDED_OPCODE, { action = "withdraw_all" })
  end
end

local function sendDeposit(amount)
  -- Cooldown checked in confirmBtn.onClick
  amount = tonumber(amount)
  if not amount or amount <= 0 then return end
  local protocolGame = g_game.getProtocolGame()
  if protocolGame then
    protocolGame:sendExtendedJSONOpcode(EXTENDED_OPCODE, { action = "deposit", amount = amount })
  end
end

local function sendWithdraw(amount)
  -- Cooldown checked in confirmBtn.onClick
  amount = tonumber(amount)
  if not amount or amount <= 0 then return end
  local protocolGame = g_game.getProtocolGame()
  if protocolGame then
    protocolGame:sendExtendedJSONOpcode(EXTENDED_OPCODE, { action = "withdraw", amount = amount })
  end
end

local function sendTransfer(name, amount)
  -- Cooldown checked in confirmBtn.onClick
  amount = tonumber(amount)
  if not amount or amount <= 0 or not name or name == "" then return end
  local protocolGame = g_game.getProtocolGame()
  if protocolGame then
    protocolGame:sendExtendedJSONOpcode(EXTENDED_OPCODE, { action = "transfer", name = name, amount = amount })
  end
end

local function sendTransferAll(name)
  -- Cooldown checked in confirmBtn.onClick
  if not name or name == "" then return end
  local protocolGame = g_game.getProtocolGame()
  if protocolGame then
    protocolGame:sendExtendedJSONOpcode(EXTENDED_OPCODE, { action = "transfer_all", name = name })
  end
end

local function showConfirm(type, title)
  if confirmWindow then confirmWindow:destroy() end
  confirmWindow = g_ui.displayUI('bank_confirm')
  confirmWindow.actionType = type
  confirmWindow:getChildById('title'):setText(title)

  local valueInput = confirmWindow:recursiveGetChildById('valueInput')
  local nameInput = confirmWindow:recursiveGetChildById('nameInput')
  local previewLabel = confirmWindow:recursiveGetChildById('previewLabel')
  local confirmBtn = confirmWindow:recursiveGetChildById('confirmBtn')
  local nameLabel = confirmWindow:recursiveGetChildById('nameLabel')
  local valueLabel = confirmWindow:recursiveGetChildById('valueLabel')

  if type == 'transfer' or type == 'transfer_all' then
    nameInput:show()
    nameLabel:show()
    if type == 'transfer_all' then
      valueInput:hide()
      valueLabel:hide()
      previewLabel:setText(tr('All bank balance'))
    end
  end

  valueInput.onTextChange = function(widget, text)
    local val = tonumber(text) or 0
    previewLabel:setText('$' .. formatNumber(val))
  end

  confirmBtn.onClick = function()
    local amountText = valueInput:getText()
    local amount = tonumber(amountText) or 0
    local name = nameInput:getText()

    if type ~= 'transfer_all' then
      if amount <= 0 then
        displayFailureMessage(tr('Please enter a valid amount greater than zero.'))
        return
      end
    end

    if not checkCooldown() then return end

    if type == 'transfer' or type == 'transfer_all' then
      if not name or name:len() < 2 then
        displayFailureMessage(tr('Player not found or name is too short.'))
        return
      end
    end

    if type == 'deposit' then
      sendDeposit(amount)
    elseif type == 'withdraw' then
      sendWithdraw(amount)
    elseif type == 'transfer' then
      sendTransfer(name, amount)
    elseif type == 'transfer_all' then
      sendTransferAll(name)
    end
    confirmWindow:destroy()
  end
end

local function onExtendedJSONOpcode(protocol, opcode, data)
  if opcode ~= EXTENDED_OPCODE then return end

  if data.action == "balance_update" then
    updateUI(data)
  elseif data.action == "transaction_result" then
    updateUI(data)
    if data.message then
      local title = data.status == "success" and tr("Success") or tr("Error")
      local infoBox = displayInfoBox(title, data.message)
      infoBox:raise()
      infoBox:focus()
    end
  end
end

local function onInventoryUpdate()
  if bankWindow and bankWindow:isVisible() then
    requestBalance()
  end
end

local function conditionFn(menuPosition, lookThing, useThing, creatureThing)
  if not g_game.isOnline() then return false end
  return creatureThing and creatureThing:isLocalPlayer()
end

function toggle()
  if not g_game.isOnline() then return end

  if bankWindow:isVisible() then
    bankWindow:hide()
    if confirmWindow then confirmWindow:destroy() end
  else
    bankWindow:show()
    bankWindow:raise()
    bankWindow:focus()
    requestBalance()
  end
end

function init()
  connect(g_game, { onGameEnd = onGameEnd })
  connect(LocalPlayer, { onInventoryChange = onInventoryUpdate })

  ProtocolGame.registerExtendedJSONOpcode(EXTENDED_OPCODE, onExtendedJSONOpcode)

  topButton = modules.client_topmenu.addRightGameButton('bankTopButton', tr('Bank System'), '/game_bank/images/bank',
    toggle)
  modules.game_interface.addMenuHook('bank', tr('Bank'), toggle, conditionFn)

  bankWindow = g_ui.displayUI('bank')
  if not bankWindow then
    g_logger.error("[game_bank] Could not load bank.otui")
    return
  end
  bankWindow:hide()

  balanceLabel = bankWindow:recursiveGetChildById('balanceValue')
  inventoryTotal = bankWindow:recursiveGetChildById('inventoryTotalValue')

  depositBtn = bankWindow:recursiveGetChildById('depositBtn')
  withdrawBtn = bankWindow:recursiveGetChildById('withdrawBtn')
  depositAllBtn = bankWindow:recursiveGetChildById('depositAllBtn')
  withdrawAllBtn = bankWindow:recursiveGetChildById('withdrawAllBtn')
  transferBtn = bankWindow:recursiveGetChildById('transferBtn')
  transferAllBtn = bankWindow:recursiveGetChildById('transferAllBtn')

  depositBtn.onClick = function() showConfirm('deposit', tr('Deposit')) end
  withdrawBtn.onClick = function() showConfirm('withdraw', tr('Withdraw')) end
  depositAllBtn.onClick = function() sendDepositAll() end
  withdrawAllBtn.onClick = function() sendWithdrawAll() end
  transferBtn.onClick = function() showConfirm('transfer', tr('Transfer')) end
  transferAllBtn.onClick = function() showConfirm('transfer_all', tr('Transfer All')) end

  if g_game.isOnline() then
    requestBalance()
  end
end

function terminate()
  disconnect(g_game, { onGameEnd = onGameEnd })
  disconnect(LocalPlayer, { onInventoryChange = onInventoryUpdate })

  ProtocolGame.unregisterExtendedJSONOpcode(EXTENDED_OPCODE, onExtendedJSONOpcode)
  modules.game_interface.removeMenuHook('bank')

  if topButton then topButton:destroy() end
  if bankWindow then bankWindow:destroy() end
  if confirmWindow then confirmWindow:destroy() end
end

function onGameEnd()
  if bankWindow then bankWindow:hide() end
  if confirmWindow then confirmWindow:destroy() end
end
