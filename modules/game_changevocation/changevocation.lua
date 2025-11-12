opcode                            = 4

MainWindow                        = nil
MainWindowButton                  = nil
UpgradeConfirmWindow              = nil
SearchVocationText                = nil
FiltersWindow                     = nil

PlayerCurrentVocationId           = nil
PlayerVocations                   = {}

VocationsRadio                    = UIRadioGroup.create()

local CurrentFilters              = {}
local FiltersPanels               = { "classPanel", "typePanel", "elementPanel" }

local VOCATION_CLASS_BRONZE       = 1
local VOCATION_CLASS_SILVER       = 2
local VOCATION_CLASS_GOLD         = 3
local VOCATION_CLASS_DIVINE       = 4

local VOCATION_TYPE_ASSASSIN      = 1
local VOCATION_TYPE_WARRIOR       = 2
local VOCATION_TYPE_EXPERT        = 3
local VOCATION_TYPE_SUPPORT       = 4
local VOCATION_TYPE_TANK          = 5

local COMBATINDEX_PHYSICALDAMAGE  = 0
local COMBATINDEX_ENERGYDAMAGE    = 1
local COMBATINDEX_EARTHDAMAGE     = 2
local COMBATINDEX_FIREDAMAGE      = 3
local COMBATINDEX_UNDEFINEDDAMAGE = 4
local COMBATINDEX_LIFEDRAIN       = 5
local COMBATINDEX_MANADRAIN       = 6
local COMBATINDEX_HEALING         = 7
local COMBATINDEX_DROWNDAMAGE     = 8
local COMBATINDEX_ICEDAMAGE       = 9
local COMBATINDEX_HOLYDAMAGE      = 10
local COMBATINDEX_DEATHDAMAGE     = 11
local COMBATINDEX_WATERDAMAGE     = 12
local COMBATINDEX_ROCKDAMAGE      = 13
local COMBATINDEX_WINDDAMAGE      = 14
local COMBATINDEX_LIGHTDAMAGE     = 15
local COMBATINDEX_DARKDAMAGE      = 16
local COMBATINDEX_STEELDAMAGE     = 17
local COMBATINDEX_GHOSTDAMAGE     = 18
local COMBATINDEX_GRASSDAMAGE     = 19
local COMBATINDEX_DRAGONDAMAGE    = 20

local CombatNameByIndex           = {
	[COMBATINDEX_PHYSICALDAMAGE]  = "Physical",
	[COMBATINDEX_ENERGYDAMAGE]    = "Energy",
	[COMBATINDEX_EARTHDAMAGE]     = "Earth",
	[COMBATINDEX_FIREDAMAGE]      = "Fire",
	[COMBATINDEX_UNDEFINEDDAMAGE] = "Undefined",
	[COMBATINDEX_LIFEDRAIN]       = "Lifedrain",
	[COMBATINDEX_MANADRAIN]       = "Manadrain",
	[COMBATINDEX_HEALING]         = "Healing",
	[COMBATINDEX_DROWNDAMAGE]     = "Drown",
	[COMBATINDEX_ICEDAMAGE]       = "Ice",
	[COMBATINDEX_HOLYDAMAGE]      = "Holy",
	[COMBATINDEX_DEATHDAMAGE]     = "Death",
	[COMBATINDEX_WATERDAMAGE]     = "Water",
	[COMBATINDEX_ROCKDAMAGE]      = "Rock",
	[COMBATINDEX_WINDDAMAGE]      = "Wind",
	[COMBATINDEX_LIGHTDAMAGE]     = "Light",
	[COMBATINDEX_DARKDAMAGE]      = "Dark",
	[COMBATINDEX_STEELDAMAGE]     = "Steel",
	[COMBATINDEX_GHOSTDAMAGE]     = "Ghost",
	[COMBATINDEX_GRASSDAMAGE]     = "Grass",
	[COMBATINDEX_DRAGONDAMAGE]    = "Dragon",
}


local ClassName = {
	[VOCATION_CLASS_BRONZE] = "Shinigami",
	[VOCATION_CLASS_SILVER] = "Hollow",
	[VOCATION_CLASS_GOLD]   = "Quincy",
	[VOCATION_CLASS_DIVINE] = "Humano",
}

local TypeName = {
	[VOCATION_TYPE_ASSASSIN] = "dano pvp",
	[VOCATION_TYPE_WARRIOR]  = "dano pve",
	[VOCATION_TYPE_SUPPORT]  = "Support",
	[VOCATION_TYPE_TANK]     = "Tank",
}

local function getSettingsKey(key)
	return g_game.getCharacterName() .. "_" .. g_game.getClientVersion() .. "_" .. key
