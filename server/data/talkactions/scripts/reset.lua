local initialOutfits = {
    [1] = 1683,  -- Bardock
    [2] = 1711,  -- Bills
    [3] = 1731,  -- Botamo
    [4] = 1739,  -- Brolly
    [5] = 1748,  -- Bulma
    [6] = 1755,  -- Buu
    [7] = 1777,  -- C8
    [8] = 1777,  -- C17
    [9] = 1777,  -- C18
    [10] = 1794, -- Cabba
    [11] = 1804, -- Cell
    [12] = 1811, -- Cooler
    [13] = 1822, -- Dende
    [14] = 1835, -- Freeza
    [15] = 1845, -- Ginn
    [16] = 1854, -- Gohan
    [17] = 1881, -- Goku
    [18] = 1869, -- Goku Black
    [19] = 1900, -- Hitto
    [20] = 1909, -- Janemba
    [21] = 1917, -- Jiren
    [22] = 1931, -- Kagome
    [23] = 1942, -- Kaio
    [24] = 1951, -- Kame
    [25] = 1963, -- King Cold
    [26] = 1973, -- King Vegeta
    [27] = 1984, -- Kuririn
    [28] = 1995, -- Liquir
    [29] = 2003, -- Pan
    [30] = 2012, -- Piccolo
    [31] = 2025, -- Quitela
    [32] = 2034, -- Raditz
    [33] = 2048, -- Shenron
    [34] = 2051, -- Tapion
    [35] = 2066, -- Trunks
    [36] = 2079, -- Tsuful
    [37] = 2093, -- Turles
    [38] = 2106, -- Uub
    [39] = 2113, -- Vados
    [40] = 2121, -- Vegeta
    [41] = 2135, -- Vegetto
    [42] = 1697, -- Vermouth
    [43] = 2144, -- Videl
    [44] = 2151, -- Zaiko
    [45] = 2163, -- Zeno
    [47] = 2176, -- Aizen
    [48] = 2185, -- Byakuya
    [49] = 2193, -- Gin
    [50] = 2199, -- Grimmjow
    [51] = 2207, -- Hitsugaya
    [52] = 2218, -- Ichigo FullBring
    [53] = 2227, -- Ichigo
    [54] = 2239, -- Ishida
    [55] = 2250, -- Kyouraku
    [56] = 2255, -- Neliel
    [57] = 2262, -- Orihime
    [58] = 2268, -- Renji
    [59] = 2276, -- Rukia
    [60] = 2280, -- Sado
    [61] = 2291, -- Shinji
    [62] = 2303, -- Soi Fong
    [63] = 2309, -- Tousen
    [64] = 2315, -- Ulquiorra
    [65] = 2323, -- Urahara
    [66] = 2332, -- Yoruichi
    [67] = 2339  -- Zaraki
}

local config = {
    backToLevel = 1,         -- Nível para o qual resetar
    resetLevelFree = 350,    -- Nível mínimo necessário para reset (contas gratuitas)
    resetLevelPremium = 330, -- Nível mínimo necessário para reset (contas premium)
    redSkull = false,        -- Não pode ter caveira vermelha/preta para resetar
    battle = false,          -- Não pode estar em batalha para resetar
    pz = true,               -- Deve estar em zona de proteção para resetar
}

-- Função para obter a quantidade de resets do jogador no banco de dados
local function getPlayerResets(cid)
    local result = db.getResult("SELECT `resets` FROM `players` WHERE `id` = " .. getPlayerGUID(cid))
    if result:getID() ~= -1 then
        local resets = result:getDataInt("resets")
        result:free()
        return resets < 0 and 0 or resets
    end
    return 0
end

-- Função para incrementar a contagem de resets no banco de dados
local function doPlayerAddResets(cid)
    db.query("UPDATE `players` SET `resets` = `resets` + 1 WHERE `id` = " .. getPlayerGUID(cid))
end

-- Manipulador do comando de reset
function onSay(cid, words, param)
    -- Verifica se o jogador está na transformação inicial
    local vocation = getPlayerVocation(cid)
    if not initialOutfits[vocation] then
        doPlayerSendTextMessage(cid, MESSAGE_EVENT_ORANGE, "Your vocation does not have transformations.")
        return true
    end

    local initialOutfit = initialOutfits[vocation]
    local currentOutfit = getCreatureOutfit(cid).lookType
    if currentOutfit ~= initialOutfit then
        doPlayerSendTextMessage(cid, MESSAGE_EVENT_ORANGE, "You must be in your initial transformation to reset.")
        return true
    end

    -- Verifica status de caveira (vermelha ou preta)
    if config.redSkull and (getCreatureSkullType(cid) == SKULL_RED or getCreatureSkullType(cid) == SKULL_BLACK) then
        doPlayerSendTextMessage(cid, MESSAGE_EVENT_ORANGE, "You cannot reset while having a red or black skull.")
        return true
    end

    -- Verifica zona de proteção
    if config.pz and not getTilePzInfo(getCreaturePosition(cid)) then
        doPlayerSendTextMessage(cid, MESSAGE_EVENT_ORANGE, "You must be in a protection zone to reset.")
        return true
    end

    -- Verifica status de batalha
    if config.battle and getCreatureCondition(cid, CONDITION_INFIGHT) then
        doPlayerSendTextMessage(cid, MESSAGE_EVENT_ORANGE, "You cannot reset while in battle.")
        return true
    end

    -- Determina o nível necessário com base no tipo de conta
    local resetLevel = isPremium(cid) and config.resetLevelPremium or config.resetLevelFree

    -- Verifica se o jogador atende ao requisito de nível
    if getPlayerLevel(cid) < resetLevel then
        doPlayerSendTextMessage(cid, MESSAGE_EVENT_ORANGE, "You need to be at least level " .. resetLevel .. " to reset.")
        return true
    end

    -- Realiza o reset
    local healthMax, manaMax = getCreatureMaxHealth(cid), getCreatureMaxMana(cid)
    local levelBeforeReset = getPlayerLevel(cid)
    local newResetNumber = getPlayerResets(cid) + 1
    doPlayerAddLevel(cid, -(getPlayerLevel(cid) - config.backToLevel)) -- Reseta para backToLevel
    setCreatureMaxHealth(cid, healthMax)
    setCreatureMaxMana(cid, manaMax)
    doPlayerAddResets(cid) -- Incrementa a contagem de resets no banco de dados

    -- Histórico de nível-por-reset, usado pelo portal para calcular a "Média" (ver AGENTS.md).
    db.query("INSERT INTO `player_reset_history` (`player_id`, `reset_number`, `level`, `created_at`) VALUES (" ..
        getPlayerGUID(cid) .. ", " .. newResetNumber .. ", " .. levelBeforeReset .. ", NOW())")

    doSendMagicEffect(getCreaturePosition(cid), CONST_ME_FIREWORK_RED)
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE,
        "You have reset your level! You now have " .. getPlayerResets(cid) .. " reset(s).")

    return true
end
