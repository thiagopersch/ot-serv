dofile("data/lib/tasks/task_storage.lua")

function onLogout(cid)
    TaskStorage_savePlayer(cid)
    TaskCache_clearPlayerCache(cid)
    return true
end
