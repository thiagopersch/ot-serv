if not Deathlist then dofile("data/lib/deathlist_lib.lua") end

-- Janela Deathlist do cliente (modules/game_deathlist)
-- client -> server: {"action":"self","page":1} | {"action":"search","name":"Fulano","page":1}
function onExtendedOpcode(cid, opcode, buffer)
    if opcode ~= Deathlist.OPCODE or not isPlayer(cid) then
        return true
    end

    local ok, data = pcall(json.decode, buffer)
    if not ok or type(data) ~= "table" then
        return true
    end

    if data.action == "self" then
        Deathlist.sendSelf(cid, tonumber(data.page))
    elseif data.action == "search" then
        Deathlist.sendSearch(cid, data.name, tonumber(data.page))
    end
    return true
end
