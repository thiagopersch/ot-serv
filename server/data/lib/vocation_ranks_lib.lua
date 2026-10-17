-- ============================================================
-- vocation_upgraded_lib.lua
-- Main logic for Vocation Upgraded System (TFS 0.4)
-- ============================================================

if not VocationRankConfig then dofile("data/lib/vocation_ranks_config.lua") end

VOCATION_RANK_OPCODE = 235
VocationRankLib      = {}

function VocationRankLib.getPlayerVocationRank(cid, vocationId)
  local guid = getPlayerGUID(cid)
  if not guid then return { rank = 0, stars = 0, totalStars = 0 } end

  local query = db.getResult(
    "SELECT `rank`, `stars`, `total_stars` FROM `player_vocation_ranks`" ..
    " WHERE `player_id` = " .. guid ..
    " AND `vocation_id` = " .. vocationId
  )

  if query:getID() ~= -1 then
    local data = {
      rank       = query:getDataInt("rank"),
      stars      = query:getDataInt("stars"),
      totalStars = query:getDataInt("total_stars")
    }
    query:free()
    return data
  end

  db.query(
    "INSERT INTO `player_vocation_ranks`" ..
    " (`player_id`, `vocation_id`, `rank`, `stars`, `total_stars`)" ..
    " VALUES (" .. guid .. ", " .. vocationId .. ", 0, 0, 0)"
  )
  return { rank = 0, stars = 0, totalStars = 0 }
end

-- Every vocation gets the same bonus per star: +2% damage, +5000 max HP, +5000 max mana.
function VocationRankLib.applyStats(cid, vocationId, totalStars)
  local config = VocationRankConfig.Vocations[vocationId]
  if not config then return end

  if doPlayerSetVocationRankDamageBonus then
    doPlayerSetVocationRankDamageBonus(cid, totalStars * VocationRankConfig.DamagePerStar)
  end

  if totalStars == 0 then return end

  local condition = createConditionObject(CONDITION_ATTRIBUTES)
  setConditionParam(condition, CONDITION_PARAM_TICKS, -1)
  setConditionParam(condition, CONDITION_PARAM_SUBID, 12345)
  setConditionParam(condition, CONDITION_PARAM_STAT_MAXHITPOINTS, totalStars * VocationRankConfig.HealthPerStar)
  setConditionParam(condition, CONDITION_PARAM_STAT_MAXMANAPOINTS, totalStars * VocationRankConfig.ManaPerStar)
  doAddCondition(cid, condition)
end

function sendRankDataToClient(cid)
  if not isPlayer(cid) then return end

  local vocationId = getPlayerVocation(cid)
  local config = VocationRankConfig.Vocations[vocationId]
  if not config then return end

  local rankData = VocationRankLib.getPlayerVocationRank(cid, vocationId)
  
  -- Sum all universal fragments
  local univCount = 0
  for _, itemId in ipairs(VocationRankConfig.UniversalFragmentItemIds) do
    univCount = univCount + getPlayerItemCount(cid, itemId)
  end
  
  local specCount = getPlayerItemCount(cid, config.specificFragmentItemId)

  -- Cost of the NEXT star: star (stars+1) within the current rank costs (stars+1) * FragmentsPerStar.
  -- Once stars == StarsPerRank, the next action promotes to the next rank instead of buying a star
  -- (see VocationRankLib.doUpgrade) — cost stays pinned at the 5th-star price for that action.
  local costAmount = math.min(rankData.stars + 1, VocationRankConfig.StarsPerRank) * VocationRankConfig.FragmentsPerStar

  local vocName = getVocationInfo(vocationId).name or "None"
  local playerName = getCreatureName(cid)

  -- Protocol version 2: Added per-star bonuses
  local buffer = table.concat({
    "2", -- Protocol version
    rankData.rank, rankData.stars, rankData.totalStars,
    univCount, costAmount, specCount, costAmount,
    VocationRankConfig.HealthPerStar, VocationRankConfig.ManaPerStar, VocationRankConfig.DamagePerStar, 0, 0,
    vocName, playerName
  }, "|")

  if doSendPlayerExtendedOpcode then
    doSendPlayerExtendedOpcode(cid, VOCATION_RANK_OPCODE, buffer)
  elseif doPlayerSendExtendedOpcode then
    doPlayerSendExtendedOpcode(cid, VOCATION_RANK_OPCODE, buffer)
  end
  
  -- Also update the stars for everyone else
  broadcastPlayerRankData(cid)
