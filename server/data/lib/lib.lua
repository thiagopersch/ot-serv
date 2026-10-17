function capitalize(str)
  return string.gsub(" " .. str, "%W%l", string.upper):sub(2)
end

function split(str, sep)
  local result = {}
  local regex = ("([^%s]+)"):format(sep)
  for each in str:gmatch(regex) do
    table.insert(result, each)
  end
  return result
end

function getPlayerOnlineTime(cid)
  local resultId = db.getResult("SELECT `online_time` FROM `players` WHERE `id` = " .. getPlayerGUID(cid))
  if resultId == -1 then
    return 0
  end

  local value = result.getDataInt(resultId, "online_time")
  result.free(resultId)
  return value
end

function doPlayerAddOnlineTime(cid, amount)
  if not amount or amount < 0 then
    print("[Warning] Invalid amount for doPlayerAddOnlineTime: " .. tostring(amount))
    return
  end
  db.query("UPDATE `players` SET `online_time` = `online_time` + " ..
    amount .. " WHERE `id` = " .. getPlayerGUID(cid))
end
