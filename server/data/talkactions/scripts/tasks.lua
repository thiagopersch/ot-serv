-- Task Spawn Configuration
-- Each monster can have multiple spawns with different properties

TASK_SPAWNS = {
    ["Small Goku"] = {
        { name = "Small Goku Spawn 1", area = "West Plains",  x = 1000, y = 900,  z = 7, radius = 15, weight = 10, rare = false },
        { name = "Small Goku Spawn 2", area = "South Forest", x = 1100, y = 1000, z = 7, radius = 20, weight = 8,  rare = false }
    },
    ["Raditz"] = {
        { name = "Raditz Spawn", area = "West Plains", x = 1050, y = 920, z = 7, radius = 12, weight = 6, rare = false }
    },
    ["Nappa"] = {
        { name = "Nappa Spawn", area = "East Desert", x = 1200, y = 800, z = 7, radius = 10, weight = 5, rare = false }
    },
    ["Vegeta"] = {
        { name = "Vegeta Spawn", area = "East Desert", x = 1250, y = 820, z = 7, radius = 12, weight = 4, rare = false }
    },
    ["Elite Saiyajin"] = {
        { name = "Elite Saiyajin Spawn 1", area = "East Desert",     x = 1220, y = 810, z = 7, radius = 15, weight = 6, rare = false },
        { name = "Elite Saiyajin Spawn 2", area = "North Mountains", x = 1300, y = 700, z = 7, radius = 10, weight = 4, rare = false }
    },
    ["Saiyajin Warrior"] = {
        { name = "Saiyajin Warrior Spawn", area = "East Desert", x = 1230, y = 830, z = 7, radius = 14, weight = 7, rare = false }
    },
    ["Freeza"] = {
        { name = "Freeza Spawn", area = "North Frozen Tundra", x = 1400, y = 600, z = 7, radius = 15, weight = 3, rare = false }
    },
    ["Freeza Final Form"] = {
        { name = "Freeza Final Spawn", area = "North Frozen Tundra", x = 1420, y = 580, z = 7, radius = 10, weight = 2, rare = true }
    },
    ["Freeza Boss"] = {
        { name = "Freeza Boss Chamber", area = "Freeza's Ship", x = 1450, y = 550, z = 7, radius = 8, weight = 1, rare = true }
    },
    ["Cell"] = {
        { name = "Cell Spawn", area = "Cell Games Arena", x = 1500, y = 650, z = 7, radius = 15, weight = 3, rare = false }
    },
    ["Cell Perfect"] = {
        { name = "Cell Perfect Spawn", area = "Cell Games Arena", x = 1520, y = 660, z = 7, radius = 10, weight = 2, rare = true }
    },
    ["Majin Boo"] = {
        { name = "Majin Boo Spawn", area = "South Dark Mountains", x = 1600, y = 900, z = 7, radius = 12, weight = 3, rare = false }
    },
    ["Super Boo"] = {
        { name = "Super Boo Spawn", area = "South Dark Mountains", x = 1610, y = 910, z = 7, radius = 10, weight = 2, rare = true }
    },
    ["Kid Boo"] = {
        { name = "Kid Boo Spawn", area = "Supreme Kai Planet", x = 1700, y = 500, z = 7, radius = 20, weight = 2, rare = true }
    },
    ["Bills"] = {
        { name = "Bills Spawn", area = "God of Destruction Planet", x = 1800, y = 400, z = 7, radius = 20, weight = 1, rare = true }
    },
    ["Whis"] = {
        { name = "Whis Spawn", area = "God of Destruction Planet", x = 1800, y = 420, z = 7, radius = 15, weight = 1, rare = true }
    },
    ["Jiren"] = {
        { name = "Jiren Spawn", area = "World of Void", x = 2000, y = 300, z = 7, radius = 25, weight = 1, rare = true }
    },
    ["Hollow"] = {
        { name = "Hollow Spawn 1", area = "Shadow Realm", x = 900, y = 1100, z = 7, radius = 12, weight = 10, rare = false },
        { name = "Hollow Spawn 2", area = "Dark Forest",  x = 950, y = 1150, z = 7, radius = 15, weight = 7,  rare = false }
    },
    ["Lesser Hollow"] = {
        { name = "Lesser Hollow Spawn 1", area = "Shadow Realm", x = 880, y = 1080, z = 7, radius = 20, weight = 12, rare = false },
        { name = "Lesser Hollow Spawn 2", area = "Dark Forest",  x = 930, y = 1130, z = 7, radius = 18, weight = 10, rare = false }
    },
    ["Shinigami"] = {
        { name = "Shinigami Spawn 1", area = "Soul Society", x = 800, y = 1000, z = 7, radius = 15, weight = 6, rare = false },
        { name = "Shinigami Spawn 2", area = "Seireitei",    x = 820, y = 1020, z = 7, radius = 12, weight = 5, rare = false }
    },
    ["Soul Reaper"] = {
        { name = "Soul Reaper Spawn", area = "Soul Society", x = 810, y = 1010, z = 7, radius = 14, weight = 4, rare = false }
    },
    ["Arrancar"] = {
        { name = "Arrancar Spawn 1", area = "Hueco Mundo", x = 700, y = 1200, z = 7, radius = 15, weight = 5, rare = false },
        { name = "Arrancar Spawn 2", area = "Las Noches",  x = 720, y = 1220, z = 7, radius = 12, weight = 4, rare = false }
    },
    ["Arrancar Elite"] = {
        { name = "Arrancar Elite Spawn", area = "Las Noches", x = 730, y = 1230, z = 7, radius = 10, weight = 3, rare = false }
    },
    ["Espada"] = {
        { name = "Espada Spawn 1", area = "Las Noches",  x = 740, y = 1240, z = 7, radius = 12, weight = 3, rare = false },
        { name = "Espada Spawn 2", area = "Hueco Mundo", x = 710, y = 1210, z = 7, radius = 10, weight = 2, rare = true }
    },
    ["Espada Elite"] = {
        { name = "Espada Elite Spawn", area = "Las Noches Throne Room", x = 750, y = 1250, z = 7, radius = 10, weight = 2, rare = true }
    },
    ["Captain"] = {
        { name = "Captain Spawn 1", area = "Seireitei",    x = 830, y = 1030, z = 7, radius = 12, weight = 3, rare = false },
        { name = "Captain Spawn 2", area = "Soul Society", x = 840, y = 1040, z = 7, radius = 10, weight = 2, rare = false }
    },
    ["Captain Commander"] = {
        { name = "Captain Commander Spawn", area = "Seireitei HQ", x = 850, y = 1050, z = 7, radius = 10, weight = 1, rare = true }
    },
    ["Yhwach"] = {
        { name = "Yhwach Spawn", area = "Wandenreich", x = 600, y = 1300, z = 7, radius = 20, weight = 1, rare = true }
    },
    ["Aizen Boss"] = {
        { name = "Aizen Boss Spawn", area = "Las Noches Throne Room", x = 760, y = 1260, z = 7, radius = 12, weight = 1, rare = true }
    }
}

function TaskSpawn_getSpawns(monsterName)
    return TASK_SPAWNS[monsterName] or {}
end

function TaskSpawn_getEncounterChance(monsterName)
    local spawns = TASK_SPAWNS[monsterName]
    if not spawns or #spawns == 0 then return 0 end

    local totalWeight = 0
    for _, spawn in ipairs(spawns) do
        totalWeight = totalWeight + spawn.weight
    end

    -- Calculate probability based on weight vs total possible spawns
    local chance = math.min(math.floor((totalWeight / 50) * 100), 100)
    return chance
end

function TaskSpawn_getPrimaryArea(monsterName)
    local spawns = TASK_SPAWNS[monsterName]
    if not spawns or #spawns == 0 then return "Unknown" end
    return spawns[1].area
end
