if not BattlePassLib then dofile("data/lib/battle_pass_lib.lua") end

-- Cheap check every 5 minutes: ensureSeason() only does real work (clone previous season)
-- the first time it's called after the month rolls over.
function onThink(interval)
    BattlePassLib.ensureSeason()
    return true
end

-- Roda depois que o boot completo termina (monstros já carregados) — battle_pass_lib.lua é
-- carregado como mod, antes dos monstros, então a resolução inicial de looktype das missions
-- (feita no dofile do mod, via ensureSeason -> reload) ficaria com lookType = 0 e sem essa
-- liberação nunca tentaria de novo. setMonstersLoaded() libera a resolução e o reload()
-- recalcula tudo certo, sem log de erro (ver comentário em battle_pass_lib.lua).
function onStartup()
    BattlePassLib.setMonstersLoaded()
    BattlePassLib.reload()
    return true
end
