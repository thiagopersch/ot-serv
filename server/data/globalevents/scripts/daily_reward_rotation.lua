if not DailyReward then dofile("data/lib/daily_reward.lua") end

-- Gera o calendário do mês (a partir do padrão do portal) logo na virada, sem esperar o
-- primeiro login. Só faz trabalho real uma vez por mês.
function onThink(interval)
    DailyReward.rotate()
    return true
end
