local param = {
    distanceEffect = 166,
    magEffect = 278,
    lvl = 50,
    interval = 300,
    numRepeat = 1,
    pos = { x = 0, y = 0, z = 0 },
    speedPerTile = 1 -- tempo em ms que o distanceEffect leva para percorrer 1 tile
}

local combat = createCombatObject()
setCombatParam(combat, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
setCombatParam(combat, COMBAT_PARAM_DISTANCEEFFECT, param.distanceEffect)

function onGetFormulaValues(cid, level, maglevel)
    return getCombatFormulaValues(cid, level, maglevel, 1, 2, 10, 1, 1, param.lvl)
end

setCombatCallback(combat, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues")

local function onCastSpell1(parameters)
    doCombat(parameters.cid, parameters.combat1, parameters.var)
end

function onCastSpell(cid, var)
    local target = getCreatureTarget(cid)
    if not target or not isCreature(target) or getCreatureHealth(target) <= 0 then
        return false
    end

    local casterPos = getCreaturePosition(cid)
    local targetPos = getCreaturePosition(target)

    -- posição para exibir o magEffect
    local magEffectPos = {
        x = targetPos.x + param.pos.x,
        y = targetPos.y + param.pos.y,
        z = targetPos.z + param.pos.z
    }

    local distance = math.max(math.abs(targetPos.x - casterPos.x), math.abs(targetPos.y - casterPos.y))
    local delay = param.speedPerTile * distance

    local parameters = { cid = cid, var = var, combat1 = combat }

    for k = 1, param.numRepeat do
        addEvent(function()
            if isCreature(cid) then
                onCastSpell1(parameters)
                addEvent(function()
                    if isCreature(cid) and isCreature(target) then
                        doSendMagicEffect(magEffectPos, param.magEffect)
                    end
                end, delay)
            end
        end, 1 + ((k - 1) * param.interval))
    end
    return true
end
