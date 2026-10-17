-- Account manager
accountManager = false
namelockManager = false
newPlayerChooseTown = false
newPlayerChooseVoc = true
-- newPlayerDefaultTownId = 2
newPlayerSpawnPosX = 32000
newPlayerSpawnPosY = 32002
newPlayerSpawnPosZ = 7
newPlayerTownId = 1
newPlayerLevel = 1
newPlayerMagicLevel = 0
generateAccountNumber = false
generateAccountSalt = false
accountSize = 25
useFragHandler = true
enableCast = true
extendedOpcodes = true
useKFormatForNumbers = true
-- countUint16 = false
-- maxcount = 10000

-- Unjustified kills
-- NOTE: *Banishment and *BlackSkull variables are >summed up<
-- (dailyFragsToRedSkull + dailyFragsToBanishment) with their
-- *RedSkull equivalents.
-- Auto banishing works only if useBlackSkull set to negative.
-- advancedFragList is not advised if you use huge frags
-- requirements.
redSkullLength = 30 * 24 * 60 * 60
blackSkullLength = 45 * 24 * 60 * 60
dailyFragsToRedSkull = 3
weeklyFragsToRedSkull = 5
monthlyFragsToRedSkull = 10
dailyFragsToBlackSkull = dailyFragsToRedSkull
weeklyFragsToBlackSkull = weeklyFragsToRedSkull
monthlyFragsToBlackSkull = monthlyFragsToRedSkull
dailyFragsToBanishment = dailyFragsToRedSkull
weeklyFragsToBanishment = weeklyFragsToRedSkull
monthlyFragsToBanishment = monthlyFragsToRedSkull
blackSkulledDeathHealth = 40
blackSkulledDeathMana = 0
useBlackSkull = true
useFragHandler = true
advancedFragList = false

-- Banishments
-- violationNameReportActionType 1 = just a report, 2 = name lock, 3 = player banishment
-- killsBanLength works only if useBlackSkull option is disabled.
notationsToBan = 3
warningsToFinalBan = 4
warningsToDeletion = 5
banLength = 7 * 24 * 60 * 60
killsBanLength = 7 * 24 * 60 * 60
finalBanLength = 30 * 24 * 60 * 60
ipBanishmentLength = 1 * 24 * 60 * 60
broadcastBanishments = true
maxViolationCommentSize = 200
violationNameReportActionType = 2
autoBanishUnknownBytes = false

-- Battle
-- NOTE: showHealingDamageForMonsters inheritates from showHealingDamage.
-- loginProtectionPeriod is the famous Tibia anti-magebomb system.
-- deathLostPercent set to nil enables manual mode.
worldType = "open"
protectionLevel = 50
pvpTileIgnoreLevelAndVocationProtection = true
pzLocked = 30 * 1000
huntingDuration = 60 * 1000
criticalHitChance = 7
criticalHitMultiplier = 1
displayCriticalHitNotify = true
removeWeaponAmmunition = true
removeWeaponCharges = true
removeRuneCharges = true
whiteSkullTime = 15 * 60 * 1000
noDamageToSameLookfeet = false
showHealingDamage = false
showHealingDamageForMonsters = false
fieldOwnershipDuration = 5 * 1000
stopAttackingAtExit = true
loginProtectionPeriod = 10 * 1000
deathLostPercent = 10
stairhopDelay = 2 * 1000
pushCreatureDelay = 2 * 1000
deathContainerId = 1987
gainExperienceColor = 215
addManaSpentInPvPZone = true
squareColor = 0
allowFightback = true
fistBaseAttack = 7
optionalWarAttackableAlly = false
healthHealingColor = COLOR_GREEN
manaHealingColor = COLOR_DARKPURPLE

worldId = 0
ip = os.getenv("SERVER_IP") or "127.0.0.1"
bindOnlyGlobalAddress = false
loginPort = 7171
gamePort = 7172
loginTries = 10
retryTimeout = 5 * 1000
loginTimeout = 60 * 1000
maxPlayers = 1000
motd = "Welcome to the WodBleach!"
displayOnOrOffAtCharlist = false
onePlayerOnlinePerAccount = false
allowClones = false
serverName = "WodBleach"
loginMessage = "Welcome to the WodBleach!"
statusTimeout = 5 * 60 * 1000
replaceKickOnLogin = true
forceSlowConnectionsToDisconnect = false
loginOnlyWithLoginServer = false
premiumPlayerSkipWaitList = true
max_packets_per_second = 1000

-- Anti-Divulga��o
advertisingBlock = ".net;servegame;no-ip;.hopto;.net;.info;.org;.zapto;.me;.ddns;.pl;.biz"

-- Anti-Push
useAntiPush = true
antiPushDelay = 500
antiPushItems = "2148,2152,2160,3976"

