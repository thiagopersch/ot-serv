-- Teleport checkpoint network: monuments (item 53225) open a window listing these
-- points. Each point is bought individually (storageKey) with a list of item costs
-- (today only crystal coin 2160, but `costs` accepts any number of {itemId, count}
-- entries so a second required item, or a different currency, is just another row).
--
-- `id` must stay stable once a point ships (it is only used to key `storageKey` below
-- and to reference the point from the client) — do not reorder or reuse an old id.
if not json then json = dofile("data/lib/json.lua") end

TELEPORT_CHECKPOINT_OPCODE = 253

TELEPORT_CHECKPOINTS = {
    {
        id = 1,
        name = "Main City",
        position = { x = 31894, y = 32199, z = 7 },
        costs = {
            { itemId = 2160, count = 250 },
        },
    },
    {
        id = 2,
        name = "Mansions",
        position = {x = 31985, y = 32296, z = 7},
        costs = {
            { itemId = 2160, count = 250 },
        },
    },
    {
        id = 3,
        name = "Travel North Main City",
        position = {x = 31947, y = 32147, z = 7},
        costs = {
            { itemId = 2160, count = 250 },
        },
    },
    {
        id = 4,
        name = "Trainers Main City",
        position = {x = 31783, y = 32213, z = 7},
        costs = {
            { itemId = 2160, count = 250 },
        },
    },
    {
        id = 5,
        name = "Kitnets Main City",
        position = {x = 32031, y = 32222, z = 7},
        costs = {
            { itemId = 2160, count = 250 },
        },
    },
    {
        id = 6,
        name = "Northeast Exit Main City",
        position = {x = 32108, y = 32132, z = 7},
        costs = {
            { itemId = 2160, count = 250 },
        },
    },
    {
        id = 7,
        name = "Panda's Main City",
        position = {x = 32287, y = 32467, z = 7},
        costs = {
            { itemId = 2160, count = 250 },
        },
    },
    {
        id = 8,
        name = "Desert Main City",
        position = {x = 32488, y = 32439, z = 7},
        costs = {
            { itemId = 2160, count = 250 },
        },
    },
    {
        id = 9,
        name = "Lion's Main City",
        position = {x = 32428, y = 32272, z = 7},
        costs = {
            { itemId = 2160, count = 500 },
        },
    },
    {
        id = 10,
        name = "Bandit Chef's North Main City",
        position = {x = 32287, y = 31964, z = 7},
        costs = {
            { itemId = 2160, count = 800 },
        },
    },
    {
        id = 11,
        name = "Demons Main City",
        position = {x = 32187, y = 32065, z = 7},
        costs = {
            { itemId = 2160, count = 250 },
        },
    },
    {
        id = 12,
        name = "Janembas Main City",
        position = {x = 32245, y = 32260, z = 7},
        costs = {
            { itemId = 2160, count = 250 },
        },
    },
    {
        id = 13,
        name = "Southeast Icy land",
        position = {x = 32547, y = 31872, z = 7},
        costs = {
            { itemId = 2160, count = 1250 },
        },
    },
}

local STORAGE_BASE = 90000

function getTeleportCheckpointById(pointId)
    for _, point in ipairs(TELEPORT_CHECKPOINTS) do
        if point.id == pointId then return point end
    end
    return nil
end

function getTeleportCheckpointStorageKey(point)
    return STORAGE_BASE + point.id
end

function isTeleportCheckpointPurchased(cid, point)
    return getPlayerStorageValue(cid, getTeleportCheckpointStorageKey(point)) == 1
end

-- `clientId` mirrors the game_chest pattern (chest.lua): server item ids don't always
-- match the .dat/.otb sprite id the client needs for UIItem:setItemId.
local function getItemClientId(itemId)
    local itemInfo = getItemInfo(itemId)
    if itemInfo and itemInfo.clientId and itemInfo.clientId > 0 then return itemInfo.clientId end
    return itemId
end

local function buildTeleportCheckpointList(cid)
    local list = {}
    for _, point in ipairs(TELEPORT_CHECKPOINTS) do
        local costs = {}
        for _, cost in ipairs(point.costs) do
            table.insert(costs, {
                itemId = cost.itemId,
                clientId = getItemClientId(cost.itemId),
                count = cost.count,
                name = getItemNameById(cost.itemId),
            })
        end

        table.insert(list, {
            id = point.id,
            name = point.name,
            position = point.position,
            purchased = isTeleportCheckpointPurchased(cid, point),
            costs = costs,
        })
    end
    return list
end

-- `monumentPosition` is only sent when opening the window from the monument's onUse
-- (client uses it to auto-close the window once the player walks away); a re-list
-- after a purchase omits it so the client keeps the position it already has.
function sendTeleportCheckpointList(cid, monumentPosition)
    doPlayerSendExtendedOpcode(cid, TELEPORT_CHECKPOINT_OPCODE, json.encode({
        action = "list",
        points = buildTeleportCheckpointList(cid),
        monumentPosition = monumentPosition,
    }))
end
