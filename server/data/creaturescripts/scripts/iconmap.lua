local config = {
    storage = 30001,
    version = 1,
    marks = {
        { mark = 5, pos = { x = 31999, y = 32001, z = 6 }, desc = "Beginning of your story" },
        { mark = 4, pos = { x = 32000, y = 32021, z = 6 }, desc = "Dragon" }
    }
}

local f_addMark = doPlayerAddMapMark
if (not f_addMark) then f_addMark = doAddMapMark end

function onThink(cid, interval)
    if (isPlayer(cid) ~= TRUE or getPlayerStorageValue(cid, config.storage) == config.version) then
        return
    end

    for _, m in pairs(config.marks) do
        f_addMark(cid, m.pos, m.mark, m.desc ~= nil and m.desc or "")
    end
    setPlayerStorageValue(cid, config.storage, config.version)
    return TRUE
end
