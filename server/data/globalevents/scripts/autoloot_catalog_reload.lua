if not AutolootCatalog_reload then dofile("data/lib/autoloot_lib.lua") end

function onThink(interval)
    AutolootCatalog_reload()
    return true
end
