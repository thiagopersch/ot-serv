if not json then
  json = dofile('data/lib/json.lua')
end

local function loadCoinsConfig()
  local file = io.open('data/creaturescripts/scripts/bank_coins.json', 'r')
  if not file then
    print("[Error] Could not load bank_coins.json")
    return {}
  end
  local content = file:read('*a')
  file:close()
  local decoded = json.decode(content)
  return decoded and decoded.coins or {}
end

local BankCoins = loadCoinsConfig()

local Config = {
  OpCode = 164,
  Cooldown = 3 -- seconds
}

local lastAction = {}

function onLogin(cid)
  registerCreatureEvent(cid, "BankOpcode")
  -- Send balance on login to sync client
  addEvent(sendBalance, 1000, cid)
  return true
end

function onExtendedOpcode(cid, opcode, buffer)
  if opcode ~= Config.OpCode then
    return true
  end

  if not getBooleanFromString(getConfigInfo('bankSystem')) then
    return true
  end

  local status, data = pcall(function()
    return json.decode(buffer)
  end)

  if not status or not data then
    return true
  end

  local action = data.action
  if action ~= "get_balance" then
    local now = os.time()
    if lastAction[cid] and now - lastAction[cid] < Config.Cooldown then
      return true
    end

    lastAction[cid] = now
  end

  if action == "get_balance" then
    sendBalance(cid)
  elseif action == "deposit" then
    handleDeposit(cid, data.amount)
  elseif action == "withdraw" then
    handleWithdraw(cid, data.amount)
  elseif action == "deposit_all" then
    handleDepositAll(cid)
  elseif action == "withdraw_all" then
    handleWithdrawAll(cid)
  elseif action == "transfer" then
    handleTransfer(cid, data.name, data.amount)
  elseif action == "transfer_all" then
    handleTransferAll(cid, data.name)
  end

  return true
end

function getCustomMoney(cid)
  local total = 0
  for _, coin in ipairs(BankCoins) do
    total = total + (getPlayerItemCount(cid, coin.id) * coin.worth)
  end
  return total
end

function addCustomMoney(cid, amount)
  for _, coin in ipairs(BankCoins) do
    local count = math.floor(amount / coin.worth)
    if count > 0 then
      local toAdd = count
      while toAdd > 0 do
        local stack = math.min(100, toAdd)
        doPlayerAddItem(cid, coin.id, stack)
        toAdd = toAdd - stack
      end
      amount = amount - (count * coin.worth)
    end
    if amount == 0 then break end
  end
  return true
end

function removeCustomMoney(cid, amount)
  local total = getCustomMoney(cid)
  if total < amount then return false end
  
  for _, coin in ipairs(BankCoins) do
    local count = getPlayerItemCount(cid, coin.id)
    if count > 0 then
      doPlayerRemoveItem(cid, coin.id, count)
    end
  end
  
  local remainder = total - amount
  if remainder > 0 then
    addCustomMoney(cid, remainder)
  end
  return true
end

function getCoinBreakdown(cid)
  local breakdown = {}
  for _, coin in ipairs(BankCoins) do
    breakdown[coin.name] = getPlayerItemCount(cid, coin.id)
  end
  return breakdown
end

function sendBalance(cid)
  if not isPlayer(cid) then return end

  local coins = getCoinBreakdown(cid)
  doPlayerSendExtendedOpcode(cid, Config.OpCode, json.encode({
    action = "balance_update",
    balance = getPlayerBalance(cid),
    money = getCustomMoney(cid),
    goldCoins = coins.gold or 0,
    platinumCoins = coins.platinum or 0,
    crystalCoins = coins.crystal or 0,
    purpleBar = coins.purple_bar or 0,
    greenBar = coins.green_bar or 0,
    greyBar = coins.grey_bar or 0
  }))
end

function handleDeposit(cid, amount)
  if not isPlayer(cid) then return end

  amount = tonumber(amount)
  if not amount or amount <= 0 then
    sendError(cid, "Invalid amount.")
    return
  end

  if getCustomMoney(cid) < amount then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "You do not have enough money.")
    sendBalance(cid)
    return
  end

  if removeCustomMoney(cid, amount) then
    doPlayerSetBalance(cid, getPlayerBalance(cid) + amount)
    local msg = "You have deposited " .. amount .. " gold. Your balance is " .. getPlayerBalance(cid) .. "."
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, msg)
    doPlayerSendExtendedOpcode(cid, Config.OpCode, json.encode({
      action = "transaction_result",
      status = "success",
      message = msg
    }))
    sendBalance(cid)
  else
    sendError(cid, "Could not deposit money.")
  end
