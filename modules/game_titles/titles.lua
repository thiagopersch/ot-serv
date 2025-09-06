VOCATION_OPCODE = 5

local playerTitles = {
  ["God"] = { title = "[ADMINISTRADOR]", color = "#DC143C" },
  -- Add more player titles as needed
}

local npcTitles = {
  ["Afonso"] = { title = "[Backpack Buyer]", color = "#DAA520" },
  ["Zoruta"] = { title = "[Clubs Buyer]", color = "#DAA520" },
  ["Frodo"] = { title = "[Foods Buyer]", color = "#DAA520" },
  ["Gukoa"] = { title = "[Legs Buyer]", color = "#DAA520" },
  ["Razo"] = { title = "[Helmets Buyer]", color = "#DAA520" },
  ["Gidan"] = { title = "[Bows and Crossbows Buyer]", color = "#DAA520" },
  ["Samanta"] = { title = "[Armors Buyer]", color = "#DAA520" },
  ["Rivertall"] = { title = "[Gloves Buyer]", color = "#DAA520" },
  ["Dobao"] = { title = "[Swords Buyer]", color = "#DAA520" },
  ["Kayfas"] = { title = "[Maces Buyer]", color = "#DAA520" },
  ["Cakev"] = { title = "[Shields Buyer]", color = "#DAA520" },
  ["Zaratustra"] = { title = "[PROFETA VIAJANTE]", color = "#DAA520" },
  -- Add more NPC titles as needed
}

local vocations = {
  [100000] = { title = "Shin", color = "#FF0000" }
}


local monsterTitles = {
  ["Training Monk"] = { title = "[TREINADOR]", color = "#DC143C" },
  ["Mama Bird"] = { title = "[BOSS]", color = "#DC143C" },
  -- Add more monster titles as needed
}

local titleFont = "ndbochaos-16px-rounded"

function init()
  connect(Creature, {
    onAppear = updateTitle,
  })
  ProtocolGame.registerExtendedOpcode(VOCATION_OPCODE, deadpool)
end

function terminate()
  disconnect(Creature, {
    onAppear = updateTitle,
  })
  ProtocolGame.unregisterExtendedOpcode(VOCATION_OPCODE)
end

function string.split(inputstr, sep)
  if sep == nil then
    sep = "%s"
  end
  local t = {}
  for str in string.gmatch(inputstr, "([^" .. sep .. "]+)") do
    table.insert(t, str)
  end
  return t
end

function getVisiblePlayersOnScreen()
  local visiblePlayers = {}
  local localPlayer = g_game.getLocalPlayer()
  if not localPlayer then
    return visiblePlayers
  end

  local position = localPlayer:getPosition()
  if not position or position.x == 0 and position.y == 0 and position.z == 0 then
    return visiblePlayers
  end

  local creatures = g_map.getSpectators(position, false, false)
  for _, creature in ipairs(creatures) do
    if creature:isPlayer() then
      table.insert(visiblePlayers, creature)
    end
  end
  return visiblePlayers
end

function deadpool(protocol, opcode, buffer)
  if opcode == VOCATION_OPCODE then
    local data = string.split(buffer, ';')
    local vocation = tonumber(data[1])
    local playerName = data[2]
    local color = data[3]

    playerTitles[playerName] = { vocation = vocation, color = color }

    applyTitlesToVisiblePlayers()
  end
end

function applyTitlesToVisiblePlayers()
  local visiblePlayers = getVisiblePlayersOnScreen()
  for _, player in ipairs(visiblePlayers) do
    local name = player:getName()
    if playerTitles[name] then
      local info = playerTitles[name]
      if info.vocation and vocations[info.vocation] then
        local color = info.color
        if color == nil or color == "" then
          color = vocations[info.vocation].color or "#FF0000"
        end
        player:setName(name .. " [" .. vocations[info.vocation].name .. "]", color)
      else
        player:setName(name, "#FF0000") -- Nome padrão em vermelho
      end
    end
  end
end

function updateTitle(creature)
  local name = creature:getName()
  local player = g_game.getLocalPlayer()
  local vocation = player:getVocation()
  if not player then
    return
  end
  if vocations[vocation] then
    creature:setName(name .. " [" .. vocations[vocation].name .. "]", vocations[vocation].color)
  elseif monsterTitles[name] then
    creature:setTitle(monsterTitles[name].title, titleFont, monsterTitles[name].color)
  elseif creature:isPlayer() and playerTitles[name] then
    creature:setTitle(playerTitles[name].title, titleFont, playerTitles[name].color)
  elseif not creature:isPlayer() and npcTitles[name] then
    creature:setTitle(npcTitles[name].title, titleFont, npcTitles[name].color)
  end
end

-- function init()
--   connect(Creature, {
--     onAppear = updateTitle,
--   })
-- end

-- function terminate()
--   disconnect(Creature, {
--     onAppear = updateTitle,
--   })
-- end

-- function updateTitle(creature)
--   local name = creature:getName()

--   if creature:isPlayer() then
--     if playerTitles[name] then
--       creature:setTitle(playerTitles[name].title, titleFont, playerTitles[name].color)
--     end
--   elseif creature:isNpc() then
--     if npcTitles[name] then
--       creature:setTitle(npcTitles[name].title, titleFont, npcTitles[name].color)
--     end
--   else -- assume it's a monster
--     if monsterTitles[name] then
--       creature:setTitle(monsterTitles[name].title, titleFont, monsterTitles[name].color)
--     end
--   end
-- end
