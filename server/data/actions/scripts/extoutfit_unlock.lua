dofile("data/lib/extoutfit_lib.lua")

local healthbarMap = {
  [56917] = 71,  -- blue spirit
  [56918] = 72,  -- golden aura
  [56919] = 73,  -- iron
  [56920] = 74,  -- iron aura
  [56921] = 75,  -- demon horn
  [56922] = 76,  -- hollow skull
  [56923] = 77,  -- snake ninja
  [56924] = 78,  -- kong
  [56925] = 79,  -- orange energy
  [56926] = 80,  -- pink blossom
  [56927] = 81,  -- super yellow ray
  [56928] = 82,  -- purple shadow
  [56929] = 83,  -- dark chakra
  [56930] = 84,  -- hunter green
  [56931] = 85,  -- leaf ninja
  [56932] = 86,  -- youtube
  [56933] = 87,  -- kitchen
  [56934] = 88,  -- love
  [56935] = 89,  -- straw hat
  [56936] = 90,  -- love aikawa
  [56937] = 91,  -- blue iron angel wings
  [56938] = 92,  -- pink fairy wings
  [56939] = 93,  -- iron angel wings
  [56940] = 94,  -- grimmjow
  [56941] = 95,  -- renji
  [56942] = 96,  -- hyori
  [56943] = 97,  -- rukia kuchiki
  [56944] = 98,  -- three hollow mask
  [56945] = 99,  -- young ayamamoto
  [56946] = 100, -- lille barro
  [56947] = 101, -- cookie
  [56948] = 102, -- candy
  [56949] = 103, -- gerard valkyrie
  [56950] = 104, -- giselle gewelle
  [56951] = 105, -- red phantom
}

function onUse(cid, item, fromPosition, itemEx, toPosition)
  local itemId = item.itemid
  local visualId = healthbarMap[itemId]
  if not visualId then
    return false
  end

  if extoutfit.hasHealthBar(cid, visualId) then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "You already have this healthbar unlocked.")
    return true
  end

  extoutfit.addHealthBar(cid, visualId)
  doPlayerSave(cid)
  doRemoveItem(item.uid, 1)
  doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Healthbar unlocked! Open the outfit window to equip it.")
  doPlayerSendOutfitWindow(cid)
  return true
end
