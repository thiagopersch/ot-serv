function addOnlineBonus(cid, horas, bonus_contador, bonus_max)
  if not isPlayer(cid) then return false end
  setPlayerStorageValue(cid, bonus_contador, getPlayerStorageValue(cid, bonus_contador) + 1)
  doPlayerAddOnlineTime(cid, 1)
  doPlayerSendTextMessage(cid, MESSAGE_STATUS_CONSOLE_BLUE,
    "[Online Points] Hello " ..
    getPlayerName(cid) .. ", for being online in our world, you just received 1 Online Points for that!. Total: " ..
    getPlayerStorageValue(cid, bonus_contador) .. ".")
  if getPlayerStorageValue(cid, bonus_contador) >= bonus_max then
    doPlayerSendTextMessage(cid, 19,
      "Their " .. bonus_max .. " Online Points were converted into 5 day of Premium Account!")
    doPlayerAddPremiumDays(cid, 5)
    setPlayerStorageValue(cid, bonus_contador, 0)
  end
  addEvent(addOnlineBonus, horas * 3600 * 1000, cid, horas, bonus_contador, bonus_max)
end

function onLogin(cid)
  local bonus_contador = 72702 -- Storage que vai guardar quantos online bonus o char possui.
  local horas = 1              -- Quantidade de horas o char precisa ficar logado pra receber cada online bonus.
  local bonus_max = 30         -- Quantidade de bonus que o char precisa atingir para ganhar 1 dia de premium account, zerando o contador.
  local totalDB = getPlayerOnlineTime(cid)
  if getPlayerStorageValue(cid, bonus_contador) < 0 then
    setPlayerStorageValue(cid, bonus_contador, 0)
  end
  doPlayerSendTextMessage(cid, 27,
    "You are with: " .. totalDB .. " Online Points.")
  addEvent(addOnlineBonus, horas * 3600 * 1000, cid, horas, bonus_contador, bonus_max)

  return true
end
