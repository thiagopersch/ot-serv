-- Resgata a recompensa de uma quest já concluída (chamado pelo botão do quest log, OTC:
-- cliente/modules/game_questlog/questlog.lua, markQuest()). Mantém o mesmo formato de talkaction
-- que o quest log já usava (`!marcar`), agora com o parâmetro sendo o id numérico da quest.
function onSay(cid, words, param)
    if words ~= "!resgatarquest" or not isPlayer(cid) then
        return false
    end

    local questId = tonumber(param)
    if not questId then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Quest inválida.")
        return true
    end

    local playerId = getPlayerGUID(cid)

    local resultId = db.getResult(
        "SELECT q.`reward_exp`, q.`reward_money`, q.`reward_item_id`, q.`reward_item_count`, " ..
        "pq.`completed`, pq.`rewarded` " ..
        "FROM `quests` q LEFT JOIN `player_quests` pq ON pq.`quest_id` = q.`id` AND pq.`player_id` = " .. playerId ..
        " WHERE q.`id` = " .. questId)

    if resultId == -1 then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Quest não encontrada.")
        return true
    end

    local completed = result.getDataInt(resultId, "completed") == 1
    local rewarded = result.getDataInt(resultId, "rewarded") == 1
    local rewardExp = result.getDataInt(resultId, "reward_exp")
    local rewardMoney = result.getDataInt(resultId, "reward_money")
    local rewardItemId = result.getDataInt(resultId, "reward_item_id")
    local rewardItemCount = result.getDataInt(resultId, "reward_item_count")
    result.free(resultId)

    if not completed then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Você ainda não concluiu essa quest.")
        return true
    end

    if rewarded then
        doPlayerSendTextMessage(cid, MESSAGE_STATUS_SMALL, "Recompensa já resgatada.")
        return true
    end

    if rewardExp > 0 then doPlayerAddExperience(cid, rewardExp) end
    if rewardMoney > 0 then doPlayerAddMoney(cid, rewardMoney) end
    if rewardItemId and rewardItemId > 0 then
        doPlayerAddItem(cid, rewardItemId, rewardItemCount > 0 and rewardItemCount or 1)
    end

    db.query("UPDATE `player_quests` SET `rewarded` = 1 WHERE `player_id` = " .. playerId ..
        " AND `quest_id` = " .. questId)

    doPlayerSendTextMessage(cid, MESSAGE_EVENT_ADVANCE, "Recompensa resgatada!")
    return true
end
