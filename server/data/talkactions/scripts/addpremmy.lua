function onSay(cid, words, param)
  local t = string.explode(string.lower(param), ",")
  local call, name, day = t[1], t[2], t[3]
  local player, keys = getPlayerByName(name), { "add", "remove", "check" }
  if not isInArray(keys, call) or param == '' or name == nil then
    return doPlayerPopupFYI(cid,
      "Está com problemas?\nAprenda os comandos!\n---------------\nAdicionar premium:\n/pa " ..
      keys[1] ..
      ", player, days\n/pa " ..
      keys[1] ..
      ", Wakon, 30\n---------------\nRemover premium:\n/pa " ..
      keys[2] ..
      ", player, days\n/pa " ..
      keys[2] ..
      ", Wakon, 30\n---------------\nVer Premium:\n/pa " .. keys[3] .. ", player\n/pa check, Wakon\n---------------")
  elseif not isPlayer(player) then
    return doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, 'O jogador não está online ou não existe.')
  end

  if call == keys[1] then
    doPlayerAddPremiumDays(player, day)
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
      'Foram adicionados ' .. day .. ' dias de premium ao jogador ' .. name .. '.')
    doPlayerSendTextMessage(player, MESSAGE_EVENT_ADVANCE,
      'Você recebeu ' .. day .. ' premium days de um membro da equipe.')
  elseif call == keys[2] then
    if getPlayerPremiumDays(player) > 0 then
      doPlayerRemovePremiumDays(player, day)
      doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
        'Foram removidos ' .. day .. ' dias de premium do jogador ' .. name .. '.')
    else
      doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, 'Esse jogador não possui nenhum dia de premium.')
    end
  elseif call == keys[3] then
    if isPremium(player) then
      doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
        'O jogador ' .. name .. ' tem ' .. getPlayerPremiumDays(player) .. ' dias de premium.')
    else
      doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, 'O jogador ' .. name .. ' é free account.')
    end
  end
  return true
end
