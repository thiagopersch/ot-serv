-- game_auraoffset/game_auraoffset.lua
-- Directional offset adjustment for auras and wings.
-- The lookup keys are looktypes (creature:getAura() / creature:getWings()).
-- Configure per-looktype offsets for each cardinal direction.

local wingOffsets = {
    [3519] = { -- Dark Wings
        [North] = { x = 32, y = -16 },
        [East] = { x = 32, y = -16 },
        [South] = { x = 32, y = -16 },
        [West] = { x = 32, y = -16 },
    },
}

local auraOffsets = {
    [3479] = { -- grey aura (looktype)
        [North] = { x = 64, y = 42 },
        [East] = { x = 64, y = 42 },
        [South] = { x = 64, y = 42 },
        [West] = { x = 64, y = 42 },
    },
    [3517] = { -- Yellow Ki
        [North] = { x = 65, y = 24 },
        [East] = { x = 65, y = 24 },
        [South] = { x = 65, y = 24 },
        [West] = { x = 65, y = 24 },
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
