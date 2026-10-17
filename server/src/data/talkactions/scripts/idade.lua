local STORAGE_AGE = 1000
local STORAGE_MINUTES = 1001

local function getTitleByAge(age)
    if age <= 2 then
        return "Baby"
    elseif age <= 10 then
        return "Child"
    elseif age <= 17 then
        return "Teenager"
    elseif age <= 30 then
        return "Young"
    elseif age <= 60 then
        return "Adult"
    elseif age <= 100 then
        return "Veteran"
    elseif age <= 150 then
        return "Elder"
    else
        return "Legendary"
    end
end

function onSay(cid, words, param)
    local age = getPlayerStorageValue(cid, STORAGE_AGE)
    local minutes = getPlayerStorageValue(cid, STORAGE_MINUTES)

    if age < 0 then
        age = 0
        setPlayerStorageValue(cid, STORAGE_AGE, 0)
    end
    if minutes < 0 then
        minutes = 0
        setPlayerStorageValue(cid, STORAGE_MINUTES, 0)
    end

    local title = getTitleByAge(age)
    local accountType = isPremium(cid) and "VIP" or "Free"
    local nextAge = 60 - minutes

    local message = "=== PERFIL ===\n"
    message = message .. "Idade: " .. age .. " anos (" .. title .. ")\n"
    message = message .. "Tipo de conta: " .. accountType .. "\n"
    message = message .. "Tempo para próxima idade: " .. nextAge .. " minutos"

    doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, message)
    return true
end
