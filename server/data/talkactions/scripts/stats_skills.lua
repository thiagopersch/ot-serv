if not ServerConfigLib then dofile("data/lib/server_config_lib.lua") end

function onSay(cid, words, param, channel)
    local dodge = math.max(0, getPlayerStorageValue(cid, 48700))
    local crit = math.max(0, getPlayerStorageValue(cid, 48701))
    local dodgeCap = ServerConfigLib.getDodgeCap()
    local criticalCap = ServerConfigLib.getCriticalCap()

    local text = "--- Character Extra Skills ---\n"
    text = text .. "Dodge: " .. dodge .. "/" .. dodgeCap .. " (" .. string.format("%.3f", dodge * (2.5 / dodgeCap)) .. "%)\n"
    text = text .. "Critical: " .. crit .. "/" .. criticalCap .. " (" .. string.format("%.3f", crit * (2.5 / criticalCap)) .. "%)\n"

    doPlayerPopupFYI(cid, text)
    return true
end
