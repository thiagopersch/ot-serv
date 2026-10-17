json = dofile("data/lib/json.lua")
dofile("data/lib/tasks/task_db_loader.lua")
dofile("data/lib/tasks/task_cache.lua")
dofile("data/lib/tasks/task_storage.lua")
dofile("data/lib/tasks/task_rank.lua")
dofile("data/lib/tasks/task_rewards.lua")
dofile("data/lib/tasks/task_kill.lua")
dofile("data/lib/tasks/task_delivery.lua")
dofile("data/lib/tasks/task_core.lua")
dofile("data/lib/tasks/task_network.lua")
dofile("data/lib/tasks/task_npc.lua")

-- Este globalevent já rodava a cada 5min (ver globalevents.xml) só para salvar progresso dos
-- jogadores; aproveitamos o mesmo tick para recarregar o catálogo de tasks do banco, então
-- edições feitas em `/admin/tasks` propagam pro jogo sem reiniciar o servidor.
function onThink(interval)
    TaskConfig_reload()
    TaskStorage_saveAll()
    return true
end
