local time = 1

function onSay(cid, words, param, channel)
    if exhaustion.check(cid, transformExhaustStorage) == TRUE then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_WARNING, "Wait 1 second before transforming again.")
        return true
    end

    local vocation = getPlayerVocation(cid)
    if not saga[vocation] then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "There is no transformation for this vocation.")
        exhaustion.set(cid, transformExhaustStorage, time)
        return true
    end

    local outfits = {}
    for i, v in ipairs(saga[vocation]) do
        if type(v) == "table" then
            outfits[i] = v
        end
    end

    if words:lower() == "!revert" or words:lower() == "!reverter" then
        local out = outfits[1]

        if getCreatureOutfit(cid).lookType == out.lookType then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_WARNING, "You are already in your base transformation!")
            exhaustion.set(cid, transformExhaustStorage, time)
            return true
        end

        local sagaData = saga[vocation]

        stopAura(cid)

        local flashEffectId = out.effect or sagaData.effect or defaultTransformEffect
        local flashPos = getTransformEffectPos(cid, sagaData, out)
        local revertOutfit = getCreatureOutfit(cid)
        revertOutfit.lookType = out.lookType
        doCreatureChangeOutfit(cid, revertOutfit)
        setPlayerStorageValue(cid, sagastor, ":" .. out.lookType .. ",:" .. vocation)
        doSendMagicEffect(flashPos, flashEffectId)
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_WARNING, "You've reverted to your base transformation!")
        doPlayerSay(cid, "Back to my original form!", TALKTYPE_ORANGE_1)

        if out.aura then
            startAura(cid, out.aura, out.auraPos)
        end

        exhaustion.set(cid, transformExhaustStorage, time)
        return true
    end

    local transformIndex
    if param == '' then
        local currentOutfit = getCreatureOutfit(cid).lookType
        local currentIndex = 0
        for i, outfit in ipairs(outfits) do
            if outfit.lookType == currentOutfit then
                currentIndex = i
                break
            end
        end

        if currentIndex == #outfits then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_WARNING, "You have reached the final transformation!")
            exhaustion.set(cid, transformExhaustStorage, time)
            return true
        end

        transformIndex = currentIndex + 1
    else
        local t = string.explode(param, ",")
        if t[2] or not tonumber(t[1]) then
            doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_RED,
                "Please use a valid transform number or no parameter.")
            exhaustion.set(cid, transformExhaustStorage, time)
            return true
        end
        transformIndex = tonumber(t[1])
    end

    if transformIndex > #outfits or transformIndex < 1 then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_RED, "This transform does not exist.")
        exhaustion.set(cid, transformExhaustStorage, time)
        return true
    end

    local requiredLevel = saga[vocation].level or 50
    local transformLevel = (transformIndex == 1) and 1 or (transformIndex - 1) * requiredLevel
    if getPlayerLevel(cid) < transformLevel then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_WARNING,
            "Sorry, you need to be level " .. transformLevel .. " for the next transformation.")
        exhaustion.set(cid, transformExhaustStorage, time)
        return true
    end

    local out = outfits[transformIndex]
    local sagaData = saga[vocation]

    local flashEffectId = out.effect or sagaData.effect or defaultTransformEffect
    local flashPos = getTransformEffectPos(cid, sagaData, out)
    local transformOutfit = getCreatureOutfit(cid)
    transformOutfit.lookType = out.lookType
    doCreatureChangeOutfit(cid, transformOutfit)
    setPlayerStorageValue(cid, sagastor, ":" .. out.lookType .. ",:" .. vocation)
    doSendMagicEffect(flashPos, flashEffectId)
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_WARNING, "You've chosen a new transform!")
    doPlayerSay(cid, "Aah, there, I'm stronger!", TALKTYPE_ORANGE_1)
    if out.aura then
        startAura(cid, out.aura, out.auraPos)
    else
        stopAura(cid)
    end

    exhaustion.set(cid, transformExhaustStorage, time)
    return true
end
