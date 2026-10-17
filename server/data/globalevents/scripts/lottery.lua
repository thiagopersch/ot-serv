local config = {
    lottery_hour = "2 hours", -- Time to next lottery (only for broadcast message, real time you can set on globalevents.xml)
    rewards_id = {
        2160, 5801, 23816, 49468, 49723, 49535, 49540, 49583, 49551, 49571, 49596, 49609, 49620, 49686, 49756, 49674, 49669, 49503, 49504, 49505, 49506, 49507
    },                   -- Rewards ID
    crystal_counts = 10, -- Used only if on rewards_id is crystal coin (ID: 2160).
    website = "yes"      -- Only if you have php scripts and table `lottery` in your database!
}
function onThink(interval, lastExecution)
    if (getWorldCreatures(0) == 0) then return true end

    local list = {}
    for i, tid in ipairs(getPlayersOnline()) do list[i] = tid end

    local winner = list[math.random(1, #list)]
    local random_item = config.rewards_id[math.random(1, #config.rewards_id)]

    if (random_item == 2148) or (random_item == 2152) or (random_item == 2160) then
        -- if (random_item == rewards_id) then
        doPlayerAddItem(winner, random_item, config.crystal_counts)
        doBroadcastMessage("[LOTTERY] Winner: " .. getCreatureName(winner) ..
            ", Reward: " .. config.crystal_counts .. " " ..
            getItemNameById(random_item) ..
            "s! Congratulations! (Next draw in " ..
            config.lottery_hour .. ").", "warning", "top")
    else
        doBroadcastMessage("[LOTTERY] Winner: " .. getCreatureName(winner) ..
            ", Reward: " .. getItemNameById(random_item) ..
            "! Congratulations! (Next draw in " ..
            config.lottery_hour .. ").", "warning", "top")
        doPlayerAddItem(winner, random_item, 1)
    end

    if (config.website == "yes") then
        db.query("INSERT INTO `lottery` (`name`, `item`) VALUES ('" ..
            getCreatureName(winner) .. "', '" ..
            getItemNameById(random_item) .. "');")
    end
    return true
end
