function onSay(player, words, param)
  if not player:getGroup():getAccess() then
    return true
  end

  local target = Player(param)
  if not target then
    player:sendCancelMessage("Player not found.")
    return false
  end

  if target:getAccountType() > player:getAccountType() then
    player:sendCancelMessage("You can not get info about this player.")
    return false
  end

  local modal = ModalWindow(3478, 'Player Info', '')
  local message
  local targetIp = target:getIp()

  message = "-------------INFO--------------" ..
      "\nName: " .. target:getName() ..
      "\nType: " .. (target:getGroup():getAccess() and "God" or "Player") ..
      "\nPremium Days: " .. target:getPremiumDays() ..
      "\nXP: " .. target:getExperience() ..
      "\nLevel: " .. target:getLevel() ..
      "\nHP: [" .. target:getHealth() .. '/' .. target:getMaxHealth() .. ']' ..
      "\nMP: [" .. target:getMana() .. '/' .. target:getMaxMana() .. ']' ..
      "\nMoney: " .. target:getMoney() + target:getBankBalance() ..
      "\nFree Cap: " .. target:getFreeCapacity() ..
      "\nStamina: " .. target:getStamina() ..
      "\nSoul Points: " .. target:getSoul() ..
      "\nSpeed: " .. target:getSpeed() ..
      "\nGuild: " .. (target:getGuildNick() and target:getGuildNick() or '-') ..
      "\nIP: " .. Game.convertIpToString(targetIp) ..
      "\n\n--------------SET--------------" ..
      "\nAmulet: " ..
      (target:getSlotItem(CONST_SLOT_NECKLACE) and capitalize(target:getSlotItem(CONST_SLOT_NECKLACE):getName()) or '-') ..
      "\nBackpak: " ..
      (target:getSlotItem(CONST_SLOT_BACKPACK) and capitalize(target:getSlotItem(CONST_SLOT_BACKPACK):getName()) or '-') ..
      "\nHead: " ..
      (target:getSlotItem(CONST_SLOT_HEAD) and capitalize(target:getSlotItem(CONST_SLOT_HEAD):getName()) or '-') ..
      "\nArmor: " ..
      (target:getSlotItem(CONST_SLOT_ARMOR) and capitalize(target:getSlotItem(CONST_SLOT_ARMOR):getName()) or '-') ..
      "\nLegs: " ..
      (target:getSlotItem(CONST_SLOT_LEGS) and capitalize(target:getSlotItem(CONST_SLOT_LEGS):getName()) or '-') ..
      "\nBoots: " ..
      (target:getSlotItem(CONST_SLOT_FEET) and capitalize(target:getSlotItem(CONST_SLOT_FEET):getName()) or '-') ..
      "\nWeapon: " ..
      (target:getSlotItem(CONST_SLOT_LEFT) and capitalize(target:getSlotItem(CONST_SLOT_LEFT):getName()) or '-') ..
      "\nShield: " ..
      (target:getSlotItem(CONST_SLOT_RIGHT) and capitalize(target:getSlotItem(CONST_SLOT_RIGHT):getName()) or '-') ..
      "\nRing: " ..
      (target:getSlotItem(CONST_SLOT_RING) and capitalize(target:getSlotItem(CONST_SLOT_RING):getName()) or '-') ..
      "\nAmmo: " ..
      (target:getSlotItem(CONST_SLOT_AMMO) and capitalize(target:getSlotItem(CONST_SLOT_AMMO):getName()) or '-') ..
      "\n\n------------SKILLS-------------" ..
      "\nML: " .. target:getMagicLevel() ..
      "\nFist: " .. target:getSkillLevel(SKILL_FIST) ..
      "\nClub: " .. target:getSkillLevel(SKILL_CLUB) ..
      "\nSword: " .. target:getSkillLevel(SKILL_SWORD) ..
      "\nAxe: " .. target:getSkillLevel(SKILL_AXE) ..
      "\nDistance: " .. target:getSkillLevel(SKILL_DISTANCE) ..
      "\nShielding: " .. target:getSkillLevel(SKILL_SHIELDING) ..
      "\nFishing: " .. target:getSkillLevel(SKILL_FISHING) ..
      "\n\n-----------POSITION----------" ..
      "\nX: " .. target:getPosition().x ..
      " | Y: " .. target:getPosition().y ..
      " | Z: " .. target:getPosition().z

  modal:setMessage(message)
  modal:addButton(8738, 'OK')
  modal:setDefaultEnterButton(8738)
  modal:sendToPlayer(player)

  local players = {}
  for _, targetPlayer in ipairs(Game.getPlayers()) do
    if targetPlayer:getIp() == targetIp and targetPlayer ~= target then
      players[#players + 1] = targetPlayer:getName() .. " [" .. targetPlayer:getLevel() .. "]"
    end
  end

  if #players > 0 then
    player:sendTextMessage(MESSAGE_STATUS_CONSOLE_BLUE,
      "Other players on same IP: " .. table.concat(players, ", ") .. ".")
  end
  return false
end
