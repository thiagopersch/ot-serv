-- Modified game_inspect script to work as game_player_profile

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
	InspectWindow = g_ui.displayUI("player_profile")

	InspectWindow:hide()


	ProtocolGame.registerExtendedOpcode(opcode, onRecvExtendedOpcode)
	ProtocolGame.registerExtendedOpcode(50, onRecvBackgroundUpdate)
	connect(g_game, {
		onGameEnd = close
	})
end

function terminate()
	InspectWindow:destroy()
	InspectWindow = nil

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

function show()
	if InspectWindow then
		InspectWindow:setVisible(true)
		InspectWindow:focus()
	end
end

-- Compatibility for game_interface
function open(creature)
	if not creature then return end
	requestProfile(creature:getId())
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
	if not InspectWindow then
		return
	end

	local playerPanel = InspectWindow:recursiveGetChildById("playerPanel")
	if not playerPanel then
		return
	end

	-- VOCATION IMAGE
	local vocationName = ProfileData.vocation_name or "not_found"

	-- lowercase
	vocationName = string.gsub(vocationName, "%s*%b()", "")

	-- lowercase
	vocationName = string.lower(vocationName)

	-- remove espaços
	vocationName = string.gsub(vocationName, "%s+", "_")

	local vocationImageSrc = "/images/vocations/" .. vocationName .. ".png"

	if not g_resources.fileExists(vocationImageSrc) then
		vocationImageSrc = "/images/vocations/not_found.png"
	end

	local vocationImage = playerPanel:recursiveGetChildById("vocationImage")
	if vocationImage then
		vocationImage:setImageSource(vocationImageSrc)
	end

	local age = ProfileData.age or 0
	local ageLabel = age < 2 and 'year' or 'years'

	playerPanel:recursiveGetChildById("nameLabel"):setText(ProfileData.name or "--")

	playerPanel:recursiveGetChildById("levelLabel"):setText(string.format("%s: %s",
		tr("Level"),
		tostringex(ProfileData.level, "--")))

	playerPanel:recursiveGetChildById("vocationLabel"):setText(string.format("%s: %s",
		tr("Vocation"),
		tostringex(ProfileData.vocation_name, "--")))

	playerPanel:recursiveGetChildById("ageLabel"):setText(string.format("%s: %s",
		tr("Age"),
		tostringex(age .. " " .. ageLabel, "--")))

	playerPanel:recursiveGetChildById("fragsLabel"):setText(string.format("%s: %s",
		tr("Frags"),
		tostringex(ProfileData.frags, "--")))

	playerPanel:recursiveGetChildById("resetsLabel"):setText(string.format("%s: %s",
		tr("Resets"),
		tostringex(ProfileData.resets, "--")))

	playerPanel:recursiveGetChildById("onlinePointsLabel"):setText(string.format("%s: %s",
		tr("Online Points"),
		tostringex(ProfileData.online_points, "--")))

	playerPanel:recursiveGetChildById("balanceLabel"):setText(string.format("%s: %s",
		tr("Balance"),
		tostringex(ProfileData.balance, "--")))

	playerPanel:recursiveGetChildById("capLabel"):setText(string.format("%s: %s",
		tr("Cap"),
		tostringex(ProfileData.cap, "--")))

	playerPanel:recursiveGetChildById("accountLabel"):setText(string.format("%s: %s",
		tr("Account"),
		tr(ProfileData.premium and "Premium Account" or "Free Account")))

	playerPanel:recursiveGetChildById("townLabel"):setText(string.format("%s: %s",
		tr("Town"),
		tostringex(ProfileData.town_name, "--")))

	playerPanel:recursiveGetChildById("guildLabel"):setText(string.format("%s: %s",
		tr("Guild"),
		tostringex(ProfileData.guild_name, "--")))

	local stamina = ProfileData.stamina or 0

	playerPanel:recursiveGetChildById("staminaLabel"):setText(string.format("%s: %s",
		tr("Stamina"),
		formatStrTime(stamina)))

	local staminaBar = playerPanel:recursiveGetChildById("staminaBar")
	staminaBar:setValue(stamina, 0, 2520)

	local maxHealth = ProfileData.max_health or 0
	local healthBar = playerPanel:recursiveGetChildById("healthBar")

	healthBar:setText(maxHealth)
	healthBar:setValue(maxHealth, 0, math.max(maxHealth, 1))

	local maxMana = ProfileData.max_mana or 0
	local manaBar = playerPanel:recursiveGetChildById("manaBar")

	manaBar:setText(maxMana)
	manaBar:setValue(maxMana, 0, math.max(maxMana, 1))

	-- ITEMS
	if not ProfileData.equipments then
		ProfileData.equipments = {}
	end

	local itemsPanel = InspectWindow:recursiveGetChildById("itemsPanel")

	if itemsPanel then
		local eyeIcon = itemsPanel:recursiveGetChildById("eyeIcon")

		if eyeIcon then
			eyeIcon:setImageSource(ProfileData.showEquipments and "assets/eye_open" or "assets/eye_closed")
		end

		for i = 1, 10 do
			local item = ProfileData.equipments[i]
			local slotPanel = itemsPanel:recursiveGetChildById("slot" .. i)

			if slotPanel then
				if ProfileData.showEquipments then
					local itemId = item and item.id or 0

					if itemId ~= 0 then
						slotPanel:setStyle("InventoryItem")
						slotPanel:setItemId(itemId)
						slotPanel:setItemCount(item.count or 0)

						if slotPanel.setTooltipTable then
							slotPanel:setTooltipTable("", itemId)
						end
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
	end

	-- SKILLS
	if not ProfileData.skills then
		ProfileData.skills = {}
	end

	local skillsPanel = InspectWindow:recursiveGetChildById("skillsPanel")

	if skillsPanel then
		skillsPanel:recursiveGetChildById("magLevel"):setText(string.format("%s: %s",
			tr("Magic Level"),
			tostringex(ProfileData.magic_level, "--")))

		for i = 0, 6 do
			skillsPanel:recursiveGetChildById("skill" .. i):setText(string.format("%s: %s",
				tr(SkillIdToName[i]),
				tostringex(ProfileData.skills[i], "--")))
		end

		skillsPanel:recursiveGetChildById("dodgeLabel"):setText(string.format("%s: %s",
			tr("Dodge"),
			tostringex((ProfileData.dodge or 0) .. "/1000", "--")))

		skillsPanel:recursiveGetChildById("critLabel"):setText(string.format("%s: %s",
			tr("Critical"),
			tostringex((ProfileData.crit or 0) .. "/1000", "--")))
	end

	-- RANK
	local rankPanel = InspectWindow:recursiveGetChildById("rankPanel")

	if rankPanel then
		local rankColor = getRankColor(ProfileData.task_rank)

		rankPanel:recursiveGetChildById("rankLabel"):setText(string.format("%s: %s",
			tr("Rank"),
			tostringex(ProfileData.task_rank, "--")))

		rankPanel:recursiveGetChildById("rankLabel"):setColor(rankColor)

		rankPanel:recursiveGetChildById("pointsLabel"):setText(string.format("%s: %s",
			tr("Task Points"),
			tostringex(ProfileData.task_points, "0")))

		local progressFill = rankPanel:recursiveGetChildById("rankProgressFill")
		local progressBar = rankPanel:recursiveGetChildById("rankProgressBar")
		local progressText = rankPanel:recursiveGetChildById("rankProgressText")

		if ProfileData.task_next_rank and
				ProfileData.task_next_rank ~= "" and
				ProfileData.task_next_rank ~= ProfileData.task_rank then
			rankPanel:recursiveGetChildById("nextRankLabel"):setText(string.format(
				"Next: %s (%s pts)",
				ProfileData.task_next_rank,
				tostringex(ProfileData.task_points_to_next, "0")
			))

			if progressFill and progressBar then
				local maxPoints = ProfileData.task_points_to_next_max

				if maxPoints and maxPoints > 0 then
					local pct = math.min(
						(ProfileData.task_points_in_rank or 0) / maxPoints,
						1
					)

					local barWidth = math.max(progressBar:getWidth(), 150)

					progressFill:setWidth(math.floor(barWidth * pct))
				end
			end

			if progressText then
				progressText:setText(string.format("%s / %s",
					tostringex(ProfileData.task_points_in_rank, "0"),
					tostringex(ProfileData.task_points_to_next_max, "1")))
			end
		else
			rankPanel:recursiveGetChildById("nextRankLabel"):setText("Max Rank!")

			if progressFill then
				progressFill:setWidth(0)
			end

			if progressText then
				progressText:setText("MAXED")
			end
		end
	end
