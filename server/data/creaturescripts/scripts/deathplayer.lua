-- Registra a morte de jogadores no canal Deaths (data/lib/system_channels_lib.lua).
-- Morto por jogador (ou summon de jogador) = vermelho; por monstro/outros = laranja.
function onDeath(cid, corpse, deathList)
    if not isPlayer(cid) then
        return true
    end

    local killer = SysChannel_resolveKiller(deathList and deathList[1])
    local killerText, byPlayer = SysChannel_describeKiller(killer)

    local text = SysChannel_timestamp() .. " " .. getCreatureName(cid) .. " [" .. getPlayerLevel(cid) ..
        "] foi morto por " .. killerText .. "."
    SysChannel_broadcast(SYSCHANNEL_DEATHS, text, byPlayer and TALKTYPE_CHANNEL_RN or TALKTYPE_CHANNEL_O)
    return true
end

function onLogin(cid)
    registerCreatureEvent(cid, "DeathPlayer")
    return true
end