end

function handleWithdraw(cid, amount)
  if not isPlayer(cid) then return end

  amount = tonumber(amount)
  if not amount or amount <= 0 then
    sendError(cid, "Invalid amount.")
    return
  end

  if getPlayerBalance(cid) < amount then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "There is not enough gold on your account.")
    sendBalance(cid)
    return
  end

  if addCustomMoney(cid, amount) then
    doPlayerSetBalance(cid, getPlayerBalance(cid) - amount)
    local msg = "You have withdrawn " .. amount .. " gold. Your balance is " .. getPlayerBalance(cid) .. "."
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, msg)
    doPlayerSendExtendedOpcode(cid, Config.OpCode, json.encode({
      action = "transaction_result",
      status = "success",
      message = msg
    }))
    sendBalance(cid)
  else
    sendError(cid, "Could not withdraw money.")
  end
end

function handleDepositAll(cid)
  if not isPlayer(cid) then return end

  local money = getCustomMoney(cid)
  if money <= 0 then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "You do not have any money to deposit.")
    sendBalance(cid)
    return
  end

  if removeCustomMoney(cid, money) then
    doPlayerSetBalance(cid, getPlayerBalance(cid) + money)
    local msg = "You have deposited " .. money .. " gold. Your balance is " .. getPlayerBalance(cid) .. "."
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, msg)
    doPlayerSendExtendedOpcode(cid, Config.OpCode, json.encode({
      action = "transaction_result",
      status = "success",
      message = msg
    }))
    sendBalance(cid)
  else
    sendError(cid, "Could not deposit money.")
  end
end

function handleWithdrawAll(cid)
  if not isPlayer(cid) then return end

  local balance = getPlayerBalance(cid)
  if balance <= 0 then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "There is not enough gold on your account.")
    sendBalance(cid)
    return
  end

  if addCustomMoney(cid, balance) then
    doPlayerSetBalance(cid, 0)
    local msg = "You have withdrawn " .. balance .. " gold. Your balance is 0."
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, msg)
    doPlayerSendExtendedOpcode(cid, Config.OpCode, json.encode({
      action = "transaction_result",
      status = "success",
      message = msg
    }))
    sendBalance(cid)
  else
    sendError(cid, "Could not withdraw money.")
  end
end

function handleTransfer(cid, targetName, amount)
  if not isPlayer(cid) then return end

  if not targetName or targetName == "" then
    sendError(cid, "Target name is missing.")
    return
  end

  amount = tonumber(amount)
  if not amount or amount <= 0 then
    sendError(cid, "Invalid amount.")
    return
  end

  if getPlayerBalance(cid) < amount then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "You do not have enough gold in your account.")
    sendBalance(cid)
    return
  end

  if not playerExists(targetName) then
    sendError(cid, "Player " .. targetName .. " does not exist.")
    return
  end

  if doPlayerTransferMoneyTo(cid, targetName, amount) then
    doPlayerSave(cid, true)
    local msg = "You have transferred " .. amount .. " gold to " .. targetName .. "."
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, msg)
    doPlayerSendExtendedOpcode(cid, Config.OpCode, json.encode({
      action = "transaction_result",
      status = "success",
      message = msg
    }))
    sendBalance(cid)
  else
    sendError(cid, "Could not transfer money.")
  end
end

function handleTransferAll(cid, targetName)
  if not isPlayer(cid) then return end

  if not targetName or targetName == "" then
    sendError(cid, "Target name is missing.")
    return
  end

  local balance = getPlayerBalance(cid)
  if balance <= 0 then
    sendError(cid, "You do not have any gold in your account.")
    return
  end

  if not playerExists(targetName) then
    sendError(cid, "Player " .. targetName .. " does not exist.")
    return
  end

  if doPlayerTransferAllMoneyTo(cid, targetName) then
    doPlayerSave(cid, true)
    local msg = "You have transferred all your gold (" .. balance .. ") to " .. targetName .. "."
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, msg)
    doPlayerSendExtendedOpcode(cid, Config.OpCode, json.encode({
      action = "transaction_result",
      status = "success",
      message = msg
    }))
    sendBalance(cid)
  else
    sendError(cid, "Could not transfer money.")
  end
end

function sendError(cid, message)
  if not isPlayer(cid) then return end

  doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, message)
  doPlayerSendExtendedOpcode(cid, Config.OpCode, json.encode({
    action = "transaction_result",
    status = "error",
    message = message
  }))
  sendBalance(cid)
end