end

local function getTierStars(level)
	local starType
	local count = ((level - 1) % 5) + 1
	if (level > 10) then
		starType = "/images/game/goldenstar"
	elseif (level > 5) then
		starType = "/images/game/silverstar"
	elseif (level > 0) then
		starType = "/images/game/bronzestar"
	else
		starType = nil
		count = 0
	end
	return starType, count
end

local function getPortrait(name)
	name = tostring(name):gsub(" ", "_"):gsub("[%[%]]", ""):lower()
	local imageSrc = g_resources.guessFilePath("/images/portraits/" .. name, "png")
	if (not g_resources.fileExists(imageSrc)) then
		imageSrc = g_resources.guessFilePath("/images/portraits/not_found", "png")
	end
	return imageSrc
end

local function updateFiltersWindowPosition(widget, mousePos, mouseMoved)
	if (FiltersWindow) then
		local position = widget:getPosition()
		FiltersWindow:move(position.x + widget:getWidth(), position.y)
	end
	return true
end

local function onDragChange(widget, mousePos)
	local ret
	if (not widget:isDragging()) then
		-- drag enter
		ret = UIWindow.onDragEnter(widget, mousePos)
		FiltersWindow:setOpacity(0.8)
	else
		ret = UIWindow.onDragLeave(widget, mousePos)
		FiltersWindow:setOpacity(1.0)
	end
	return ret
end

local function onCheckBoxChange(widget, checked)
	local parent = widget:getParent()
	for _, child in ipairs(parent:getChildren()) do
		if (widget ~= child) then
			child:setChecked(false, true)
		end
	end

	local filterType = nil
	local id = parent:getId()
	if (id == "classPanel") then
		filterType = "class"
	elseif (id == "typePanel") then
		filterType = "type"
	elseif (id == "elementPanel") then
		filterType = "element"
	end

	if (not filterType) then
		return
	end

	if (checked) then
		CurrentFilters[filterType] = tonumber(widget:getId())
	else
		CurrentFilters[filterType] = nil
	end

	updateVocationsDisplay()
end

local function sortAlgorithm(a, b)
	a, b = a.t or a, b.t or b
	if (a.fav and b.fav) then
		return a.order > b.order
	elseif (a.fav) then
		return true
	elseif (b.fav) then
		return false
	end
	return a.level > b.level
end

function init()
	MainWindow = g_ui.displayUI("changevocation")
	MainWindow.onDragEnter = onDragChange
	MainWindow.onDragLeave = onDragChange
	connect(MainWindow, { onDragMove = updateFiltersWindowPosition })
	MainWindow:hide()

	FiltersWindow = g_ui.displayUI("filters")
	FiltersWindow:setHeight(MainWindow:getHeight())
	FiltersWindow:breakAnchors()
	for _, id in ipairs(FiltersPanels) do
		for _, child in ipairs(FiltersWindow:getChildById(id):getChildren()) do
			child.onCheckChange = onCheckBoxChange
		end
	end
	hideFilters()

	MainWindowButton = modules.client_topmenu.addRightGameToggleButton("ChangeVocationWindow", tr("Change Vocation"),
		"/images/optionstab/features.png", toggle)
	MainWindowButton:setOn(false)

	SearchVocationText = MainWindow:getChildById("searchVocationText")
	SearchVocationText.onTextChange = updateVocationsDisplay

	ProtocolGame.registerExtendedOpcode(opcode, onRecvOpcode)

	connect(g_game, { onGameEnd = onLogout })
	connect(LocalPlayer, { onWalk = onWalk })
end

function terminate()
	VocationsRadio:destroy()

	MainWindow:destroy()
	MainWindow = nil

	FiltersWindow:destroy()
	FiltersWindow = nil

	--MainWindowButton:destroy()
	--MainWindowButton = nil

	cleanup()

	ProtocolGame.unregisterExtendedOpcode(opcode)

	disconnect(g_game, { onGameEnd = onLogout })
	disconnect(LocalPlayer, { onWalk = onWalk })
end

function cleanup()
	if (UpgradeConfirmWindow) then
		UpgradeConfirmWindow:destroy()
		UpgradeConfirmWindow = nil
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
	if (MainWindow) then
		MainWindow:setVisible(true)
		MainWindow:focus()
	end
end

function close()
	if (MainWindow) then
		cleanup()
		local infoPanel = MainWindow:getChildById("infoPanel")
		infoPanel:getChildById("vocationPanel"):setImageSource("")
		infoPanel:getChildById("infoLabel"):setText("")
		MainWindow:getChildById("vocationsList"):destroyChildren()
		MainWindow:setVisible(false)
		hideFilters(true)
		CurrentFilters = {}

		if (SearchVocationText) then
			SearchVocationText:setText("")
		end
	end
