dofile("data/lib/vocation_ranks_lib.lua")

function onSay(cid, words, param)
  if not isPlayer(cid) then return true end

  local vocationId = getPlayerVocation(cid)
  local rankData = VocationRankLib.getPlayerVocationRank(cid, vocationId)
  local rankName = "None"

  if VocationRankConfig and VocationRankConfig.Ranks[rankData.rank] then
      rankName = VocationRankConfig.Ranks[rankData.rank].name
  end

  doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL,
    "Vocation: " .. getVocationInfo(vocationId).name ..
    " | Rank: " .. rankName ..
    " | Stars: " .. rankData.stars .. "/" .. VocationRankConfig.StarsPerRank ..
    " | Total Stars: " .. rankData.totalStars)
  return true
end
