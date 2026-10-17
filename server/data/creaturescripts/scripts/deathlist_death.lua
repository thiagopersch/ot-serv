if not Deathlist then dofile("data/lib/deathlist_lib.lua") end

-- Grava bless, level antes/depois e itens perdidos de cada morte (player_death_details/items).
-- Sempre retorna true: false aqui cancelaria o corpo e o loot.
function onDeath(cid, corpse, deathList)
    if isPlayer(cid) then
        local ok, err = pcall(Deathlist.onPlayerDeath, cid)
        if not ok then
            print("[Deathlist] Erro ao registrar morte: " .. tostring(err))
        end
    end
    return true
end
