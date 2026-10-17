VocationRankConfig = {
  StarsPerRank = 5,
  FragmentsPerStar = 50, -- cost of star N within a rank = N * FragmentsPerStar (50, 100, 150, 200, 250)
  DamagePerStar = 2,     -- % damage bonus per star ever purchased (all vocations)
  HealthPerStar = 5000,  -- flat max HP bonus per star ever purchased (all vocations)
  ManaPerStar = 5000,    -- flat max mana bonus per star ever purchased (all vocations)

  UniversalFragmentItemIds = { 56386, 56411, 56412, 56413, 56414, 56328 }, -- All universal fragment types
  UniversalFragmentItemId = 56386,                                         -- Primary universal fragment (kept for compatibility)
  Ranks = {
    [0] = { name = "None", color = "#aaaaaa", starImage = "" },
    [1] = { name = "Bronze", color = "#cd7f32", starImage = "/images/ranks/bronze_star.png" },
    [2] = { name = "Silver", color = "#c0c0c0", starImage = "/images/ranks/silver_star.png" },
    [3] = { name = "Gold", color = "#ffd700", starImage = "/images/ranks/gold_star.png" },
    [4] = { name = "Diamond", color = "#b9f2ff", starImage = "/images/ranks/diamond_star.png" }
  },
  Vocations = {}
}

-- Archetype base combat multipliers (used by the spell damage formula and combat defense
-- logic — independent of the star/rank upgrade system above).
VocationRankConfig.Archetypes = {
  ["DPS"] = { damageMult = 2.5, defenseMult = 1.0 },
  ["Bruiser"] = { damageMult = 2.0, defenseMult = 1.05 },
  ["Support"] = { damageMult = 1.0, defenseMult = 1.10, manaRegenBuff = 15000 },
  ["Tank"] = { damageMult = 1.0, defenseMult = 1.20, hpRegenBuff = 15000 }
}

-- Rank shorthands
local BRONZE, SILVER, GOLD, DIAMOND = 1, 2, 3, 4

-- Helper to add vocation configs quickly
local function addVocation(id, archetype, maxRank, specificItemId)
  VocationRankConfig.Vocations[id] = {
    archetype = archetype,
    maxRank = maxRank,
    specificFragmentItemId = specificItemId,
  }
end

-- Dragon Ball Vocations (ID 0-45) — None (ID 0) has no config (cannot upgrade)
addVocation(1, "DPS", SILVER, 49856)      -- Bardock
addVocation(2, "DPS", DIAMOND, 49857)     -- Bills
addVocation(3, "Tank", GOLD, 49858)       -- Botamo
addVocation(4, "DPS", GOLD, 49859)        -- Brolly
addVocation(5, "Bruiser", BRONZE, 49860)  -- Bulma
addVocation(6, "Bruiser", SILVER, 49861)  -- Buu
addVocation(7, "Bruiser", BRONZE, 49862)  -- C8
addVocation(8, "Bruiser", BRONZE, 49863)  -- C17
addVocation(9, "Bruiser", BRONZE, 49864)  -- C18
addVocation(10, "DPS", BRONZE, 49865)     -- Cabba
addVocation(11, "DPS", SILVER, 49866)     -- Cell
addVocation(12, "DPS", SILVER, 49867)     -- Cooler
addVocation(13, "Support", BRONZE, 49868) -- Dende
addVocation(14, "Bruiser", SILVER, 49869) -- Freeza
addVocation(15, "DPS", GOLD, 49870)       -- Ginn
addVocation(16, "Bruiser", BRONZE, 49854) -- Gohan
addVocation(17, "DPS", BRONZE, 49852)     -- Goku
addVocation(18, "DPS", GOLD, 49871)       -- Goku Black
addVocation(19, "DPS", SILVER, 49872)     -- Hitto
addVocation(20, "DPS", SILVER, 49873)     -- Janemba
addVocation(21, "DPS", GOLD, 49874)       -- Jiren
addVocation(22, "Bruiser", BRONZE, 49875) -- Kagome
addVocation(23, "Bruiser", SILVER, 49876) -- Kaio
addVocation(24, "Bruiser", SILVER, 49877) -- Kame
addVocation(25, "Bruiser", BRONZE, 49878) -- King Cold
addVocation(26, "Bruiser", SILVER, 49879) -- King Vegeta
addVocation(27, "Bruiser", BRONZE, 49880) -- Kuririn
addVocation(28, "DPS", GOLD, 49881)       -- Liquir
addVocation(29, "Support", SILVER, 49882) -- Pan
addVocation(30, "Support", BRONZE, 49855) -- Piccolo
addVocation(31, "Bruiser", GOLD, 49883)   -- Quitela
addVocation(32, "Bruiser", BRONZE, 49884) -- Raditz
addVocation(33, "DPS", DIAMOND, 49885)    -- Shenron
addVocation(34, "DPS", GOLD, 49886)       -- Tapion
addVocation(35, "DPS", BRONZE, 49887)     -- Trunks
addVocation(36, "Bruiser", SILVER, 49888) -- Tsuful
addVocation(37, "DPS", SILVER, 49889)     -- Turles
addVocation(38, "Bruiser", SILVER, 49890) -- Uub
addVocation(39, "Bruiser", DIAMOND, 49891) -- Vados
addVocation(40, "DPS", BRONZE, 49853)     -- Vegeta
addVocation(41, "DPS", GOLD, 49892)       -- Vegetto
addVocation(42, "DPS", GOLD, 49893)       -- Vermouth
addVocation(43, "Support", SILVER, 49894) -- Videl
addVocation(44, "DPS", DIAMOND, 49895)    -- Zaiko
addVocation(45, "DPS", DIAMOND, 49896)    -- Zeno

