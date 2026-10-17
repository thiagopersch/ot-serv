-- Catálogo de quests é administrado pelo portal (`quests` table, /admin/quests) — este arquivo
-- só cuida do progresso do jogador (`player_quests`). A lógica de "quando completar" continua
-- bespoke por quest, escrita em scripts de action/npc que chamam QuestLib.completeQuest.

QuestLib = QuestLib or {}

function QuestLib.isQuestCompleted(playerId, questId)
    local resultId = db.getResult("SELECT `completed` FROM `player_quests` WHERE `player_id` = " ..
        playerId .. " AND `quest_id` = " .. questId)
    if resultId == -1 then return false end

    local completed = result.getDataInt(resultId, "completed") == 1
    result.free(resultId)
    return completed
end

-- Marca a quest como concluída (idempotente — chamar de novo não tem efeito se já concluída).
-- Não concede a recompensa aqui: o jogador resgata com "!resgatarquest <id>"
-- (data/talkactions/scripts/resgatarquest.lua), acionado pelo botão do quest log (OTC).
function QuestLib.completeQuest(cid, questId)
    local playerId = getPlayerGUID(cid)
    if QuestLib.isQuestCompleted(playerId, questId) then
        return false
    end

    db.query("INSERT INTO `player_quests` (`player_id`, `quest_id`, `completed`, `completed_at`) VALUES (" ..
        playerId .. ", " .. questId .. ", 1, NOW()) " ..
        "ON DUPLICATE KEY UPDATE `completed` = 1, `completed_at` = NOW()")

    if isPlayer(cid) then
        doPlayerSendTextMessage(cid, MESSAGE_EVENT_ADVANCE, "Quest concluída! Resgate a recompensa no diário de quests.")
    end

    if BattlePassLib then
        BattlePassLib.onQuestCompleted(cid, questId)
    end

    return true
end
