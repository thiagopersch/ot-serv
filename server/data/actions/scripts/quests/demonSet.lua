function onUse(cid, item, frompos, item2, topos)
    local uid = 11002
    if item.uid == uid then
        if getPlayerStorageValue(cid, uid) == -1 then
            doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "Congratulations! You have gain the quest item!")
            local bag = doPlayerAddItem(cid, 10518, 1)
            doAddContainerItem(bag, 2493, 1)
            doAddContainerItem(bag, 2494, 1)
            doAddContainerItem(bag, 2495, 1)
            doAddContainerItem(bag, 2520, 1)
            doAddContainerItem(bag, 35574, 1)
            doAddContainerItem(bag, 49505, 5)
            setPlayerStorageValue(cid, uid, 1)
        else
            doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "Sorry, you already did this quest!")
        end
        return true
    end
end
