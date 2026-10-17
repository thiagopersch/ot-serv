if not json then json = dofile("data/lib/json.lua") end

local HIGH_OPCODE = 73

local highscoreCategories = {
  [0] = { name = "Level", type = "player", column = "level", expr = "experience" },
  [1] = { name = "Magic Level", type = "player", column = "maglevel", expr = "maglevel" },
  [2] = { name = "Fist Fighting", type = "skill", skillid = 0 },
  [3] = { name = "Club Fighting", type = "skill", skillid = 1 },
  [4] = { name = "Sword Fighting", type = "skill", skillid = 2 },
  [5] = { name = "Axe Fighting", type = "skill", skillid = 3 },
  [6] = { name = "Distance Fighting", type = "skill", skillid = 4 },
  [7] = { name = "Shielding", type = "skill", skillid = 5 },
}

function onLogin(cid)
  registerCreatureEvent(cid, "HighscoreOpcode")
  return true
end

function onExtendedOpcode(cid, opcode, buffer)
  if opcode ~= HIGH_OPCODE then return false end
  local req = nil
  if type(json) == "table" and json.decode then
    local success, data = pcall(json.decode, buffer)
    if success then req = data end
  end
  if not req or type(req) ~= "table" then
    doPlayerSendCancel(cid, "Invalid request.")
    return true
  end
  if req.action == "request" then sendHighscore(cid, req) end
  return true
end

