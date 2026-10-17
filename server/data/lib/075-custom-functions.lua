function doShowTimeByPos(uid, pos, duration, type, effectId)
  type = type or 20
  effectId = effectId or CONST_ME_SMOKE
  local steps = duration * 10
  for i = 0, steps do
    addEvent(function()
      if isCreature(uid) then
        local remaining = duration - (i / 10)
        if remaining >= 0 then
          doSendAnimatedText(pos, string.format("%.1f", remaining), TEXTCOLOR_BLUE)
        end
      end
    end, i * 100)
  end
  addEvent(function()
    if isCreature(uid) then
      doSendMagicEffect(pos, effectId)
    end
  end, duration * 1000)
  return true
end

function doExpandingWaveCombat(cid, config)
  if not isCreature(cid) then
    return false
  end

  local function isBlocked(pos)
    -- Verifica se o tile existe primeiro para evitar spam de "Tile not found" no console
    local ground = getThingfromPos({ x = pos.x, y = pos.y, z = pos.z, stackpos = 0 }, false)
    if ground.itemid == 0 then return true end -- Se não há chão, está bloqueado

    local t = getTileInfo(pos)
    if type(t) ~= 'table' then return false end
    
    -- 1. Checa Zona de Proteção / No-PvP / Casas
    local pz = t.protection or t.pz or t.nopvp or t.house or false
    if pz == true or (type(pz) == 'number' and pz > 0) then
      return true
    end

    -- 2. Checa se o tile bloqueia projéteis (Paredes e objetos sólidos)
    local block = t.blockprojectile or false
    if block == true or (type(block) == 'number' and block > 0) then
      return true
    end

    return false
  end

  -- Verifica linha de visão livre de projéteis entre duas posições.
  -- `canThrowObjectTo` nunca foi exposta ao Lua neste fork (só existe em C++, sem lua_register
  -- em luascript.cpp) — usa `isSightClear`, que é o equivalente já registrado (mesmo
  -- Map::canThrowObjectTo por baixo, ver game.cpp Game::isSightClear).
  local function hasLineOfSight(fromPos, toPos)
    -- Posições no mesmo tile são sempre visíveis
    if fromPos.x == toPos.x and fromPos.y == toPos.y and fromPos.z == toPos.z then
      return true
    end
    -- floorCheck = true: barra o "lançamento" se as posições estiverem em andares diferentes
    return isSightClear(fromPos, toPos, true)
  end

  local casterPos = getCreaturePosition(cid)
  if isBlocked(casterPos) then
    return false
  end

  local hitCreatures = {}

  local function getEffect(radius)
    if config.effects then
      return config.effects[(radius - 1) % #config.effects + 1]
    end
    return config.effect
  end



  local function doAreaDamage(radius)
    if not isCreature(cid) then
      return false
    end

    local center = getCreaturePosition(cid)
    if isBlocked(center) then
      return false
    end

    -- 1. Efeitos (Apenas no anel do raio atual)
    -- Só renderiza efeito se o tile não estiver bloqueado E houver linha de visão livre do centro
    for x = -radius, radius do
      for y = -radius, radius do
        if math.abs(x) + math.abs(y) == radius then
          local areaPos = { x = center.x + x, y = center.y + y, z = center.z }
          if not isBlocked(areaPos) and hasLineOfSight(center, areaPos) then
            doSendMagicEffect(areaPos, getEffect(radius))
          end
        end
      end
    end

    -- 2. Dano (Usando getSpectators para ser eficiente e evitar logs de 'Tile not found')
    local spectators = getSpectators(center, radius, radius, false)
    if spectators then
      for _, creature in ipairs(spectators) do
        if isCreature(creature) and creature ~= cid then
          local targetPos = getCreaturePosition(creature)
          local dist = math.abs(targetPos.x - center.x) + math.abs(targetPos.y - center.y)

          if dist <= radius and not hitCreatures[creature] then
            hitCreatures[creature] = true
            -- Checar se a posição do alvo não está bloqueada E se há linha de visão livre
            -- hasLineOfSight já rejeita PZ e blockprojectile (paredes, árvores, etc.)
            if not isBlocked(targetPos) and hasLineOfSight(center, targetPos) then
              local min, max
              if isPlayer(cid) and config.spellMaxLevel then
                -- Same level/magic level/vocation/skill-upgrade formula used by target spells
                -- (getCombatFormulaValues, data/lib/formula_values_spells.lua), so wave and
                -- target spells scale the same way. Radius keeps the existing behaviour of
                -- hitting harder the farther the ring has expanded.
                local level = getPlayerLevel(cid)
                local maglevel = getPlayerMagLevel(cid)
                min, max = getCombatFormulaValues(cid, level, maglevel, config.baseMin or 1,
                  config.baseMax or 2, config.levelDiv or 10, config.magMultMin or 1,
                  config.magMultMax or 1, config.spellMaxLevel)
                min = min * radius
                max = max * radius
              elseif config.minDmg and config.maxDmg then
                -- Valores fixos por spell (ex: monsters/bakuhatsuha.lua)
                min = -(config.minDmg * radius)
                max = -(config.maxDmg * radius)
              else
                -- Monstro usando spell de player: o min/max do XML do monstro é ignorado
                -- pela engine em spells com script, então escala pela vida máxima do caster
                -- (~bate com os valores atuais do XML: trunks SSJ2 350k HP -> 500-750,
                -- trunks SSJ5 1.5M HP -> 2000-2500).
                local maxHealth = getCreatureMaxHealth(cid)
                min = -(maxHealth * (config.monsterMinPct or 0.0014) * radius)
                max = -(maxHealth * (config.monsterMaxPct or 0.0018) * radius)
              end
              doTargetCombatHealth(cid, creature, config.type, min, max, getEffect(radius))
            end
          end
        end
      end
    end
  end

  local function expandArea(radius)
    if radius > config.maxRadius then
      return
    end
    if not isCreature(cid) then
      return
    end
    doAreaDamage(radius)
    addEvent(function()
      expandArea(radius + 1)
    end, config.areaIncreaseDelay)
  end

  expandArea(1)
  return true
end
