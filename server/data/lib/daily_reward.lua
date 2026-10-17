-- Daily Reward
-- Os itens/outfits NÃO ficam mais neste script: o "padrão" (pool por raridade, itens bônus e
-- outfits bônus) é administrado no portal em `/admin/daily-rewards/default` e salvo nas tabelas
-- `daily_reward_default_items`, `daily_reward_rarity_weights` e `daily_reward_default_outfits`.
-- Os outfits bônus são referências ao catálogo `custom_outfits` (data/lib/custom_outfits.lua): o
-- jogador recebe o ITEM do outfit e libera o outfit ao usá-lo.
-- Na virada do mês (globalevent DailyRewardRotation / primeiro acesso) o calendário do mês é
-- gerado a partir desse padrão em `daily_rewards_monthly` + `daily_rewards_bonus_monthly`,
-- a menos que o portal já tenha configurado aquele mês (dias faltantes são completados).
--
-- Performance: o calendário do mês é global, então fica em cache (DailyReward.cache, por estado
-- Lua) e é recarregado só quando o mês muda ou após CACHE_TTL segundos (para refletir edições
-- do portal). O estado de cada jogador custa 2 queries (dias resgatados + bônus resgatados).
DailyReward = {
    opcode = 155,
    RARITIES = {"comum", "incomum", "raro", "lendario", "mitico"},
    CACHE_TTL = 300,
    OPEN_EXHAUST = 1,

    cache = nil,
    lastOpen = {}
}

function DailyReward.getDaysInMonth(month, year)
    local days = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31}
    if month == 2 and year % 4 == 0 and (year % 100 ~= 0 or year % 400 == 0) then
        return 29
    end
    return days[month] or 30
end

-- Marcos de dias consecutivos. Fevereiro não chega a 30 (28/29 dias), então o último bônus
-- fica no dia 28 — inclusive em ano bissexto.
function DailyReward.getBonusMilestones(month)
    return {5, 10, 15, 20, 25, month == 2 and 28 or 30}
end

function DailyReward.setBit(mask, bit)
    return mask + (2 ^ (bit - 1))
end

function DailyReward.isBitSet(mask, bit)
    return (math.floor(mask / (2 ^ (bit - 1))) % 2) == 1
end

local function forEachRow(query, fn)
    local q = db.getResult(query)
    if q and q:getID() ~= -1 then
        repeat
            fn(q)
        until not q:next()
        q:free()
    end
end

