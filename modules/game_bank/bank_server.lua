-- Banking System Server Module
-- Handles banking operations on the server side

-- Configuration
local Config = {
  -- Opcode for communication with client
  OpCode = 156
}

-- Register login event
local LoginEvent = CreatureEvent("BankLogin")

-- Handle player login
function LoginEvent.onLogin(player)
  -- Register extended opcode event
  player:registerEvent("BankExtended")
  return true
end

-- Register extended opcode event
local ExtendedEvent = CreatureEvent("BankExtended")

-- Handle extended opcode messages from client
function ExtendedEvent.onExtendedOpcode(player, opcode, buffer)
  -- Check if this is our opcode
  if opcode ~= Config.OpCode then
    return true
  end
  
  -- Parse the message
  local status, data = pcall(function()
    return json.decode(buffer)
  end)
  
  -- Handle json parsing errors
  if not status or not data then
    return true
  end
  
  -- Process different actions
  if data.action == "get_balance" then
    sendBalance(player)
  elseif data.action == "deposit" then
    handleDeposit(player, data.amount)
  elseif data.action == "withdraw" then
    handleWithdraw(player, data.amount)
  elseif data.action == "deposit_all" then
    handleDepositAll(player)
  elseif data.action == "withdraw_all" then
    handleWithdrawAll(player)
  end
  
  return true
end

-- Send the player's current bank balance
function sendBalance(player)
  if not player then return end
  
  -- Get the player's bank balance
  local balance = player:getBankBalance()
  
  -- Send balance to client
  player:sendExtendedOpcode(Config.OpCode, json.encode({
    action = "balance_update",
    balance = balance
  }))
end

-- Handle deposit request
function handleDeposit(player, amount)
  if not player or not amount then return end
  
  amount = tonumber(amount)
  if not amount or amount <= 0 then
    -- Invalid amount
    sendTransactionResult(player, false, "Invalid amount")
    return
  end
  
  -- Check if player has enough money
  if player:getMoney() < amount then
    sendTransactionResult(player, false, "You don't have enough money")
    return
  end
  
  -- Remove money from player and add to bank
  if player:removeMoney(amount) then
    player:setBankBalance(player:getBankBalance() + amount)
    
    -- Send success message
    sendTransactionResult(
      player, 
      true, 
      "Deposited " .. amount .. " gold to your bank account",
      player:getBankBalance()
    )
    
    player:sendTextMessage(MESSAGE_STATUS, "You have deposited " .. amount .. " gold.")
  else
    -- Transaction failed
    sendTransactionResult(player, false, "Failed to deposit: couldn't remove money")
  end
end

-- Handle withdraw request
function handleWithdraw(player, amount)
  if not player or not amount then return end
  
  amount = tonumber(amount)
  if not amount or amount <= 0 then
    -- Invalid amount
    sendTransactionResult(player, false, "Invalid amount")
    return
  end
  
  -- Check if player has enough money in bank
  if player:getBankBalance() < amount then
    sendTransactionResult(player, false, "You don't have enough money in your bank account")
    return
  end
  
  -- Remove money from bank and add to player
  player:setBankBalance(player:getBankBalance() - amount)
  player:addMoney(amount)
    
  -- Send success message
  sendTransactionResult(
    player, 
    true, 
    "Withdrew " .. amount .. " gold from your bank account",
    player:getBankBalance()
  )
    
  player:sendTextMessage(MESSAGE_STATUS, "You have withdrawn " .. amount .. " gold.")
end

-- Handle deposit all request
function handleDepositAll(player)
  if not player then return end
  
  -- Get player's current money
  local playerMoney = player:getMoney()
  
  if playerMoney <= 0 then
    sendTransactionResult(player, false, "You don't have any money to deposit")
    return
  end
  
  -- Remove all money from player and add to bank
  if player:removeMoney(playerMoney) then
    player:setBankBalance(player:getBankBalance() + playerMoney)
    
    -- Send success message
    sendTransactionResult(
      player, 
      true, 
      "Deposited all " .. playerMoney .. " gold to your bank account",
      player:getBankBalance()
    )
    
    player:sendTextMessage(MESSAGE_STATUS, "You have deposited " .. playerMoney .. " gold.")
  else
    -- Transaction failed
    sendTransactionResult(player, false, "Failed to deposit all: couldn't remove money")
  end
end

-- Handle withdraw all request
function handleWithdrawAll(player)
  if not player then return end
  
  -- Get player's current bank balance
  local bankBalance = player:getBankBalance()
  
  if bankBalance <= 0 then
    sendTransactionResult(player, false, "You don't have any money in your bank account")
    return
  end
  
  -- Remove all money from bank and add to player
  player:setBankBalance(0)
  player:addMoney(bankBalance)
    
  -- Send success message
  sendTransactionResult(
    player, 
    true, 
    "Withdrew all " .. bankBalance .. " gold from your bank account",
    0
  )
    
  player:sendTextMessage(MESSAGE_STATUS, "You have withdrawn " .. bankBalance .. " gold.")
end

-- Send transaction result to client
function sendTransactionResult(player, success, message, balance)
  if not player then return end
  
  -- If balance wasn't provided, get it
  if not balance then
    balance = player:getBankBalance()
  end
  
  -- Send result to client
  player:sendExtendedOpcode(Config.OpCode, json.encode({
    action = "transaction_result",
    success = success,
    message = message,
    balance = balance
  }))
end

-- Register events
LoginEvent:type("login")
LoginEvent:register()
ExtendedEvent:type("extendedopcode")
ExtendedEvent:register()

-- Log initialization
print(">> Bank System loaded.") 