dofile("data/lib/tasks/task_rank.lua")

function onLook(cid, thing, position, lookDistance)
    if isPlayer(thing.uid) then
        local desc = TaskRank_formatLookDescription(thing.uid)
        if desc ~= "" then
            local current = getCreatureDescription(thing.uid) or ""
            -- TFS 0.4 usa doCreatureChangeDescription ou similar
            -- Verifique qual função seu TFS suporta
        end
    end
    return true
end

-- function onLook(cid, thing, position, lookDistance)
--     if isPlayer(thing.uid) then
--         local desc = TaskRank_formatLookDescription(thing.uid)
--         if desc ~= "" then
--             doPlayerSetSpecialDescription(thing.uid, desc)
--         end
--     end
--     return true
-- end
