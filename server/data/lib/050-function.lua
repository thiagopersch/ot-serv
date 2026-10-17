function doPlayerGiveItem(cid, itemid, amount, subType)
  local item = 0
  if (isItemStackable(itemid)) then
    item = doCreateItemEx(itemid, amount)
    if (doPlayerAddItemEx(cid, item, true) ~= RETURNVALUE_NOERROR) then
      return false
    end
  else
    for i = 1, amount do
      item = doCreateItemEx(itemid, subType or 1)
      if (doPlayerAddItemEx(cid, item, true) ~= RETURNVALUE_NOERROR) then
        return false
      end
    end
  end
  return true
end

function doPlayerGiveItemContainer(cid, containerid, itemid, amount, subType)
  for i = 1, amount do
    local container = doCreateItemEx(containerid, 1)
    for x = 1, getContainerCapById(containerid) do
      doAddContainerItem(container, itemid, subType or 0)
    end
    if (doPlayerAddItemEx(cid, container, true) ~= RETURNVALUE_NOERROR) then
      return false
    end
  end
  return true
end

function doPlayerTakeItem(cid, itemid, amount)
  return getPlayerItemCount(cid, itemid) >= amount and doPlayerRemoveItem(cid, itemid, amount)
end

function doPlayerBuyItem(cid, itemid, count, cost, charges)
  return doPlayerRemoveMoney(cid, cost) and doPlayerGiveItem(cid, itemid, count, charges)
end

function doPlayerBuyItemContainer(cid, containerid, itemid, count, cost, charges)
  return doPlayerRemoveMoney(cid, cost) and doPlayerGiveItemContainer(cid, containerid, itemid, count, charges)
end

function doPlayerSellItem(cid, itemid, count, cost)
  if (not doPlayerTakeItem(cid, itemid, count)) then
    return false
  end
  if (not doPlayerAddMoney(cid, cost)) then
    error('[doPlayerSellItem] Could not add money to: ' .. getPlayerName(cid) .. ' (' .. cost .. 'gp).')
  end
  return true
end

function doPlayerWithdrawMoney(cid, amount)
  if (not getBooleanFromString(getConfigInfo('bankSystem'))) then
    return false
  end
  local balance = getPlayerBalance(cid)
  if (amount > balance or not doPlayerAddMoney(cid, amount)) then
    return false
  end
  doPlayerSetBalance(cid, balance - amount)
  doPlayerSave(cid, true)
  return true
end

function doPlayerDepositMoney(cid, amount)
  if (not getBooleanFromString(getConfigInfo('bankSystem'))) then
    return false
  end
  if (not doPlayerRemoveMoney(cid, amount)) then
    return false
  end
  doPlayerSetBalance(cid, getPlayerBalance(cid) + amount)
  doPlayerSave(cid, true)
  return true
end

function doPlayerAddStamina(cid, minutes)
  return doPlayerSetStamina(cid, getPlayerStamina(cid) + minutes)
end

function isPremium(cid)
  return isPlayer(cid) and (getPlayerPremiumDays(cid) > 0 or getBooleanFromString(getConfigInfo('freePremium')))
end

function getMonthDayEnding(day)
  if (day == "01" or day == "21" or day == "31") then
    return "st"
  elseif (day == "02" or day == "22") then
    return "nd"
  elseif (day == "03" or day == "23") then
    return "rd"
  end
  return "th"
end

function getMonthString(m)
  return os.date("%B", os.time { year = 1970, month = m, day = 1 })
end

function getArticle(str)
  return str:find("[AaEeIiOoUuYy]") == 1 and "an" or "a"
end

function isNumeric(str)
  return tonumber(str) ~= nil
end

function isNumber(str)
  return tonumber(str) ~= nil
end

function doNumberFormat(i)
  local str, found = string.gsub(i, "(%d)(%d%d%d)$", "%1,%2", 1), 0
  repeat
    str, found = string.gsub(str, "(%d)(%d%d%d),", "%1,%2,", 1)
  until found == 0
  return str
