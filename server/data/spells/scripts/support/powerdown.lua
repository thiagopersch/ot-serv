function onCastSpell(cid, var)
    local mana = getCreatureMana(cid)
    local effect = 320

    if doCreatureAddMana(cid, -mana) then
        if doPlayerAddSpentMana(cid, mana) then
            doSendMagicEffect(getCreaturePosition(cid), effect)
            return false
        else
            doCreatureAddMana(cid, mana)
        end
    end

    doSendMagicEffect(getCreaturePosition(cid), effect)
    return false
end
