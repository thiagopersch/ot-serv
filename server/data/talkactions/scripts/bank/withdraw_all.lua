function onSay(cid, words, param)
    if getBooleanFromString(getConfigInfo('bankSystem')) == TRUE then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
            "Here you are, " .. getPlayerBalance(cid) .. " gold.")
        doPlayerWithdrawAllMoney(cid)
        return TRUE
    else
        return FALSE
    end
end