end

function doPlayerAddAddons(cid, addon)
  for i = 0, #maleOutfits do
    doPlayerAddOutfit(cid, maleOutfits[i], addon)
  end
  for i = 0, #femaleOutfits do
    doPlayerAddOutfit(cid, femaleOutfits[i], addon)
  end
end

function doPlayerWithdrawAllMoney(cid)
  return doPlayerWithdrawMoney(cid, getPlayerBalance(cid))
end

function doPlayerDepositAllMoney(cid)
  return doPlayerDepositMoney(cid, getPlayerMoney(cid))
end

function doPlayerTransferAllMoneyTo(cid, target)
  return doPlayerTransferMoneyTo(cid, target, getPlayerBalance(cid))
end

function playerExists(name)
  return getPlayerGUIDByName(name) ~= 0
end

function getTibiaTime()
  local minutes = getWorldTime()
  local hours = 0
  while minutes >= 60 do
    hours = hours + 1
    minutes = minutes - 60
  end
  return { hours = hours, minutes = minutes }
end

function doWriteLogFile(file, text)
  local f = io.open(file, "a+")
  if (not f) then return false end
  f:write("[" .. os.date("%d/%m/%Y %H:%M:%S") .. "] " .. text .. "\n")
  f:close()
  return true
end

function getExperienceForLevel(lv)
  lv = lv - 1
  return ((50 * lv * lv * lv) - (150 * lv * lv) + (400 * lv)) / 3
end

function doMutePlayer(cid, time)
  local condition = createConditionObject(CONDITION_MUTED)
  setConditionParam(condition, CONDITION_PARAM_TICKS, time * 1000)
  return doAddCondition(cid, condition)
end

function getPlayerGroupName(cid)
  return getGroupInfo(getPlayerGroupId(cid)).name
end

function getPlayerVocationName(cid)
  return getVocationInfo(getPlayerVocation(cid)).name
end

function getPlayerVocationId(cid)
  return getVocationInfo(getPlayerVocation(cid)).id
end

function getPromotedVocation(vid)
  return getVocationInfo(vid).promotedVocation
end

function doPlayerRemovePremiumDays(cid, days)
  return doPlayerAddPremiumDays(cid, -days)
end

function getPlayerMasterPos(cid)
  return getTownTemplePosition(getPlayerTown(cid))
end

function getHouseOwner(houseId) return getHouseInfo(houseId).owner end

function getHouseName(houseId) return getHouseInfo(houseId).name end

function getHouseEntry(houseId) return getHouseInfo(houseId).entry end

function getHouseRent(houseId) return getHouseInfo(houseId).rent end

function getHousePrice(houseId) return getHouseInfo(houseId).price end

function getHouseTown(houseId) return getHouseInfo(houseId).town end

function getHouseDoorsCount(houseId) return #getHouseInfo(houseId).doors end

function getHouseBedsCount(houseId) return #getHouseInfo(houseId).beds end

function getHouseTilesCount(houseId) return getHouseInfo(houseId).tiles end

function getItemNameById(itemid) return getItemDescriptionsById(itemid).name end

function getItemPluralNameById(itemid) return getItemDescriptionsById(itemid).plural end

function getItemArticleById(itemid) return getItemDescriptionsById(itemid).article end

function getItemName(uid) return getItemDescriptions(uid).name end

function getItemPluralName(uid) return getItemDescriptions(uid).plural end

function getItemArticle(uid) return getItemDescriptions(uid).article end

function getItemText(uid) return getItemDescriptions(uid).text end

function getItemSpecialDescription(uid) return getItemDescriptions(uid).special end

function getItemWriter(uid) return getItemDescriptions(uid).writer end

function getItemDate(uid) return getItemDescriptions(uid).date end

