local npcWindowDialog
local buttonHolder
local lblTitle
local outfitBox
local panelMsg
local scrollPanel
local lblMessage
local LabelText
local itemBox
local buttondialog
local fadeOutEvent = nil
local initialHeight = 200

function init()
	connect(g_game, { onGameEnd = offline })
	connect(LocalPlayer, { onPositionChange = onCreaturePositionChange })

	ProtocolGame.registerExtendedOpcode(80, function(protocol, opcode, buffer)
		print("Received extended opcode data: " .. buffer)
		local data = json.decode(buffer)
		if (data.action == "close") then
			offline()
		elseif (data.action == "create") then
			NpcDialog(data.data)
		end
	end)

	npcWindowDialog = g_ui.displayUI('dialog')

	buttonHolder    = npcWindowDialog:getChildById('buttonHolder')
	lblTitle        = npcWindowDialog:getChildById('lblTitle')
	scrollPanel     = npcWindowDialog:getChildById('scrollPanel')
	panelMsg        = npcWindowDialog:getChildById('panelMsg')
	outfitBox       = npcWindowDialog:getChildById('outfitBox')
	itemBox         = npcWindowDialog:getChildById('itemBox')
	buttondialog    = npcWindowDialog:getChildById('buttondialog')
	lblMessage      = g_ui.createWidget('LabelText', panelMsg)
end

function terminate()
	disconnect(g_game, { onGameEnd = offline })
	disconnect(Creature, { onPositionChange = onCreaturePositionChange })
	ProtocolGame.unregisterExtendedOpcode(80)
	removeEvent(npcWindowDialog.fadeEvent)
	npcWindowDialog:destroy()
end

function clearItemBox()
	itemBox:destroyChildren()
end

function offline()
	clearItemBox()
	buttondialog:destroyChildren()
	npcWindowDialog:hide()
	npcWindowDialog:setHeight(initialHeight)
	if fadeOutEvent then
		removeEvent(fadeOutEvent)
	end
end

function onCreaturePositionChange(creature, newPos, oldPos)
	if creature:isLocalPlayer() then
		clearItemBox()
		npcWindowDialog:setHeight(initialHeight)
		npcWindowDialog:hide()
	end
end

function openDialog()
	npcWindowDialog:raise()
	npcWindowDialog:show()
	npcWindowDialog:setOpacity(0)
	npcWindowDialog:setHeight(initialHeight)
	g_effects.fadeIn(npcWindowDialog, 150)
	if fadeOutEvent then
		removeEvent(fadeOutEvent)
	end
	fadeOutEvent = scheduleEvent(function() g_effects.fadeOut(npcWindowDialog, 150) end, 30000)
end

function writeTextEffect(lblMessage, text, delay, callback)
	lblMessage:clearText()
	local textSize = #text
	local initialHeight = npcWindowDialog:getHeight()

	for i = 1, textSize do
		scheduleEvent(function()
			lblMessage:setText(lblMessage:getText() .. text:sub(i, i))

			local newHeight = initialHeight + lblMessage:getTextSize().height

			npcWindowDialog:setHeight(newHeight)
		end, delay * i)
	end
end

function NpcDialog(value)
	clearItemBox()
	local Npc = g_map.getCreatureById(value.npcId)

	lblTitle:setText(Npc:getName())
	outfitBox:setOutfit(Npc:getOutfit())

	lblMessage:clearText()
	writeTextEffect(lblMessage, tr(value.message), 15)
	scrollPanel:setVisible(lblMessage:getTextSize().height > panelMsg.limitText)

	local textLength = string.len(value.message)
	local windowHeight = textLength * 10

	if value.items ~= nil then
		local itemHeight = 10
		windowHeight = windowHeight + (#value.items * itemHeight)
	end

	local maxHeight = 800
	if windowHeight > maxHeight then
		windowHeight = maxHeight
	end
	npcWindowDialog:setHeight(windowHeight)

	if value.items ~= nil then
		for _, itemId in ipairs(value.items) do
			local item = g_ui.createWidget('Item', itemBox)
			item:setItemId(itemId)
		end
	end
	buttondialog:destroyChildren()
	if value.options ~= '' then
		local option = value.options:split('&')

		for i = 1, #option do
			local button = g_ui.createWidget('OptionButton', buttondialog)
			button:setText(tr(option[i]))
			button:setWidth(500)
			button:setHeight(150)
			button:setVisible(false)
			button.onClick = function()
				g_game.talkChannel(MessageModes.NpcTo, 0, option[i])
				npcWindowDialog:setHeight(initialHeight)
				button:setVisible(false)
			end
		end
		buttondialog:setHeight(#option > 25 and 88 or 25)
		scheduleEvent(function()
			for i, child in ipairs(buttondialog:getChildren()) do
				child:setVisible(true)
				g_effects.fadeIn(child, 500)
			end
		end, (#value.message * 8) + 500)
	end

	openDialog()
end
