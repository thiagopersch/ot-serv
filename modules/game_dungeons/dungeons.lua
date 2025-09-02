local extendedOpcode = 101
local mainWindow = nil
local topButton = nil
local confirmWindow = nil
local dungeons = {}

local function sendStartRequest(id)
	local pg = g_game.getProtocolGame()
	if (pg) then
		pg:sendExtendedOpcode(extendedOpcode, "start|" .. id)
	end
end

local function destroyConfirmWindow()
	if (confirmWindow) then
		confirmWindow:destroy()
		confirmWindow = nil
	end
end

local function showConfirmWindow(id, message)
	destroyConfirmWindow()

	confirmWindow = g_ui.createWidget("MainWindow", rootWidget)
	confirmWindow:setText(tr("Quest Information"))

	local messageLabel = g_ui.createWidget("Label", confirmWindow)
	messageLabel:setText(message)
	messageLabel:setTextAutoResize(true)
	messageLabel:setTextWrap(true)
	messageLabel:addAnchor(AnchorTop, "parent", AnchorTop)
	messageLabel:addAnchor(AnchorHorizontalCenter, "parent", AnchorHorizontalCenter)

	local buttonsWidth = 0

	local yesButton = g_ui.createWidget("Button", confirmWindow)
	yesButton:setText(tr("Yes"))
	yesButton:setWidth(64)
	yesButton:addAnchor(AnchorBottom, "parent", AnchorBottom)
	yesButton:addAnchor(AnchorRight, "parent", AnchorHorizontalCenter)
	yesButton:setMarginRight(4)
	yesButton.onClick = function() sendStartRequest(id) destroyConfirmWindow() end
	buttonsWidth = buttonsWidth + yesButton:getWidth() + yesButton:getMarginRight()

	local noButton = g_ui.createWidget("Button", confirmWindow)
	noButton:setText(tr("No"))
	noButton:setWidth(64)
	noButton:addAnchor(AnchorBottom, "parent", AnchorBottom)
	noButton:addAnchor(AnchorLeft, "parent", AnchorHorizontalCenter)
	noButton:setMarginLeft(4)
	noButton.onClick = destroyConfirmWindow
	buttonsWidth = buttonsWidth + noButton:getWidth() + noButton:getMarginLeft()

	confirmWindow:setWidth(math.max(messageLabel:getWidth(), confirmWindow:getTextSize().width, buttonsWidth) + confirmWindow:getPaddingLeft() + confirmWindow:getPaddingRight())
	confirmWindow:setHeight(messageLabel:getHeight() + confirmWindow:getPaddingTop() + confirmWindow:getPaddingBottom() + 32)
end

local function showErrorWindow(message)
	destroyConfirmWindow()

	confirmWindow = g_ui.createWidget("MainWindow", rootWidget)
	confirmWindow:setText(tr("Quest Information"))

	local messageLabel = g_ui.createWidget("Label", confirmWindow)
	messageLabel:setText(message)
	messageLabel:setTextAutoResize(true)
	messageLabel:setTextWrap(true)
	messageLabel:addAnchor(AnchorTop, "parent", AnchorTop)
	messageLabel:addAnchor(AnchorHorizontalCenter, "parent", AnchorHorizontalCenter)

	local okButton = g_ui.createWidget("Button", confirmWindow)
	okButton:setText(tr("Ok"))
	okButton:setWidth(64)
	okButton:addAnchor(AnchorBottom, "parent", AnchorBottom)
	okButton:addAnchor(AnchorHorizontalCenter, "parent", AnchorHorizontalCenter)
	okButton.onClick = destroyConfirmWindow

	confirmWindow:setWidth(math.max(messageLabel:getWidth(), confirmWindow:getTextSize().width) + confirmWindow:getPaddingLeft() + confirmWindow:getPaddingRight())
	confirmWindow:setHeight(messageLabel:getHeight() + confirmWindow:getPaddingTop() + confirmWindow:getPaddingBottom() + 32)
end

local function createDungeon(dg)
	local widget = g_ui.createWidget("DungeonPanel", mainWindow:getChildById("mainPanel"))
	widget.dg = dg
	widget:setImageSource("assets/" .. dg.imageId)
	widget:getChildById("label1"):setText(dg.rewardDesc)
	widget:getChildById("label2"):setText("Level mínimo: " .. dg.minLevel)
	widget:getChildById("label3"):setText("Players max(party): " .. dg.maxPlayers)
	widget:getChildById("startButton").onClick = function ()
		showConfirmWindow(dg.id, "Você deseja iniciar a dungeon " .. dg.name .. "?")
	end
end

local function updateDungeons()
	local mainPanel = mainWindow:getChildById("mainPanel")
	mainPanel:destroyChildren()

	for i = 1, #dungeons do
		createDungeon(dungeons[i])
	end
end

local function onRecvExtendedOpcode(pg, opcode, buffer)
	local data = buffer:split("|")
	local action = data[1]
	if (action == "data") then
		dungeons = {}

		for i = 2, #data do
			local it = data[i]
			local dg = {}
			dg.id = tonumber(it:match("^id:(%d+)"))
			dg.name = it:match("name:([^&]+)")
			dg.minLevel = tonumber(it:match("minlv:(%d+)"))
			dg.maxPlayers = tonumber(it:match("maxpl:(%d+)"))
			dg.imageId = it:match("imageid:([^&]+)")
			dg.rewardDesc = it:match("desc:([^&]+)")
			dungeons[i - 1] = dg
		end

		updateDungeons()
		open()
	elseif (action == "close") then
		close()
	elseif (action == "error") then
		local message = table.concat(data, "|", 2)
		showErrorWindow(message)
	end
end

local function requestOpen()
	local pg = g_game.getProtocolGame()
	if (pg) then
		pg:sendExtendedOpcode(extendedOpcode, "data")
	end
end

local function toggle()
	if (not mainWindow) then
		return
	end

	if (mainWindow:isVisible()) then
		close()
	else
		requestOpen()
	end
end

----------------------------------------------------------------------------------
----------------------------------------------------------------------------------
----------------------------------------------------------------------------------

function open()
	if (mainWindow) then
		mainWindow:centerIn("parent")
		mainWindow:setVisible(true)
	end
end

function close()
	if (mainWindow) then
		destroyConfirmWindow()
		mainWindow:setVisible(false)
	end
end

----------------------------------------------------------------------------------
----------------------------------------------------------------------------------
----------------------------------------------------------------------------------

function init()
	mainWindow = g_ui.displayUI("dungeons")
	mainWindow:setVisible(false)

	topButton = modules.client_topmenu.addRightGameToggleButton("dungeons", tr("Dungeons"), "assets/top_button.png", toggle)

	ProtocolGame.registerExtendedOpcode(extendedOpcode, onRecvExtendedOpcode)
	connect(g_game, { onGameEnd = close })
end

function terminate()
	topButton:destroy()
	topButton = nil

	mainWindow:destroy()
	mainWindow = nil

	destroyConfirmWindow()

	ProtocolGame.unregisterExtendedOpcode(extendedOpcode)
	disconnect(g_game, { onGameEnd = close })
end
