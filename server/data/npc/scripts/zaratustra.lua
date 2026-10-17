local keywordHandler = KeywordHandler:new()
local npcHandler = NpcHandler:new(keywordHandler)
NpcSystem.parseParameters(npcHandler)

function onCreatureAppear(cid) npcHandler:onCreatureAppear(cid) end

function onCreatureDisappear(cid) npcHandler:onCreatureDisappear(cid) end

function onCreatureSay(cid, type, msg) npcHandler:onCreatureSay(cid, type, msg) end

function onThink() npcHandler:onThink() end

local travel_confirmation = {}
local centralCityPos = { x = 31951, y = 32227, z = 7 }

function onGreetCallback(cid)
    local talkUser = NPCHANDLER_CONVBEHAVIOR == CONVERSATION_DEFAULT and 0 or cid
    travel_confirmation[talkUser] = true
    return true
end

function onCreatureSayCallback(cid, type, msg)
    if not npcHandler:isFocused(cid) then
        return false
    end

    local talkUser = NPCHANDLER_CONVBEHAVIOR == CONVERSATION_DEFAULT and 0 or cid
    local message = string.lower(msg)
    local player = getPlayerName(cid)

    if message == 'yes' then
        if travel_confirmation[talkUser] then
            doPlayerSetTown(cid, 2)
            doSendMagicEffect(getCreaturePosition(cid), 240)
            doTeleportThing(cid, centralCityPos, true)
            doSendMagicEffect(centralCityPos, 240)
            doPlayerSave(cid, true)
            local formattedText = "center|" ..
                TEXTCOLOR_GREEN .. "|" .. 'Welcome to Central City, ' .. player .. '! May your journey be glorious!'
            doBroadcastMessage(formattedText)
            travel_confirmation[talkUser] = nil
        end
        return true
    end

    if message == 'no' then
        selfSay('Very well, ' .. player .. '. When you are ready, come back to me. Safe travels!', cid)
        travel_confirmation[talkUser] = nil
        return true
    end

    return false
end

npcHandler:setCallback(CALLBACK_GREET, onGreetCallback)
npcHandler:setCallback(CALLBACK_MESSAGE_DEFAULT, onCreatureSayCallback)
npcHandler:addModule(FocusModule:new())