function getTilePzInfo(pos)
  local tmp = getTileInfo(pos)
  if type(tmp) ~= 'table' then return false end
  return getBooleanFromString(tmp.protection) or getBooleanFromString(tmp.pz) or getBooleanFromString(tmp.nopvp) or false
end

function getTileZoneInfo(pos)
  local tmp = getTileInfo(pos)
  if type(tmp) ~= 'table' then return 0 end
  if getBooleanFromString(tmp.pvp) then return 2 end
  if getBooleanFromString(tmp.nopvp) then return 1 end
  return 0
end

function doShutdown()
  return doSetGameState(GAMESTATE_SHUTDOWN)
end

function doSummonCreature(name, pos, displayError)
  local cid = doCreateMonster(name, pos, displayError ~= false)
  if (not cid) then
    cid = doCreateNpc(name, pos, displayError ~= false)
  end
  return cid
end

function getOnlinePlayers()
  local players = {}
  for _, cid in ipairs(getPlayersOnline()) do
    table.insert(players, getCreatureName(cid))
  end
  return players
end

function getPlayerByName(name)
  local cid = getCreatureByName(name)
  return isPlayer(cid) and cid or nil
end

function isPlayer(cid)
  return isCreature(cid) and cid >= AUTOID_PLAYERS and cid < AUTOID_MONSTERS
end

function isPlayerGhost(cid)
  if (not isPlayer(cid)) then return false end
  return getCreatureCondition(cid, CONDITION_GAMEMASTER, GAMEMASTER_INVISIBLE) or
      getPlayerFlagValue(cid, PLAYERFLAG_CANNOTBESEEN)
end

function isMonster(cid)
  return isCreature(cid) and cid >= AUTOID_MONSTERS and cid < AUTOID_NPCS
end

function isNpc(cid)
  return isCreature(cid) and cid >= AUTOID_NPCS
end

function doPlayerSetExperienceRate(cid, value)
  return doPlayerSetRate(cid, SKILL__LEVEL, value)
end

function doPlayerSetMagicRate(cid, value)
  return doPlayerSetRate(cid, SKILL__MAGLEVEL, value)
end

function doPlayerAddLevel(cid, amount, round)
  local level = getPlayerLevel(cid)
  local experience
  if (amount > 0) then
    experience = getExperienceForLevel(level + amount) -
        (round and getPlayerExperience(cid) or getExperienceForLevel(level))
  else
    experience = -((round and getPlayerExperience(cid) or getExperienceForLevel(level)) - getExperienceForLevel(level + amount))
  end
  return doPlayerAddExperience(cid, experience)
end

function doPlayerAddMagLevel(cid, amount)
  for i = 1, amount do
    doPlayerAddSpentMana(cid,
      (getPlayerRequiredMana(cid, getPlayerMagLevel(cid, true) + 1) - getPlayerSpentMana(cid)) /
      getConfigInfo('rateMagic')
    )
  end
  return true
end

function doPlayerAddSkill(cid, skill, amount, round)
  if (skill == SKILL__LEVEL) then
    return doPlayerAddLevel(cid, amount, round)
  elseif (skill == SKILL__MAGLEVEL) then
    return doPlayerAddMagLevel(cid, amount)
  end
  return doPlayerAddSkillTry(cid, skill,
    (getPlayerRequiredSkillTries(cid, skill, getPlayerSkillLevel(cid, skill) + 1) - getPlayerSkillTries(cid, skill)) /
    getConfigInfo('rateSkill')
  )
end

function getPartyLeader(cid)
  local party = getPartyMembers(cid)
  return type(party) == 'table' and party[1] or 0
end

function isInParty(cid)
  return type(getPartyMembers(cid)) == 'table'
end

function isPrivateChannel(channelId)
  return channelId >= CHANNEL_PRIVATE
end

function doPlayerResetIdleTime(cid)
  return doPlayerSetIdleTime(cid, 0)
