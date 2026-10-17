if not BattlePassLib then dofile("data/lib/battle_pass_lib.lua") end

function onLogin(cid)
    registerCreatureEvent(cid, "BattlePassKill")
    registerCreatureEvent(cid, "BattlePassOpcode")

    local progress = BattlePassLib.getProgress(cid)
    if progress then
        BattlePassLib.sendUpdate(cid, progress)
    end
    return true
end

function onKill(cid, target, lastHit)
    if not isPlayer(cid) or not isMonster(target) then return true end

    local master = getCreatureMaster(target)
    if master ~= target and isPlayer(master) then
        return true
    end

    BattlePassLib.onKill(cid, target)
    return true
end

function onExtendedOpcode(cid, opcode, buffer)
    if opcode ~= BATTLE_PASS_OPCODE then return true end

    local ok, req = pcall(json.decode, buffer)
    if not ok or type(req) ~= "table" then return true end

    if req.action == "request" then
        local progress = BattlePassLib.getProgress(cid)
        if progress then BattlePassLib.sendUpdate(cid, progress) end
    elseif req.action == "claim" then
        local success, message = BattlePassLib.claimReward(cid, tonumber(req.level), tostring(req.track))
        SysChannel_send(cid, SYSCHANNEL_BATTLEPASS, message, success and TALKTYPE_CHANNEL_O or TALKTYPE_CHANNEL_RN)
    elseif req.action == "buyGoldPass" then
        local success, message = BattlePassLib.buyGoldPass(cid)
        SysChannel_send(cid, SYSCHANNEL_BATTLEPASS, message, success and TALKTYPE_CHANNEL_O or TALKTYPE_CHANNEL_RN)
    elseif req.action == "buyLevel" then
        local success, message = BattlePassLib.buyLevel(cid)
        SysChannel_send(cid, SYSCHANNEL_BATTLEPASS, message, success and TALKTYPE_CHANNEL_O or TALKTYPE_CHANNEL_RN)
    end

    return true
end
