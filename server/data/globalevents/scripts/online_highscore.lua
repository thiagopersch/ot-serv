function onThink(interval, lastExecution)
  local players = getPlayersOnline()

  local playerData = {}
  for _, cid in ipairs(players) do
    table.insert(playerData, {
      cid = cid,
      name = getCreatureName(cid),
      level = getPlayerLevel(cid),
      experience = getPlayerExperience(cid)
    })
  end

  table.sort(playerData, function(a, b) return a.experience > b.experience end)

  local msg = "~ TOP 5 players online ~"
  for i = 1, math.min(5, #playerData) do
    msg = msg .. "\n" .. i .. ". " .. playerData[i].name .. "  [Lv: " .. playerData[i].level .. "]"
  end

  local formattedMsg = "top|" .. TEXTCOLOR_TEAL .. msg

  doBroadcastMessage(formattedMsg)
  return true
end