end

function doBroadcastMessage(text, message_type, position)
  local class = message_type or MESSAGE_STATUS_WARNING
  local position = position or 'top'
  if (type(class) == 'string') then
    local className = MESSAGE_TYPES[class]
    if (not className) then return false end
    class = className
  elseif (class < MESSAGE_FIRST or class > MESSAGE_LAST) then
    return false
  end

  -- If text already contains '|', it's already formatted, send as-is
  local formattedText = text
  if not text:find('|') then
    local color = TEXTCOLOR_RED
    if (class == MESSAGE_STATUS_CONSOLE_BLUE) then
      color = TEXTCOLOR_BLUE
    elseif (class == MESSAGE_STATUS_CONSOLE_ORANGE) then
      color = TEXTCOLOR_ORANGE
    elseif (class == MESSAGE_INFO_DESCR) then
      color = TEXTCOLOR_GREEN
    elseif (class == MESSAGE_STATUS_CONSOLE_RED) then
      color = TEXTCOLOR_RED
    end

    if (position == 'center' or position == 'bottom') then
      formattedText = position .. '|' .. color .. '|' .. text
    else
      formattedText = color .. '|' .. text
    end
  end

  for _, pid in ipairs(getPlayersOnline()) do
    doPlayerSendTextMessage(pid, class, formattedText)
  end
  return true
end

function doPlayerBroadcastMessage(cid, text, class, checkFlag, ghost)
  local checkFlag, ghost, class = checkFlag ~= false, ghost == true, class or TALKTYPE_BROADCAST
  if (checkFlag and not getPlayerFlagValue(cid, PLAYERFLAG_CANBROADCAST)) then
    return false
  end
  if (type(class) == 'string') then
    local className = TALKTYPE_TYPES[class]
    if (not className) then return false end
    class = className
  elseif (class < TALKTYPE_FIRST or class > TALKTYPE_LAST) then
    return false
  end
  for _, pid in ipairs(getPlayersOnline()) do
    doCreatureSay(cid, text, class, ghost, pid)
  end
  print("> " .. getCreatureName(cid) .. " broadcasted message: \"" .. text .. "\".")
  return true
end

function getBooleanFromString(input)
  local t = type(input)
  if (t == 'boolean') then return input end
  if (t == 'number') then return input > 0 end
  local str = string.lower(tostring(input))
  return str == "yes" or str == "true" or (tonumber(str) or 0) > 0
end

function doCopyItem(item, attributes)
  local attributes = type(attributes) == 'table' and attributes or (attributes and { "aid" } or {})
  local ret = doCreateItemEx(item.itemid, item.type)
  for _, key in ipairs(attributes) do
    local value = getItemAttribute(item.uid, key)
    if (value ~= nil) then
      doItemSetAttribute(ret, key, value)
    end
  end
  if (isContainer(item.uid)) then
    for i = getContainerSize(item.uid) - 1, 0, -1 do
      local tmp = getContainerItem(item.uid, i)
      if (tmp.itemid > 0) then
        doAddContainerItemEx(ret, doCopyItem(tmp, true).uid)
      end
    end
  end
  return getThing(ret)
end

function doRemoveThing(uid)
  return isCreature(uid) and doRemoveCreature(uid) or doRemoveItem(uid)
end

function setAttackFormula(combat, type, minl, maxl, minm, maxm, min, max)
  min, max = min or 0, max or 0
  return setCombatFormula(combat, type, -1, 0, -1, 0, minl, maxl, minm, maxm, -min, -max)
end

function setHealingFormula(combat, type, minl, maxl, minm, maxm, min, max)
  min, max = min or 0, max or 0
  return setCombatFormula(combat, type, 1, 0, 1, 0, minl, maxl, minm, maxm, min, max)
end

function doChangeTypeItem(uid, subtype)
  local thing = getThing(uid)
  if (thing.itemid < 100) then return false end
  return doTransformItem(thing.uid, thing.itemid, subtype or 1)
