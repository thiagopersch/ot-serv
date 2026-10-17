-- Generic Vocation Unlock Item
dofile("data/lib/change_vocation.lua")

-- config example: { [itemId] = vocationId }
-- Gotenks -> 49523
-- C16 -> 49508
-- Jenk -> 49525, 49529
-- Trunks -> 49530
local config = {
    [49527] = 1, -- Bardock
    -- [] = 2, -- Bills
    -- [] = 3, -- Botamo
    [49528] = 4,  -- Brolly
    -- [] = 5, -- Bulma
    [49512] = 6,  -- Buu
    -- [] = 7, -- C8
    [49518] = 8,  -- C17
    [49519] = 9,  -- C18
    -- [] = 10, -- Cabba
    [49516] = 11, -- Cell
    [49520] = 12, -- Cooler
    [49522] = 13, -- Dende
    [49524] = 14, -- Freeza
    [49525] = 15, -- Ginn
    [49515] = 16, -- Gohan
    [49509] = 17, -- Goku
    -- [] = 18, -- Goku Black
    -- [] = 19, -- Hitto
    -- [] = 20, -- Janemba
    -- [] = 21, -- Jiren
    -- [] = 22, -- Kagome
    [49526] = 23, -- Kaio
    -- [] = 24, -- Mestre Kame
    -- [] = 25, -- King Cold
    -- [] = 26, -- King Vegeta
    -- [] = 27, -- Kuririn
    -- [] = 28, -- Liquir
    -- [] = 29, -- Pan
    [49513] = 30, -- Piccolo
    -- [] = 31, -- Quitela
    -- [] = 32, -- Raditz
    -- [] = 33, -- Shenron
    -- [] = 34, -- Tapion
    [49511] = 35, -- Trunks
    [49521] = 36, -- Tsuful
    -- [] = 37, -- Turles
    [49517] = 38, -- Uub
    -- [] = 39, -- Vados
    [49510] = 40, -- Vegeta
    -- [] = 41, -- Vegetto
    -- [] = 42, -- Vermouth
    -- [] = 43, -- Videl
    -- [] = 44, -- Zaiko
    -- [] = 45, -- Zeno

    -- [] = 47, -- Sosuke Aizen
    -- [] = 48, -- Byakuya Kuchiki
    -- [] = 49, -- Gin Ichimaru
    -- [] = 50, -- Grimmjow Jaegerjaquez
    -- [] = 51, -- Toshiro Hitsugaya
    -- [] = 52, -- Ichigo Kurosaki FullBring
    -- [] = 53, -- Ichigo Kurosaki
    -- [] = 54, -- Uryu Ishida
    -- [] = 55, -- Shunsui Kyoraku
    -- [] = 56, -- Nelliel Tu Odelschwanck
    -- [] = 57, -- Orihime Inoue
    -- [] = 58, -- Renji Abarai
    -- [] = 59, -- Rukia Kuchiki
    -- [] = 60, -- Yasutora Sado
    -- [] = 61, -- Shinji Hirako
    -- [] = 62, -- Soi fon
    -- [] = 63, -- Kaname Tosen
    -- [] = 64, -- Ulquiorra Cifer
    -- [] = 65, -- Kisuke Urahara
    -- [] = 66, -- Yoruichi Shihouin
    -- [] = 67, -- Kenpachi Zaraki
}

function onUse(cid, item, fromPosition, itemEx, toPosition)
    local vocId = config[item.itemid]
    if not vocId then
        return false
    end

    if ChangeVocation.isUnlocked(cid, vocId) then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL,
            "You have already unlocked the " .. ChangeVocation.getVocationName(vocId) .. " vocation.")
        return true
    end

    ChangeVocation.unlockVocation(cid, vocId)
    doRemoveItem(item.uid, 1)

    doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR,
        "You have successfully unlocked the " .. ChangeVocation.getVocationName(vocId) .. " vocation!")
    doSendMagicEffect(getCreaturePosition(cid), 13) -- Effect 13 (magical) ou CONST_ME_HOLYDAMAGE

    ChangeVocation.syncPlayer(cid)
    return true
end
