-- chunkname: @/modules/game_inspect/script.lua

opcode = 13
InspectWindow = nil
InspectButton = nil
ProfileData = {}

local SkillIdToName = {
	[0] = "Fist",
	"Club",
	"Sword",
	"Axe",
	"Distance",
	"Shielding",
	"Fishing"
}
local InventorySlotStyles = {
	[InventorySlotHead] = "HeadSlot",
	[InventorySlotNeck] = "NeckSlot",
	[InventorySlotBack] = "BackSlot",
	[InventorySlotBody] = "BodySlot",
	[InventorySlotRight] = "RightSlot",
	[InventorySlotLeft] = "LeftSlot",
	[InventorySlotLeg] = "LegSlot",
	[InventorySlotFeet] = "FeetSlot",
	[InventorySlotFinger] = "FingerSlot",
	[InventorySlotAmmo] = "AmmoSlot"
}

function init()
	InspectWindow = g_ui.displayUI("ui")

	if InspectWindow then
		InspectWindow:hide()
	end


	InspectButton = modules.client_topmenu.addLeftGameButton("InspectButton", tr("Profile"), "/images/topbuttons/inspect",
		toggle)

	InspectButton:setOn(true)
	ProtocolGame.registerExtendedOpcode(opcode, onRecvExtendedOpcode)
	connect(g_game, {
		onGameEnd = close
	})
end

function terminate()
	InspectWindow:destroy()

	InspectWindow = nil

	InspectButton:destroy()

	InspectButton = nil

	ProtocolGame.unregisterExtendedOpcode(opcode)
	disconnect(g_game, {
		onGameEnd = close
	})
end

function toggle()
	if InspectWindow then
		if InspectWindow:isVisible() then
			close()
		else
			local localPlayer = g_game.getLocalPlayer()

			if localPlayer then
				requestProfile(localPlayer:getId())
			end
		end
	end
end

function close()
	if InspectWindow then
		InspectWindow:setVisible(false)
	end
end

function open()
	if InspectWindow then
		InspectWindow:setVisible(true)
		InspectWindow:focus()
	end
end

local function formatStrTime(t)
	local h = math.floor(t / 3600)
	local m = math.floor(t / 60) % 60
	local s = math.floor(t % 60)
	local str = ""

	if h > 0 then
		str = string.format("%02d:%02d:%02d", h, m, s)
	else
		str = string.format("%02d:%02d", m, s)
	end

	return str
end

local function tostringex(s, def)
	local t = type(s)

	if t == "string" or t == "number" then
		s = tostring(s)

		if s == "" then
			s = def
		end
	end

	return s
end

function getFrame(rarity)
	if rarity == 6 or rarity == 5 then
		return '/images/rarity/rarity_super_legendary'
	elseif rarity == 4 then
		return '/images/rarity/rarity_legendary'
	elseif rarity == 3 then
		return '/images/rarity/rarity_epic'
	elseif rarity == 2 then
		return '/images/rarity/rarity_rare'
	elseif rarity == 1 then
		return '/images/rarity/rarity_commom'
	else
		return '/images/ui/item'
	end
end

