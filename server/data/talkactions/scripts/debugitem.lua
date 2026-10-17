function onSay(cid, words, param, channel)
    local player = g_game.getPlayer(cid)
    if not player then return false end
    
    -- Create 5000 gold coins
    local item = doCreateItemEx(2148, 5000)
    if item then
        local ret = doPlayerAddItemEx(cid, item, true)
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Item created: " .. tostring(ret) .. " - Count: " .. getItemCount(item))
    else
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_RED, "Failed to create item")
    end
    
    return false
end
