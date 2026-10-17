function timeString(timeDiff)
  local dateFormat = {
    { "day",    timeDiff / 60 / 60 / 24 },
    { "hour",   timeDiff / 60 / 60 % 24 },
    { "minute", timeDiff / 60 % 60 },
    { "second", timeDiff % 60 }
  }

  local out = {}
  for k, t in ipairs(dateFormat) do
    local v = math.floor(t[2])
    if (v > 0) then
      table.insert(out,
        (k < #dateFormat and (#out > 0 and ', ' or '') or ' and ') .. v .. ' ' .. t[1] .. (v ~= 1 and 's' or ''))
    end
  end
  local ret = table.concat(out)
  if ret:len() < 16 and ret:find("second") then
    local a, b = ret:find(" and ")
    ret = ret:sub(b + 1)
  end

  return ret
end

function onAdvance(cid, skill, oldlevel, newlevel)
  if skill ~= SKILL__LEVEL then
    return true
  end

  local oldtime = getPlayerStorageValue(cid, 3499)
  local timenow = os.time()
  if oldtime == -1 then
    setPlayerStorageValue(cid, 3499, timenow)
  else
    local msg = getPlayerName(cid) ..
        " It took you " .. timeString(timenow - oldtime) .. " to advance in level from your last advance."
    local formattedText = "top|" .. TEXTCOLOR_YELLOW .. "|" .. msg
    addEvent(doBroadcastMessage, 21, formattedText)
    setPlayerStorageValue(cid, 3499, timenow)
  end
  return true
end
