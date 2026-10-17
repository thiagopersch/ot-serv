dofile("data/lib/donate_tier.lua")

-- Bônus aproximado de XP/loot por tier de donate (ver data/lib/donate_tier.lua).
--
-- Isto NÃO é uma multiplicação exata do ganho de experiência/drop nativos — o engine calcula
-- ambos inteiramente em C++ (Player::rateExperience / Monsters::createLoot), sem nenhum hook
-- Lua disponível para experiência (não existe CREATURE_EVENT_GAINEXPERIENCE) nem para loot.
-- Em vez disso: concede um bônus de experiência somado por cima (proporcional à exp base do
-- monstro) e rerola a própria tabela de loot do monstro com chance aumentada em bonusPct%,
-- devolvendo os itens extras numa backpack no corpo — mesmo padrão de
-- data/creaturescripts/scripts/monsterBoost.lua (addBonusLoot), reaproveitado aqui.

local ignoredLootIds = { 1987 } -- não duplica a própria backpack como item de loot

local function addBonusLoot(cid, position, monsterName, bonusPct)
    local corpse = 0
    for i = 0, 255 do
        position.stackpos = i
        corpse = getTileThingByPos(position)
        if corpse.uid > 0 and isCorpse(corpse.uid) then
            break
        end
    end
    if corpse == 0 or corpse.uid == 0 then return end

    local monsterLoot = getMonsterLootList(monsterName)
    local bonusBackpack = doCreateItemEx(1987, 1)
    local bonusItems = {}

    for _, loot in pairs(monsterLoot) do
        if math.random(1, 100000) <= (loot.chance * bonusPct / 100) then
            if not isInArray(ignoredLootIds, loot.id) then
                local count = loot.countmax and math.random(1, loot.countmax) or 1
                doAddContainerItem(bonusBackpack, loot.id, count)
                table.insert(bonusItems, count .. "x " .. getItemNameById(loot.id))
            end
        end
    end

    -- Mesmo padrão de monsterBoost.lua: sempre entrega a backpack no corpo (vazia se o roll
    -- não acertou nenhum item extra), evitando lidar com remoção de item aqui.
    doAddContainerItemEx(corpse.uid, bonusBackpack)
    if #bonusItems > 0 then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
            "[Donate] Loot bônus: " .. table.concat(bonusItems, ", ") .. ".")
    end
end

function onKill(cid, target, lastHit)
    if not lastHit or not isPlayer(cid) or not isMonster(target) then return true end

    local master = getCreatureMaster(target)
    if master ~= target and isPlayer(master) then return true end

    local tier = DonateTier.getAccountDonateTier(getPlayerAccountId(cid))
    if tier.bonusPct <= 0 then return true end

    local monsterName = getCreatureName(target)
    local monsterInfo = getMonsterInfo(monsterName)
    if monsterInfo and monsterInfo.experience then
        local baseExp = monsterInfo.experience * getExperienceStage(getPlayerLevel(cid))
        local bonusExp = math.ceil(baseExp * tier.bonusPct / 100)
        if bonusExp > 0 then
            doPlayerAddExperience(cid, bonusExp)
            addEvent(doSendAnimatedText, 50, getThingPos(cid), "+" .. bonusExp .. " exp (donate)", 19)
        end
    end

    addEvent(addBonusLoot, 10, cid, getThingPos(target), monsterName, tier.bonusPct)
    return true
end