end

function confirm()
	local widget = VocationsRadio:getSelectedWidget()
	if (widget and widget.vocation) then
		local msg = OutputMessage.create()
		msg:addU8(SpecialOpcode)
		msg:addU8(opcode)
		msg:addU8(1)
		msg:addU16(widget.vocation.id)
		g_game.getProtocolGame():send(msg)
	end
end

function upgrade()
	local widget = VocationsRadio:getSelectedWidget()
	if (widget and widget.vocation) then
		local msg = OutputMessage.create()
		msg:addU8(SpecialOpcode)
		msg:addU8(opcode)
		msg:addU8(2)
		msg:addU16(widget.vocation.id)
		g_game.getProtocolGame():send(msg)
	end
end

function onWalk(player, oldPosition, newPosition)
	close()
end

function onLogout()
	close()
end

----------------------------------------------------------
----------------------------------------------------------
----------------------------------------------------------

function onClickFiltersButton(widget, mousePos)
	if (not FiltersWindow:isVisible()) then
		showFilters()
	else
		hideFilters()
	end
end

function showFilters()
	MainWindow:getChildById("filtersButton"):setText(tr("Filters") .. " <<")
	FiltersWindow:setVisible(true)
	updateFiltersWindowPosition(MainWindow)
end

function hideFilters(reset)
	MainWindow:getChildById("filtersButton"):setText(tr("Filters") .. " >>")
	FiltersWindow:setVisible(false)
	if (reset) then
		for _, id in ipairs(FiltersPanels) do
			for _, child in ipairs(FiltersWindow:getChildById(id):getChildren()) do
				child:setChecked(false, true)
			end
		end
	end
end

---@param pg ProtocolGame
---@param opcode number
---@param msg InputMessage
function onRecvOpcode(pg, opcode, msg)
	local action = msg:getU8()
	if (action == 1) then
		PlayerVocations = {}
		PlayerCurrentVocationId = msg:getU16()
		print("PlayerCurrentVocationId", PlayerCurrentVocationId)
		local vocationsCount = msg:getU16()
		for i = 1, vocationsCount do
			local data = {}
			data.id = msg:getU16()
			data.lookType = msg:getU16()
			data.tier_level = msg:getU16()
			data.level = msg:getU32()
			data.name = msg:getString()
			data.class = msg:getU8()
			data.type = msg:getU8()
			data.element = msg:getU8()
			data.original_order = i
			data.order = math.max(i, g_settings.getNumber(getSettingsKey("CV_FAV_" .. data.id)))
			data.fav = data.order ~= data.original_order
			PlayerVocations[i] = data
			table.dump(data)
		end

		table.sort(PlayerVocations, sortAlgorithm)

		updateVocationsList()
	elseif (action == 2) then
		local canUpgrade = (msg:getU8() ~= 0)
		local text = msg:getString()
		cleanup()
		if (canUpgrade) then
			UpgradeConfirmWindow = showConfirmWindow(text)
		else
			UpgradeConfirmWindow = showNoticeWindow(text)
		end
	elseif (action == 3) then
		local vocationID = msg:getU16()
		local nextTier = msg:getU16()
		local success = (msg:getU8() ~= 0)
		local text = msg:getString()
		cleanup()
		if (success) then
			updateVocationTier(vocationID, nextTier)
			UpgradeConfirmWindow = showNoticeWindow(text)
		else
			UpgradeConfirmWindow = showNoticeWindow(text)
		end
	end
end

function onConfirmUpgrade()
	cleanup()
	local widget = VocationsRadio:getSelectedWidget()
	if (widget and widget.vocation) then
		local msg = OutputMessage.create()
		msg:addU8(SpecialOpcode)
		msg:addU8(opcode)
		msg:addU8(3)
		msg:addU16(widget.vocation.id)
		g_game.getProtocolGame():send(msg)
	end
end

function onDeniedUpgrade()
	cleanup()
end

function showConfirmWindow(message)
	return UIMessageBox.display(tr("Notice"), message,
		{ { text = tr("Yes"), callback = onConfirmUpgrade }, { text = tr("No"), callback = onDeniedUpgrade } },
		onConfirmUpgrade, onDeniedUpgrade)
end

function showNoticeWindow(message)
	return UIMessageBox.display(tr("Notice"), message, { { text = tr("Ok"), callback = onDeniedUpgrade } }, onDeniedUpgrade,
		onDeniedUpgrade)
