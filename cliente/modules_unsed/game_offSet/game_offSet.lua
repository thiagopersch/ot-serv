local wingOffsets = {
    [1] = {
        [North] = { x = 15, y = 17 },
        [East] = { x = 15, y = 17 },
        [South] = { x = 15, y = 17 },
        [West] = { x = 15, y = 17 },
    },
}

local auraOffsets = {
    [1] = { -- Tipo de aura
        [North] = { x = -5, y = 0 },
        [East] = { x = -5, y = 0 },
        [South] = { x = -5, y = 0 },
        [West] = { x = -5, y = 0 },
    },
    [2] = {
        [North] = { x = 30, y = 16 },
        [East] = { x = 30, y = 16 },
        [South] = { x = 30, y = 16 },
        [West] = { x = 30, y = 16 },
    },
}

local function translateDir(dir)
    if dir == NorthEast or dir == SouthEast then
        return East
    elseif dir == NorthWest or dir == SouthWest then
        return West
    end
    return dir
end

local function getEffectOffset(effectId, effectType, direction)
    local effectData = (effectType == "wings" and wingOffsets[effectId]) or
        (effectType == "auras" and auraOffsets[effectId])
    direction = translateDir(direction)
    return effectData and effectData[direction] or { x = 0, y = 0 }
end

local function onCreatureAppear(creature)
    local direction = creature:getDirection()

    local wingOffset = getEffectOffset(creature:getWings(), "wings", direction)
    creature:setWingsOffset(wingOffset.x, wingOffset.y)

    local auraOffset = getEffectOffset(creature:getAura(), "auras", direction)
    creature:setAuraOffset(auraOffset.x, auraOffset.y)
end

local function onCreatureDirectionChange(creature, oldDirection, newDirection)
    local wingOffset = getEffectOffset(creature:getWings(), "wings", newDirection)
    creature:setWingsOffset(wingOffset.x, wingOffset.y)

    local auraOffset = getEffectOffset(creature:getAura(), "auras", newDirection)
    creature:setAuraOffset(auraOffset.x, auraOffset.y)
end

local function onCreatureOutfitChange(creature, newOutfit, oldOutfit)
    local direction = creature:getDirection()

    local wingOffset = getEffectOffset(creature:getWings(), "wings", direction)
    creature:setWingsOffset(wingOffset.x, wingOffset.y)

    local auraOffset = getEffectOffset(creature:getAura(), "auras", direction)
    creature:setAuraOffset(auraOffset.x, auraOffset.y)
end

function init()
    connect(LocalPlayer, { onOutfitChange = onCreatureOutfitChange })
    connect(Creature, {
        onAppear = onCreatureAppear,
        onDirectionChange = onCreatureDirectionChange,
        onOutfitChange = onCreatureOutfitChange
    })
end

function terminate()
    disconnect(LocalPlayer, { onOutfitChange = onCreatureOutfitChange })
    disconnect(Creature, {
        onAppear = onCreatureAppear,
        onDirectionChange = onCreatureDirectionChange,
        onOutfitChange = onCreatureOutfitChange
    })
end
