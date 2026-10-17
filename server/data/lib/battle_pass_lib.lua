-- ============================================================
-- battle_pass_lib.lua
-- Battle Pass system: season/missions/rewards are administered on the web portal
-- (`/admin/battle-pass`, tables battle_pass_*) — this file loads the active season from the
-- database (same pattern as data/lib/tasks/task_db_loader.lua) and tracks player progress.
--
-- Only mission `type` values actually tracked below have a matching `checkMissions` call
-- somewhere in the codebase. `lib/validations/admin/battle-pass.ts` (portal) exposes more types
-- (dungeon_any_vocation, damage, battle_pass_missions, daily_tasks, specific_tasks,
-- daily_rewards, vocation_rank) than are wired here — those can be configured on the portal but
-- currently never advance in-game (no hook calls `checkMissions` for them yet).
-- ============================================================

if not json then json = dofile("data/lib/json.lua") end

BattlePassLib = BattlePassLib or {}
BATTLE_PASS_OPCODE = 251

-- IMPORTANT: `db.getResult` in this engine returns `-1` only on a hard query error (bad SQL) —
-- a SELECT that matches zero rows still returns a "valid" handle, and reading a field from it
-- returns `false` instead of throwing. So checking `res ~= -1` alone is NOT enough to know a row
-- was actually found; always double check the read value's type before trusting it.
local function readInt(res, column)
    if res == -1 or res == false or res == nil then return nil end
    local value = result.getDataInt(res, column)
    if type(value) ~= "number" then return nil end
    return value
end

local function readString(res, column, default)
    if res == -1 or res == false or res == nil then return default end
    local value = result.getDataString(res, column)
    if type(value) ~= "string" then return default end
    return value
end