end

function onSelectionChange(radioWidget, selectedWidget, previousSelectedWidget)
	local t = selectedWidget.vocation
	if (not t) then
		return
	end

	cleanup()
	if (previousSelectedWidget) then
		previousSelectedWidget:setBackgroundColor("#0000007f")
	end

	selectedWidget:setBackgroundColor("#00000000")

	local infoText = {
		tr("Level"), ": ", t.level, "\n",
		tr("Class"), ": ", tr(ClassName[t.class] or "???"), "\n",
		tr("Type"), ": ", tr(TypeName[t.type] or "???"), "\n",
		tr("Element"), ": ", tr(CombatNameByIndex[t.element] or "???"),
	}

	local infoPanel = MainWindow:getChildById("infoPanel")
	local starsPanel = infoPanel:getChildById("starsPanel")
	starsPanel:destroyChildren()

	local starsImage, starsCount = getTierStars(t.tier_level or 0)
	if (starsImage and starsCount and starsCount > 0) then
		starsPanel:resize((14 * starsCount) - 5, 10)
		for i = 1, starsCount do
			local starWidget = g_ui.createWidget("UIWidget", starsPanel)
			starWidget:setId("star" .. i)
			starWidget:setImageSource(starsImage)
			starWidget:setPhantom(true)
		end
	end

	infoPanel:getChildById("nameLabel"):setText(t.name)
	infoPanel:getChildById("vocationPanel"):setImageSource(getPortrait(t.name))
	infoPanel:getChildById("infoLabel"):setText(table.concat(infoText, ""))
	MainWindow:getChildById("confirmButton"):setEnabled(t.id ~= PlayerCurrentVocationId)
end

function onHoverVocation(widget, hovered)
	if (VocationsRadio:getSelectedWidget() == widget) then
		return
	end

	if (hovered) then
		widget:setBackgroundColor("#0000004f")
	else
		widget:setBackgroundColor("#0000007f")
	end
end

function changeFavoriteVocation(widget)
	local favoriteOrder = math.max(1000, g_settings.getNumber(getSettingsKey("CV_Fav_Order"))) % 1000000
	local t = widget.t
	if (t.order > t.original_order) then
		t.order = t.original_order
	else
		t.order = favoriteOrder
	end

	widget:setImageSource(t.order ~= t.original_order and "assets/fav" or "assets/no-fav")

	if (t.order ~= t.original_order) then
		g_settings.set(getSettingsKey("CV_FAV_" .. t.id), favoriteOrder)
		g_settings.set(getSettingsKey("CV_Fav_Order"), favoriteOrder + 1)
		t.fav = true
	else
		g_settings.remove(getSettingsKey("CV_FAV_" .. t.id))
		t.fav = false
	end
	g_settings.save()

	table.sort(PlayerVocations, sortAlgorithm)

	local vocationsListWidget = MainWindow:getChildById("vocationsList")
	local orderedChildren = vocationsListWidget:getChildren()
	table.sort(orderedChildren, sortAlgorithm)
	vocationsListWidget:reorderChildren(orderedChildren)
end

