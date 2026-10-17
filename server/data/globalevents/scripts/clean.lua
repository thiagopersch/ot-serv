function executeClean()
    doCleanMap()
    local msg = "..:: Game map cleaned ::..\nNext clean in 1 hour."
    local formattedText = "center|" .. TEXTCOLOR_ORANGE .. "|" .. msg
    doBroadcastMessage(formattedText)
    return true
end

function onThink(interval, lastExecution, thinkInterval)
    local msg = "..:: Game map cleaning ::..\nGame map cleaning within 1 hour, please pick up your items!"
    local formattedText = "center|" .. TEXTCOLOR_RED .. "|" .. msg
    doBroadcastMessage(formattedText)
    addEvent(executeClean, 3600000)
    return true
end