-- Resolve o looktype do cliente (protocolo) a partir do monstro já carregado em memória pelo
-- engine (data/monster/*.xml, gerado pelo site via monsterToXml com o "Número" do cadastro de
-- looktypes já resolvido em `<look type="...">`) — mesmo padrão de data/lib/bestiary_lib.lua.
-- Evita totalmente `db.getResult`/`getData*` pra essa consulta: tentativas anteriores de ler
-- `monsters.look_type`/`look_type_id` via SQL sempre bateram em "Error during getData*(coluna)"
-- mesmo com a coluna existindo e a query sendo válida — getMonsterInfo lê o XML direto, sem SQL.
--
-- IMPORTANTE: só cacheia quando acha o monstro (lookType > 0). `data/lib/battle_pass_lib.lua`
-- é carregado como mod, e ">> Carregando Mods" acontece ANTES de ">> Carregando Monstros" no
-- boot — a primeira chamada (disparada pelo `BattlePassLib.ensureSeason()` no fim deste
-- arquivo) sempre falharia porque nenhum monstro existe em memória ainda. `getMonsterInfo`
-- imprime no console via `errorEx` mesmo dentro de `pcall` (pcall só protege o script Lua de
-- abortar, não silencia o log do engine), então até com o cache essa primeira chamada gerava
-- uma linha de erro por monstro único referenciado nas missions. Por isso não tentamos resolver
-- nada enquanto `monstersLoaded` não for setado — `BattlePassLib.setMonstersLoaded()` é chamado
-- pelo globalevent `type="startup"` em battle_pass_rotation.lua, que roda depois do boot
-- completo, e o `reload()` disparado por ele resolve tudo certo, sem log de erro.
local monstersLoaded = false
function BattlePassLib.setMonstersLoaded()
    monstersLoaded = true
end

local monsterLookTypeCache = {}
local function getMonsterLookType(monsterName)
    if not monstersLoaded or not monsterName or monsterName == "" then return 0 end
    local key = string.lower(monsterName)
    if monsterLookTypeCache[key] ~= nil then return monsterLookTypeCache[key] end

    local lookType = 0
    local ok, monsterInfo = pcall(getMonsterInfo, monsterName)
    if ok and monsterInfo and monsterInfo.outfit then
        lookType = monsterInfo.outfit.lookType or 0
        -- Alguns monstros são cadastrados com `<look typeex="...">` (outfit baseado em item) em
        -- vez de `<look type="...">` — lookType fica 0 nesse caso. Mesmo fallback usado por
        -- data/lib/bestiary_lib.lua / game_bestiary.lua no client: manda lookTypeEx no lugar de
        -- lookType (o client já sabe renderizar isso via `setOutfit({ type = ... })`).
        if lookType == 0 then
            lookType = monsterInfo.outfit.lookTypeEx or 0
        end
    end

    if lookType > 0 then
        monsterLookTypeCache[key] = lookType
    end
    return lookType
end

function BattlePassLib.reload()
    local seasonResult = db.getResult(
        "SELECT `id`, `month`, `year`, `max_level`, `xp_per_level`, `gold_pass_item_id`, `gold_pass_cost`, " ..
        "`level_purchase_item_id`, `level_purchase_cost` " ..
        "FROM `battle_pass_seasons` WHERE `is_active` = 1 LIMIT 1")

    local seasonId = readInt(seasonResult, "id")
    if not seasonId then
        if seasonResult ~= -1 then result.free(seasonResult) end
        BATTLE_PASS_SEASON = nil
        return
    end

    local season = {
        id = seasonId,
        month = readInt(seasonResult, "month") or 0,
        year = readInt(seasonResult, "year") or 0,
        maxLevel = readInt(seasonResult, "max_level") or 100,
        xpPerLevel = readInt(seasonResult, "xp_per_level") or 1000,
        goldPassItemId = readInt(seasonResult, "gold_pass_item_id") or 0,
        goldPassCost = readInt(seasonResult, "gold_pass_cost") or 0,
        levelPurchaseItemId = readInt(seasonResult, "level_purchase_item_id") or 0,
        levelPurchaseCost = readInt(seasonResult, "level_purchase_cost") or 0,
        missions = {},
        rewards = {},
    }
    result.free(seasonResult)

    local missionsResult = db.getResult(
        "SELECT `id`, `type`, `target`, `description`, `xp_reward` FROM `battle_pass_missions` " ..
        "WHERE `season_id` = " .. season.id .. " AND `published` = 1")
    if readInt(missionsResult, "id") then
        repeat
            local okTarget, target = pcall(json.decode, readString(missionsResult, "target", "{}"))
            target = okTarget and target or {}
            table.insert(season.missions, {
                id = readInt(missionsResult, "id"),
                type = readString(missionsResult, "type", ""),
                target = target,
                lookType = getMonsterLookType(target.monster),
                description = readString(missionsResult, "description", ""),
                xpReward = readInt(missionsResult, "xp_reward") or 0,
            })
        until not result.next(missionsResult)
    end
    if missionsResult ~= -1 then result.free(missionsResult) end

    local rewardsResult = db.getResult(
        "SELECT `level`, `track`, `rarity`, `item_id`, `count`, `order` FROM `battle_pass_rewards` " ..
        "WHERE `season_id` = " .. season.id .. " ORDER BY `level` ASC, `track` ASC, `order` ASC")
    if readInt(rewardsResult, "level") then
        repeat
            local level = readInt(rewardsResult, "level")
            local track = readString(rewardsResult, "track", "")
            local key = track .. "_" .. level
            local itemId = readInt(rewardsResult, "item_id") or 0
            local itemInfo = getItemInfo(itemId)
            local clientId = (itemInfo and itemInfo.clientId and itemInfo.clientId > 0) and itemInfo.clientId or itemId

            season.rewards[key] = season.rewards[key] or {}
            table.insert(season.rewards[key], {
                itemId = itemId,
                clientId = clientId,
                -- Nome vindo de items.xml (sempre correto, inclusive pra itens customizados) —
                -- não depende do items.otb local do client, que não tem nome embutido pra quase
                -- nenhum item (só ~0.7% dos itens têm o atributo de nome no OTB do client).
                name = itemInfo and itemInfo.name or "",
                count = readInt(rewardsResult, "count") or 1,
                rarity = readString(rewardsResult, "rarity", ""),
                order = readInt(rewardsResult, "order") or 0,
            })
        until not result.next(rewardsResult)
    end
    if rewardsResult ~= -1 then result.free(rewardsResult) end

    BATTLE_PASS_SEASON = season
end

-- Ensures a season row exists for the current month/year, cloning the most recent previous
-- season's missions/rewards when a new one has to be created (same behaviour as
-- lib/battle-pass-season.ts on the portal, kept independent so the game doesn't depend on the
-- portal running to roll over at midnight on the last day of the month).
function BattlePassLib.ensureSeason()
    local month = tonumber(os.date("%m"))
    local year = tonumber(os.date("%Y"))

    local existing = db.getResult(
        "SELECT `id` FROM `battle_pass_seasons` WHERE `month` = " .. month .. " AND `year` = " .. year)
    local existingId = readInt(existing, "id")
    if existing ~= -1 then result.free(existing) end
    if existingId then
        BattlePassLib.reload()
        return
    end

    local prevResult = db.getResult(
        "SELECT `id`, `max_level`, `xp_per_level`, `gold_pass_item_id`, `gold_pass_cost`, " ..
        "`level_purchase_item_id`, `level_purchase_cost` " ..
        "FROM `battle_pass_seasons` ORDER BY `year` DESC, `month` DESC LIMIT 1")

    local maxLevel, xpPerLevel, goldItem, goldCost = 100, 1000, 0, 0
    local levelPurchaseItem, levelPurchaseCost = 0, 0
    local prevId = readInt(prevResult, "id")
    if prevId then
        maxLevel = readInt(prevResult, "max_level") or maxLevel
        xpPerLevel = readInt(prevResult, "xp_per_level") or xpPerLevel
        goldItem = readInt(prevResult, "gold_pass_item_id") or goldItem
        goldCost = readInt(prevResult, "gold_pass_cost") or goldCost
        levelPurchaseItem = readInt(prevResult, "level_purchase_item_id") or levelPurchaseItem
        levelPurchaseCost = readInt(prevResult, "level_purchase_cost") or levelPurchaseCost
    end
    if prevResult ~= -1 then result.free(prevResult) end

    db.query("UPDATE `battle_pass_seasons` SET `is_active` = 0")
    -- `created_at`/`updated_at` set explicitly — don't rely on a DB-side DEFAULT CURRENT_TIMESTAMP
    -- existing, some deployments (ex.: `prisma db push` on this schema) don't set one.
    db.query("INSERT INTO `battle_pass_seasons` (`month`, `year`, `max_level`, `xp_per_level`, " ..
        "`gold_pass_item_id`, `gold_pass_cost`, `level_purchase_item_id`, `level_purchase_cost`, " ..
        "`is_active`, `created_at`, `updated_at`) VALUES (" ..
        month .. ", " .. year .. ", " .. maxLevel .. ", " .. xpPerLevel .. ", " ..
        goldItem .. ", " .. goldCost .. ", " .. levelPurchaseItem .. ", " .. levelPurchaseCost ..
        ", 1, NOW(), NOW())")

    if prevId then
        local newSeasonResult = db.getResult(
            "SELECT `id` FROM `battle_pass_seasons` WHERE `month` = " .. month .. " AND `year` = " .. year)
        local newId = readInt(newSeasonResult, "id")
        if newSeasonResult ~= -1 then result.free(newSeasonResult) end

        db.query("INSERT INTO `battle_pass_missions` (`season_id`, `type`, `target`, `description`, " ..
            "`xp_reward`, `published`, `created_at`, `updated_at`) SELECT " .. newId ..
            ", `type`, `target`, `description`, `xp_reward`, `published`, NOW(), NOW() " ..
            "FROM `battle_pass_missions` WHERE `season_id` = " .. prevId)
        db.query("INSERT INTO `battle_pass_rewards` (`season_id`, `level`, `track`, `rarity`, " ..
            "`item_id`, `count`, `order`) SELECT " .. newId ..
            ", `level`, `track`, `rarity`, `item_id`, `count`, `order` FROM `battle_pass_rewards` " ..
            "WHERE `season_id` = " .. prevId)

        print("[BattlePass] Rolled over to season " .. month .. "/" .. year .. " (cloned from previous).")
    else
        print("[BattlePass] Created first season " .. month .. "/" .. year .. ".")
    end

    BattlePassLib.reload()
end

-- Este fork do TFS carrega cada <event> de creaturescripts.xml/globalevents.xml num ambiente
-- Lua isolado (globals não compartilhadas nem sempre entre tags da mesma categoria — confirmado
-- via log: AUTOLOOT_CATALOG/BATTLE_PASS_SEASON reiniciam do zero em cada bloco de boot em vez de
-- reaproveitar o que já tinha carregado). Isso significa que este arquivo é dofile'd várias
-- vezes independentes, cada uma com sua PRÓPRIA cópia de BattlePassLib/BATTLE_PASS_SEASON —
-- `BattlePassLib.setMonstersLoaded()` chamado pelo globalevent de startup só corrige a cópia
-- DAQUELE ambiente, não a cópia usada por onLogin/onKill/onExtendedOpcode em
-- creaturescripts/scripts/battle_pass.lua (ambiente diferente, nunca recebe esse aviso, fica com
-- lookType = 0 pra sempre desde o dofile inicial pré-boot). Por isso cada ambiente precisa se
-- auto-corrigir sozinho: getProgress() é chamado por todo ponto de entrada real de gameplay
-- (login, kill, claim, compra), e um jogador só consegue disparar esses eventos depois que o
-- boot terminou — então a primeira chamada real é sempre pós-boot, garantindo que
-- getMonsterInfo já funcione no ambiente que a chamou, sem depender de nenhum outro ambiente.
local postBootReloaded = false
local function ensurePostBootReload()
    if postBootReloaded then return end
    postBootReloaded = true
    monstersLoaded = true
    BattlePassLib.reload()
end

function BattlePassLib.getProgress(cid)
    ensurePostBootReload()
    if not BATTLE_PASS_SEASON then return nil end
    local guid = getPlayerGUID(cid)
    if not guid then return nil end

    local res = db.getResult(
        "SELECT `xp`, `level`, `has_gold_pass`, `mission_progress`, `claimed_bronze`, `claimed_gold` " ..
        "FROM `player_battle_pass` WHERE `player_id` = " .. guid .. " AND `season_id` = " .. BATTLE_PASS_SEASON.id)

    local xp = readInt(res, "xp")
    if not xp then
        if res ~= -1 then result.free(res) end
        db.query("INSERT INTO `player_battle_pass` (`player_id`, `season_id`, `xp`, `level`, " ..
            "`has_gold_pass`, `mission_progress`, `claimed_bronze`, `claimed_gold`) VALUES (" ..
            guid .. ", " .. BATTLE_PASS_SEASON.id .. ", 0, 0, 0, '{}', '[]', '[]')")
        return { xp = 0, level = 0, hasGoldPass = false, missionProgress = {}, claimedBronze = {}, claimedGold = {} }
    end

    local okProgress, missionProgress = pcall(json.decode, readString(res, "mission_progress", "{}"))
    local okBronze, claimedBronze = pcall(json.decode, readString(res, "claimed_bronze", "[]"))
    local okGold, claimedGold = pcall(json.decode, readString(res, "claimed_gold", "[]"))

    local progress = {
        xp = xp,
        level = readInt(res, "level") or 0,
        hasGoldPass = readInt(res, "has_gold_pass") == 1,
        missionProgress = okProgress and missionProgress or {},
        claimedBronze = okBronze and claimedBronze or {},
        claimedGold = okGold and claimedGold or {},
    }
    result.free(res)
    return progress
end

function BattlePassLib.saveProgress(cid, progress)
    local guid = getPlayerGUID(cid)
    if not guid or not BATTLE_PASS_SEASON then return end

    db.query("UPDATE `player_battle_pass` SET `xp` = " .. progress.xp ..
        ", `level` = " .. progress.level ..
        ", `has_gold_pass` = " .. (progress.hasGoldPass and 1 or 0) ..
        ", `mission_progress` = " .. db.escapeString(json.encode(progress.missionProgress)) ..
        ", `claimed_bronze` = " .. db.escapeString(json.encode(progress.claimedBronze)) ..
        ", `claimed_gold` = " .. db.escapeString(json.encode(progress.claimedGold)) ..
        " WHERE `player_id` = " .. guid .. " AND `season_id` = " .. BATTLE_PASS_SEASON.id)
end

function BattlePassLib.sendUpdate(cid, progress)
    if not BATTLE_PASS_SEASON then return end
    local goldPassInfo = getItemInfo(BATTLE_PASS_SEASON.goldPassItemId)
    local levelPurchaseInfo = getItemInfo(BATTLE_PASS_SEASON.levelPurchaseItemId)
    local payload = json.encode({
        action = "update",
        season = {
            month = BATTLE_PASS_SEASON.month,
            year = BATTLE_PASS_SEASON.year,
            maxLevel = BATTLE_PASS_SEASON.maxLevel,
            xpPerLevel = BATTLE_PASS_SEASON.xpPerLevel,
            goldPassItemId = BATTLE_PASS_SEASON.goldPassItemId,
            goldPassClientId = (goldPassInfo and goldPassInfo.clientId and goldPassInfo.clientId > 0)
                and goldPassInfo.clientId or BATTLE_PASS_SEASON.goldPassItemId,
            -- Nome vindo de items.xml (server), não do items.otb do client — ver comentário em
            -- season.rewards acima, mesmo motivo (nome quase nunca embutido no OTB do client).
            goldPassItemName = goldPassInfo and goldPassInfo.name or "",
            goldPassCost = BATTLE_PASS_SEASON.goldPassCost,
            levelPurchaseItemId = BATTLE_PASS_SEASON.levelPurchaseItemId,
            levelPurchaseClientId = (levelPurchaseInfo and levelPurchaseInfo.clientId and levelPurchaseInfo.clientId > 0)
                and levelPurchaseInfo.clientId or BATTLE_PASS_SEASON.levelPurchaseItemId,
            levelPurchaseItemName = levelPurchaseInfo and levelPurchaseInfo.name or "",
            levelPurchaseCost = BATTLE_PASS_SEASON.levelPurchaseCost,
        },
        missions = BATTLE_PASS_SEASON.missions,
        rewards = BATTLE_PASS_SEASON.rewards,
        progress = progress,
    })
    doPlayerSendExtendedOpcode(cid, BATTLE_PASS_OPCODE, payload)
end

-- Aplica XP direto num `progress` já carregado, sem tocar no banco — usado tanto por addXp
-- (round-trip único) quanto por checkMissions (que já tem seu próprio `progress` em mãos).
-- IMPORTANTE: checkMissions costumava chamar BattlePassLib.addXp(cid, ...), que fazia seu PRÓPRIO
-- getProgress (uma leitura separada e desatualizada do banco) e seu próprio saveProgress no meio
-- do loop. Isso significava que o `saveProgress(cid, progress)` do FIM de checkMissions (com o
-- `progress` local dele, que já tinha o `missionProgress` atualizado mas ainda o `xp`/`level`
-- ANTIGOS) sobrescrevia de volta o XP que addXp acabara de salvar — o ganho de XP da missão nunca
-- persistia de verdade. Aplicar tudo no mesmo objeto `progress` e salvar uma vez só resolve isso.
local function applyXp(progress, amount)
    if not progress or amount <= 0 or progress.level >= BATTLE_PASS_SEASON.maxLevel then return false end

    progress.xp = progress.xp + amount
    local leveledUp = false
    while progress.level < BATTLE_PASS_SEASON.maxLevel and progress.xp >= BATTLE_PASS_SEASON.xpPerLevel do
        progress.xp = progress.xp - BATTLE_PASS_SEASON.xpPerLevel
        progress.level = progress.level + 1
        leveledUp = true
    end
    if progress.level >= BATTLE_PASS_SEASON.maxLevel then
        progress.xp = 0
    end
    return leveledUp
end

local function announceLevelUp(cid, level)
    if not isPlayer(cid) then return end
    SysChannel_send(cid, SYSCHANNEL_BATTLEPASS, "Battle Pass level up! You are now level " .. level .. ".", TALKTYPE_CHANNEL_O)
    doSendMagicEffect(getCreaturePosition(cid), CONST_ME_FIREWORK_YELLOW)
end

-- Qualquer level (1..progress.level) com reward configurado (bronze sempre conta; gold só se o
-- jogador tem o Gold Pass) que ainda não foi resgatado — usado pra avisar no popup de missão
-- concluída se vale a pena o jogador abrir o Battle Pass pra resgatar algo.
local function hasUnclaimedReward(progress)
    if not BATTLE_PASS_SEASON then return false end
    local claimedBronze, claimedGold = {}, {}
    for _, level in ipairs(progress.claimedBronze) do claimedBronze[level] = true end
    for _, level in ipairs(progress.claimedGold) do claimedGold[level] = true end

    for level = 1, progress.level do
        local bronzeRewards = BATTLE_PASS_SEASON.rewards["bronze_" .. level]
        if bronzeRewards and #bronzeRewards > 0 and not claimedBronze[level] then return true end
        if progress.hasGoldPass then
            local goldRewards = BATTLE_PASS_SEASON.rewards["gold_" .. level]
            if goldRewards and #goldRewards > 0 and not claimedGold[level] then return true end
        end
    end
    return false
end

-- Notificação dedicada (separada do `action = "update"` de sendUpdate) que o client usa pra
-- abrir uma janela modal chamando atenção do jogador — texto sempre em inglês americano, igual
-- ao resto das mensagens do sistema (não passa por tr()/tradução).
local function announceMissionComplete(cid, mission, hasClaimable)
    if not isPlayer(cid) then return end
    doPlayerSendExtendedOpcode(cid, BATTLE_PASS_OPCODE, json.encode({
        action = "missionComplete",
        description = mission.description,
        xpReward = mission.xpReward,
        hasClaimable = hasClaimable,
    }))
end

function BattlePassLib.addXp(cid, amount)
    if not BATTLE_PASS_SEASON then return end
    local progress = BattlePassLib.getProgress(cid)
    if not progress then return end

    local leveledUp = applyXp(progress, amount)
    BattlePassLib.saveProgress(cid, progress)
    if leveledUp then announceLevelUp(cid, progress.level) end
    BattlePassLib.sendUpdate(cid, progress)
end

local function checkMissions(cid, matches)
    if not BATTLE_PASS_SEASON or not isPlayer(cid) then return end
    local progress = BattlePassLib.getProgress(cid)
    if not progress then return end

    local changed, leveledUp = false, false
    local completedMissions = {}
    for _, mission in ipairs(BATTLE_PASS_SEASON.missions) do
        if matches(mission) then
            local key = tostring(mission.id)
            local required = mission.target.amount or 1
            local current = progress.missionProgress[key] or 0
            if current < required then
                current = current + 1
                progress.missionProgress[key] = current
                changed = true
                if current < required then
                    local text
                    if mission.type == "kill_monster" and mission.target.monster then
                        text = "Keep killing " .. mission.target.monster .. " [" .. current .. " of " .. required ..
                            "] to complete the Battle Pass mission"
                    else
                        text = "Battle Pass mission progress: " .. (mission.description or "") ..
                            " [" .. current .. " of " .. required .. "]"
                    end
                    SysChannel_send(cid, SYSCHANNEL_BATTLEPASS, text, TALKTYPE_CHANNEL_W)
                end
                if current >= required then
                    SysChannel_send(cid, SYSCHANNEL_BATTLEPASS, "Mission completed: " .. (mission.description or "") ..
                        " (+" .. (mission.xpReward or 0) .. " XP)", TALKTYPE_CHANNEL_O)
                    table.insert(completedMissions, mission)
                    if applyXp(progress, mission.xpReward) then
                        leveledUp = true
                    end
                end
            end
        end
    end

    if changed then
        BattlePassLib.saveProgress(cid, progress)
        if leveledUp then announceLevelUp(cid, progress.level) end
        BattlePassLib.sendUpdate(cid, progress)

        -- Calculado com o `progress` já final (depois de todo XP/level-up desta leva) — se um
        -- kill completar 2 missões ao mesmo tempo, cada popup reflete corretamente se já dá pra
        -- resgatar algo, e não o estado (potencialmente desatualizado) de antes das outras terem
        -- sido processadas.
        local hasClaimable = hasUnclaimedReward(progress)
        for _, mission in ipairs(completedMissions) do
            announceMissionComplete(cid, mission, hasClaimable)
        end
    end
end

function BattlePassLib.onKill(cid, target)
    if not isMonster(target) then return end
    local monsterName = string.lower(getCreatureName(target))

    checkMissions(cid, function(mission)
        return mission.type == "kill_monster"
            and mission.target.monster
            and string.lower(mission.target.monster) == monsterName
    end)
end

function BattlePassLib.onQuestCompleted(cid, questId)
    checkMissions(cid, function(mission)
        return mission.type == "quest" and mission.target.questId == questId
    end)
end

function BattlePassLib.claimReward(cid, level, track)
    if not BATTLE_PASS_SEASON then return false, "There is no active battle pass." end
    if track ~= "bronze" and track ~= "gold" then return false, "Invalid track." end

    local progress = BattlePassLib.getProgress(cid)
    if not progress then return false, "Error loading progress." end
    if progress.level < level then return false, "You haven't reached this level yet." end
    if track == "gold" and not progress.hasGoldPass then return false, "You need the Gold Pass." end

    local claimedList = track == "gold" and progress.claimedGold or progress.claimedBronze
    for _, claimedLevel in ipairs(claimedList) do
        if claimedLevel == level then return false, "Already claimed." end
    end

    local rewards = BATTLE_PASS_SEASON.rewards[track .. "_" .. level]
    if not rewards or #rewards == 0 then return false, "No reward configured for this level." end

    for _, reward in ipairs(rewards) do
        doPlayerAddItem(cid, reward.itemId, reward.count)
    end
    table.insert(claimedList, level)
    if track == "gold" then progress.claimedGold = claimedList else progress.claimedBronze = claimedList end

    BattlePassLib.saveProgress(cid, progress)
    BattlePassLib.sendUpdate(cid, progress)
    doSendMagicEffect(getCreaturePosition(cid), CONST_ME_GIFT_WRAPS)
    return true, "Reward claimed!"
end

function BattlePassLib.buyLevel(cid)
    if not BATTLE_PASS_SEASON then return false, "There is no active battle pass." end
    if BATTLE_PASS_SEASON.levelPurchaseItemId == 0 then return false, "Level purchase is not enabled this season." end

    local progress = BattlePassLib.getProgress(cid)
    if not progress then return false, "Error loading progress." end
    if progress.level >= BATTLE_PASS_SEASON.maxLevel then return false, "You are already at max level." end

    if getPlayerItemCount(cid, BATTLE_PASS_SEASON.levelPurchaseItemId) < BATTLE_PASS_SEASON.levelPurchaseCost then
        return false, "Not enough currency."
    end

    doPlayerRemoveItem(cid, BATTLE_PASS_SEASON.levelPurchaseItemId, BATTLE_PASS_SEASON.levelPurchaseCost)
    progress.level = progress.level + 1
    progress.xp = 0
    BattlePassLib.saveProgress(cid, progress)
    BattlePassLib.sendUpdate(cid, progress)
    doSendMagicEffect(getCreaturePosition(cid), CONST_ME_FIREWORK_YELLOW)
    return true, "Level purchased!"
end

function BattlePassLib.buyGoldPass(cid)
    if not BATTLE_PASS_SEASON then return false, "There is no active battle pass." end
    if BATTLE_PASS_SEASON.goldPassItemId == 0 then return false, "Gold Pass is not purchasable this season." end

    local progress = BattlePassLib.getProgress(cid)
    if not progress then return false, "Error loading progress." end
    if progress.hasGoldPass then return false, "You already have the Gold Pass." end

    if getPlayerItemCount(cid, BATTLE_PASS_SEASON.goldPassItemId) < BATTLE_PASS_SEASON.goldPassCost then
        return false, "Not enough currency."
    end

    doPlayerRemoveItem(cid, BATTLE_PASS_SEASON.goldPassItemId, BATTLE_PASS_SEASON.goldPassCost)
    progress.hasGoldPass = true
    BattlePassLib.saveProgress(cid, progress)
    BattlePassLib.sendUpdate(cid, progress)
    return true, "Gold Pass purchased!"
end

if not BATTLE_PASS_SEASON then
    BattlePassLib.ensureSeason()
end
