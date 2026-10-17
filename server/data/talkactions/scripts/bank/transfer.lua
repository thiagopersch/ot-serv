function onSay(cid, words, param)
    if getBooleanFromString(getConfigInfo('bankSystem')) == TRUE then
        if (param == "") then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "Command requires param.")
            return TRUE
        end

        local t = string.explode(param, ",")
        local name = t[1]
        local amount = t[2]

        if not name or not amount then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "Invalid format. Use: !transfer name,amount")
            return TRUE
        end

        local m = tonumber(amount)

        if (not m) then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "No money specified.")
            return TRUE
        end

        m = math.abs(m)

        if m <= getPlayerBalance(cid) then
            if playerExists(name) then
                doPlayerTransferMoneyTo(cid, name, m)
                doPlayerSave(cid, true)
                doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
                    "You have transferred " ..
                    m .. " gold to " .. name .. ". Your account balance is " .. getPlayerBalance(cid) .. " gold.")
            else
                doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, "Player " .. name .. " does not exist.")
            end
        else
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
                "There is not enough gold on your account. Your account balance is " ..
                getPlayerBalance(cid) .. ". Please tell the amount of gold coins you would like to transfer.")
        end
        return TRUE
    else
        return FALSE
    end
end
