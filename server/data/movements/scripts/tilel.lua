function onStepIn(cid, item, pos, fromPos)
  local resets = getPlayerResets(cid)
  if resets and resets < item.actionid then
    doCreatureSay(cid, "Esta area e exclusiva para players com " .. item.actionid .. " resets ou mais.",
      TALKTYPE_ORANGE_1)
    doTeleportThing(cid, fromPos)
  else
    doCreatureSay(cid, "Acesso liberado.", TALKTYPE_ORANGE_1)
    return true
  end
end

-- outra versão:
-- local function getPlayerResets(cid)
--     local result = db.getResult("SELECT `resets` FROM `players` WHERE `id` = " .. getPlayerGUID(cid))
--     if result:getID() ~= -1 then
--         local resets = result:getDataInt("resets")
--         result:free()
--         return resets < 0 and 0 or resets
--     end
--     return 0
-- end