-- Database
-- NOTE: sqlFile is used only by sqlite database, and sqlKeepAlive by mysql database.
-- To disable sqlKeepAlive such as mysqlReadTimeout use 0 value.
-- encryptionType can be plain, md5, sha1, sha256, sha512 or vahash.
sqlType = "mysql"
sqlHost = os.getenv("SQL_HOST") or "localhost"
sqlPort = tonumber(os.getenv("SQL_PORT")) or 3307
sqlUser = "root"
sqlPass = os.getenv("SQL_PASS") or "ndbo"
sqlDatabase = os.getenv("SQL_DATABASE") or "ndbo"
sqlFile = "theforgottenserver.s3db"
sqlKeepAlive = 0
mysqlReadTimeout = 10
mysqlWriteTimeout = 10
mysqlReconnectionAttempts = 5
encryptionType = "sha1"

-- Deathlist
deathListEnabled = true
deathListRequiredTime = 1 * 60 * 1000
deathAssistCount = 19
maxDeathRecords = 5

-- Guilds
ingameGuildManagement = true
levelToFormGuild = 8
premiumDaysToFormGuild = 0
guildNameMinLength = 4
guildNameMaxLength = 20
maxPlayerGuild = 1000

-- Highscores
highscoreDisplayPlayers = 15
updateHighscoresAfterMinutes = 60

-- Houses
buyableAndSellableHouses = true
houseNeedPremium = true
bedsRequirePremium = true
levelToBuyHouse = 8
housesPerAccount = 0
houseRentAsPrice = false
housePriceAsRent = false
housePriceEachSquare = 1000
houseRentPeriod = "never"
houseCleanOld = 0
guildHalls = true
houseSkipInitialRent = true

-- Item usage
timeBetweenActions = 500
timeBetweenExActions = 500
timeBetweenCustomActions = 500
hotkeyAimbotEnabled = true

-- Exhausts
onBuy = 500
onSell = 500
changeOutfit = 500

-- Map
-- NOTE: storeTrash costs more memory, but will perform alot faster cleaning.
mapName = "main.otbm"
mapAuthor = "Peixola"
randomizeTiles = true
storeTrash = true
cleanProtectedZones = true
mailboxDisabledTowns = ""

-- Mailbox Block
mailMaxAttempts = 5
mailBlockPeriod = 30 * 60 * 1000
mailAttemptsFadeTime = 5 * 60 * 1000

-- Process
-- NOTE: defaultPriority works only on Windows and niceLevel on *nix
-- niceLevel works only on *nix systems
-- coresUsed are seperated by comma cores ids used by server process,
-- default is -1, so it stays untouched (automaticaly assigned by OS).
defaultPriority = "high"
niceLevel = 5
coresUsed = "-1"

-- Startup
startupDatabaseOptimization = true
updatePremiumStateAtStartup = true
confirmOutdatedVersion = false
skipItemsVersionCheck = true

formulaLevel = 5.0
formulaMagic = 1.0
bufferMutedOnSpellFailure = false
spellNameInsteadOfWords = false
emoteSpells = true
hideSpellWords = false
unifiedSpells = true

-- Outfits
allowChangeOutfit = true
allowChangeColors = true
allowChangeAddons = true
disableOutfitsForPrivilegedPlayers = false
addonsOnlyPremium = false

-- Miscellaneous
-- NOTE: promptExceptionTracerErrorBox works only with precompiled support feature,
-- called "exception tracer" (__EXCEPTION_TRACER__ flag).
dataDirectory = "data/"
logsDirectory = "data/logs/"
bankSystem = true
displaySkillLevelOnAdvance = true
promptExceptionTracerErrorBox = true
maximumDoorLevel = 9999
maxMessageBuffer = 4
tradeLimit = 100
defaultDepotSize = 1000
defaultDepotSizePremium = 2000
classicEquipmentSlots = true

-- VIP list
separateVipListPerCharacter = false
vipListDefaultLimit = 20
vipListDefaultPremiumLimit = 100

-- Saving-related
-- useHouseDataStorage usage may be found at README.
saveGlobalStorage = true
useHouseDataStorage = true
storePlayerDirection = false

