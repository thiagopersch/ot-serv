-- Anuncia no canal Bosses a morte de um boss e quem deu o ultimo golpe.
-- Registrado no XML de cada boss: <script><event name="BossChannelDeath"/></script>
function onDeath(cid, corpse, deathList)
    if not isMonster(cid) then
        return true
    end

    local name = getCreatureName(cid)
    BossSystem_clearAlive(name, cid)

    local killer = SysChannel_resolveKiller(deathList and deathList[1])
    local killerText = SysChannel_describeKiller(killer)

    SysChannel_broadcast(SYSCHANNEL_BOSSES, SysChannel_timestamp() .. " O boss " .. name ..
        " foi derrotado! Ultimo golpe: " .. killerText .. ".", TALKTYPE_CHANNEL_RN)
    return true
end