end

function doSetItemText(uid, text, writer, date)
  local thing = getThing(uid)
  if (thing.itemid < 100) then return false end
  doItemSetAttribute(uid, "text", text)
  if (writer) then
    doItemSetAttribute(uid, "writer", tostring(writer))
    if (date) then
      doItemSetAttribute(uid, "date", tonumber(date))
    end
  end
  return true
end

function getFluidSourceType(itemid)
  local item = getItemInfo(itemid)
  return item and item.fluidSource or false
end

function getDepotId(uid)
  return getItemAttribute(uid, "depotid") or false
end

function getItemDescriptions(uid)
  local thing = getThing(uid)
  if (thing.itemid < 100) then return false end
  local item = getItemInfo(thing.itemid)
  return {
    name = getItemAttribute(uid, "name") or item.name,
    plural = getItemAttribute(uid, "pluralname") or item.plural,
    article = getItemAttribute(uid, "article") or item.article,
    special = getItemAttribute(uid, "description") or "",
    text = getItemAttribute(uid, "text") or "",
    writer = getItemAttribute(uid, "writer") or "",
    date = getItemAttribute(uid, "date") or 0
  }
end

function getItemWeightById(itemid, count, precision)
  local item = getItemInfo(itemid)
  if (not item) then return false end
  count = count or 1
  if (count > 100) then
    print('[Warning] getItemWeightById', 'Calculating weight for more than 100 items!')
  end
  return item.weight * count
end

function getItemWeaponType(uid)
  local thing = getThing(uid)
  if (thing.itemid < 100) then return false end
  return getItemInfo(thing.itemid).weaponType
end

function getItemRWInfo(uid)
  local thing = getThing(uid)
  if (thing.itemid < 100) then return false end
  local item = getItemInfo(thing.itemid)
  local flags = 0
  if (item.readable) then flags = flags + 1 end
  if (item.writable) then flags = flags + 2 end
  return flags
end

function getItemLevelDoor(itemid)
  local item = getItemInfo(itemid)
  return item and item.levelDoor or false
end

function isItemStackable(itemid)
  local item = getItemInfo(itemid)
  return item and item.stackable or false
end

function isItemRune(itemid)
  local item = getItemInfo(itemid)
  return item and (item.type == ITEM_TYPE_RUNE or item.clientCharges) or false
end

function isItemDoor(itemid)
  local item = getItemInfo(itemid)
  return item and item.type == ITEM_TYPE_DOOR or false
end

function isItemContainer(itemid)
  local item = getItemInfo(itemid)
  return item and item.group == ITEM_GROUP_CONTAINER or false
end

function isItemFluidContainer(itemid)
  local item = getItemInfo(itemid)
  return item and item.group == ITEM_GROUP_FLUID or false
end

function isItemMovable(itemid)
  local item = getItemInfo(itemid)
  return item and item.movable or false
end

function isCorpse(uid)
  local thing = getThing(uid)
  if (thing.itemid < 100) then return false end
  local item = getItemInfo(thing.itemid)
  return item and item.corpseType ~= 0 or false
end

function getContainerCapById(itemid)
  local item = getItemInfo(itemid)
  return item and item.group == ITEM_GROUP_CONTAINER and item.maxItems or false
end

function getMonsterAttackSpells(name)
  local monster = getMonsterInfo(name)
  return monster and monster.attacks or false
end

function getMonsterHealingSpells(name)
  local monster = getMonsterInfo(name)
  return monster and monster.defenses or false
end

function getMonsterLootList(name)
  local monster = getMonsterInfo(name)
  return monster and monster.loot or false
end

function getMonsterSummonList(name)
  local monster = getMonsterInfo(name)
  return monster and monster.summons or false
end

function choose(...)
  local arg = { ... }
  return arg[math.random(#arg)]
end