-- Loot
-- monsterLootMessage 0 to disable, 1 - only party, 2 - only player, 3 - party or player (like Tibia's)
checkCorpseOwner = true
monsterLootMessage = 3
monsterLootMessageType = 25

-- Auto Loot
enableAutoLoot = true

-- Compact number display (1k, 10k, 1kk, and so on)
expNumbersInK = true
damageNumbersInK = true

-- Show the player's own life/mana bars as a percentage (100%) instead of absolute values (1500/1500)
lifeManaInPercent = true

-- Chest system: consuming this item rolls a random reward from `chest_rewards`
-- (managed on the portal at /admin/chest-rewards). Set to 0 to disable.
chestItemId = 56399 -- chest system key

-- Ghost mode
ghostModeInvisibleEffect = false
ghostModeSpellEffects = true

-- Limits
idleWarningTime = 14 * 60 * 1000
idleKickTime = 15 * 60 * 1000
reportsExpirationAfterReads = 1
tileLimit = 0
protectionTileLimit = 0
houseTileLimit = 0

-- Premium-related
freePremium = true
premiumForPromotion = true

-- Blessings
-- NOTE: blessingReduction* regards items/containers loss.
-- eachBlessReduction is how much each bless reduces the experience/magic/skills loss.
blessings = true
blessingOnlyPremium = true
blessingReductionBase = 30
blessingReductionDecrement = 5
eachBlessReduction = 8

-- Rates
-- NOTE: experienceStages configuration is located in data/XML/stages.xml.
-- rateExperienceFromPlayers 0 to disable.
experienceStages = false
rateExperience = 500.0
rateExperienceFromPlayers = 0
rateSkill = 5.0
rateMagic = 5.0
rateLoot = 1.0
rateSpawn = 1.0

-- Monster rates
rateMonsterHealth = 1.0
rateMonsterMana = 1.0
rateMonsterAttack = 1.0
rateMonsterDefense = 1.0

-- Experience from players
-- NOTE: min~Threshold* set to 0 will disable the minimum threshold:
-- player will gain experience from every lower leveled player.
-- max~Threshold* set to 0 will disable the maximum threshold:
-- player will gain experience from every higher leveled player.
minLevelThresholdForKilledPlayer = 0.9
maxLevelThresholdForKilledPlayer = 1.1

-- Stamina
-- NOTE: Stamina is stored in miliseconds, so seconds are multiplied by 1000.
-- rateStaminaHits multiplies every hit done a creature, which are later
-- multiplied by player attack speed.
-- rateStaminaGain is multiplying every second of logged out time, eg:
-- 60 * 1000 / 3 = 20 seconds, what gives 1 stamina minute for 3 being logged off.
-- rateStaminaThresholdGain is dividing in case the normal gain (that is
-- multiplied by rateStaminaGain, btw.) passed above threshold, eg:
-- 60 * 1000 / 3 = 20 / 4 = 5 seconds (3 * 4 = 12 minutes for 1 stamina minute).
-- staminaRatingLimit* is in minutes.
rateStaminaLoss = 1
rateStaminaGain = 3
rateStaminaThresholdGain = 12
staminaRatingLimitTop = 40 * 60
staminaRatingLimitBottom = 14 * 60
staminaLootLimit = 14 * 60
rateStaminaAboveNormal = 1.5
rateStaminaUnderNormal = 0.5
staminaThresholdOnlyPremium = true

-- Party
-- NOTE: experienceShareLevelDifference is float number.
-- experienceShareLevelDifference is highestLevel * value
experienceShareRadiusX = 30
experienceShareRadiusY = 30
experienceShareRadiusZ = 1
experienceShareLevelDifference = 2 / 3
extraPartyExperienceLimit = 20
extraPartyExperiencePercent = 5
experienceShareActivity = 2 * 60 * 1000

-- Global save
-- NOTE: globalSaveHour means like 03:00, not that it will save every 3 hours,
-- if you want such a system please check out data/globalevents/globalevents.xml.
globalSaveEnabled = true
globalSaveHour = 12
globalSaveMinute = 60
shutdownAtGlobalSave = true
cleanMapAtGlobalSave = false

-- Spawns
deSpawnRange = 2
deSpawnRadius = 50
monsterSpawnWalkback = true
allowBlockSpawn = true

-- Summons
maxPlayerSummons = 2
teleportAllSummons = true
teleportPlayerSummons = false

-- Status
statusPort = 7171
ownerName = ""
ownerEmail = "@otland.net"
url = "http://otland.net/"
location = "Brazil"
displayGamemastersWithOnlineCommand = false

-- Logs
displayPlayersLogging = true
prefixChannelLogs = ""
runFile = "server/run.log"
outputLog = "server/out.log"
truncateLogsOnStartup = false
logsPlayers = false

-- Manager
-- NOTE: managerPassword left blank disables manager.
managerPort = 7171
managerLogs = true
managerPassword = ""
managerLocalhostOnly = true
managerConnectionsLimit = 1

-- Admin
-- NOTE: adminPassword left blank disables manager.
-- Set to anything if you set adminRequireLogin to false.
-- adminEncryption available options: rsa1024xtea;
-- remember to set correct data!
adminPort = 7171
adminLogs = true
adminPassword = ""
adminLocalhostOnly = true
adminConnectionsLimit = 1
adminRequireLogin = true
adminEncryption = ""
adminEncryptionData = ""
