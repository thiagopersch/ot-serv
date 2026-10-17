dofile("data/lib/bestiary_lib.lua")

function onExtendedOpcode(cid, opcode, buffer)
    if not isPlayer(cid) then
        return false
    end

    if opcode ~= 250 then
        return false
    end

    if buffer == "request" then
        if not Bestiary_debounce(cid) then
            return true
        end
        Bestiary_sendToPlayer(cid)
    end

    return true
end
