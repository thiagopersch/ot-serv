dofile("data/lib/donate_tier.lua")

-- Bless infinita: como o consumo de blessings acontece dentro do engine C++
-- (Player::onCreatureDeath, `blessings = 0` antes de forçar o relogin — ver player.cpp), a
-- reaplicação acontece aqui, a cada login (inclusive o relogin forçado após a morte).
--
-- `config.lua` tem `blessingOnlyPremium = true` — blessings só têm efeito para contas premium
-- nesse fork, então só reaplicamos para contas premium (senão seria um efeito nulo).
function onLogin(cid)
    local tier = DonateTier.getAccountDonateTier(getPlayerAccountId(cid))
    if tier.bonusPct > 0 and isPremium(cid) then
        for i = 1, 5 do
            doPlayerAddBlessing(cid, i)
        end
    end
    return true
end
