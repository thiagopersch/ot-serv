function onSay(player, words, param)
  local skill = getPlayerOnlineTime(player)
  local message =
      "-------------[+]------- [Online Bonus System] -------[+]-------------\n\n" ..
      "Ganhe um online token a cada hora que você passa online sem deslogar.\n\n" ..
      "Total Online Tokens: " .. skill .. "\n\n"
  doPlayerPopupFYI(player, message)
end
