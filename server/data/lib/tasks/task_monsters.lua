-- Monster Database for Task System
-- Uses getMonsterInfo() to read monster data from data/monster/*.xml dynamically

function TaskMonsters_getData(monsterName)
    if not monsterName then return nil end
    local ok, info = pcall(getMonsterInfo, monsterName)
    if ok and info then
        return {
            name = monsterName,
            lookType = info.lookType or 0,
            level = info.level or 0,
            hp = info.health or 0,
            exp = info.experience or 0,
            speed = info.speed or 0
        }
    end
    return nil
end

function TaskMonsters_getAllData(monsterNames)
    local result = {}
    for _, name in ipairs(monsterNames) do
        local data = TaskMonsters_getData(name)
        if data then
            table.insert(result, data)
        end
    end
    return result
end
