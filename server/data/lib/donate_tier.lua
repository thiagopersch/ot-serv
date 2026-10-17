-- Espelho de lib/donate-tier.ts (portal) — qualquer mudança nos tiers precisa ser replicada
-- nos dois lugares, não há uma única fonte executável entre TS e Lua.
--
-- Tier de donate = quantidade de linhas em `donations` por conta (não soma de `amount`).

DonateTier = DonateTier or {}

DonateTier.TIERS = {
    { key = "diamantite", name = "Diamantite", minCount = 50, bonusPct = 50 },
    { key = "platina", name = "Platina", minCount = 36, bonusPct = 35 },
    { key = "dourado", name = "Dourado", minCount = 26, bonusPct = 20 },
    { key = "prata", name = "Prata", minCount = 20, bonusPct = 15 },
    { key = "bronze", name = "Bronze", minCount = 11, bonusPct = 10 },
    { key = "ferro", name = "Ferro", minCount = 6, bonusPct = 0 },
    { key = "madeira", name = "Madeira", minCount = 0, bonusPct = 0 },
}

function DonateTier.getTierByCount(donationCount)
    for _, tier in ipairs(DonateTier.TIERS) do
        if donationCount >= tier.minCount then
            return tier
        end
    end
    return DonateTier.TIERS[#DonateTier.TIERS]
end

function DonateTier.getAccountDonateTier(accountId)
    local resultId = db.getResult("SELECT COUNT(*) AS cnt FROM `donations` WHERE `account_id` = " .. accountId)
    local count = 0
    if resultId ~= -1 then
        count = result.getDataInt(resultId, "cnt")
        result.free(resultId)
    end

    return DonateTier.getTierByCount(count)
end