function updateProfile()
	local eloImageSrc

	if not ProfileData.elo_name or ProfileData.elo_name == "" then
		eloImageSrc = g_resources.guessFilePath("assets/elo/not_found", "png")
	else
		eloImageSrc = g_resources.guessFilePath("assets/elo/" .. tostring(ProfileData.elo_name):lower(), "png")

		if not g_resources.fileExists(eloImageSrc) then
			eloImageSrc = g_resources.guessFilePath("assets/elo/not_found", "png")
		end
	end

	local vocationImageSrc

	if not ProfileData.vocation_name or ProfileData.vocation_name == "" then
		vocationImageSrc = g_resources.guessFilePath("assets/vocation/not_found", "png")
	else
		vocationImageSrc = g_resources.guessFilePath("assets/vocation/" .. tostring(ProfileData.vocation_name):lower(), "png")

		if not g_resources.fileExists(vocationImageSrc) then
			vocationImageSrc = g_resources.guessFilePath("assets/vocation/not_found", "png")
		end
	end

	local playerPanel = InspectWindow:getChildById("playerPanel")



	playerPanel:getChildById("vocationImage"):setImageSource(vocationImageSrc)
	playerPanel:getChildById("nameLabel"):setText(ProfileData.name or "--")
	playerPanel:getChildById("levelLabel"):setText(string.format("%s: %s", tr("Level"), tostringex(ProfileData.level, "--")))
	playerPanel:getChildById("vocationLabel"):setText(string.format("%s: %s", tr("Vocation"),
		tostringex(ProfileData.vocation_name, "--")))
	playerPanel:getChildById("accountLabel"):setText(string.format("%s: %s", tr("Account"),
		tr(ProfileData.premium and "Premium Account" or "Free Account")))
	playerPanel:getChildById("townLabel"):setText(string.format("%s: %s", tr("Town"),
		tostringex(ProfileData.town_name, "--")))
	playerPanel:getChildById("guildLabel"):setText(string.format("%s: %s", tr("Guild"),
		tostringex(ProfileData.guild_name, "--")))

	local stamina = ProfileData.stamina or 0

	playerPanel:getChildById("staminaLabel"):setText(string.format("%s: %s", tr("Stamina"), formatStrTime(stamina)))
	playerPanel:getChildById("staminaBar"):setValue(stamina, 0, 2520)

	local maxHealth = ProfileData.max_health or 0
	local healthBar = playerPanel:getChildById("healthBar")

	healthBar:setText(maxHealth)
	healthBar:setValue(maxHealth, 0, maxHealth)

	local maxMana = ProfileData.max_mana or 0
	local manaBar = playerPanel:getChildById("manaBar")

	manaBar:setText(maxMana)
	manaBar:setValue(maxMana, 0, maxMana)

	if not ProfileData.equipments then
		ProfileData.equipments = {}
	end

	local itemsPanel = InspectWindow:getChildById("itemsPanel")
	local eyeIcon = itemsPanel:getChildById("eyeIcon")

	-- Configura a visibilidade do ícone do olho e a fonte da imagem baseada na visibilidade dos equipamentos.
	-- eyeIcon:setVisible(ProfileData.isLocalPlayer)
	eyeIcon:setImageSource(ProfileData.showEquipments and "assets/eye_open" or "assets/eye_closed")

	for i = 1, 10 do
		local item = ProfileData.equipments[i]
		local slotPanel = itemsPanel:getChildById("slot" .. i)

		-- Se 'eye_open', configura os itens; se 'eye_closed', limpa os slots.
		if ProfileData.showEquipments then
			local itemId = item and item.id or 0
			if itemId ~= 0 then
				slotPanel:setStyle("InventoryItem")
				slotPanel:setItemId(itemId)
				slotPanel:setItemCount(item.count or 0)
			else
				slotPanel:setStyle(InventorySlotStyles[i])
				slotPanel:setItem(nil)
			end
		else
			slotPanel:setStyle(InventorySlotStyles[i])
			slotPanel:setItem(nil)
		end
	end

	if not ProfileData.skills then
		ProfileData.skills = {}
	end

	local skillsPanel = InspectWindow:getChildById("skillsPanel")

	skillsPanel:getChildById("magLevel"):setText(string.format("%s: %s", tr("Magic Level"),
		tostringex(ProfileData.magic_level, "--")))

	for i = 0, 6 do
		skillsPanel:getChildById("skill" .. i):setText(string.format("%s: %s", tr(SkillIdToName[i]),
			tostringex(ProfileData.skills[i], "--")))
	end
end

