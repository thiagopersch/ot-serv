function onSay(cid, words, param)
  if words == "!sendquestlog" then
    dofile("data/lib/quest_system_lib.lua")
    sendQuestLog(cid)
    return true
  elseif words == "!closequestlog" then
    return true
  end
  return false
end
