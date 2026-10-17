function onSay(cid, words, param)
    if getBooleanFromString(getConfigInfo('bankSystem')) == TRUE then
        if (param == "") then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "Command requires param.")
            return TRUE
        end
        local name = param:trim()
        if playerExists(name) then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
                "You have transferred " .. getPlayerBalance(cid) .. " gold to " .. name .. ".")
            doPlayerTransferAllMoneyTo(cid, name)
            doPlayerSave(cid, true)
        else
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "Player " .. name .. " does not exist.")
            return TRUE
        end
    else
        return FALSE
    end
end
