-- LADO >>
local combat1 = createCombatObject()
setCombatParam(combat1, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)

local function eraserBlowFormula(cid, level, maglevel)
    return getCombatFormulaValues(cid, level, maglevel, 1, 2, 10, 1, 1, 90)
end

function onGetFormulaValues1(cid, level, maglevel) return eraserBlowFormula(cid, level, maglevel) end
setCombatCallback(combat1, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues1")

local arr1 = {
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 1, 1, 1, 1, 1, 2, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
}

local area1 = createCombatArea(arr1)
setCombatArea(combat1, area1)

local combat10 = createCombatObject()
setCombatParam(combat10, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
setCombatParam(combat10, COMBAT_PARAM_EFFECT, 451)
function onGetFormulaValues2(cid, level, maglevel) return eraserBlowFormula(cid, level, maglevel) end
setCombatCallback(combat10, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues2")

local arr10 = {
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 1, 0, 0, 0, 0, 0, 2, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
}

local area10 = createCombatArea(arr10)
setCombatArea(combat10, area10)
-- LADO <<
local combat2 = createCombatObject()
setCombatParam(combat2, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
function onGetFormulaValues3(cid, level, maglevel) return eraserBlowFormula(cid, level, maglevel) end
setCombatCallback(combat2, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues3")

local arr2 = { --lado <<
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 2, 1, 1, 1, 1, 1, 1, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
}

local area2 = createCombatArea(arr2)
setCombatArea(combat2, area2)

local combat20 = createCombatObject()
setCombatParam(combat20, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
setCombatParam(combat20, COMBAT_PARAM_EFFECT, 451)
function onGetFormulaValues4(cid, level, maglevel) return eraserBlowFormula(cid, level, maglevel) end
setCombatCallback(combat20, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues4")

local arr20 = {
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 2, 1, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 },
}

local area20 = createCombatArea(arr20)
setCombatArea(combat20, area20)
-- LADO /\
local combat3 = createCombatObject()
setCombatParam(combat3, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
function onGetFormulaValues5(cid, level, maglevel) return eraserBlowFormula(cid, level, maglevel) end
setCombatCallback(combat3, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues5")

local arr3 = {
    { 0, 0, 0, 0, 2, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 }
}

local area3 = createCombatArea(arr3)
setCombatArea(combat3, area3)

local combat30 = createCombatObject()
setCombatParam(combat30, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
setCombatParam(combat30, COMBAT_PARAM_EFFECT, 450)
function onGetFormulaValues6(cid, level, maglevel) return eraserBlowFormula(cid, level, maglevel) end
setCombatCallback(combat30, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues6")

local arr30 = {
    { 0, 0, 0, 0, 2, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 }
}

local area30 = createCombatArea(arr30)
setCombatArea(combat30, area30)
-- LADO \/
local combat4 = createCombatObject()
setCombatParam(combat4, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
function onGetFormulaValues7(cid, level, maglevel) return eraserBlowFormula(cid, level, maglevel) end
setCombatCallback(combat4, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues7")

local arr4 = {
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 2, 0, 0, 0, 0 }
}

local area4 = createCombatArea(arr4)
setCombatArea(combat4, area4)

local combat40 = createCombatObject()
setCombatParam(combat40, COMBAT_PARAM_TYPE, COMBAT_PHYSICALDAMAGE)
setCombatParam(combat40, COMBAT_PARAM_EFFECT, 450)
function onGetFormulaValues8(cid, level, maglevel) return eraserBlowFormula(cid, level, maglevel) end
setCombatCallback(combat40, CALLBACK_PARAM_LEVELMAGICVALUE, "onGetFormulaValues8")

local arr40 = {
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 1, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 0, 0, 0, 0, 0 },
    { 0, 0, 0, 0, 2, 0, 0, 0, 0 }
}

local area40 = createCombatArea(arr40)
setCombatArea(combat40, area40)


function eraserblow3(cid)
    if getCreatureLookDirection(cid) == 1 then
        doCombat(cid, combat1, numberToVariant(cid))
        doCombat(cid, combat10, numberToVariant(cid))
        doPlayerSay(cid, 'Haaaaaa!', TALKTYPE_ORANGE_1)
    elseif getCreatureLookDirection(cid) == 3 then
        doCombat(cid, combat2, numberToVariant(cid))
        doCombat(cid, combat20, numberToVariant(cid))
        doPlayerSay(cid, 'Haaaaaa!', TALKTYPE_ORANGE_1)
    elseif getCreatureLookDirection(cid) == 0 then
        doCombat(cid, combat3, numberToVariant(cid))
        doCombat(cid, combat30, numberToVariant(cid))
        doPlayerSay(cid, 'Haaaaaa!', TALKTYPE_ORANGE_1)
    elseif getCreatureLookDirection(cid) == 2 then
        doCombat(cid, combat4, numberToVariant(cid))
        doCombat(cid, combat40, numberToVariant(cid))
        doPlayerSay(cid, 'Haaaaaa!', TALKTYPE_ORANGE_1)
    end
end

function eraserblow2(cid)
    doPlayerSay(cid, 'Blow... ', TALKTYPE_ORANGE_1)
    addEvent(eraserblow3, 500, cid)
end

function eraserblow1(cid)
    doPlayerSay(cid, 'Eraser...', TALKTYPE_ORANGE_1)
    addEvent(eraserblow2, 500, cid)
end

function onCastSpell(cid, var)
    if exhaustion.check(cid, 13103) == TRUE then
        doPlayerSendCancel(cid, "Podera usar novamente dentro de 20 segundos.")
        doSendMagicEffect(getCreaturePosition(cid), 2)
        return false
    elseif exhaustion.check(cid, 13104) == TRUE then
        doPlayerSendCancel(cid, "You are exhauted.")
        doSendMagicEffect(getCreaturePosition(cid), 2)
        return false
    end
    addEvent(eraserblow1, 500, cid)
    exhaustion.set(cid, 13103, 20.0)
    return true
end
