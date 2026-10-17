function onUse(cid, item, frompos, item2, topos)
    local uid = 11001
    if item.uid == uid then
        if getPlayerStorageValue(cid, uid) == -1 then
            doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "Congratulations! You have gain the quest item!")
            local bag = doPlayerAddItem(cid, 15646, 1)
            doAddContainerItem(bag, 49491, 1)
            doAddContainerItem(bag, 49723, 1)
            doAddContainerItem(bag, 40758, 1)
            doAddContainerItem(bag, 40757, 1)
            doAddContainerItem(bag, 40756, 1)
            doAddContainerItem(bag, 40759, 1)
            doAddContainerItem(bag, 15491, 1)
            doAddContainerItem(bag, 49702, 1)
            doAddContainerItem(bag, 49505, 3)
            setPlayerStorageValue(cid, uid, 1)
        else
            doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "Sorry, you already did this quest!")
        end
        return true
    end
end
