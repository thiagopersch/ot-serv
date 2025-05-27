opcode = 3

---@type UIWidget | nil
AttributesWindow = nil
AttributesWindowButton = nil

local function requestOpen()
	if (AttributesWindow) then
		if (not AttributesWindow:isVisible()) then
			local msg = OutputMessage.create()
			msg:addU8(SpecialOpcode)
			msg:addU8(opcode)
			msg:addU8(0)
			g_game.getProtocolGame():send(msg)
		else
			AttributesWindow:setVisible(false)
		end
	end
end

---@param pg ProtocolGame
---@param opcode number
---@param msg InputMessage
local function onRecvOpcode(pg, opcode, msg)
	local freePoints = msg:getU32()
	local freePointsLabel = AttributesWindow:getChildById("freePointsLabel")
	if (not freePointsLabel.originalText) then
		freePointsLabel.originalText = freePointsLabel:getText()
	end

	freePointsLabel:setText(tr(freePointsLabel.originalText, freePoints))

	local skillsListWidget = AttributesWindow:getChildById("skillsList")
	for _, child in ipairs(skillsListWidget:getChildren()) do
		if (child:getId():match("^skill%d+$") and child.lastCosts) then
			local addButton = child:getChildById("addButton")
			if (freePoints < child.lastCosts) then
				addButton:setOpacity(0.25)
			else
				addButton:setOpacity(1.0)
			end
		end
	end

	local skillsCount = msg:getU8()
	for _ = 1, skillsCount do
		local skillID = msg:getU8()
		local skillMax = msg:getU16()
		local skillInc = msg:getU32() / 100
		local skillVal = msg:getU16()
		local skillCost = msg:getU16()

		local skillPanel = skillsListWidget:getChildById("skill" .. skillID)
		if (skillPanel) then
			skillPanel:getChildById("countLabel"):setText(skillVal .. " / " .. skillMax)
			skillPanel.lastCosts = skillCost

			if (not skillPanel.originalTooltip) then
				skillPanel.originalTooltip = skillPanel:getTooltip()
			end

			local tooltipText = tr(skillPanel.originalTooltip, skillInc)
			tooltipText = tooltipText .. "\n" .. tr("Currently you have %s%%.", (skillVal * skillInc))
			skillPanel:setTooltip(tooltipText)

			local addButton = skillPanel:getChildById("addButton")
			if (skillVal >= skillMax) then
				addButton:setVisible(false)
			elseif (freePoints < skillCost) then
				addButton:setOpacity(0.25)
				addButton:setVisible(true)
			else
				addButton:setOpacity(1.0)
				addButton:setVisible(true)
			end

			addButton:setTooltip(tr("Costs: %d point%s.", skillCost, (skillCost > 1 and "s" or "")))
		else
			pwarning("attribute skill with id " .. skillID .. " does not exists!")
		end
	end

	if (msg:getU8() ~= 0) then
		open()
	end
end

-------------------------------------------------------------------------
-------------------------------------------------------------------------
-------------------------------------------------------------------------

function onClickAdd(w)
	local skillID = tonumber(w:getParent():getId():match("(%d+)"))
	local msg = OutputMessage.create()
	msg:addU8(SpecialOpcode)
	msg:addU8(opcode)
	msg:addU8(skillID)
	g_game.getProtocolGame():send(msg)
end

function toggle()
	if (AttributesWindow) then
		AttributesWindow:setVisible(not AttributesWindow:isVisible())
	end
end

function open()
	if (AttributesWindow) then
		AttributesWindow:setVisible(true)
	end
end

function close()
	if (AttributesWindow) then
		AttributesWindow:setVisible(false)
	end
end

-------------------------------------------------------------------------
-------------------------------------------------------------------------
-------------------------------------------------------------------------

function init()
	AttributesWindow = g_ui.displayUI("attributes_window")
	AttributesWindow:hide()

	AttributesWindowButton = modules.client_topmenu.addRightGameToggleButton("AttributesWindow", tr("Attributes Window"), "assets/button.png", requestOpen)
	AttributesWindowButton:setOn(false)

	ProtocolGame.registerSpecialOpcode(opcode, onRecvOpcode)

	connect(g_game, { onGameEnd = close })
	connect(LocalPlayer, { onWalk = close })
end

function terminate()
	AttributesWindow:destroy()
	AttributesWindow = nil

	AttributesWindowButton:destroy()
	AttributesWindowButton = nil

	ProtocolGame.unregisterSpecialOpcode(opcode)

	disconnect(g_game, { onGameEnd = close })
	disconnect(LocalPlayer, { onWalk = close })
end
