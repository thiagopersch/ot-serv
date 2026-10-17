dofile("data/lib/tasks/task_storage.lua")

function onLogin(cid)
    registerCreatureEvent(cid, "TaskKill")
    registerCreatureEvent(cid, "TaskOpcode")
    registerCreatureEvent(cid, "TaskLogout")

    TaskStorage_loadPlayer(cid)

    return true
end
