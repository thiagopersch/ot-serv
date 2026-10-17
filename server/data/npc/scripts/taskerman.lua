local keywordHandler = KeywordHandler:new()
local npcHandler = NpcHandler:new(keywordHandler)
NpcSystem.parseParameters(npcHandler)

function onCreatureAppear(cid) npcHandler:onCreatureAppear(cid) end
function onCreatureDisappear(cid) npcHandler:onCreatureDisappear(cid) end
function onCreatureSay(cid, type, msg) npcHandler:onCreatureSay(cid, type, msg) end
function onThink() npcHandler:onThink() end

npcHandler:setMessage(MESSAGE_GREET, "Hello |PLAYERNAME|! Want to check the {tasks}? Need to {deliver} a completed task? Or want to see your {rank}? Maybe a {daily} mission?")
npcHandler:setMessage(MESSAGE_FAREWELL, "Farewell!")
npcHandler:addModule(FocusModule:new())