function sendHighscore(cid, req)
  local category = tonumber(req.category) or 0
  local def = highscoreCategories[category]
  if not def then
    sendHighscoreResponse(cid, category, 1, 1, {})
    return
  end

  local page = tonumber(req.page) or 1
  local perPage = tonumber(req.entriesPerPage) or 10
  local ownOnly = tonumber(req.type) or 0
  perPage = math.min(50, math.max(1, perPage))
  if page < 1 then page = 1 end

  local vocations = req.vocations or { 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 }
  local vocColumn = (def.type == "skill" and "players.vocation") or "vocation"
  local vocWhere = ""
  if vocations and #vocations > 0 and not (vocations[1] == 0) then
    vocWhere = " AND ("
    for i, voc in ipairs(vocations) do
      vocWhere = vocWhere .. vocColumn .. "=" .. tonumber(voc)
      if i < #vocations then vocWhere = vocWhere .. " OR " end
    end
    vocWhere = vocWhere .. ")"
  end

  local playerName = getPlayerName(cid)
  local ownWhere = (ownOnly == 1) and (" AND `name`=" .. db.escapeString(playerName)) or ""
  -- Mesma regra do site (/community/ranking): so jogadores normais/tutores (group_id 1/2).
  -- O Account Manager tem group_id=1 (mesmo dos jogadores normais), entao precisa ser
  -- excluido explicitamente pelo nome, ja que o group_id sozinho nao o filtra.
  local groupWhere = " AND `group_id` IN (1, 2) AND `name` != 'Account Manager'"
  local data, total, pages = {}, 0, 1

  -- Ranking por player stats
  if def.type == "player" then
    local orderBy = "ORDER BY `" .. def.column .. "` DESC, `experience` DESC"
    local countRes = db.getResult("SELECT COUNT(*) AS total FROM `players` WHERE 1=1" .. vocWhere .. ownWhere .. groupWhere .. ";")
    if countRes:getID() ~= -1 then
      total = countRes:getDataInt("total")
      countRes:free()
    end
    pages = math.max(1, math.ceil(total / perPage))
    if page > pages then page = pages end
    local offset = (page - 1) * perPage

    local sql =
        "SELECT `name`, `level`, `experience`, `maglevel`, `vocation`, `looktype`, `lookhead`, `lookbody`, `looklegs`, `lookfeet`, `lookaddons` " ..
        "FROM `players` WHERE 1=1" .. vocWhere .. ownWhere .. groupWhere .. " " .. orderBy ..
        " LIMIT " .. perPage .. " OFFSET " .. offset
    local res = db.getResult(sql)
    local rank = offset + 1
    while res:getID() ~= -1 do
      local pname = res:getDataString("name")
      local isOnline = 0
      if getPlayerByNameWildcard then
        local pid = getPlayerByNameWildcard(pname)
        if pid and isPlayer(pid) then
          isOnline = 1
        end
      end
      local expvalue = def.expr and res:getDataInt(def.expr) or res:getDataInt(def.column)
      table.insert(data, {
        rank = rank,
        name = pname,
        level = res:getDataInt("level"),
        experience = expvalue,
        vocation = res:getDataInt("vocation"),
        lookType = res:getDataInt("looktype"),
        lookHead = res:getDataInt("lookhead"),
        lookBody = res:getDataInt("lookbody"),
        lookLegs = res:getDataInt("looklegs"),
        lookFeet = res:getDataInt("lookfeet"),
        lookAddons = res:getDataInt("lookaddons"),
        wingsId = 0,
        auraId = 0,
        shaderId = 0,
        online = isOnline
      })
      rank = rank + 1
      if not res:next() then break end
    end
    if res:getID() ~= -1 then res:free() end

    -- Ranking por skills
  elseif def.type == "skill" then
    local skillid = def.skillid
    local countSql = "SELECT COUNT(*) AS total " ..
        "FROM `player_skills` INNER JOIN `players` ON `player_skills`.`player_id` = `players`.`id` " ..
        "WHERE `player_skills`.`skillid`=" .. skillid .. vocWhere .. ownWhere .. groupWhere .. ";"
    local resCount = db.getResult(countSql)
    if resCount:getID() ~= -1 then
      total = resCount:getDataInt("total")
      resCount:free()
    end
    pages = math.max(1, math.ceil(total / perPage))
    if page > pages then page = pages end
    local offset = (page - 1) * perPage

    local sql = [[SELECT players.name, players.level, players.vocation, players.looktype, players.lookhead,
            players.lookbody, players.looklegs, players.lookfeet, players.lookaddons, player_skills.value
            FROM player_skills INNER JOIN players ON player_skills.player_id=players.id
            WHERE player_skills.skillid=]] .. skillid .. vocWhere .. ownWhere .. groupWhere ..
        [[ ORDER BY player_skills.value DESC, players.level DESC
            LIMIT ]] .. perPage .. " OFFSET " .. offset .. ";"
    local res = db.getResult(sql)
    local rank = offset + 1
    while res and res:getID() ~= -1 do
      local pname = res:getDataString("name")
      local isOnline = 0
      if getPlayerByNameWildcard then
        local pid = getPlayerByNameWildcard(pname)
        if pid and isPlayer(pid) then
          isOnline = 1
        end
      end
      table.insert(data, {
        rank = rank,
        name = pname,
        level = res:getDataInt("level"),
        experience = res:getDataInt("value"),
        vocation = res:getDataInt("vocation"),
        lookType = res:getDataInt("looktype"),
        lookHead = res:getDataInt("lookhead"),
        lookBody = res:getDataInt("lookbody"),
        lookLegs = res:getDataInt("looklegs"),
        lookFeet = res:getDataInt("lookfeet"),
        lookAddons = res:getDataInt("lookaddons"),
        wingsId = 0,
        auraId = 0,
        shaderId = 0,
        online = isOnline
      })
      rank = rank + 1
      if not res:next() then break end
    end
    if res then res:free() end
  end

  sendHighscoreResponse(cid, category, page, pages, data)
end

function sendHighscoreResponse(cid, category, page, pages, data)
  local response = {
    action = "highscore",
    category = category,
    page = page,
    pages = pages,
    data = data
  }
  local resp_str = ""
  if type(json) == "table" and json.encode then
    resp_str = json.encode(response)
  end
  doPlayerSendExtendedOpcode(cid, HIGH_OPCODE, resp_str)
end