end

local RANK_COLORS = {
	["Unranked"] = "#666666",
	["Citizen"] = "#aaaaaa",
	["Veteran"] = "#cd7f32",
	["Master"] = "#c0c0c0",
	["Professional"] = "#ffd700",
	["Elite"] = "#b9f2ff",
	["Legendary"] = "#ff6b6b",
	["Immortal"] = "#ff0000",
	["Hero"] = "#ff4500",
	["God of Destruction"] = "#8b00ff",
	["God of Creation"] = "#00bfff",
	["Supreme God"] = "#ffd700",
	["Human"] = "#aaaaaa",
	["Hollow"] = "#cd7f32",
	["Shinigami"] = "#c0c0c0",
	["Vaizard"] = "#ffd700",
	["Arrancar"] = "#b9f2ff",
	["Espada"] = "#ff6b6b",
	["Captain"] = "#ff0000",
	["Elite Captain"] = "#ff4500",
	["General Captain"] = "#8b00ff",
	["Head Captain"] = "#00bfff",
	["King of Shinigami"] = "#ffd700"
}

function getRankColor(rankName)
	if RANK_COLORS[rankName] then
		return RANK_COLORS[rankName]
	end
	return "#ffffff"
end

function search()
	local searchEdit = InspectWindow:recursiveGetChildById("searchEdit")
	local text = searchEdit:getText()

	if text ~= "" then
		requestProfileByName(text)
		searchEdit:setText("")
	end

	local itemsPanel = InspectWindow:recursiveGetChildById("itemsPanel")
	local eyeIcon = itemsPanel:recursiveGetChildById("eyeIcon")
	local localPlayer = g_game.getLocalPlayer()

	if string.lower(localPlayer:getName()) == string.lower(text) then
		eyeIcon:setVisible(true)
	else
		eyeIcon:setVisible(false)
	end
