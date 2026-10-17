local config = {
  access = 3, -- acesso mínimo para sair o efeito
  text = "STAFF",
  textcolor = TEXTCOLOR_ORANGE,
  effect = nil,
  interval = 1
}


function onLogin(cid)
  if getPlayerAccess(cid) >= config.access then
    SendEffect(cid, config.effect, config.text, config.interval, config.textcolor)
  end
  return true
end

function SendEffect(cid, effect, text, time, color)
  if isPlayer(cid) then
    if config.effect ~= nil then
      doSendMagicEffect(getPlayerPosition(cid), effect)
    end
    addEvent(SendEffect, time * 1000, cid, effect, text, time, color)
  end
  return true
end
