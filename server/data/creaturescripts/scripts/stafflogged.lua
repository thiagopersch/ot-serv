local clickTeleport = createConditionObject(CONDITION_GAMEMASTER, -1, false, GAMEMASTER_TELEPORT)

function onLogin(cid)
  if getPlayerGroupId(cid) >= 3 then
    local msg = "The member of staff " .. getCreatureName(cid) .. " has just entered the server!"
    local formattedText = "top|" .. TEXTCOLOR_YELLOW .. "|" .. msg

    addEvent(doBroadcastMessage, 21, formattedText)
  end

  -- map click teleport (same as /cliport) is not saved on logout, so turn it on at every login
  if getPlayerAccess(cid) >= 3 and not getCreatureCondition(cid, CONDITION_GAMEMASTER, GAMEMASTER_TELEPORT) then
    doAddCondition(cid, clickTeleport)
  end
  return true
end
