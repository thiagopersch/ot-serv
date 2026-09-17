VOCATION_OPCODE = 5

local playerTitles = {
  ["God"] = { title = "[ADMINISTRADOR]", color = "#DC143C" },
}

local npcTitles = {
  ["Afonso"] = { title = "[BAKCPACK]", color = "#DAA520" },
  ["Dagze"] = { title = "[POTIONS / SENZU]", color = "#DAA520" },
  ["Dobao"] = { title = "[RINGS]", color = "#DAA520" },
  ["Gidan"] = { title = "[FIGURIES / DOLLS ]", color = "#DAA520" },
  ["Gukoa"] = { title = "[LEGS]", color = "#DAA520" },
  ["Hawk"] = { title = "[FOODS]", color = "#DAA520" },
  ["Kayfas"] = { title = "[WEAPONS]", color = "#DAA520" },
  ["Lucius Corvinus"] = { title = "[SHIELDS]", color = "#DAA520" },
  ["Merlin"] = { title = "[BOOTS]", color = "#DAA520" },
  ["Razo"] = { title = "[HELMETS]", color = "#DAA520" },
  ["Rivertall"] = { title = "[UTILS]", color = "#DAA520" },
  ["Taskerman"] = { title = "[MISSIONS]", color = "#DAA520" },
  ["Samanta"] = { title = "[ARMORS]", color = "#DAA520" },
  ["Waylon"] = { title = "[TRAVEL]", color = "#DAA520" },
  ["Zaratustra"] = { title = "[PROFETA VIAJANTE]", color = "#DAA520" },
  ["Zoruta"] = { title = "[AMULETS]", color = "#DAA520" },
}

local vocations = {
  [1] = { name = "Bardock", color = "#FFD700" },
  [2] = { name = "Bills", color = "#FFD700" },
  [3] = { name = "Botamo", color = "#FFD700" },
  [4] = { name = "Brolly", color = "#FFD700" },
  [5] = { name = "Bulma", color = "#FFD700" },
  [6] = { name = "Buu", color = "#FFD700" },
  [7] = { name = "C8", color = "#FFD700" },
  [8] = { name = "C17", color = "#FFD700" },
  [9] = { name = "C18", color = "#FFD700" },
  [10] = { name = "Cabba", color = "#FFD700" },
  [11] = { name = "Cell", color = "#FFD700" },
  [12] = { name = "Cooler", color = "#FFD700" },
  [13] = { name = "Dende", color = "#FFD700" },
  [14] = { name = "Freeza", color = "#FFD700" },
  [15] = { name = "Ginn", color = "#FFD700" },
  [16] = { name = "Gohan", color = "#FFD700" },
  [17] = { name = "Goku", color = "#FFD700" },
  [18] = { name = "Goku Black", color = "#FFD700" },
  [19] = { name = "Hitto", color = "#FFD700" },
  [20] = { name = "Janemba", color = "#FFD700" },
  [21] = { name = "Jiren", color = "#FFD700" },
  [22] = { name = "Kagome", color = "#FFD700" },
  [23] = { name = "Kaio", color = "#FFD700" },
  [24] = { name = "Kame", color = "#FFD700" },
  [25] = { name = "King Cold", color = "#FFD700" },
  [26] = { name = "King Vegeta", color = "#FFD700" },
  [27] = { name = "Kuririn", color = "#FFD700" },
  [28] = { name = "Liquir", color = "#FFD700" },
  [29] = { name = "Pan", color = "#FFD700" },
  [30] = { name = "Piccolo", color = "#FFD700" },
  [31] = { name = "Quitela", color = "#FFD700" },
  [32] = { name = "Raditz", color = "#FFD700" },
  [33] = { name = "Shenron", color = "#FFD700" },
  [34] = { name = "Tapion", color = "#FFD700" },
  [35] = { name = "Trunks", color = "#FFD700" },
  [36] = { name = "Tsuful", color = "#FFD700" },
  [37] = { name = "Turles", color = "#FFD700" },
  [38] = { name = "Uub", color = "#FFD700" },
  [39] = { name = "Vados", color = "#FFD700" },
  [40] = { name = "Vegeta", color = "#FFD700" },
  [41] = { name = "Vegetto", color = "#FFD700" },
  [42] = { name = "Vermouth", color = "#FFD700" },
  [43] = { name = "Videl", color = "#FFD700" },
  [44] = { name = "Zaiko", color = "#FFD700" },
  [45] = { name = "Zeno", color = "#FFD700" },
  [47] = { name = "Aizen", color = "#FFD700" },
  [48] = { name = "Byakuya", color = "#FFD700" },
  [49] = { name = "Gin", color = "#FFD700" },
  [50] = { name = "Grimmjow", color = "#FFD700" },
  [51] = { name = "Hitsugaya", color = "#FFD700" },
  [52] = { name = "Ichigo FullBring", color = "#FFD700" },
  [53] = { name = "Ichigo", color = "#FFD700" },
  [54] = { name = "Ishida", color = "#FFD700" },
  [55] = { name = "Kyouraku", color = "#FFD700" },
  [56] = { name = "Neliel", color = "#FFD700" },
  [57] = { name = "Orihime", color = "#FFD700" },
  [58] = { name = "Renji", color = "#FFD700" },
  [59] = { name = "Rukia", color = "#FFD700" },
  [60] = { name = "Sado", color = "#FFD700" },
  [61] = { name = "Shinji", color = "#FFD700" },
  [62] = { name = "Soi Fong", color = "#FFD700" },
  [63] = { name = "Tousen", color = "#FFD700" },
  [64] = { name = "Ulquiorra", color = "#FFD700" },
  [65] = { name = "Urahara", color = "#FFD700" },
  [66] = { name = "Yoruichi", color = "#FFD700" },
  [67] = { name = "Zaraki", color = "#FFD700" },
}

local monsterTitles = {
  ["Training Monk"] = { title = "[TREINADOR]", color = "#DC143C" },
  ["Mama Bird"] = { title = "[BOSS]", color = "#DC143C" },
  ["Fire Elemental Supremo"] = { title = "[BOSS]", color = "#DC143C" },
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
  local data = string.split(buffer, ';')
  local vocation = tonumber(data[1])
  local playerName = data[2]
  local color = data[3]

  playerTitles[playerName] = { vocation = vocation, color = color }


  applyTitlesToVisiblePlayers()
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
        g_logger.info(player:setName(name .. " [" .. vocations[info.vocation].name .. "]", color))
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
  if not player then return end
  local vocation = player:getVocation()

  if creature == player then
    if vocations[vocation] then
      creature:setName(vocations[vocation].name .. '\n' .. name, vocations[vocation].color)
    else
      creature:setName(name, '#FFD700')
    end
  elseif vocations[vocation] then
    creature:setName(name .. " [" .. vocations[vocation].name .. "]", vocations[vocation].color)
  elseif monsterTitles[name] then
    creature:setTitle(monsterTitles[name].title, titleFont, monsterTitles[name].color)
  elseif creature:isPlayer() and playerTitles[name] then
    creature:setTitle(playerTitles[name].title, titleFont, playerTitles[name].color)
  elseif not creature:isPlayer() and npcTitles[name] then
    creature:setTitle(npcTitles[name].title, titleFont, npcTitles[name].color)
  end
end
