local function getPlayerByCommand(cid, name)
	if not name or name == "" then
		return cid, cid
	end

	local target = getPlayerByNameWildcard(name)
	if not target then
		doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Player \"" .. name .. "\" not found.")
		return nil
	end

	if getPlayerAccess(cid) < 3 and cid ~= target then
		doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "You don't have access to set outfit extras on other players.")
		return nil
	end

	return cid, target
end

function onSay(cid, words, param)
	local target
	cid, target = getPlayerByCommand(cid, param)

	if not target then
		return true
	end

	local t = string.explode(param, ",")
	local param1 = t[1] and t[1]:trim() or ""
	local param2 = t[2] and t[2]:trim() or ""

	if words == "/wings" or words == "!wings" then
		if param1 == "none" or param1 == "0" or param1 == "" then
			doPlayerSetWings(target, 0)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Wings removed.")
		else
			local wingId = tonumber(param1)
			if wingId then
				doPlayerSetWings(target, wingId)
				doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Wings set to ID " .. wingId .. ".")
			else
				doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id|none>")
			end
		end

	elseif words == "/aura" or words == "!aura" then
		if param1 == "none" or param1 == "0" or param1 == "" then
			doPlayerSetAura(target, 0)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Aura removed.")
		else
			local auraId = tonumber(param1)
			if auraId then
				doPlayerSetAura(target, auraId)
				doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Aura set to ID " .. auraId .. ".")
			else
				doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id|none>")
			end
		end

	elseif words == "/shader" or words == "!shader" then
		if param1 == "none" or param1 == "0" or param1 == "" then
			doPlayerSetShader(target, 0)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Shader removed.")
		else
			local shaderId = tonumber(param1)
			if shaderId then
				doPlayerSetShader(target, shaderId)
				doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Shader set to ID " .. shaderId .. ".")
			else
				doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id|none>")
			end
		end

	elseif words == "/healthbar" or words == "!healthbar" then
		if param1 == "none" or param1 == "0" or param1 == "" then
			doPlayerSetHealthBar(target, 0)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Health bar removed.")
		else
			local barId = tonumber(param1)
			if barId then
				doPlayerSetHealthBar(target, barId)
				doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Health bar set to ID " .. barId .. ".")
			else
				doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id|none>")
			end
		end

	elseif words == "/manabar" or words == "!manabar" then
		if param1 == "none" or param1 == "0" or param1 == "" then
			doPlayerSetManaBar(target, 0)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Mana bar removed.")
		else
			local barId = tonumber(param1)
			if barId then
				doPlayerSetManaBar(target, barId)
				doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Mana bar set to ID " .. barId .. ".")
			else
				doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id|none>")
			end
		end

	elseif words == "/extoutfit" or words == "!extoutfit" then
		local mount = tonumber(t[1]) or 0
		local wings = tonumber(t[2]) or 0
		local aura = tonumber(t[3]) or 0
		local shader = tonumber(t[4]) or 0
		local healthBar = tonumber(t[5]) or 0
		local manaBar = tonumber(t[6]) or 0

		doPlayerSetOutfitExtras(target, mount, wings, aura, shader, healthBar, manaBar)
		doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Outfit extras updated.")

	elseif words == "/addwing" or words == "!addwing" then
		local id = tonumber(param1)
		if id then
			doPlayerAddExtoutfitUnlock(target, "wing", id)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Wing " .. id .. " unlocked.")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id>")
		end

	elseif words == "/removewing" or words == "!removewing" then
		local id = tonumber(param1)
		if id then
			doPlayerRemoveExtoutfitUnlock(target, "wing", id)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Wing " .. id .. " locked.")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id>")
		end

	elseif words == "/addaura" or words == "!addaura" then
		local id = tonumber(param1)
		if id then
			doPlayerAddExtoutfitUnlock(target, "aura", id)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Aura " .. id .. " unlocked.")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id>")
		end

	elseif words == "/removeaura" or words == "!removeaura" then
		local id = tonumber(param1)
		if id then
			doPlayerRemoveExtoutfitUnlock(target, "aura", id)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Aura " .. id .. " locked.")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id>")
		end

	elseif words == "/addshader" or words == "!addshader" then
		local id = tonumber(param1)
		if id then
			doPlayerAddExtoutfitUnlock(target, "shader", id)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Shader " .. id .. " unlocked.")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id>")
		end

	elseif words == "/removeshader" or words == "!removeshader" then
		local id = tonumber(param1)
		if id then
			doPlayerRemoveExtoutfitUnlock(target, "shader", id)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Shader " .. id .. " locked.")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id>")
		end

	elseif words == "/addhealthbar" or words == "!addhealthbar" then
		local id = tonumber(param1)
		if id then
			doPlayerAddExtoutfitUnlock(target, "healthbar", id)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Health bar " .. id .. " unlocked.")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id>")
		end

	elseif words == "/removehealthbar" or words == "!removehealthbar" then
		local id = tonumber(param1)
		if id then
			doPlayerRemoveExtoutfitUnlock(target, "healthbar", id)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Health bar " .. id .. " locked.")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id>")
		end

	elseif words == "/addmanabar" or words == "!addmanabar" then
		local id = tonumber(param1)
		if id then
			doPlayerAddExtoutfitUnlock(target, "manabar", id)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Mana bar " .. id .. " unlocked.")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id>")
		end

	elseif words == "/removemanabar" or words == "!removemanabar" then
		local id = tonumber(param1)
		if id then
			doPlayerRemoveExtoutfitUnlock(target, "manabar", id)
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "Mana bar " .. id .. " locked.")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <id>")
		end

	elseif words == "/unlockall" or words == "!unlockall" then
		if getPlayerAccess(cid) >= 4 then
			for _, extType in ipairs({"wing", "aura", "shader", "healthbar", "manabar"}) do
				local ids = {}
				if extType == "wing" or extType == "aura" then
					for i = 1, 10 do table.insert(ids, i) end
				elseif extType == "shader" then
					for i = 1, 19 do table.insert(ids, i) end
				elseif extType == "healthbar" then
					for i = 1, 70 do table.insert(ids, i) end
				elseif extType == "manabar" then
					for i = 1, 15 do table.insert(ids, i) end
				end
				for _, id in ipairs(ids) do
					doPlayerAddExtoutfitUnlock(target, extType, id)
				end
			end
			doPlayerSendTextMessage(target, MESSAGE_STATUS_CONSOLE_BLUE, "All extoutfit features unlocked!")
		else
			doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "You don't have access to this command.")
		end
	end

	return true
end
