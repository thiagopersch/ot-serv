local vocationRanksWindow = nil
local vocationRanksButton = nil
local confirmWindow = nil
local localRankData = {}

VOCATION_RANK_OPCODE = 235
local rankNames = { "Bronze", "Silver", "Gold", "Diamond" }

function init()
  ProtocolGame.registerExtendedOpcode(VOCATION_RANK_OPCODE, onOpcode)

  vocationRanksButton = modules.client_topmenu.addRightGameToggleButton(
    'vocationRanksBtn', tr('Vocation Ranks'),
    '/images/topbuttons/skills', toggleWindow
  )

  connect(g_game, {
    onGameEnd = destroyWindow
  })
end

function terminate()
  disconnect(g_game, {
    onGameEnd = destroyWindow
  })
  destroyWindow()
  if vocationRanksButton then
    vocationRanksButton:destroy()
    vocationRanksButton = nil
  end
  ProtocolGame.unregisterExtendedOpcode(VOCATION_RANK_OPCODE)
end

function onOpcode(protocol, opcode, buffer)
  local t = string.split(buffer, "|")
  local action = tonumber(t[1])

  -- Recebeu Status Pessoal
  if action == 1 then
    localRankData = {
      vocationId = tonumber(t[2]),
      rank = tonumber(t[3]),
      stars = tonumber(t[4]),
      totalStars = tonumber(t[5]),
      univFrag = tonumber(t[6]),
      specFrag = tonumber(t[7]),
      cost = tonumber(t[8]),
      bonusAtk = tonumber(t[9]),
      bonusDef = tonumber(t[10]),
      bonusHp = tonumber(t[11]),
      bonusMp = tonumber(t[12]),
      playerName = t[13],
      vocationName = t[14]
    }

    local player = g_game.getLocalPlayer()
    if player then
      -- Chama a função C++ para nós mesmos
      player:setVocationStars(localRankData.rank, localRankData.stars)
    end

    if vocationRanksWindow then
      refreshUI()
    end

    -- Broadcast (Atualiza estrelas dos outros na tela)
  elseif action == 2 then
    local playerId = tonumber(t[2])
    local pRank = tonumber(t[3])
    local pStars = tonumber(t[4])

    local creature = g_map.getCreatureById(playerId)
    if creature then
      creature:setVocationStars(pRank, pStars)
    end
  end
end

function refreshUI()
  if not vocationRanksWindow or not localRankData.rank then return end

  local rankName = rankNames[localRankData.rank] or "Bronze"
  local vocNameLower = string.lower(localRankData.vocationName)

  -- Esquerda (Imagem e Info)
  vocationRanksWindow:getChildById('vocImage'):setImageSource('/images/vocations/' .. vocNameLower .. '.png')
  vocationRanksWindow:getChildById('nameLabel'):setText(localRankData.playerName)
  vocationRanksWindow:getChildById('vocNameLabel'):setText(localRankData.vocationName)

  -- Direita (Progresso)
  vocationRanksWindow:getChildById('rankLabel'):setText('Rank: ' .. rankName .. ' ' .. localRankData.stars .. '/5')
  vocationRanksWindow:getChildById('starsBar'):setValue(localRankData.stars, 0, 5)

  -- Bônus Dinâmico
  local bonusText = string.format("Bonus Per Star:\nAtk: +%d | Def: +%d\nHP: +%d | MP: +%d",
    localRankData.bonusAtk, localRankData.bonusDef, localRankData.bonusHp, localRankData.bonusMp)
  vocationRanksWindow:getChildById('infoLabel'):setText(bonusText)

  -- Fragmentos e Custos
  local fragText = string.format("Fragments in Bag:\nUniversal: %d\nSpecific: %d\n\nCost Next Star: %d",
    localRankData.univFrag, localRankData.specFrag, localRankData.cost)
  vocationRanksWindow:getChildById('fragmentsLabel'):setText(fragText)

  local statusLabel = vocationRanksWindow:getChildById('statusLabel')
  if localRankData.univFrag >= localRankData.cost or localRankData.specFrag >= localRankData.cost then
    statusLabel:setText('Ready to Upgrade!')
    statusLabel:setColor('#55ff55')
  else
    statusLabel:setText('Insufficient Fragments!')
    statusLabel:setColor('#ff5555')
  end
end

function onUpgrade()
  if localRankData.univFrag >= localRankData.cost or localRankData.specFrag >= localRankData.cost then
    if confirmWindow then confirmWindow:destroy() end
    confirmWindow = displayGeneralBox(tr('Confirm Upgrade'),
      tr('Do you want to spend %d fragments to upgrade?', localRankData.cost),
      {
        {
          text = tr('Yes'),
          callback = function()
            if confirmWindow then
              confirmWindow:destroy()
              confirmWindow = nil
            end
            local protocol = g_game.getProtocolGame()
            if protocol then protocol:sendExtendedOpcode(VOCATION_RANK_OPCODE, 'upgrade') end
          end
        },
        {
          text = tr('No'),
          callback = function()
            if confirmWindow then
              confirmWindow:destroy()
              confirmWindow = nil
            end
          end
        },
        anchor = AnchorHorizontalCenter
      })
  else
    displayErrorBox(tr('Upgrade Failed'), tr('You need %d fragments to upgrade!', localRankData.cost))
  end
end

function open(creatureThing)
  toggleWindow()
end

function toggleWindow()
  if vocationRanksWindow then
    destroyWindow()
  else
    vocationRanksWindow = g_ui.loadUI('vocation_ranks', modules.game_interface.getRootPanel())
    vocationRanksButton:setOn(true)
    -- Pede os dados 100% atualizados antes de desenhar
    local protocol = g_game.getProtocolGame()
    if protocol then protocol:sendExtendedOpcode(VOCATION_RANK_OPCODE, 'request') end
  end
end

function destroyWindow()
  if vocationRanksWindow then
    vocationRanksWindow:destroy()
    vocationRanksWindow = nil
    vocationRanksButton:setOn(false)
  end
  if confirmWindow then
    confirmWindow:destroy()
    confirmWindow = nil
  end
end

modules.game_vocation_ranks.onUpgrade = onUpgrade
