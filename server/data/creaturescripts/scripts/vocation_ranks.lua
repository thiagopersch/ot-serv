dofile("data/lib/vocation_ranks_lib.lua")

function syncNearby(cid)
  if not isPlayer(cid) then return end
  broadcastPlayerRankData(cid)
  addEvent(syncNearby, 10000, cid) -- Resync every 10s to ensure visibility for new arrivals
end

function onLogin(cid)
  -- 1. Envia os dados completos do rank para o próprio jogador (atualiza a UI dele)
  sendRankDataToClient(cid)

  -- 2. Envia os dados básicos de rank para os outros jogadores (para verem as estrelas dele)
  broadcastPlayerRankData(cid)

  -- 3. Aplica os status bônus permanentes baseados no total de estrelas
  local vocationId = getPlayerVocation(cid)
  local rankData = VocationRankLib.getPlayerVocationRank(cid, vocationId)
  if rankData.totalStars > 0 then
    VocationRankLib.applyStats(cid, vocationId, rankData.totalStars)
  end

  -- 4. Inicia o loop de sincronização periódica
  syncNearby(cid)

  return true
end
