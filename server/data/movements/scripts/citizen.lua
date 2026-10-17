function onStepIn(cid, item, pos)
    if isPlayer(cid) ~= TRUE then
        return true
    end

    local thingPos = getThingPos(cid)
    local magicEffect = 240

    local townId = nil
    if item.actionid == 4036 then
        townId = 2 -- Central City (Main City on map)
    elseif item.actionid == 4035 then
        townId = 3 -- Icy Land
    elseif item.actionid == 4037 then
        townId = 1 -- Ressuration Temple on map
    end

    if townId then
        local townName = getTownName(townId)
        if townName then
            local success = doPlayerSetTown(cid, townId)


            local templePos = getTownTemplePosition(townId)
            if templePos and templePos.x > 0 then
                doSendMagicEffect(thingPos, magicEffect)
                doTeleportThing(cid, templePos)
                doSendMagicEffect(templePos, magicEffect)
                doPlayerSave(cid, true)
                doPlayerSendTextMessage(cid, 25, "Now you are citizen of " .. townName .. ".")
            else
                print("[Citizen Portal] Error: Town " .. townName .. " has an invalid temple position.")
            end
        else
            print("[Citizen Portal] Error: Town ID " .. townId .. " not found on the map.")
        end
    end

    return true
end