end

-- Função para remover fragmentos universais (consome o primeiro que encontrar com quantidade)
function VocationRankLib.removeUniversalFragments(cid, amount)
  local remaining = amount
  for _, itemId in ipairs(VocationRankConfig.UniversalFragmentItemIds) do
    local count = getPlayerItemCount(cid, itemId)
    if count > 0 then
      local toRemove = math.min(count, remaining)
      if doPlayerRemoveItem(cid, itemId, toRemove) then
        remaining = remaining - toRemove
      end
    end
    if remaining <= 0 then break end
  end
  return remaining <= 0
end

-- Função Consertada: Consumo de itens e upgrade real
function VocationRankLib.doUpgrade(cid, source)
  local vocationId = getPlayerVocation(cid)
  local config = VocationRankConfig.Vocations[vocationId]
  if not config then return false end

  local rankData = VocationRankLib.getPlayerVocationRank(cid, vocationId)
  
  -- Check if maxed out (Max Rank + 5 stars)
  if rankData.rank >= config.maxRank and rankData.stars >= VocationRankConfig.StarsPerRank then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "You have already reached the maximum rank for this vocation.")
    return false
  end

  -- Rank already sitting at 5/5 stars: this call promotes to the next rank instead of buying
  -- a star (reaching star 5 must be its own visible/persisted state — see bug report where
  -- promoting in the same call as buying the 5th star skipped straight past it).
  if rankData.stars >= VocationRankConfig.StarsPerRank then
    rankData.rank = rankData.rank + 1
    rankData.stars = 0

    local guid = getPlayerGUID(cid)
    db.query("UPDATE `player_vocation_ranks` SET `rank` = " ..
    rankData.rank ..
    ", `stars` = " ..
    rankData.stars ..
    ", `total_stars` = " ..
    rankData.totalStars .. " WHERE `player_id` = " .. guid .. " AND `vocation_id` = " .. vocationId)

    VocationRankLib.applyStats(cid, vocationId, rankData.totalStars)
    sendRankDataToClient(cid)
    doSendMagicEffect(getCreaturePosition(cid), 29)
    doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "Rank promoted!")
    return true
  end

  -- Star (stars+1) within the current rank costs (stars+1) * FragmentsPerStar (50, 100, 150, 200, 250)
  local costAmount = (rankData.stars + 1) * VocationRankConfig.FragmentsPerStar

  local success = false
  if source == "universal" then
    success = VocationRankLib.removeUniversalFragments(cid, costAmount)
  elseif source == "specific" then
    success = doPlayerRemoveItem(cid, config.specificFragmentItemId, costAmount)
  end

  if success then
    rankData.stars = rankData.stars + 1
    rankData.totalStars = rankData.totalStars + 1

    -- Salva no banco de dados
    local guid = getPlayerGUID(cid)
    db.query("UPDATE `player_vocation_ranks` SET `rank` = " ..
    rankData.rank ..
    ", `stars` = " ..
    rankData.stars ..
    ", `total_stars` = " ..
    rankData.totalStars .. " WHERE `player_id` = " .. guid .. " AND `vocation_id` = " .. vocationId)

    VocationRankLib.applyStats(cid, vocationId, rankData.totalStars)
    sendRankDataToClient(cid)
    doSendMagicEffect(getCreaturePosition(cid), 29) -- Efeito visual
    doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "Vocation upgraded successfully!")
    return true
  else
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "You do not have enough fragments for the upgrade.")
    return false
  end
end

function broadcastPlayerRankData(cid)
  if not isPlayer(cid) then return end
  
  local vocationId = getPlayerVocation(cid)
  local rankData = VocationRankLib.getPlayerVocationRank(cid, vocationId)
  
  -- Buffer for overhead stars: "3|creatureId|rank|stars"
  local buffer = "3|" .. cid .. "|" .. rankData.rank .. "|" .. rankData.stars
  
  local spectators = getSpectators(getCreaturePosition(cid), 10, 10, false)
  if spectators then
    for _, spectator in ipairs(spectators) do
      if isPlayer(spectator) then
        if doSendPlayerExtendedOpcode then
          doSendPlayerExtendedOpcode(spectator, VOCATION_RANK_OPCODE, buffer)
        elseif doPlayerSendExtendedOpcode then
          doPlayerSendExtendedOpcode(spectator, VOCATION_RANK_OPCODE, buffer)
        end
      end
    end
  end
end

