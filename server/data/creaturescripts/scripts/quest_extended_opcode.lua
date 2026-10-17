if not json then json = dofile("data/lib/json.lua") end
dofile("data/lib/quest_system_lib.lua")

-- Espelha data/creaturescripts/scripts/task_extended_opcode.lua: cliente pede a lista de
-- quests via sendExtendedOpcode(135, ...) em vez da talkaction legada "!sendquestlog"
-- (que continua funcionando, ambos chamam sendQuestLog).
function onExtendedOpcode(cid, opcode, buffer)
    if opcode ~= 135 then return false end
    if not isPlayer(cid) then return false end

    sendQuestLog(cid)
    return true
end
