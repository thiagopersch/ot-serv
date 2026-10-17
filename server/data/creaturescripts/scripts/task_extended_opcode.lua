if not json then json = dofile("data/lib/json.lua") end
dofile("data/lib/tasks/task_db_loader.lua")
dofile("data/talkactions/scripts/tasks.lua")
dofile("data/lib/tasks/task_network.lua")

TASK_LAST_SEND = {}

function TaskOpcode_debounce(cid)
    local now = os.time()
    local last = TASK_LAST_SEND[cid] or 0
    if now - last < 2 then
        return false
    end
    TASK_LAST_SEND[cid] = now
    return true
end

function onExtendedOpcode(cid, opcode, buffer)
    if not isPlayer(cid) then
        return false
    end

    if opcode == 201 or opcode == 240 or opcode == 125 or opcode == 235 then
        if not TaskOpcode_debounce(cid) then return true end
        TaskNetwork_sendTaskList(cid)
        return true
    end

    if opcode ~= TASK_OPCODE then
        return false
    end

    local success, data = pcall(json.decode, buffer)
    if not success or not data then
        if not TaskOpcode_debounce(cid) then return true end
        TaskNetwork_sendTaskList(cid)
        return true
    end


    TaskNetwork_handleAction(cid, data)

    return true
end
