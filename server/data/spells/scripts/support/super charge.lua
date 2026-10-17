local config = {
    cooldown = 60, -- tempo entre uma magia e outra
    timer = 60,    -- tempo em segundos que ficará healando
    storage = 45382,
    effect = 381,  -- efeito que vai sair
    lvl = 200,
    lifedraw = 2000
}

function onCastSpell(cid, var)
    if getPlayerLevel(cid) < config.lvl then
        if os.time() - getPlayerStorageValue(cid, config.storage) >=
            config.cooldown then
            for i = 1, config.timer do
                addEvent(function()
                    if isCreature(cid) then
                        local lifedraw = config.lifedraw
                        local pos = getPlayerPosition(cid)
                        doCreatureAddMana(cid, lifedraw, 1)
                        doSendAnimatedText(pos, "+" .. lifedraw, TEXTCOLOR_PURPLE)
                        doSendMagicEffect(pos, config.effect)
                    end
                end, config.lifedraw * i)
            end
            doPlayerSetStorageValue(cid, config.storage, os.time())
        else
            doPlayerSendCancel(cid,
                "You can use the spell again in " ..
                (config.cooldown - (os.time() - getPlayerStorageValue(cid, config.storage))) .. " seconds.")
            return false
        end
    else
        doPlayerSendCancel(cid, "Only levels less than " .. config.lvl .. " can use this spell.")
        return false
    end
    return true
end
