function onKill(cid, target)
  local lootLevel = getPlayerStorageValue(cid, 10017)
  if lootLevel > 0 and isMonster(target) then
    if math.random(100) <= lootLevel * 2 then
      -- Lógica de loot dobrado (requer modificação no código-fonte ou script adicional)
    end
  end
  return true
end
