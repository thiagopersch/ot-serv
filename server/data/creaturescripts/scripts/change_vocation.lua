-- Vocation Change Opcode Handler
dofile("data/lib/change_vocation.lua")

function onExtendedOpcode(cid, opcode, buffer)
    if opcode ~= ChangeVocation.Config.OPCODE then
        return false
    end

    ChangeVocation.handleExtendedOpcode(cid, buffer or "")
    return true
end

function onLogin(cid)
    ChangeVocation.syncPlayer(cid)
    return true
end
