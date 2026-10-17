-- rarity_lib.lua
-- Sistema de Raridade: catalogo, itens do jogador e evolucao (janela CRAFT do cliente).
-- A configuracao vive em data/XML/rarity.xml (lida pelo C++, exposta via getRarityConfig()).
if not json then json = dofile("data/lib/json.lua") end

Rarity = {
    OPCODE = 170,
    CUSTOM_ATTRIBUTE_KEY = 1,
    EXHAUST_STORAGE = 170001,
    EXHAUST_SECONDS = 1,
    MAX_PACKET_SIZE = 19000,
    BATCH_SIZE = 3,
    CATALOG_TTL = 60, -- segundos; depois de /reload rarity o catalogo e refeito no proximo open
    MAX_CONTAINER_DEPTH = 10,
    CATEGORIES = { "helmet", "armor", "legs", "boots", "weapons", "shields", "potions", "pets", "others" },
}

local catalogCache, catalogTime = nil, 0
local configCache, configTime = nil, 0

local function loadConfig()
    local cfg = getRarityConfig()
    cfg.byItem = {}
    for _, group in ipairs(cfg.groups) do
        for _, id in ipairs(group.items) do
            cfg.byItem[id] = group
        end
    end
    configCache, configTime = cfg, os.time()
    return cfg
end

local function getConfig()
    if not configCache or os.time() - configTime > Rarity.CATALOG_TTL then
        return loadConfig()
    end
    return configCache
end

local function itemBasicInfo(itemid)
    local info = getItemInfo(itemid)
    if not info then
        return { id = itemid, cid = 0, name = "item " .. itemid }
    end
    return { id = itemid, cid = info.clientId, name = info.name }
end

-- tier (0..max) -> tabela do config
function Rarity.getTier(rarity)
    local cfg = getConfig()
    return cfg.tiers[(rarity or 0) + 1]
end

-- grupo de um itemid, ou nil
function Rarity.getGroup(itemid)
    return getConfig().byItem[itemid]
end

-- step (materiais/chance) para evoluir de "rarity" para "rarity + 1"
function Rarity.getStep(group, rarity)
    if not group or rarity >= group.maxRarity then
        return nil
    end
    return group.steps[rarity + 1]
end

function Rarity.buildCatalog()
    if catalogCache and os.time() - catalogTime <= Rarity.CATALOG_TTL then
        return catalogCache
    end

    local cfg = loadConfig()
    local catalog = {
        guaranteeMultiplier = cfg.guaranteeMultiplier,
        maxTier = cfg.maxTier,
        categories = Rarity.CATEGORIES,
        tiers = {},
        groups = {},
        items = {},
        materials = {},
    }

    for _, tier in ipairs(cfg.tiers) do
        -- o cliente renderiza texto em latin1 (cp1252), por isso nameLatin
        table.insert(catalog.tiers, { id = tier.id, name = tier.nameLatin, color = tier.color, bonus = tier.bonus })
    end

    local materialSeen = {}
    for groupIndex, group in ipairs(cfg.groups) do
        local steps = {}
        for to = 1, group.maxRarity do
            local step = group.steps[to]
            local mats = {}
            if step then
                for _, mat in ipairs(step.materials) do
                    table.insert(mats, { id = mat.id, count = mat.count })
                    if not materialSeen[mat.id] then
                        materialSeen[mat.id] = true
                        table.insert(catalog.materials, itemBasicInfo(mat.id))
                    end
                end
            end
            -- steps sem configuracao ficam com chance 0 (nao evoluem)
            table.insert(steps, { to = to, chance = step and step.chance or 0, materials = mats, configured = step ~= nil })
        end

        table.insert(catalog.groups, {
            index = groupIndex,
            name = group.name,
            category = group.category,
            maxRarity = group.maxRarity,
            failDowngrade = group.failDowngrade,
            steps = steps,
        })

        for _, itemid in ipairs(group.items) do
            local info = itemBasicInfo(itemid)
            info.group = groupIndex
            table.insert(catalog.items, info)
        end
    end

    catalogCache, catalogTime = catalog, os.time()
    return catalog
end

-- percorre equipamento + todos os containers carregados
-- ref = "slot" ou "slot:idx:idx..." (indices 0-based dentro de cada container)
local function scanContainer(uid, ref, depth, out)
    if depth > Rarity.MAX_CONTAINER_DEPTH then
        return
    end

    local size = getContainerSize(uid)
    for i = 0, size - 1 do
        local item = getContainerItem(uid, i)
        if item and item.itemid > 0 then
            local itemRef = ref .. ":" .. i
            if Rarity.getGroup(item.itemid) then
                table.insert(out, { ref = itemRef, id = item.itemid, rarity = getItemRarity(item.uid) or 0 })
            end
            if isContainer(item.uid) then
                scanContainer(item.uid, itemRef, depth + 1, out)
            end
        end
    end
end

function Rarity.getOwned(cid)
    local owned = {}
    for slot = CONST_SLOT_FIRST, CONST_SLOT_LAST do
        local item = getPlayerSlotItem(cid, slot)
        if item and item.itemid > 0 then
            if Rarity.getGroup(item.itemid) then
                table.insert(owned, { ref = tostring(slot), id = item.itemid, rarity = getItemRarity(item.uid) or 0, equipped = true })
            end
            if isContainer(item.uid) then
                scanContainer(item.uid, tostring(slot), 1, owned)
            end
        end
    end
    return owned
end

