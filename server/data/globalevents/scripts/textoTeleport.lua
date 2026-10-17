local positions = {
    [1] = {
        message = "Initial items",
        pos = { x = 32000, y = 32004, z = 7 },
        color = { 205, 210 },
        effect = { 55 }
    },
    [2] = {
        message = "Trainers",
        pos = { x = 31893, y = 32222, z = 7 },
        color = { 205, 210 },
        effect = { 251 }
    },
    [3] = {
        message = "PvP",
        pos = { x = 31893, y = 32224, z = 7 },
        color = { 205, 210 },
        effect = { 10 }
    },
    [4] = {
        message = "Change vocation",
        pos = { x = 31910, y = 32208, z = 7 },
        color = { 205, 210 },
        effect = { 39, 55 }
    },
    [5] = {
        message = "To become a citizen of the city",
        pos = { x = 31942, y = 32226, z = 7 },
        color = { 205, 210 },
        effect = { 16 }
    },
    [6] = {
        message = "To become a citizen of the city",
        pos = { x = 32459, y = 31681, z = 7 },
        color = { 205, 210 },
        effect = { 16 }
    },
    [7] = {
        message = "PvP",
        pos = { x = 32453, y = 31681, z = 7 },
        color = { 205, 210 },
        effect = { 10 }
    },
    [8] = {
        message = "Change vocation",
        pos = { x = 32464, y = 31709, z = 7 },
        color = { 205, 210 },
        effect = { 39, 55 }
    },
    [9] = {
        message = "Trainers",
        pos = { x = 32463, y = 31681, z = 7 },
        color = { 205, 210 },
        effect = { 251 }
    },
}

function onThink(cid, interval, lastExecution)
    for _, pos in ipairs(positions) do
        for _, effect in ipairs(pos.effect) do
            if (#pos.effect > 0) then
                doSendMagicEffect(pos.pos, effect)
            end
        end
        doSendAnimatedText(pos.pos, pos.message, #pos.color > 0 and pos.color[math.random(#pos.color)] or 215)
    end
    return true
end
