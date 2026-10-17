if not TELEPORT_CHECKPOINTS then dofile("data/lib/teleport_checkpoints.lua") end

function onUse(cid, item, fromPosition, itemEx, toPosition)
    sendTeleportCheckpointList(cid, fromPosition)
    return true
end
