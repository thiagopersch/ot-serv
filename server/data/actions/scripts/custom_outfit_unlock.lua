if not CustomOutfits then dofile("data/lib/custom_outfits.lua") end

-- Item de outfit customizado: registrado por item no bloco CUSTOM_OUTFITS de actions.xml, gerado
-- pelo portal (/admin/custom-outfits). Libera o outfit para sempre, para qualquer vocação.
function onUse(cid, item, fromPosition, itemEx, toPosition)
    local outfit = CustomOutfits.getByItem(item.itemid)
    if not outfit then
        doPlayerSendCancel(cid, "Este outfit não está disponível.")
        return true
    end

    if CustomOutfits.isUnlocked(cid, outfit) then
        doPlayerSendCancel(cid, "Você já possui o outfit " .. outfit.name .. ".")
        return true
    end

    CustomOutfits.unlock(cid, outfit)
    doRemoveItem(item.uid, 1)
    doPlayerSave(cid)

    doSendMagicEffect(getThingPos(cid), CONST_ME_GIFT_WRAPS)
    doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR,
        "Outfit " .. outfit.name .. " liberado! Abra a janela de outfit para usar.")
    doPlayerSendOutfitWindow(cid)
    return true
end
