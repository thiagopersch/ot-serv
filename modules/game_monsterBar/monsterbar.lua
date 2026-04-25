local monsterBar, monsterOutfit, monsterPercent, textPercent, textName, healthCheckTimer = nil
local monsterHasBar = {
	["Demon"] = true
}

function init()
	connect(g_game, {
		onAttackingCreatureChange = onPlayerAttackingBoss,
		onGameEnd = onPlayerDeath
	})

	monsterBar = g_ui.loadUI("monsterbar", modules.game_interface.getRootPanel())

	monsterBar:addAnchor(AnchorTop, "gameTopBar", AnchorTop)

	monsterOutfit = monsterBar:getChildById("outfit")
	monsterPercent = monsterBar:getChildById("monsterPercent")
	textPercent = monsterBar:getChildById("textPercent")
	textName = monsterBar:getChildById("textName")

	monsterBar:hide()
end

function terminate()
	disconnect(g_game, {
		onAttackingCreatureChange = onPlayerAttackingBoss,
		onGameEnd = onPlayerDeath
	})
	monsterBar:hide()

	if healthCheckTimer then
		removeEvent(healthCheckTimer)

		healthCheckTimer = nil
	end
end

function onPlayerDeath()
	monsterBar:hide()

	if healthCheckTimer then
		removeEvent(healthCheckTimer)

		healthCheckTimer = nil
	end
end

function onPlayerAttackingBoss()
	local target = g_game.getAttackingCreature()
	local creature = target

	if creature and not creature:isMonster() then
		return
	end

	if not creature then
		if healthCheckTimer then
			removeEvent(healthCheckTimer)

			healthCheckTimer = nil
		end

		return monsterBar:hide()
	end

	local tabela = monsterHasBar[creature:getName()]

	if not tabela then
		monsterBar:hide()

		return true
	end

	monsterBar:show()
	monsterOutfit:setOutfit(creature:getOutfit())
	monsterOutfit:setOldScaling(true)

	if healthCheckTimer then
		removeEvent(healthCheckTimer)

		healthCheckTimer = nil
	end

	checkTargetHealth()
end

function checkTargetHealth()
	local target = g_game.getAttackingCreature()

	if not target then
		return
	end

	if target:getHealthPercent() >= 76 and target:getHealthPercent() <= 100 then
		monsterPercent:setPercent(target:getHealthPercent())
		monsterPercent:setBackgroundColor("#90CA91")
		textPercent:setText(target:getHealthPercent() .. "%")
		textPercent:setColor("#90CA91")
		textName:setText(target:getName())
		textName:setColor("#90CA91")
	elseif target:getHealthPercent() >= 26 and target:getHealthPercent() <= 75 then
		monsterPercent:setPercent(target:getHealthPercent())
		monsterPercent:setBackgroundColor("yellow")
		textPercent:setText(target:getHealthPercent() .. "%")
		textPercent:setColor("yellow")
		textName:setText(target:getName())
		textName:setColor("yellow")
	elseif target:getHealthPercent() <= 25 then
		monsterPercent:setPercent(target:getHealthPercent())
		monsterPercent:setBackgroundColor("red")
		textPercent:setText(target:getHealthPercent() .. "%")
		textPercent:setColor("red")
		textName:setText(target:getName())
		textName:setColor("red")
	end

	healthCheckTimer = scheduleEvent(checkTargetHealth, 500)
end