-- devolve o item (tabela com uid/itemid) apontado pelo ref, ou nil
function Rarity.resolveRef(cid, ref)
    if type(ref) ~= "string" then
        return nil
    end

    local parts = {}
    for part in ref:gmatch("[^:]+") do
        table.insert(parts, tonumber(part))
    end

    local slot = parts[1]
    if not slot or slot < CONST_SLOT_FIRST or slot > CONST_SLOT_LAST then
        return nil
    end

    local item = getPlayerSlotItem(cid, slot)
    for i = 2, #parts do
        if not item or item.itemid == 0 or not isContainer(item.uid) or not parts[i] then
            return nil
        end
        item = getContainerItem(item.uid, parts[i])
    end

    if not item or item.itemid == 0 then
        return nil
    end
    return item
end

function Rarity.getMaterialCounts(cid)
    local counts = {}
    for _, mat in ipairs(Rarity.buildCatalog().materials) do
        table.insert(counts, { id = mat.id, count = getPlayerItemCount(cid, mat.id) })
    end
    return counts
end

function Rarity.buildMessages(encoded)
    local size = Rarity.MAX_PACKET_SIZE
    if #encoded <= size then
        return { encoded }
    end

    local chunks = {}
    for pos = 1, #encoded, size do
        table.insert(chunks, encoded:sub(pos, pos + size - 1))
    end

    local messages = { "S" .. chunks[1] }
    for i = 2, #chunks - 1 do
        table.insert(messages, "P" .. chunks[i])
    end
    table.insert(messages, "E" .. chunks[#chunks])
    return messages
end

function Rarity.sendBatch(cid, messages, index)
    if not isPlayer(cid) then
        return
    end

    local last = math.min(index + Rarity.BATCH_SIZE - 1, #messages)
    for i = index, last do
        doPlayerSendExtendedOpcode(cid, Rarity.OPCODE, messages[i])
    end

    if last < #messages then
        addEvent(Rarity.sendBatch, 100, cid, messages, last + 1)
    end
end

function Rarity.send(cid, data)
    local ok, encoded = pcall(json.encode, data)
    if not ok or not encoded then
        print("[Rarity] Erro ao codificar JSON: " .. tostring(encoded))
        return
    end
    Rarity.sendBatch(cid, Rarity.buildMessages(encoded), 1)
end

function Rarity.sendState(cid)
    Rarity.send(cid, { type = "state", owned = Rarity.getOwned(cid), materials = Rarity.getMaterialCounts(cid) })
end

function Rarity.sendOpen(cid)
    local cfg = getConfig()
    if not cfg.enabled then
        Rarity.send(cid, { type = "error", message = "The rarity system is disabled." })
        return
    end

    Rarity.send(cid, {
        type = "open",
        catalog = Rarity.buildCatalog(),
        owned = Rarity.getOwned(cid),
        materials = Rarity.getMaterialCounts(cid),
    })
end

local function sendError(cid, message)
    Rarity.send(cid, { type = "error", message = message })
end

function Rarity.evolve(cid, ref, itemid, guaranteed)
    local cfg = getConfig()
    if not cfg.enabled then
        return sendError(cid, "The rarity system is disabled.")
    end

    if exhaustion.check(cid, Rarity.EXHAUST_STORAGE) then
        return sendError(cid, "Please wait a moment.")
    end
    exhaustion.set(cid, Rarity.EXHAUST_STORAGE, Rarity.EXHAUST_SECONDS)

    local item = Rarity.resolveRef(cid, ref)
    if not item or (itemid and item.itemid ~= itemid) then
        Rarity.sendState(cid)
        return sendError(cid, "Item not found. Was it moved?")
    end

    local group = Rarity.getGroup(item.itemid)
    if not group then
        return sendError(cid, "This item cannot be upgraded.")
    end

    local rarity = getItemRarity(item.uid) or 0
    if rarity >= group.maxRarity then
        return sendError(cid, "This item is already at max rarity.")
    end

    local step = Rarity.getStep(group, rarity)
    if not step then
        return sendError(cid, "This upgrade is not configured.")
    end

    local multiplier = guaranteed and cfg.guaranteeMultiplier or 1
    for _, mat in ipairs(step.materials) do
        if getPlayerItemCount(cid, mat.id) < mat.count * multiplier then
            return sendError(cid, "You don't have the required materials.")
        end
    end

    -- o uid continua apontando para o mesmo item mesmo que os indices do container mudem
    for _, mat in ipairs(step.materials) do
        if mat.id ~= item.itemid then
            doPlayerRemoveItem(cid, mat.id, mat.count * multiplier)
        end
    end

    local itemName = getItemInfo(item.itemid).name
    local success = guaranteed or math.random(1, 100) <= step.chance
    local newRarity = rarity
    if success then
        newRarity = rarity + 1
    elseif group.failDowngrade and rarity > 0 then
        newRarity = rarity - 1
    end

    if newRarity ~= rarity then
        doItemSetRarity(item.uid, newRarity)
    end

    local tier = Rarity.getTier(newRarity)
    local pos = getCreaturePosition(cid)
    if success then
        doSendMagicEffect(pos, CONST_ME_FIREWORK_YELLOW)
        doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "Congratulations! You upgraded " .. itemName .. " to " .. tier.nameLatin .. " rarity!")
    else
        doSendMagicEffect(pos, CONST_ME_POFF)
        doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, "The upgrade of " .. itemName .. " failed. Materials were consumed.")
    end

    Rarity.send(cid, {
        type = "result",
        success = success,
        ref = ref,
        id = item.itemid,
        itemName = itemName,
        rarity = newRarity,
        downgraded = newRarity < rarity,
    })
    Rarity.sendState(cid)
end
