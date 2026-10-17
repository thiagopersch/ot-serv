function onAdvance(cid, skill, oldLevel, newLevel)
	-- [level] = {item,quantidade}
	local config = {
		[50] = { item = 2160, count = 50 },
		[100] = { item = 2160, count = 100 },
		[150] = { item = 2160, count = 150 },
		[200] = { item = 2160, count = 200 },
		[250] = { item = 2160, count = 250 },
		[300] = { item = 2160, count = 300 },
		[350] = { item = 2160, count = 350 },
		[400] = { item = 2160, count = 400 },
		[450] = { item = 2160, count = 450 },
		[500] = { item = 2160, count = 500 },
		[550] = { item = 2160, count = 550 },
		[600] = { item = 2160, count = 600 },
		[650] = { item = 2160, count = 650 },
		[700] = { item = 2160, count = 700 },
		[750] = { item = 2160, count = 750 },
		[800] = { item = 2160, count = 800 },
		[850] = { item = 2160, count = 850 },
		[900] = { item = 2160, count = 900 },
		[950] = { item = 2160, count = 950 },
		[1000] = { item = 2160, count = 1000 },


	}

	if skill == 8 then
		for level, info in pairs(config) do
			if newLevel >= level and (getPlayerStorageValue(cid, 30700) == -1 or not (string.find(getPlayerStorageValue(cid, 30700), "'" .. level .. "'"))) then
				doPlayerAddItem(cid, info.item, info.count)

				local msg = getPlayerName(cid) .. ", you have reached the level " .. newLevel .. " and earned " ..
						info.count .. " " .. getItemNameById(info.item) .. "."
				local formattedText = "top|" .. TEXTCOLOR_YELLOW .. "|" .. msg
				addEvent(doBroadcastMessage, 21, formattedText)

				local sat = getPlayerStorageValue(cid, 30700) == -1 and "Values: '" .. level .. "'" or
						getPlayerStorageValue(cid, 30700) .. ",'" .. level .. "'"
				setPlayerStorageValue(cid, 30700, sat)
			end
		end
	end

	return TRUE
end

-- function onAdvance(cid, skill, oldlevel, newlevel)
-- 	if skill ~= SKILL__LEVEL then return true end

-- 	local rewards = {
-- 		[50] = { storage = 99960, gold = 5 },
-- 		[100] = { storage = 99961, gold = 10 },
-- 		[150] = { storage = 99962, gold = 20 },
-- 		[200] = { storage = 99963, gold = 30 },
-- 		[250] = { storage = 99964, gold = 40 },
-- 		[300] = { storage = 99965, gold = 50 },
-- 		[400] = { storage = 99966, gold = 100 },
-- 		[500] = { storage = 99966, gold = 200 },
-- 		[600] = { storage = 99966, gold = 300 },
-- 		[700] = { storage = 99966, gold = 400 },
-- 		[800] = { storage = 99966, gold = 500 },
-- 		[900] = { storage = 99966, gold = 600 },
-- 		[1000] = { storage = 99966, gold = 700 },
-- 	}

-- 	local reward = rewards[newlevel]
-- 	if reward and getPlayerStorageValue(cid, reward.storage) ~= 1 then
-- 		doPlayerAddItem(cid, 2160, reward.gold)
-- 		setPlayerStorageValue(cid, reward.storage, 1)
-- 		doPlayerSendTextMessage(cid, 22, string.format("Voce ganhou %d golds por chegar ao level %d.", reward.gold, newlevel))
-- 	end

-- 	return true
-- end
