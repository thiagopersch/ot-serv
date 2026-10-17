function onSay(cid, words, param)
    if getBooleanFromString(getConfigInfo('bankSystem')) == TRUE then
        if (param == "") then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "Command requires param.")
            return TRUE
        end

        local m = tonumber(param)
        if (not m) then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "Command requires numeric param.")
            return TRUE
        end

        m = math.abs(m)

        if m <= getPlayerMoney(cid) then
            doPlayerDepositMoney(cid, m)
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
                "Okay, you have added the amount of " ..
                m .. " gold in your account. Your current account balance is " .. getPlayerBalance(cid) .. ".")
        else
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "You do not have enough money.")
        end
        return TRUE
    else
        return FALSE
    end
end
