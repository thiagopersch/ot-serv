limit = 25
function onSay(cid, words, param, channel)
  str = ""
  if param == "" then
    local qry = db.getResult(
      "SELECT `player_id`, `date`, `level`, `killer_name` FROM `player_deaths` ORDER BY `date` DESC LIMIT 0, " .. limit)
    if (qry:getID() ~= -1) then
      repeat
        str = str ..
            "\n " ..
            os.date("%d %B %Y %X ", qry:getDataInt("date")) ..
            " " ..
            getPlayerNameByGUID(qry:getDataString("player_id")) ..
            " died at level " .. qry:getDataInt("level") .. " by:\n" .. qry:getDataString("killer_name")
      until not (qry:next())
      qry:free()
    else
      str = "No deaths."
    end
    doPlayerPopupFYI(cid, "Last Deaths:\n\n" .. str)
    return true
  end
  local deaths = db.getResult(
    "SELECT `player_id`, `date`, `level`, `killer_name` FROM `player_deaths` ORDER BY `date` DESC LIMIT 0, " .. limit)
  if (getPlayer:getID() == -1) then
    doPlayerSendCancel(cid, "This player doesn't exist.")
    return true
  end
  local getGuid = getPlayer:getDataInt("id")
  getPlayer:free()
  local qry = db.getResult("SELECT `id`, `date`, `level`, `killer_name` FROM `player_deaths` WHERE `player_id` = " ..
    getGuid .. " ORDER BY `date` DESC LIMIT 0, " .. limit)
  if (qry:getID() ~= -1) then
    repeat
      str = str ..
          "\n " ..
          os.date("%d %B %Y %X ", qry:getDataInt("date")) ..
          " died at level " .. qry:getDataInt("level") .. " by:\n" .. qry:getDataString("killer_name")
    until not (qry:next())
    qry:free()
  else
    str = "No deaths."
  end
  doPlayerPopupFYI(cid, "Last Deaths of: " .. param .. ".\n\n" .. str)
  return true
end
