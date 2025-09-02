opcode = 8

---@type UIWidget | nil
MainWindow = nil
ToggleButton = nil
ConfirmWindow = nil

InventoryBalance = 0
BankBalance = 0

local function formatMonetaryNumber(number)
	local neg, num, frac = string.match(number, "([-]?)(%d+)([.]?%d*)")
	num = num:reverse():gsub("(%d%d%d)", "%1,")
	return neg .. num:reverse():gsub("^,", "") .. frac
end

local function getMoneyDescription(value)
	value = math.max(0, value)
	if (value == 0) then
		-- fix a weird bug with it printing -0
		value = 0
	end
	return "$" .. formatMonetaryNumber(value)
end

local function onBankBalanceChange(oldValue, newValue)
	local moneyDesc = getMoneyDescription(newValue)
	local bankBalanceText = MainWindow:getChildById("bankBalanceText")
	bankBalanceText:setText(moneyDesc)

	if (ConfirmWindow) then
		local confirmWindowTitle = ConfirmWindow:getChildById("windowTitle")
		if (confirmWindowTitle:getText() == "Withdraw") then
			ConfirmWindow:getChildById("balanceLabel"):setColoredText({ (tr("Your balance") .. ": "), "#d0d0d0", moneyDesc,
				"#00df00" })
		end
	end
end

local function onInventoryBalanceChange(oldValue, newValue)
	local moneyDesc = getMoneyDescription(newValue)
	local inventoryBalanceText = MainWindow:getChildById("inventoryBalanceText")
	inventoryBalanceText:setText(moneyDesc)

	if (ConfirmWindow) then
		local confirmWindowTitle = ConfirmWindow:getChildById("windowTitle")
		if (confirmWindowTitle:getText() == "Deposit") then
			ConfirmWindow:getChildById("balanceLabel"):setColoredText({ (tr("Your balance") .. ": "), "#d0d0d0", moneyDesc,
				"#00df00" })
		end
	end
end

---@param pg ProtocolGame
---@param opcode number
---@param buffer string
local function onRecvOpcode(pg, opcode, buffer)
	local split = buffer:explode("&")
	local action = split[1]
	-- balance
	if (action == "1") then
		local oldInventoryBalance = InventoryBalance
		local oldBankBalance = BankBalance
		InventoryBalance = tonumber(split[2]) or 0
		BankBalance = tonumber(split[3]) or 0

		onInventoryBalanceChange(oldInventoryBalance, InventoryBalance)
		onBankBalanceChange(oldBankBalance, BankBalance)

		if MainWindow then
			MainWindow:getChildById("errorMessagePanel"):setText("")
		end
		-- error message
	elseif (action == "10") then
		local text = tostring(split[2])

		if MainWindow then
			local errorMessagePanel = MainWindow:getChildById("errorMessagePanel")
			errorMessagePanel:setText(text)

			removeEvent(errorMessagePanel.event)
			errorMessagePanel.event = scheduleEvent(function() errorMessagePanel:setText("") end, 3000)
		end
	end
end

local function getOrCreateConfirmWindow(title, balance)
	if (ConfirmWindow) then
		if (ConfirmWindow:getChildById("windowTitle"):getText() == title) then
			return ConfirmWindow
		end
		ConfirmWindow:destroy()
	end

	ConfirmWindow = g_ui.displayUI("confirm_window")
	ConfirmWindow:getChildById("windowTitle"):setText(title)
	ConfirmWindow:getChildById("balanceLabel"):setColoredText({ (tr("Your balance") .. ": "), "#d0d0d0",
		getMoneyDescription(balance), "#00df00" })

	local function onTextChange(this, text, oldText)
		ConfirmWindow:getChildById("inputValueLabel"):setText(getMoneyDescription(tonumber(text) or 0))
	end

	local valueInput = ConfirmWindow:getChildById("valueInput")
	valueInput.onTextChange = onTextChange
	valueInput:setText("0")
	valueInput:setText("")
	return ConfirmWindow
end

local function requestBalance()
	g_game.getProtocolGame():sendExtendedOpcode(opcode, "1")
end

-------------------------------------------------------------------
-------------------------------------------------------------------
-------------------------------------------------------------------

function depositAll()
	g_game.getProtocolGame():sendExtendedOpcode(opcode, "2")
end

function withdrawAll()
	g_game.getProtocolGame():sendExtendedOpcode(opcode, "3")
end

function deposit()
	local window = getOrCreateConfirmWindow("Deposit", InventoryBalance)
	window:show()
	window:focus()
end

function withdraw()
	local window = getOrCreateConfirmWindow("Withdraw", BankBalance)
	window:show()
	window:focus()
end

function confirm()
	if (ConfirmWindow) then
		local value = tonumber(ConfirmWindow:getChildById("valueInput"):getText())
		if (not value or value <= 0) then
			return
		end

		local confirmType = ConfirmWindow:getChildById("windowTitle"):getText()
		if (confirmType == "Deposit") then
			g_game.getProtocolGame():sendExtendedOpcode(opcode, table.concat({ 4, value }, "&"))
		elseif (confirmType == "Withdraw") then
			g_game.getProtocolGame():sendExtendedOpcode(opcode, table.concat({ 5, value }, "&"))
		end

		closeConfirm()
	end
end

function toggle()
	if (MainWindow) then
		if (MainWindow:isVisible()) then
			close()
		else
			open()
		end
	end
end

function open()
	if (MainWindow and not MainWindow:isVisible()) then
		requestBalance()
		MainWindow:setVisible(true)
		MainWindow:focus()
	end
end

function close()
	closeConfirm()
	if (MainWindow) then
		MainWindow:setVisible(false)
	end
end

function closeConfirm()
	if (ConfirmWindow) then
		ConfirmWindow:destroy()
		ConfirmWindow = nil
	end
end

-------------------------------------------------------------------
-------------------------------------------------------------------
-------------------------------------------------------------------

function init()
	if not g_ui or not g_ui.displayUI then
		error("UI system (g_ui) is not available.")
	end
	MainWindow = g_ui.displayUI("bank")
	if not MainWindow then
		error("Falha ao carregar bank.otui. Verifique o diretório.")
	end
	MainWindow:hide()

	ToggleButton = modules.client_topmenu.addRightGameToggleButton("Bank", "Bank", "icon.png", toggle)
end

function onGameStart()
	if g_game.isOnline() then
		ProtocolGame.registerExtendedOpcode(opcode, onRecvOpcode)
		connect(g_game, { onGameEnd = close })
	end
end

function terminate()
	closeConfirm()

	if MainWindow then
		MainWindow:destroy()
		MainWindow = nil
	end
	if ToggleButton then
		ToggleButton:destroy()
		ToggleButton = nil
	end
	if g_game.isOnline() then
		ProtocolGame.unregisterExtendedOpcode(opcode)
		disconnect(g_game, { onGameEnd = close })
	end
end
