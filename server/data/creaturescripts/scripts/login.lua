local config = {
  loginMessage = getConfigValue('loginMessage'),
  useFragHandler = getBooleanFromString(getConfigValue('useFragHandler'))
}

function onLogin(cid)
  local loss = getConfigValue('deathLostPercent')
  if (loss ~= nil) then
    doPlayerSetLossPercent(cid, PLAYERLOSS_EXPERIENCE, loss * 10)
  end

  local accountManager = getPlayerAccountManager(cid)
  if (accountManager == MANAGER_NONE) then
    local lastLogin, str = getPlayerLastLoginSaved(cid), config.loginMessage
    if (lastLogin > 0) then
      doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, str)
      str = "Your last visit was on " .. os.date("%a %b %d %X %Y", lastLogin) .. "."
    else
      str = str .. " Welcome to WodBleach!"
      setPlayerStorageValue(cid, 30024, 0)
    end
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE, str)
  elseif (accountManager == MANAGER_NAMELOCK) then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
      "Hello, it appears that your character has been namelocked, what would you like as your new name?")
  elseif (accountManager == MANAGER_ACCOUNT) then
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
      "Hello, type 'account' to manage your account and if you want to start over then type 'cancel'.")
  else
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_ORANGE,
      "Hello, type 'account' to create an account or type 'recover' to recover an account.")
  end

  if (not isPlayerGhost(cid)) then
    doSendMagicEffect(getCreaturePosition(cid), CONST_ME_TELEPORT)
  end

  if getPlayerStorageValue(cid, 48913) == -1 then
    setPlayerStorageValue(cid, 48913, 0)
  end

  registerCreatureEvent(cid, "OutfitFilter")
  if (config.useFragHandler) then registerCreatureEvent(cid, "SkullCheck") end
  registerCreatureEvent(cid, "AmuletDeath")
  registerCreatureEvent(cid, "critical")
  registerCreatureEvent(cid, "FullHpMana")
  registerCreatureEvent(cid, "FragReward")
  registerCreatureEvent(cid, "Mail")
  registerCreatureEvent(cid, "GuildMotd")
  registerCreatureEvent(cid, "Idle")
  registerCreatureEvent(cid, "KillingInTheNameOf")
  registerCreatureEvent(cid, "ReportBug")
  registerCreatureEvent(cid, "AdvanceSave")
  registerCreatureEvent(cid, "onlinepoints")
  registerCreatureEvent(cid, "fraglook")
  registerCreatureEvent(cid, "DeathPlayer")
  registerCreatureEvent(cid, "LevelRecompense")
  registerCreatureEvent(cid, "showKD")
  registerCreatureEvent(cid, "AdvLevelSpells")
  registerCreatureEvent(cid, "timelevel")
  registerCreatureEvent(cid, "IconMap")
  registerCreatureEvent(cid, "ChangeVocationOpcode")
  registerCreatureEvent(cid, "ChangeVocationLogin")
  registerCreatureEvent(cid, "ProfileOpcode")
  registerCreatureEvent(cid, "BankExtended")
  registerCreatureEvent(cid, "VocationRanks")
  registerCreatureEvent(cid, "VocationRanksOpcode")
  registerCreatureEvent(cid, "DailyReward")
  registerCreatureEvent(cid, "DailyRewardOpcode")
  registerCreatureEvent(cid, "DailyRewardStats")
  registerCreatureEvent(cid, "SkillUpgradesCombat")
  registerCreatureEvent(cid, "SkillUpgradesLogin")
  registerCreatureEvent(cid, "SkillUpgradesLogout")
  registerCreatureEvent(cid, "TaskLogin")
  registerCreatureEvent(cid, "TaskOpcode")
  registerCreatureEvent(cid, "ShaderSelectorOpcode")
  registerCreatureEvent(cid, "AuraSelectorOpcode")
  registerCreatureEvent(cid, "BestiaryOpcode")
  registerCreatureEvent(cid, "QuestOpcode")
  registerCreatureEvent(cid, "MBKill")
  registerCreatureEvent(cid, "BattlePassLogin")
  registerCreatureEvent(cid, "BattlePassKill")
  registerCreatureEvent(cid, "BattlePassOpcode")
  registerCreatureEvent(cid, "HighscoreLogin")
  registerCreatureEvent(cid, "HighscoreOpcode")
  registerCreatureEvent(cid, "ChestLogin")
  registerCreatureEvent(cid, "ChestOpcode")
  registerCreatureEvent(cid, "TeleportCheckpointOpcode")
  registerCreatureEvent(cid, "RarityOpcode")
  setPlayerStorageValue(cid, 81000, -1)
  setPlayerStorageValue(cid, 81001, -1)
  setPlayerStorageValue(cid, 81002, -1)
  setPlayerStorageValue(cid, 81003, -1)

  -- Bônus de XP/Skill do Daily Reward e Upgrades
  local totalExpRate = 1.0
  local xpBonusTime = getPlayerStorageValue(cid, 48702)
  if xpBonusTime > os.time() then
    totalExpRate = totalExpRate + 0.5
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Your 50% XP bonus (Daily) is active!")
  end

  if SkillUpgradesLib then
    local skillExpBonus = SkillUpgradesLib.getSkillValue(cid, "exp_bonus")
    if skillExpBonus > 0 then
      totalExpRate = totalExpRate + (skillExpBonus / 100)
    end
  end

  if totalExpRate > 1.0 then
    doPlayerSetExperienceRate(cid, totalExpRate)
  end

  local skillBonusTime = getPlayerStorageValue(cid, 48703)
  if skillBonusTime > os.time() then
    doPlayerSetMagicRate(cid, 1.25)
    -- Para outras skills, o TFS 0.4 geralmente não tem um 'setRate' individual simples no lib
    -- mas o MagicRate já cobre uma parte importante.
    doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE, "Your 25% Skill bonus is active!")
  end

  -- [NOVO]: Lê e escreve DIRETAMENTE na coluna SQL, ignorando storages limitados do TFS!
  local currentVoc = getPlayerVocation(cid)
  local guid = getPlayerGUID(cid)

  local q = db.getResult("SELECT `unlocked_vocations`, `dodge`, `critical` FROM `players` WHERE `id` = " .. guid)
  local unlockedStr = ""
  if q and q:getID() ~= -1 then
    unlockedStr = q:getDataString("unlocked_vocations")
    setPlayerStorageValue(cid, 48700, q:getDataInt("dodge"))
    setPlayerStorageValue(cid, 48701, q:getDataInt("critical"))
    q:free()
  end

  if unlockedStr == "" then
    db.query("UPDATE `players` SET `unlocked_vocations` = '" .. currentVoc .. "' WHERE `id` = " .. guid)
  else
    local found = false
    for v in unlockedStr:gmatch("(%d+)") do
      if tonumber(v) == currentVoc then
        found = true
        break
      end
    end
    if not found then
      local newVal = unlockedStr .. "," .. currentVoc
      db.query("UPDATE `players` SET `unlocked_vocations` = '" .. newVal .. "' WHERE `id` = " .. guid)
    end
  end

  -- [CORREÇÃO]: Sagastor parsing seguro
  local sagastor = 578744
  local sagaValue = getPlayerStorageValue(cid, sagastor)

  if sagaValue ~= -1 and tostring(sagaValue) ~= "" then
    local w = tostring(sagaValue):gsub(':', ''):explode(',')
    if w and #w >= 2 then
      local lookType = tonumber(w[1])
      local vocation = tonumber(w[2])

      if lookType and vocation and vocation > 0 then
        local currentOutfit = getCreatureOutfit(cid)
        currentOutfit.lookType = lookType
        doCreatureChangeOutfit(cid, currentOutfit)
        doPlayerSetVocation(cid, vocation)

        if saga and saga[vocation] then
          for _, outfit in ipairs(saga[vocation]) do
            if type(outfit) == "table" and outfit.lookType == lookType then
              if outfit.aura then
                startAura(cid, outfit.aura, outfit.auraPos)
              end
              break
            end
          end
        end
      end
    end
  else
    if saga and saga[currentVoc] and saga[currentVoc][1] then
      local currentOutfit = getCreatureOutfit(cid)
      currentOutfit.lookType = saga[currentVoc][1].lookType
      doCreatureChangeOutfit(cid, currentOutfit)
    end
  end

  -- Outfit customizado (item de outfit, /admin/custom-outfits): se o jogador escolheu um, ele
  -- vence o looktype de saga aplicado acima.
  if not CustomOutfits then dofile("data/lib/custom_outfits.lua") end
  if CustomOutfits.restoreChosen(cid) then
    stopAura(cid)
  end

  local age = math.max(0, getPlayerStorageValue(cid, STORAGE_AGE))
  local title = getAgeTitle(age)
  local frags = getPlayerFrags(cid)
  local resets = getPlayerResets(cid)

  doPlayerSendExtendedOpcode(cid, 50, age .. "|" .. title .. "|" .. frags .. "|" .. resets)

  -- ── Aura Selector: sincroniza dados ao login ─────────────────────────────
  -- Usa addEvent para garantir que o client já está pronto para receber
  -- opcodes extendidos (evita race condition no handshake inicial)
  addEvent(function()
    if not isPlayer(cid) then return end

    -- Reseta qualquer sessão de aura pendente de uma sessão anterior
    setPlayerStorageValue(cid, 81002, -1) -- ST_AURA_ITEM
    setPlayerStorageValue(cid, 81003, -1) -- ST_AURA_OPEN

    local AURA_OPCODE = 249

    -- Garante que as libs estão carregadas (guard __loaded impede recarga)
    if not extoutfit then dofile("data/lib/extoutfit_lib.lua") end
    if not extoutfit_parser then dofile("data/lib/extoutfit_parser.lua") end

    -- Envia lista de auras desbloqueadas
    local unlockedAuras = extoutfit.getAuras(cid)
    if unlockedAuras and #unlockedAuras > 0 then
      doPlayerSendExtendedOpcode(cid, AURA_OPCODE,
        "a_sync|" .. table.concat(unlockedAuras, ","))
    else
      doPlayerSendExtendedOpcode(cid, AURA_OPCODE, "a_sync|")
    end

    -- Envia aura equipada atualmente (game_auraoffset no client gerencia o offset)
    local equippedAura = extoutfit.getEquippedAura(cid)
    if equippedAura and equippedAura > 0 then
      doPlayerSendExtendedOpcode(cid, AURA_OPCODE, "a_equipped|" .. equippedAura)
    end
  end, 500) -- 500ms: suficiente para o client processar o login completo

  return true
end