-- Pool padrão configurado no portal.
function DailyReward.loadPools()
    local pools = {daily = {}, bonus = {}, outfits = {}}
    for _, rarity in ipairs(DailyReward.RARITIES) do
        pools.daily[rarity] = {weight = 0, items = {}}
    end

    forEachRow("SELECT `rarity`, `weight` FROM `daily_reward_rarity_weights`", function(q)
        local pool = pools.daily[q:getDataString("rarity")]
        if pool then
            pool.weight = math.max(0, q:getDataInt("weight"))
        end
    end)

    forEachRow("SELECT `kind`, `rarity`, `item_id`, `count`, `client_id` FROM `daily_reward_default_items` WHERE `active` = 1", function(q)
        local item = {id = q:getDataInt("item_id"), count = q:getDataInt("count"), clientId = q:getDataInt("client_id")}
        if q:getDataString("kind") == "bonus" then
            pools.bonus[#pools.bonus + 1] = item
        else
            local pool = pools.daily[q:getDataString("rarity")]
            if pool then
                pool.items[#pool.items + 1] = item
            end
        end
    end)

    forEachRow("SELECT `c`.`item_id`, `c`.`name` FROM `daily_reward_default_outfits` `d` INNER JOIN `custom_outfits` `c` ON `c`.`id` = `d`.`custom_outfit_id` WHERE `c`.`active` = 1", function(q)
        pools.outfits[#pools.outfits + 1] = {itemId = q:getDataInt("item_id"), name = q:getDataString("name")}
    end)

    return pools
end

-- Sorteia uma raridade pelo peso, ignorando raridades sem itens.
local function rollDailyItem(pools)
    local total = 0
    for _, rarity in ipairs(DailyReward.RARITIES) do
        local pool = pools.daily[rarity]
        if #pool.items > 0 then
            total = total + pool.weight
        end
    end
    if total <= 0 then
        return nil
    end

    local roll = math.random(1, total)
    for _, rarity in ipairs(DailyReward.RARITIES) do
        local pool = pools.daily[rarity]
        if #pool.items > 0 and pool.weight > 0 then
            roll = roll - pool.weight
            if roll <= 0 then
                return pool.items[math.random(#pool.items)]
            end
        end
    end
    return nil
end

-- Gera apenas o que falta do mês a partir do pool padrão. INSERT IGNORE em uma única query
-- (sem corrida de chave duplicada se dois caminhos gerarem ao mesmo tempo).
function DailyReward.ensureMonth(month, year, pools)
    local daysInMonth = DailyReward.getDaysInMonth(month, year)

    local existingDays = {}
    forEachRow(string.format("SELECT `day` FROM `daily_rewards_monthly` WHERE `month` = %d AND `year` = %d", month, year), function(q)
        existingDays[q:getDataInt("day")] = true
    end)

    local values = {}
    for day = 1, daysInMonth do
        if not existingDays[day] then
            local item = rollDailyItem(pools)
            if not item then
                print("[DailyReward] Pool padrão vazio: configure em /admin/daily-rewards/default.")
                break
            end
            values[#values + 1] = string.format("(%d, %d, %d, %d, %d, %d)", month, year, day, item.id, item.count, item.clientId)
        end
    end
    if #values > 0 then
        db.query("INSERT IGNORE INTO `daily_rewards_monthly` (`month`, `year`, `day`, `item_id`, `count`, `client_id`) VALUES " .. table.concat(values, ", "))
    end

    -- Bônus: só gera se o mês não tem nenhum (respeita marcos customizados pelo portal).
    local hasBonus = false
    forEachRow(string.format("SELECT 1 FROM `daily_rewards_bonus_monthly` WHERE `month` = %d AND `year` = %d LIMIT 1", month, year), function()
        hasBonus = true
    end)
    if not hasBonus and #pools.bonus > 0 then
        values = {}
        for _, streakDay in ipairs(DailyReward.getBonusMilestones(month)) do
            local item = pools.bonus[math.random(#pools.bonus)]
            values[#values + 1] = string.format("(%d, %d, %d, %d, %d, %d)", month, year, streakDay, item.id, item.count, item.clientId)
        end
        db.query("INSERT IGNORE INTO `daily_rewards_bonus_monthly` (`month`, `year`, `streak_day`, `item_id`, `count`, `client_id`) VALUES " .. table.concat(values, ", "))
    end
end

local function sanitizeName(name)
    return (string.gsub(name or "", "[|;:]", ""))
end

-- Calendário do mês corrente (global, em cache).
function DailyReward.getMonthCache(force)
    local month = tonumber(os.date("%m"))
    local year = tonumber(os.date("%Y"))
    local key = month .. "-" .. year
    local now = os.time()

    local cache = DailyReward.cache
    if not force and cache and cache.key == key and now - cache.loadedAt < DailyReward.CACHE_TTL then
        return cache
    end

    local pools = DailyReward.loadPools()
    DailyReward.ensureMonth(month, year, pools)

    local daysInMonth = DailyReward.getDaysInMonth(month, year)
    cache = {
        key = key, month = month, year = year, daysInMonth = daysInMonth, loadedAt = now,
        items = {}, bonus = {}, bonusIndex = {}, outfits = pools.outfits
    }

    forEachRow(string.format("SELECT `day`, `item_id`, `count`, `client_id` FROM `daily_rewards_monthly` WHERE `month` = %d AND `year` = %d", month, year), function(q)
        cache.items[q:getDataInt("day")] = {id = q:getDataInt("item_id"), count = q:getDataInt("count"), clientId = q:getDataInt("client_id")}
    end)

    forEachRow(string.format("SELECT `streak_day`, `item_id`, `count`, `client_id` FROM `daily_rewards_bonus_monthly` WHERE `month` = %d AND `year` = %d ORDER BY `streak_day` ASC", month, year), function(q)
        local streakDay = q:getDataInt("streak_day")
        if streakDay >= 1 and streakDay <= daysInMonth then
            local entry = {streakDay = streakDay, id = q:getDataInt("item_id"), count = q:getDataInt("count"), clientId = q:getDataInt("client_id")}
            entry.name = sanitizeName(getItemNameById(entry.id))
            cache.bonus[#cache.bonus + 1] = entry
            cache.bonusIndex[streakDay] = #cache.bonus
        end
    end)

    local dailyParts = {}
    for day = 1, daysInMonth do
        local item = cache.items[day]
        dailyParts[day] = item and (item.clientId .. "," .. item.count) or "0,0"
    end
    cache.dailyStr = table.concat(dailyParts, ";")

    local bonusParts = {}
    for i, b in ipairs(cache.bonus) do
        bonusParts[i] = b.streakDay .. ":" .. b.clientId .. "," .. b.count .. ":" .. b.name
    end
    cache.bonusStr = table.concat(bonusParts, ";")

    DailyReward.cache = cache
    -- Exhaust do "open" só precisa durar segundos; limpa aqui para não acumular cids antigos.
    DailyReward.lastOpen = {}
    return cache
end

-- Usado pelo globalevent (estado Lua separado do creaturescript): só garante que o mês
-- corrente exista assim que ele vira, sem montar o cache de envio.
function DailyReward.rotate()
    local month = tonumber(os.date("%m"))
    local year = tonumber(os.date("%Y"))
    local key = month .. "-" .. year
    if DailyReward.rotatedKey == key then
        return
    end
    DailyReward.ensureMonth(month, year, DailyReward.loadPools())
    DailyReward.rotatedKey = key
end

-- Estado do jogador no mês: 2 queries, o resto em memória.
function DailyReward.getPlayerState(guid, cache)
    local today = tonumber(os.date("%d"))
    local claimed = {}
    local claimedMask, missedMask = 0, 0

    forEachRow(string.format("SELECT `day` FROM `player_daily_rewards` WHERE `player_id` = %d AND `month` = %d AND `year` = %d", guid, cache.month, cache.year), function(q)
        local day = q:getDataInt("day")
        if not claimed[day] then
            claimed[day] = true
            claimedMask = DailyReward.setBit(claimedMask, day)
        end
    end)

    for day = 1, today - 1 do
        if not claimed[day] then
            missedMask = DailyReward.setBit(missedMask, day)
        end
    end

    -- Sequência conta a partir de hoje, ou de ontem se hoje ainda não foi resgatado
    -- (antes zerava até o jogador resgatar o dia).
    local consecutive = 0
    local start = claimed[today] and today or today - 1
    for day = start, 1, -1 do
        if not claimed[day] then
            break
        end
        consecutive = consecutive + 1
    end

    -- Bits por posição na lista de bônus enviada ao cliente (mesma ordem que ele renderiza).
    local bonusClaimed = {}
    local bonusClaimedMask, bonusAvailableMask = 0, 0
    forEachRow(string.format("SELECT `streak_day` FROM `player_daily_reward_bonus` WHERE `player_id` = %d AND `month` = %d AND `year` = %d", guid, cache.month, cache.year), function(q)
        local index = cache.bonusIndex[q:getDataInt("streak_day")]
        if index and not bonusClaimed[index] then
            bonusClaimed[index] = true
            bonusClaimedMask = DailyReward.setBit(bonusClaimedMask, index)
        end
    end)
    for i, b in ipairs(cache.bonus) do
        if not bonusClaimed[i] and consecutive >= b.streakDay then
            bonusAvailableMask = DailyReward.setBit(bonusAvailableMask, i)
        end
    end

    return {
        today = today,
        claimed = claimed,
        claimedMask = claimedMask,
        missedMask = missedMask,
        consecutive = consecutive,
        bonusClaimed = bonusClaimed,
        bonusClaimedMask = bonusClaimedMask,
        bonusAvailableMask = bonusAvailableMask
    }
end

function DailyReward.getClaimedDaysList(state)
    local days = {}
    for day = 1, 31 do
        if state.claimed[day] then
            days[#days + 1] = day
        end
    end
    return table.concat(days, ", ")
end
