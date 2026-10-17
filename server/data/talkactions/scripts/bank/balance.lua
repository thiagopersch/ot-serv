function onSay(cid, words, param)
    if getBooleanFromString(getConfigInfo('bankSystem')) == TRUE then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
            "Your account balance is " .. getPlayerBalance(cid) .. " gps.")
        return TRUE
    else
        return FALSE
    end
end
