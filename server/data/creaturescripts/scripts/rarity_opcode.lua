if not Rarity then dofile("data/lib/rarity_lib.lua") end

-- Janela CRAFT (aba de raridade) do cliente
-- client -> server: {"action":"open"} | {"action":"refresh"} | {"action":"evolve","ref":"3:0","id":1234,"guaranteed":true}
function onExtendedOpcode(cid, opcode, buffer)
    if opcode ~= Rarity.OPCODE or not isPlayer(cid) then
        return true
    end

    local ok, data = pcall(json.decode, buffer)
    if not ok or type(data) ~= "table" then
        return true
    end

    if data.action == "open" then
        Rarity.sendOpen(cid)
    elseif data.action == "refresh" then
        Rarity.sendState(cid)
    elseif data.action == "evolve" then
        Rarity.evolve(cid, data.ref, tonumber(data.id), data.guaranteed == true)
    end
    return true
end
