function onSay(cid, words, param)
  -- apenas staff (access > 0)
  if getPlayerAccess(cid) == 5 then
    return TRUE
  end

  local t = string.explode(param, ",")
  if #t ~= 2 then
    doPlayerSendCancel(cid, "Insufficient parameters.")
    return FALSE
  end

  local item = tonumber(t[1])
  local count = tonumber(t[2])

  if not item or not count then
    doPlayerSendCancel(cid, "Invalid parameters.")
    return FALSE
  end

  local players = getPlayersOnline()
  for i = 1, #players do
    doPlayerAddItem(players[i], item, count)
  end

  local itemName = getItemNameById(item)

  doBroadcastMessage("The staff just sent " .. count .. " " .. itemName .. " to all online players!", "warning", "top")

  return FALSE
end
