function onSay(cid, words, param, channel)
    local player = Player(cid)
    if not player then return false end
    
    -- Teste 1: Criar item com count baixo (50)
    local item1 = Game.createItem(2148, 50)  -- 50 gold coins
    if item1 then
        player:sendTextMessage(MESSAGE_STATUS_CONSOLE_BLUE, "Teste 1 - Item criado. Count: " .. item1:getCount())
        local ret = player:addItemEx(item1)
        player:sendTextMessage(MESSAGE_STATUS_CONSOLE_BLUE, "Teste 1 - addItemEx retornou: " .. tostring(ret))
    else
        player:sendTextMessage(MESSAGE_STATUS_CONSOLE_RED, "Teste 1 - Falha ao criar item")
    end
    
    -- Teste 2: Criar item com count alto (10000)
    local item2 = Game.createItem(2148, 10000)  -- 10000 gold coins
    if item2 then
        player:sendTextMessage(MESSAGE_STATUS_CONSOLE_BLUE, "Teste 2 - Item criado. Count: " .. item2:getCount())
        local ret = player:addItemEx(item2)
        player:sendTextMessage(MESSAGE_STATUS_CONSOLE_BLUE, "Teste 2 - addItemEx retornou: " .. tostring(ret))
    else
        player:sendTextMessage(MESSAGE_STATUS_CONSOLE_RED, "Teste 2 - Falha ao criar item")
    end
    
    return false
end
