-- ============================================================
-- outfit_transform.lua
-- Picking an outfit from the "Set Outfit" window IS the transformation.
-- Replaces the old !transform / !revert talkactions: choosing a saga
-- lookType here applies the same flash effect / aura / storage update
-- that the talkaction used to, and choosing a non-saga lookType stops
-- any active transformation aura. The change is also explicitly
-- persisted so the outfit survives logout/login.
-- ============================================================

if not saga then dofile("data/lib/transformation_lib.lua") end
if not CustomOutfits then dofile("data/lib/custom_outfits.lua") end

function onOutfit(cid, old, current)
    if not isPlayer(cid) then return true end

    local vocation = getPlayerVocation(cid)
    local sagaData = saga[vocation]

    if sagaData and current.lookType ~= old.lookType then
        local matched
        for _, out in ipairs(sagaData) do
            if type(out) == "table" and out.lookType == current.lookType then
                matched = out
                break
            end
        end

        if matched then
            if not canPlayerWearLookType(cid, matched.lookType) then
                doPlayerSendCancel(cid, "You have not unlocked this transformation yet.")
                return false
            end

            stopAura(cid)

            local flashEffectId = matched.effect or sagaData.effect or defaultTransformEffect
            local flashPos = getTransformEffectPos(cid, sagaData, matched)
            doSendMagicEffect(flashPos, flashEffectId)
            setPlayerStorageValue(cid, sagastor, ":" .. matched.lookType .. ",:" .. vocation)

            if matched.aura then
                startAura(cid, matched.aura, matched.auraPos)
            end
        else
            -- Switched to a non-saga outfit: no longer transformed, stop the aura loop
            stopAura(cid)
        end
    end

    -- Lembra o outfit customizado escolhido (ou esquece, se voltou para saga/outro) para o
    -- login.lua reaplicar depois do bloco de saga.
    if current.lookType ~= old.lookType then
        CustomOutfits.onOutfitChanged(cid, current.lookType)
    end

    -- defaultOutfit is already updated synchronously by the engine before this event fires,
    -- so saving here is enough to make the choice survive logout/login.
    doPlayerSave(cid)
    return true
end