function updateVocationsList()
	local vocationsListWidget = MainWindow:getChildById("vocationsList")
	vocationsListWidget:destroyChildren()

	MainWindow:getChildById("countLabel"):setText(table.concat({ tr("Vocations"), ": ", #PlayerVocations }, ""))

	VocationsRadio:destroy()
	VocationsRadio.onSelectionChange = onSelectionChange

	for i = 1, #PlayerVocations do
		local t = PlayerVocations[i]
		local vocationBackground = g_ui.createWidget("Panel", vocationsListWidget)
		vocationBackground:setId("vocation" .. t.id)
		vocationBackground:setImageSource("assets/panel")
		vocationBackground.name = t.name:lower()
		vocationBackground.t = t

		local vocationWidget = g_ui.createWidget("UICreature", vocationBackground)
		vocationWidget:addAnchor(AnchorBottom, "parent", AnchorBottom)
		vocationWidget:addAnchor(AnchorHorizontalCenter, "parent", AnchorHorizontalCenter)
		vocationWidget:setMarginRight(16)
		vocationWidget:setMarginBottom(16)
		vocationWidget:setOutfit({ type = t.lookType })
		vocationWidget:setSize("64 64")

		local levelLabel = g_ui.createWidget("Label", vocationBackground)
		levelLabel:addAnchor(AnchorTop, "parent", AnchorTop)
		levelLabel:addAnchor(AnchorLeft, "parent", AnchorLeft)
		levelLabel:setMarginBottom(16)
		levelLabel:setText("Lv" .. t.level)
		levelLabel:setFont("verdana-11px-rounded")
		levelLabel:setColor("green")

		local starsImage, starsCount = getTierStars(t.tier_level)
		if (starsImage and starsCount and starsCount > 0) then
			for k = 1, starsCount do
				local starWidget = g_ui.createWidget("UIWidget", vocationBackground)
				starWidget:setId("star" .. k)
				starWidget:addAnchor(AnchorBottom, "parent", AnchorBottom)
				starWidget:addAnchor(AnchorLeft, "parent", AnchorLeft)
				starWidget:setImageSource(starsImage)
				starWidget:setMarginBottom(1)
				starWidget:setMarginLeft(8 + (k - 1) * 10)
			end
		end

		local clickablePanel = g_ui.createWidget("Panel", vocationBackground)
		clickablePanel:setPhantom(false)
		clickablePanel:fill("parent")
		clickablePanel:setBackgroundColor("#0000007f")
		clickablePanel:setTooltip(t.name .. " (Lv " .. t.level .. ")")
		clickablePanel.vocation = t

		local favWidget = g_ui.createWidget("UIWidget", clickablePanel)
		favWidget.t = t
		favWidget:setId("fav")
		favWidget:addAnchor(AnchorTop, "parent", AnchorTop)
		favWidget:addAnchor(AnchorRight, "parent", AnchorRight)
		favWidget:setImageSource(t.order ~= t.original_order and "assets/fav" or "assets/no-fav")
		favWidget:setImageSize("18 18")
		favWidget:setTooltip(tr("Favorite"))
		favWidget:raise()
		favWidget.onClick = changeFavoriteVocation

		connect(clickablePanel, { onHoverChange = onHoverVocation })
		VocationsRadio:addWidget(clickablePanel)

		if (t.id == PlayerCurrentVocationId) then
			VocationsRadio:selectWidget(clickablePanel)
		end
	end

	open()
end

function updateVocationTier(vocationID, tierLevel)
	for i = 1, #PlayerVocations do
		local t = PlayerVocations[i]
		if (t.id == vocationID) then
			t.tier_level = tierLevel
			break
		end
	end

	local vocationsListWidget = MainWindow:getChildById("vocationsList")
	local vocationPanel = vocationsListWidget:getChildById("vocation" .. vocationID)
	local starsImage, starsCount = getTierStars(tierLevel)
	if (vocationPanel) then
		local children = vocationPanel:getChildren()
		for i = 1, #children do
			local t = children[i]
			if (t and t:getId():match("^star%d+$")) then
				t:destroy()
			end
		end

		if (starsImage and starsCount and starsCount > 0) then
			for k = 1, starsCount do
				local starWidget = g_ui.createWidget("UIWidget", vocationPanel)
				starWidget:setId("star" .. k)
				starWidget:addAnchor(AnchorBottom, "parent", AnchorBottom)
				starWidget:addAnchor(AnchorLeft, "parent", AnchorLeft)
				starWidget:setImageSource(starsImage)
				starWidget:setMarginBottom(1)
				starWidget:setMarginLeft(8 + (k - 1) * 10)
				starWidget:lower()
			end
		end
	end

	local selectedWidget = VocationsRadio:getSelectedWidget()
	if (selectedWidget and selectedWidget.vocation and selectedWidget.vocation.id == vocationID) then
		local infoPanel = MainWindow:getChildById("infoPanel")
		local starsPanel = infoPanel:getChildById("starsPanel")
		starsPanel:destroyChildren()

		if (starsImage and starsCount and starsCount > 0) then
			starsPanel:resize((14 * starsCount) - 5, 10)
			for i = 1, starsCount do
				local starWidget = g_ui.createWidget("UIWidget", starsPanel)
				starWidget:setId("star" .. i)
				starWidget:setImageSource(starsImage)
				starWidget:setPhantom(true)
			end
		end
	end
end

function updateVocationsDisplay()
	local text = SearchVocationText:getText():lower()
	local vocationsListWidget = MainWindow:getChildById("vocationsList")
	for _, child in ipairs(vocationsListWidget:getChildren()) do
		local display = true
		if (text ~= "" and not string.find(child.name, text, nil, true)) then
			display = false
		end

		if (display and child.t) then
			local vocation = child.t
			if (CurrentFilters.class and vocation.class ~= CurrentFilters.class) then
				display = false
			elseif (CurrentFilters.type and vocation.type ~= CurrentFilters.type) then
				display = false
			elseif (CurrentFilters.element and vocation.element ~= CurrentFilters.element) then
				display = false
			end
		end

		child:setVisible(display)
	end
end
