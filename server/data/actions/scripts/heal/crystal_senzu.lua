function onUse(cid, item, fromPosition, itemEx, toPosition)
    ITEM = 49696
    local storage = 50000
    local magicEffect = 316
    local REG_HEALTH = 60000
    local REG_MANA = 60000
    local qtdRemoveItem = 1
    local wait = 2
    local pos1 = {
        x = getPlayerPosition(cid).x + 1,
        y = getPlayerPosition(cid).y + 0,
        z = getPlayerPosition(cid).z
    }

    if fromPosition.x ~= CONTAINER_POSITION and exhaustion.get(cid, storage) == FALSE then
        doPlayerAddMana(cid, REG_MANA)
        doCreatureAddHealth(cid, REG_HEALTH)
        doCreatureSay(cid, 'Aaahhh!', TALKTYPE_ORANGE_1)
        doSendMagicEffect(pos1, magicEffect)
        doRemoveItem(item.uid, qtdRemoveItem)
        exhaustion.set(cid, storage, wait)
    elseif item.itemid == ITEM and exhaustion.get(cid, storage) == FALSE then
        doPlayerAddMana(cid, REG_MANA)
        doCreatureAddHealth(cid, REG_HEALTH)
        doCreatureSay(cid, 'Aaahhh!', TALKTYPE_ORANGE_1)
        doSendMagicEffect(pos1, magicEffect)
        doRemoveItem(item.uid, qtdRemoveItem)
        exhaustion.set(cid, storage, wait)
    else
        doPlayerSendCancel(cid, "You are exhausted.")
    end
    return TRUE
end
