-- Outfits customizados (/admin/custom-outfits no portal)
-- Cada outfit do catálogo `custom_outfits` vira, pelo portal, uma entrada em data/XML/outfits.xml
-- (bloco CUSTOM_OUTFITS) com storageId = STORAGE_BASE + id e storageValue = 1, sem vocação — o
-- engine já libera para qualquer vocação quando o storage do jogador é 1 (Player::canWearOutfit).
-- Usar o item `item_id` (actions/scripts/custom_outfit_unlock.lua) seta esse storage: liberação
-- permanente, salva junto com o player. O jogador troca pela janela de outfit normal (Ctrl+O).
CustomOutfits = {
    STORAGE_BASE = 61000,
    -- Looktype customizado escolhido por último (-1 = nenhum): reaplicado no login, depois do
    -- bloco de saga do login.lua, que senão volta para a transformação.
    CHOSEN_STORAGE = 60999,
    CACHE_TTL = 300,

    cache = nil
}

-- Catálogo ativo indexado por item e por looktype (estado Lua de cada interface tem o seu).
function CustomOutfits.getCatalog(force)
    local now = os.time()
    local cache = CustomOutfits.cache
    if not force and cache and now - cache.loadedAt < CustomOutfits.CACHE_TTL then
        return cache
    end

    cache = {loadedAt = now, byItem = {}, byLook = {}}
    local q = db.getResult("SELECT `id`, `name`, `look_type`, `item_id` FROM `custom_outfits` WHERE `active` = 1")
    if q and q:getID() ~= -1 then
        repeat
            local outfit = {
                id = q:getDataInt("id"),
                name = q:getDataString("name"),
                lookType = q:getDataInt("look_type"),
                itemId = q:getDataInt("item_id")
            }
            cache.byItem[outfit.itemId] = outfit
            cache.byLook[outfit.lookType] = outfit
        until not q:next()
        q:free()
    end

    CustomOutfits.cache = cache
    return cache
end

function CustomOutfits.getByItem(itemId)
    return CustomOutfits.getCatalog().byItem[itemId]
end

function CustomOutfits.getByLook(lookType)
    return CustomOutfits.getCatalog().byLook[lookType]
end

function CustomOutfits.isUnlocked(cid, outfit)
    return getPlayerStorageValue(cid, CustomOutfits.STORAGE_BASE + outfit.id) >= 1
end

function CustomOutfits.unlock(cid, outfit)
    setPlayerStorageValue(cid, CustomOutfits.STORAGE_BASE + outfit.id, 1)
end

-- Chamado pelo onOutfit: lembra (ou esquece) o outfit customizado escolhido.
function CustomOutfits.onOutfitChanged(cid, lookType)
    if CustomOutfits.getByLook(lookType) then
        setPlayerStorageValue(cid, CustomOutfits.CHOSEN_STORAGE, lookType)
    else
        setPlayerStorageValue(cid, CustomOutfits.CHOSEN_STORAGE, -1)
    end
end

-- Chamado no login, depois da saga: volta para o outfit customizado escolhido se ainda liberado.
function CustomOutfits.restoreChosen(cid)
    local lookType = getPlayerStorageValue(cid, CustomOutfits.CHOSEN_STORAGE)
    if lookType <= 0 then
        return false
    end

    local outfit = CustomOutfits.getByLook(lookType)
    if not outfit or not CustomOutfits.isUnlocked(cid, outfit) or not canPlayerWearOutfit(cid, lookType, 0) then
        setPlayerStorageValue(cid, CustomOutfits.CHOSEN_STORAGE, -1)
        return false
    end

    local current = getCreatureOutfit(cid)
    current.lookType = lookType
    doCreatureChangeOutfit(cid, current)
    return true
end
