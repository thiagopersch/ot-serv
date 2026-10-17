-- /rarity N  -> define a raridade (0..max) do item na mao direita (ou esquerda) - uso de GM/teste
function onSay(cid, words, param, channel)
    local rarity = tonumber(param)
    if not rarity then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Usage: " .. words .. " <rarity 0-" .. getRarityConfig().maxTier .. ">")
        return true
    end

    local item = getPlayerSlotItem(cid, CONST_SLOT_RIGHT)
    if not item or item.itemid == 0 then
        item = getPlayerSlotItem(cid, CONST_SLOT_LEFT)
    end

    if not item or item.itemid == 0 then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Hold the item in your right or left hand.")
        return true
    end

    if not doItemSetRarity(item.uid, rarity) then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Could not set the rarity of this item.")
        return true
    end

    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Rarity of item " .. item.itemid .. " set to " .. getItemRarity(item.uid) .. ".")
    return true
end
