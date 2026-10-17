dofile("data/lib/change_vocation.lua")

function onStepIn(cid, item, position, fromPosition)
    if not isPlayer(cid) then return true end
    ChangeVocation.open(cid)
    return true
end

-- Fechar janela ao sair do piso
function onStepOut(cid, item, position, fromPosition)
    if not isPlayer(cid) then return true end
    ChangeVocation.close(cid)
    return true
end
