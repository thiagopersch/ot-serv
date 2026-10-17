local keywordHandler = KeywordHandler:new()
local npcHandler = NpcHandler:new(keywordHandler)
NpcSystem.parseParameters(npcHandler)

-- OTServ event handling functions
function onCreatureAppear(cid) npcHandler:onCreatureAppear(cid) end

function onCreatureDisappear(cid) npcHandler:onCreatureDisappear(cid) end

function onCreatureSay(cid, type, msg) npcHandler:onCreatureSay(cid, type, msg) end

function onThink() npcHandler:onThink() end

-- Greet callback for initial NPC interaction
function greetCallback(cid)
    doSendDialogNpc(cid, getNpcId(),
        "Hello, I see you have made it this far!\nClick on Travel to continue!",
        "Close&Reward&Travel")
    return true
end

-- Creature say callback for handling player input
function creatureSayCallback(cid, type, msg)
    if not npcHandler:isFocused(cid) then
        return false
    end

    local msgLower = msg:lower()
    if msgcontains(msgLower, "recompensa") then
        local message = ""
        if getPlayerStorageValue(cid, 7000) == -1 then
            setPlayerStorageValue(cid, 7000, 1)
            doPlayerAddItem(cid, 2160, 1)
            message = "Você acaba de ganhar uns trocados por chegar até aqui.\nVolte sempre!"
        else
            message = "Você já pegou sua recompensa, obrigado e volte sempre!"
        end
        doSendDialogNpc(cid, getNpcId(), message, "Fechar")
    elseif msgcontains(msgLower, "fechar") then
        doSendDialogNpcClose(cid)
        npcHandler:unGreet(cid)
    end

    return true
end

-- Travel keywords for Central City
local travelNode = keywordHandler:addKeyword({ 'central city' }, StdModule.say, {
    npcHandler = npcHandler,
    onlyFocus = true,
    text = 'Do you want to go to {Central City}?'
})
travelNode:addChildKeyword({ 'yes' }, StdModule.travel, {
    npcHandler = npcHandler,
    premium = false,
    level = 1,
    destination = { x = 17541, y = 17552, z = 6 }
})
travelNode:addChildKeyword({ 'no' }, StdModule.say, {
    npcHandler = npcHandler,
    onlyFocus = true,
    reset = true,
    text = 'Then go hunting again! Bye Bye!'
})

-- Travel keywords for Karakura
local travelNode = keywordHandler:addKeyword({ 'karakura' }, StdModule.say, {
    npcHandler = npcHandler,
    onlyFocus = true,
    text = 'Do you want to go to {Karakura}?'
})
travelNode:addChildKeyword({ 'yes' }, StdModule.travel, {
    npcHandler = npcHandler,
    premium = true,
    level = 50,
    destination = { x = 17584, y = 17710, z = 6 }
})
travelNode:addChildKeyword({ 'no' }, StdModule.say, {
    npcHandler = npcHandler,
    onlyFocus = true,
    reset = true,
    text = 'Then go hunting again! Bye Bye!'
})

-- General travel keyword
keywordHandler:addKeyword({ 'travel' }, StdModule.say, {
    npcHandler = npcHandler,
    onlyFocus = true,
    text = "Where do you want to travel? {Central City}, {Karakura}"
})

-- Set callbacks and add focus module
npcHandler:setCallback(CALLBACK_MESSAGE_DEFAULT, creatureSayCallback)
npcHandler:setCallback(CALLBACK_GREET, greetCallback)
npcHandler:addModule(FocusModule:new())

-- local keywordHandler = KeywordHandler:new()
-- local npcHandler = NpcHandler:new(keywordHandler)
-- NpcSystem.parseParameters(npcHandler)

-- -- OTServ event handling functions start
-- function onCreatureAppear(cid) npcHandler:onCreatureAppear(cid) end

-- function onCreatureDisappear(cid) npcHandler:onCreatureDisappear(cid) end

-- function onCreatureSay(cid, type, msg) npcHandler:onCreatureSay(cid, type, msg) end

-- function onThink() npcHandler:onThink() end

-- -- OTServ event handling functions end

-- -- Don't forget npcHandler = npcHandler in the parameters. It is required for all StdModule functions!
-- local travelNode = keywordHandler:addKeyword({ 'central city' }, StdModule.say, {
--     npcHandler = npcHandler,
--     onlyFocus = true,
--     text = 'Do you want to go to {Central City}?'
-- })
-- travelNode:addChildKeyword({ 'yes' }, StdModule.travel, {
--     npcHandler = npcHandler,
--     premium = false,
--     level = 1,
--     destination = { x = 17541, y = 17552, z = 6 }
-- })
-- travelNode:addChildKeyword({ 'no' }, StdModule.say, {
--     npcHandler = npcHandler,
--     onlyFocus = true,
--     reset = true,
--     text = 'Then go hunting again! Bye Bye!'
-- })

-- local travelNode = keywordHandler:addKeyword({ 'karakura' }, StdModule.say, {
--     npcHandler = npcHandler,
--     onlyFocus = true,
--     text = 'Do you want to go to {Karakura}?'
-- })
-- travelNode:addChildKeyword({ 'yes' }, StdModule.travel, {
--     npcHandler = npcHandler,
--     premium = yes,
--     level = 50,
--     destination = { x = 17584, y = 17710, z = 6 }
-- })
-- travelNode:addChildKeyword({ 'no' }, StdModule.say, {
--     npcHandler = npcHandler,
--     onlyFocus = true,
--     reset = true,
--     text = 'Then go hunting again! Bye Bye!'
-- })

-- keywordHandler:addKeyword({ 'travel' }, StdModule.say, {
--     npcHandler = npcHandler,
--     onlyFocus = true,
--     text = "Where do you want to travel? {Central City}, {Karakura}"
-- })

-- -- Makes sure the npc reacts when you say hi, bye etc.
-- npcHandler:addModule(FocusModule:new())