function search()
	local searchEdit = InspectWindow:getChildById("searchEdit")
	local text = searchEdit:getText()

	if text ~= "" then
		requestProfileByName(text)
		searchEdit:setText("")
	end

	local itemsPanel = InspectWindow:getChildById("itemsPanel")
	local eyeIcon = itemsPanel:getChildById("eyeIcon")
	local localPlayer = g_game.getLocalPlayer()

	if string.lower(localPlayer:getName()) == string.lower(text) then
		eyeIcon:setVisible(true)
	else
		eyeIcon:setVisible(false)
	end
end

function updateItemSlots()
	local itemsPanel = InspectWindow:getChildById("itemsPanel")
	for i = 1, 10 do
		local item = ProfileData.equipments[i]
		local slotPanel = itemsPanel:getChildById("slot" .. i)

		if ProfileData.showEquipments then
			local itemId = item and item.id or 0
			if itemId ~= 0 then
				slotPanel:setStyle("InventoryItem")
				slotPanel:setItemId(itemId)
				slotPanel:setItemCount(item.count or 0)
				slotPanel:setTooltipTable("", itemId)
				-- slotPanel:setImageSource(getFrame(item.rarity))
			else
				slotPanel:setStyle(InventorySlotStyles[i])
				slotPanel:setItem(nil)
			end
		else
			slotPanel:setStyle(InventorySlotStyles[i])
			slotPanel:setItem(nil)
		end
	end
end

function changePrivacy()
	local enable = not ProfileData.showEquipments

	ProfileData.showEquipments = enable

	requestPrivacyChange(enable)

	local itemsPanel = InspectWindow:getChildById("itemsPanel")
	local eyeIcon = itemsPanel:getChildById("eyeIcon")

	eyeIcon:setImageSource(enable and "assets/eye_open" or "assets/eye_closed")

	-- Atualiza os slots de item baseados na nova configuração de privacidade
	updateItemSlots()
end

function requestProfile(creatureId)
	local data = {
		"1",
		creatureId
	}
	local itemsPanel = InspectWindow:getChildById("itemsPanel")
	local eyeIcon = itemsPanel:getChildById("eyeIcon")
	eyeIcon:setVisible(true)
	g_game.getProtocolGame():sendExtendedOpcode(opcode, table.concat(data, "&"))
end

function requestProfileByName(name)
	local data = {
		"2",
		name
	}
	g_game.getProtocolGame():sendExtendedOpcode(opcode, table.concat(data, "&"))
end

function requestPrivacyChange(enable)
	local data = {
		"3",
		enable and 1 or 0
	}

	g_game.getProtocolGame():sendExtendedOpcode(opcode, table.concat(data, "&"))
end

function onRecvExtendedOpcode(pg, opcode, buffer)
	local data = buffer:explode("&")

	ProfileData = {
		name = data[1],
		max_health = tonumber(data[2]) or 0,
		max_mana = tonumber(data[3]) or 0,
		level = tonumber(data[4]) or 1,
		vocation_name = data[5],
		town_name = data[6],
		stamina = tonumber(data[7]) or 0,
		guild_name = data[8],
		premium = (tonumber(data[9]) or 0) ~= 0
	}
	ProfileData.skills = {}

	for i = 0, 6 do
		ProfileData.skills[i] = data[10 + i]
	end

	ProfileData.magic_level = data[17]
	ProfileData.isLocalPlayer = (tonumber(data[10]) or 0) ~= 0
	ProfileData.showEquipments = (tonumber(data[19]) or 0) ~= 0
	ProfileData.equipments = {}

	local index = 20

	if index < #data then
		for i = 1, 10 do
			local id = tonumber(data[index]) or 0
			local count = tonumber(data[index + 1]) or 0
			-- local rarity = tonumber(data[index + 2]) or 0
			ProfileData.equipments[i] = {
				id = id,
				count = count
				-- rarity = rarity
			}
			index = index + 2
		end
	end

	updateProfile()
	open()
end
