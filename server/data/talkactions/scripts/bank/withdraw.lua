function onSay(cid, words, param)
    if getBooleanFromString(getConfigInfo('bankSystem')) == TRUE then
        local m = tonumber(param)
        if (param == "") then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "Command requires param.")
            return TRUE
        end

        if (not m) then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "Command requires numeric param.")
            return TRUE
        end

        m = math.abs(m)

        if m <= getPlayerBalance(cid) then
            doPlayerWithdrawMoney(cid, m)
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
                "Here you are, " .. m .. " gold. Your account balance is " .. getPlayerBalance(cid) .. ".")
        else
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "There is not enough gold on your account.")
        end
        return TRUE
    else
        return FALSE
    end
end