end

function updateItemSlots()
	local itemsPanel = InspectWindow:recursiveGetChildById("itemsPanel")
	for i = 1, 10 do
		local item = ProfileData.equipments[i]
		local slotPanel = itemsPanel:recursiveGetChildById("slot" .. i)

		if ProfileData.showEquipments then
			local itemId = item and item.id or 0
			if itemId ~= 0 then
				slotPanel:setStyle("InventoryItem")
				slotPanel:setItemId(itemId)
				slotPanel:setItemCount(item.count or 0)
				if slotPanel.setTooltipTable then
					slotPanel:setTooltipTable("", itemId)
				end
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

	local itemsPanel = InspectWindow:recursiveGetChildById("itemsPanel")
	local eyeIcon = itemsPanel:recursiveGetChildById("eyeIcon")

	eyeIcon:setImageSource(enable and "assets/eye_open" or "assets/eye_closed")

	updateItemSlots()
end

function requestProfile(creatureId)
	local data = {
		"1",
		creatureId
	}
	local itemsPanel = InspectWindow:recursiveGetChildById("itemsPanel")
	local eyeIcon = itemsPanel:recursiveGetChildById("eyeIcon")
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
	print("[PROFILE] data count: " .. #data)
	print("[PROFILE] data[1]: " .. tostring(data[1]))
	print("[PROFILE] data[4]: " .. tostring(data[4]))
	if #data < 16 then return end

	ProfileData = {
		name = data[1],
		max_health = tonumber(data[2]) or 0,
		max_mana = tonumber(data[3]) or 0,
		level = tonumber(data[4]) or 1,
		vocation_name = data[5],
		town_name = data[6],
		stamina = tonumber(data[7]) or 0,
		guild_name = data[8],
		premium = (tonumber(data[9]) or 0) ~= 0,
		age = tonumber(data[10]) or 0,
		frags = tonumber(data[11]) or 0,
		resets = tonumber(data[12]) or 0,
		balance = tonumber(data[13]) or 0,
		cap = tonumber(data[14]) or 0,
		dodge = tonumber(data[15]) or 0,
		crit = tonumber(data[16]) or 0
	}
	ProfileData.skills = {}

	for i = 0, 6 do
		ProfileData.skills[i] = data[17 + i]
	end

	ProfileData.magic_level = data[24]
	ProfileData.isLocalPlayer = (tonumber(data[25]) or 0) ~= 0
	ProfileData.showEquipments = (tonumber(data[26]) or 0) ~= 0
	ProfileData.equipments = {}

	local index = 27

	if index < #data then
		for i = 1, 10 do
			local id = tonumber(data[index]) or 0
			local count = tonumber(data[index + 1]) or 0
			ProfileData.equipments[i] = {
				id = id,
				count = count
			}
			index = index + 2
		end
	end

	ProfileData.online_points = tonumber(data[index] or 0)

	index = index + 1
	ProfileData.task_rank = data[index] or "None"
	index = index + 1
	ProfileData.task_points = tonumber(data[index]) or 0
	index = index + 1
	ProfileData.task_next_rank = data[index] or ""
	index = index + 1
	ProfileData.task_points_to_next = tonumber(data[index]) or 0
	index = index + 1
	ProfileData.task_points_in_rank = tonumber(data[index]) or 0
	index = index + 1
	ProfileData.task_points_to_next_max = tonumber(data[index]) or 1

	updateProfile()
	show()
end

function onRecvBackgroundUpdate(protocol, opcode, buffer)
	local data = buffer:explode("|")
	if not InspectWindow or not InspectWindow:isVisible() then return end

	-- Opcode 50 usually sends: age|title|frags|resets
	-- We only update ProfileData if it belongs to the local player
	if ProfileData.isLocalPlayer then
		if data[1] then ProfileData.age = tonumber(data[1]) or 0 end
		if data[3] then ProfileData.frags = tonumber(data[3]) or 0 end
		if data[4] then ProfileData.resets = tonumber(data[4]) or 0 end
		updateProfile()
	end
end
