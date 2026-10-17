-- Script to filter player outfits based on vocation and level
-- Triggered on login and level up

function onLogin(cid)
    registerCreatureEvent(cid, "OutfitAdvance")
    registerCreatureEvent(cid, "OutfitTransform")
    updatePlayerOutfits(cid)
    return true
end

function onAdvance(cid, skill, oldLevel, newLevel)
    if skill == SKILL__LEVEL then
        -- Delay a bit to ensure the level is updated in the internal state if needed
        addEvent(updatePlayerOutfits, 100, cid)
    end
    return true
end