-- Bleach Vocations (ID 47-67)
addVocation(47, "DPS", DIAMOND, 49897)     -- Sosuke Aizen
addVocation(48, "DPS", DIAMOND, 49898)     -- Byakuya Kuchiki
addVocation(49, "Bruiser", GOLD, 49899)    -- Gin Ichimaru
addVocation(50, "DPS", SILVER, 49900)      -- Grimmjow Jaegerjaquez
addVocation(51, "Bruiser", DIAMOND, 49901) -- Toshiro Hitsugaya
addVocation(52, "DPS", DIAMOND, 49902)     -- Ichigo Kurosaki Time Skip (Ichigo FullBring)
addVocation(53, "DPS", BRONZE, 49903)      -- Ichigo Kurosaki
addVocation(54, "Bruiser", BRONZE, 49904)  -- Uryuu Ishida
addVocation(55, "DPS", DIAMOND, 49905)     -- Shunsui Kyouraku
addVocation(56, "Bruiser", SILVER, 49906)  -- Neliel Tu Odelschwanck
addVocation(57, "Support", BRONZE, 49907)  -- Orihime Inoue
addVocation(58, "Bruiser", BRONZE, 49908)  -- Renji Abarai
addVocation(59, "Bruiser", BRONZE, 49909)  -- Rukia Kuchiki
addVocation(60, "Tank", BRONZE, 49910)     -- Yasutora Sado
addVocation(61, "Bruiser", DIAMOND, 49911) -- Shinji Hirako
addVocation(62, "Bruiser", GOLD, 49912)    -- Soi Fong
addVocation(63, "Bruiser", DIAMOND, 49913) -- Kaname Tousen
addVocation(64, "DPS", DIAMOND, 49914)     -- Ulquiorra Ciffer
addVocation(65, "Bruiser", DIAMOND, 49915) -- Kisuke Urahara
addVocation(66, "Bruiser", DIAMOND, 49916) -- Yoruichi Shihouin
addVocation(67, "DPS", DIAMOND, 49917)     -- Kenpachi Zaraki

-- Sobrepõe maxRank/archetype/specificFragmentItemId hardcoded acima com os valores dos campos
-- do CRUD de vocações do portal (colunas vocations.max_rank/archetype/specific_fragment_item_id,
-- exportadas como atributos maxrank="N" archetype="..." specificfragmentitemid="N" em
-- vocations.xml). Mantém os fallbacks hardcoded (addVocation acima) quando o atributo não existe
-- (portal ainda não exportou/vocação sem entrada no XML), pra não quebrar servidores que não usam
-- o portal.
local function loadVocationConfigFromXml()
  local path = "data/XML/vocations.xml"
  local file, err = io.open(path, "r")
  if not file then
    print("[VocationRanks] Nao foi possivel abrir " .. path .. ": " .. tostring(err))
    return
  end

  local content = file:read("*a")
  file:close()

  local overridden = 0
  for vocationBlock in string.gmatch(content, "<vocation%s+(.-)/?>") do
    local id = tonumber(vocationBlock:match('id="(%-?%d+)"'))
    if id and VocationRankConfig.Vocations[id] then
      local maxRank = tonumber(vocationBlock:match('maxrank="(%d+)"'))
      local archetype = vocationBlock:match('archetype="([^"]+)"')
      local specificFragmentItemId = tonumber(vocationBlock:match('specificfragmentitemid="(%d+)"'))

      if maxRank then VocationRankConfig.Vocations[id].maxRank = maxRank end
      if archetype then VocationRankConfig.Vocations[id].archetype = archetype end
      if specificFragmentItemId then
        VocationRankConfig.Vocations[id].specificFragmentItemId = specificFragmentItemId
      end

      if maxRank or archetype or specificFragmentItemId then
        overridden = overridden + 1
      end
    end
  end

end

loadVocationConfigFromXml()
