-- data/creaturescripts/scripts/exp_magic.lua
function onAdvance(cid, skill, oldLevel, newLevel)
  if skill == SKILL__LEVEL or skill == SKILL__MAGLEVEL then
    local expLevel = getPlayerStorageValue(cid, 10001)
    local magicLevel = getPlayerStorageValue(cid, 10003)
    if expLevel == -1 then expLevel = 0 end
    if magicLevel == -1 then magicLevel = 0 end
    if skill == SKILL__LEVEL and expLevel > 0 then
      local expBonus = math.floor(doPlayerAddExp(cid) * (expLevel * 0.05))
      doPlayerAddExp(cid, expBonus)
    elseif skill == SKILL__MAGLEVEL and magicLevel > 0 then
      doPlayerAddSkill(cid, SKILL__MAGLEVEL, magicLevel * 50)
    end
  end
  return true
end
