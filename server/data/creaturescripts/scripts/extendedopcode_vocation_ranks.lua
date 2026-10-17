-- ============================================================
-- extendedopcode_vocation_upgraded.lua
-- Handles opcode 235 messages from clients (TFS 0.4)
-- ============================================================

dofile("data/lib/vocation_ranks_lib.lua")

function onExtendedOpcode(cid, opcode, buffer)
  if opcode ~= VOCATION_RANK_OPCODE then return false end
  if not isPlayer(cid) then return false end

  if buffer == "request" then
    sendRankDataToClient(cid)
  elseif buffer:sub(1, 7) == "upgrade" then
    local parts  = string.explode(buffer, "|")
    local source = parts[2] or "auto"
    VocationRankLib.doUpgrade(cid, source)
  end

  return true
end
