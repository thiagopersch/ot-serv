local STORAGE_KEY = 50001

function onSay(cid, words, param)
  local player = cid
  local vocId = tonumber(param)
  if not vocId then
    return false
  end

  local unlockedStr = getPlayerStorageValue(player, STORAGE_KEY)
  if not unlockedStr or unlockedStr == "" or unlockedStr == "-1" then
    return false
  end

  local hasVoc = false
  for id in string.gmatch(unlockedStr, "[^,]+") do
    if tonumber(id) == vocId then
      hasVoc = true
      break
    end
  end

  if not hasVoc or getPlayerVocation(player) == vocId then
    return false
  end

  doPlayerSetVocation(player, vocId)
  doPlayerSendTextMessage(player, MESSAGE_INFO_DESCR, "Vocation changed to " .. getVocationName(vocId) .. "!")
  doSendMagicEffect(getCreaturePosition(player), CONST_ME_MAGIC_BLUE)

  return false
end
