-- Catálogo de quests é administrado pelo portal (`quests` table, /admin/quests) — este arquivo
-- só monta e envia o payload pro cliente (opcode 135, JSON — mesmo padrão de
-- data/lib/tasks/task_network.lua). Progresso do jogador vem de `player_quests` (ver
-- data/lib/quests/quest_lib.lua — QuestLib.completeQuest é chamado por scripts de action/npc
-- quest a quest, igual ao padrão antigo baseado em storage). Requisitado pelo cliente via
-- extended opcode (data/creaturescripts/scripts/quest_extended_opcode.lua) ou pela talkaction
-- legada `!sendquestlog`.
if not json then json = dofile("data/lib/json.lua") end

function sendQuestLog(cid)
  if not isPlayer(cid) then return end

  local playerLevel = getPlayerLevel(cid) or 1
  local playerId = getPlayerGUID(cid)

  local resultId = db.getResult(
    "SELECT q.`id`, q.`name`, q.`description`, q.`category`, COALESCE(pq.`completed`, 0) AS completed " ..
    "FROM `quests` q LEFT JOIN `player_quests` pq ON pq.`quest_id` = q.`id` AND pq.`player_id` = " .. playerId ..
    " WHERE q.`published` = 1 AND q.`level_required` <= " .. playerLevel ..
    " ORDER BY q.`level_required` ASC")

  local quests = {}

  if resultId ~= -1 then
    repeat
      local description = result.getDataString(resultId, "description")
      quests[#quests + 1] = {
        id = result.getDataInt(resultId, "id"),
        name = result.getDataString(resultId, "name"),
        description = description ~= "" and description or "No description provided.",
        category = result.getDataString(resultId, "category"),
        completed = result.getDataInt(resultId, "completed") == 1,
      }
    until not result.next(resultId)
    result.free(resultId)
  end

  doPlayerSendExtendedOpcode(cid, 135, json.encode({ quests = quests }))
end
