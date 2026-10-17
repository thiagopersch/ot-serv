function onUse(cid, item, frompos, item2, topos)
    local uid = 11000
    if item.uid == uid then
        if getPlayerStorageValue(cid, uid) == -1 then
            doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "Congratulations! You have earned your starting items!")
            local bag = doPlayerAddItem(cid, 1988, 1)
            doAddContainerItem(bag, 49545, 1)
            doAddContainerItem(bag, 49706, 1)
            doAddContainerItem(bag, 49629, 1)
            doAddContainerItem(bag, 49614, 1)
            doAddContainerItem(bag, 49763, 1)
            doAddContainerItem(bag, 49689, 100)
            doAddContainerItem(bag, 49690, 100)
            doAddContainerItem(bag, 2160, 100)
            doAddContainerItem(bag, 2666, 100)
            setPlayerStorageValue(cid, uid, 1)
        else
            doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "Sorry, the chest is empty.")
        end
        return true
    end
end
