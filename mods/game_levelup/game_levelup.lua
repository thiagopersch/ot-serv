local seconds_fadeout = 2
local LevelUpWindow
local LevelWindowByRoot
local ultimo_uso = os.time()

local function onLevelUp(creature, level, levelPercent, oldLevel, oldLevelPercent)
	if level > oldLevel and oldLevel ~= -1 then
		doAnimationImage()
	end
end

function doAnimationImage()
  LevelWindowByRoot = modules.game_interface.getRootPanel().windowLevelUp
  local tempo_atual = os.time()
  if tempo_atual - ultimo_uso >= 2 then
  doCloseWindowUp()
    ultimo_uso = tempo_atual
    if not LevelWindowByRoot then
      LevelUpWindow = g_ui.loadUI('game_levelup', modules.game_interface.getRootPanel())
      image = LevelUpWindow.image
	  local windowsize = LevelUpWindow:getSize().height / 4
	  LevelUpWindow:setMarginTop(windowsize)
      scheduleEvent(function()
	    g_effects.fadeIn(image, 350) -- Efeito de aparecer o modulo
      end, 100)
    end
    
    scheduleEvent(function()
      g_effects.fadeOut(image, 350) -- Efeito de sumir depois de 2 segundos
      scheduleEvent(function()
        doCloseWindowUp()
      end, 400) -- contagem em milisegundos para executar a função de destruir
    end, seconds_fadeout*1000) -- contagem em milisegundos para executar a função de fade out
  end
end

function doCloseWindowUp()
  if LevelUpWindow then
    LevelUpWindow:destroy()
    LevelUpWindow = nil
  end
end

function init()
    connect(LocalPlayer, {onLevelChange = onLevelUp})
    connect(Creature, {
        onLevelChange = onLevelUp,
    })
    connect(g_game, { onLogout = doCloseWindowUp })
end

function terminate()
    disconnect(LocalPlayer, {onLevelChange = onLevelUp})
    disconnect(Creature, {
        onLevelChange = onLevelUp,
    })
    disconnect(g_game, { onLogout = doCloseWindowUp })
	doCloseWindowUp()
end
