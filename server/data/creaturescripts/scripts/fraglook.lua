-- Fraglook & Stats System using profile_lib.lua

if not ServerConfigLib then dofile("data/lib/server_config_lib.lua") end

function onLogin(cid)
    registerCreatureEvent(cid, "fraglook")
    return true
end

function onLook(cid, thing, position, lookDistance)
    if not isPlayer(thing.uid) then
        return true
    end

    local target = thing.uid
    local isSelf = (target == cid)

    -- Metadata
    local name = getCreatureName(target)
    local level = getPlayerLevel(target)
    local sex = getPlayerSex(target) -- 0 = female, 1 = male
    local vocation = getPlayerVocationName(target)

    -- Pronouns & Prefixes
    local subject = isSelf and "You" or (sex == 0 and "She" or "He")
    local verb = isSelf and "are" or "is"
    local prefix = subject .. " " .. verb

    -- 1. Base Description
    local description = ""
    if isSelf then
        description = "You see yourself."
    else
        description = string.format("You see %s (Level %d).", name, level)
    end

    -- Vocation / Group logic
    if getPlayerFlagValue(target, PLAYERFLAG_SHOWGROUPINSTEADOFVOCATION) then
        description = description .. string.format(" %s %s.", prefix, getPlayerGroupName(target))
    elseif vocation ~= "None" and vocation ~= "" then
        description = description .. string.format(" %s a %s.", prefix, vocation)
    else
        description = description .. string.format(" %s with no vocation.", prefix)
    end

    -- Guild Information
    local guildId = getPlayerGuildId(target)
    if guildId > 0 then
        local rank = getPlayerGuildRank(target)
        local guildName = getPlayerGuildName(target)
        local nick = getPlayerGuildNick(target)
        description = description .. string.format(" %s %s of the %s%s.",
            prefix,
            (rank == "" and "a member" or rank),
            guildName,
            (nick ~= "" and " (" .. nick .. ")" or "")
        )
    end

    -- Marriage Information
    local partnerGuid = getPlayerPartner(target)
    if partnerGuid > 0 then
        local partnerName = getPlayerNameByGUID(partnerGuid)
        if partnerName then
            description = description .. string.format(" %s the %s of %s.",
                prefix,
                (sex == 0 and "wife" or "husband"),
                partnerName
            )
        end
    end

    -- 2. Stats (Age, Frags, Resets) - Visible to ALL
    local age = getPlayerAgeReal(target)
    local ageTitle = getAgeTitle(age)
    local frags = getPlayerFrags(target)
    local resets = getPlayerResets(target)
    local ageTitle = getAgeTitle(age)

    if age < 2 then
        ageTitle = "year"
    else
        ageTitle = "years"
    end

    description = description .. string.format("\n[Age: %d %s (%s)]", age, ageTitle, getAgeTitle(age))
    description = description .. string.format("\n[Frags: %d]\n[Resets: %d]", frags, resets)

    local dodge = math.max(0, getPlayerStorageValue(target, 48700))
    local critical = math.max(0, getPlayerStorageValue(target, 48701))
    local dodgeCap = ServerConfigLib.getDodgeCap()
    local criticalCap = ServerConfigLib.getCriticalCap()
    description = description .. string.format("\n[Critical: %d/%d, Dodge: %d/%d]",
        critical, criticalCap, dodge, dodgeCap)

    -- 3. GOD Only Details
    -- Using common flags for details/position visibility
    local canSeeDetails = getPlayerFlagValue(cid, PLAYERCUSTOMFLAG_CANSEECREATUREDETAILS)
    local canSeePos = getPlayerFlagValue(cid, PLAYERCUSTOMFLAG_CANSEEPOSITION)

    if canSeeDetails then
        local hp = getCreatureHealth(target)
        local maxHp = getCreatureMaxHealth(target)
        local mana = getCreatureMana(target)
        local maxMana = getCreatureMaxMana(target)
        local ip = doConvertIntegerToIp(getPlayerIp(target))

        description = description .. string.format("\nLife: [%d / %d]", hp, maxHp)
        description = description .. string.format("\nReiatsu/Ki: [%d / %d]", mana, maxMana)
        description = description .. string.format("\nIP: [%s]", ip)
    end

    -- Task Rank
    if isPlayer(target) then
        local ok = pcall(function()
            if TaskRank_getPlayerRankName then
                local rankName, rankPoints = TaskRank_getPlayerRankName(target)
                if rankName and rankName ~= "Unranked" then
                    description = description .. string.format("\n[Task Rank: %s | %d pts]", rankName, rankPoints)
                end
            end
        end)
    end

    if canSeePos then
        description = description ..
            string.format("\nPosition: [X:%d] [Y:%d] [Z:%d]", position.x, position.y, position.z)
    end


    -- Append any other special description that might exist
    local special = getPlayerSpecialDescription(target)
    if special ~= "" then
        description = description .. "\n" .. special
    end

    doPlayerSendTextMessage(cid, MESSAGE_INFO_DESCR, description)
    return false -- Cancel default message to show our custom one
end
