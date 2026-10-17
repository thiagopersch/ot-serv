dofile("data/lib/extoutfit_lib.lua")

local wingMap = {
  [56508] = 1,  -- Dark Wings
  [56500] = 2,  -- Ulquiorra Wings
  [56505] = 3,  -- Red Dragon Wings
  [56503] = 5,  -- Iron Bat Wings
  [56502] = 6,  -- Bronze Bat Wings
  [56501] = 9,  -- Angel Wings
  [56504] = 10, -- New Dark Wings
}

local wingNames = {
  [1] = "Dark Wings",
  [2] = "Ulquiorra Wings",
  [3] = "Red Dragon Wings",
  [4] = "Blue Dragon Wings",
  [5] = "Iron Bat Wings",
  [6] = "Bronze Bat Wings",
  [7] = "Dark Angel Wings",
  [8] = "Pink Angel Wings",
  [9] = "Angel Wings",
  [10] = "New Dark Wings",
}

function onUse(cid, item, fromPosition, itemEx, toPosition)
  local itemId = item.itemid
  local wingId = wingMap[itemId]
  if not wingId then
    return false
  end

  if extoutfit.hasWing(cid, wingId) then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "You already have this wing unlocked.")
    return true
  end

  extoutfit.addWing(cid, wingId)
  doPlayerSave(cid)
  doRemoveItem(item.uid, 1)
  doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE,
    (wingNames[wingId] or "Wing") .. " unlocked! Open the outfit window to equip it.")
  doPlayerSendOutfitWindow(cid)
  return true
end
