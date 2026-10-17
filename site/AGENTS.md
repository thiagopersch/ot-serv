# Diretrizes para Desenvolvimento do Portal Web NDBO (AGENTS.md)

Este documento atua como um guia arquitetural e técnico para agentes de Inteligência Artificial interagirem com o desenvolvimento deste portal web, integrado ao OTSERVER (WODBO/DBOSupreme).

---

## 1. Visão Geral do Projeto

O projeto consiste em um portal web completo e moderno para gerenciamento de contas, visualização de estatísticas do servidor, suporte ao cliente, e-commerce (bazar e loja) e painel administrativo para o OTSERVER NDBO.

### Tecnologias Principais:

- **Framework**: Next.js 16 (App Router) & React 19.
- **Banco de Dados & ORM**: MySQL integrado com **Prisma ORM**.
- **Autenticação**: NextAuth.js com Credentials Provider personalizado (criptografia de senha em **SHA-1** baseada no schema das contas do OTSERVER).
- **Estilização**: Tailwind CSS v4 + Vanilla CSS + `clsx` / `tailwind-merge` para classes dinâmicas.
- **Componentes de UI**: shadcn-ui (customizado para Next.js 16) e `lucide-react` para ícones.
- **Gerenciamento de Estado**: Zustand.
- **Validação de Formulários**: React Hook Form + Zod.
- **Consumo de Dados**: SWR (Stale-While-Revalidate) com cache otimizado.
- **Tabelas & Gráficos**: TanStack Table (com filtros, ordenação e paginação) e Recharts.
- **Logs & Auditoria**: Sistema interno de monitoramento de ações e alterações.
- **Date Utilities**: Day.js.
- **Ambiente**: Docker para Devops.

---

## 2. Estrutura de Diretórios e Convenções

```
/
├── app/                  # Rotas do Next.js (App Router)
│   ├── (auth)/           # Grupo de rotas de login, cadastro, recuperação
│   ├── admin/            # Painel administrativo (acesso restrito group_id >= 5)
│   ├── api/              # Handlers de APIs REST
│   ├── layout.tsx        # Layout raiz com Fontes Outfit e Geist, Provedores
│   ├── globals.css       # Configuração Tailwind CSS v4 e variáveis de cores oklch
│   └── page.tsx          # Landing page principal
├── components/           # Componentes UI reutilizáveis (shadcn + custom)
│   ├── ui/               # Componentes atômicos do shadcn-ui
│   └── shared/           # Componentes específicos de negócios (Navbar, Footer, etc)
├── hooks/                # Custom React hooks (ex: useAuth, useStats)
├── lib/                  # Helpers, prisma.ts, auth.ts, utils.ts
├── store/                # Zustand stores para gerenciamento de estado global
├── prisma/               # Schema e migrations do Prisma ORM
├── public/               # Ativos públicos (imagens, downloads, downloads/patches)
├── docker/               # Arquivos de build do Docker
├── eslint.config.mjs     # Configurações de Linting
└── package.json          # Dependências do projeto
```

---

## 3. Autenticação e Segurança

### Fluxo de Login Customizado:

1. O login é autenticado diretamente na tabela `accounts` (campo `name` como login e `password` como senha).
2. A senha armazenada no banco OTSERVER tradicional utiliza a criptografia **SHA-1**. No NextAuth, o adapter ou CredentialsProvider deve realizar o hash do input do usuário para comparação:
   ```javascript
   import crypto from 'crypto';
   const hashedPassword = crypto
     .createHash('sha1')
     .update(rawPassword)
     .digest('hex');
   ```
3. O schema deve ser compatível para buscar usuários por `name` e verificar se a conta não está bloqueada (`blocked == false`).

### Controle de Acesso e Níveis de Permissões:

- Níveis de permissão são baseados no campo `group_id` da tabela `accounts`:
  - **Jogador Normal**: `group_id = 1`
  - **Tutor**: `group_id = 2`
  - **Gamemaster (GM)**: `group_id` 3-4 (sem acesso ao painel administrativo do portal)
  - **Administrador**: `group_id >= 5`
  - **Administrador Master (Site Admin)**: `group_id = 6`
- **Importante**: Todas as rotas de administração (`/admin/*`) e links de gerenciamento administrativo devem ser validados no lado do servidor (`ADMIN_MIN_GROUP_ID` em `lib/auth-constants.ts`) para garantir que o usuário autenticado possua `group_id >= 5`.

---

## 4. Estrutura do Menu e Rotas da Aplicação

### Componente de Navbar (Responsivo com Dropdown Animado)

A estrutura de navegação e as respectivas rotas correspondentes:

- **Home** (`/`)
- **Conta**
  - Login (`/login`)
  - Cadastro (`/register`)
  - Recuperação de Conta (`/recover`)
- **Downloads** (`/downloads`)
- **Regras** (`/rules`)
- **Comunidade**
  - Buscar jogador (`/community/characters`)
  - Guilds (`/community/guilds`)
  - Ranking (`/community/ranking`)
  - Sistemas (`/community/systems`)
  - Quem está online? (`/community/online`)
  - Quem está ao vivo? (`/community/cast`)
  - Últimas mortes (`/community/deaths`)
- **Gameplay**
  - Eventos (`/gameplay/events`)
  - Quests (`/gameplay/quests`)
  - Raids (`/gameplay/raids`)
  - Tarefas (Tasks) (`/gameplay/tasks`)
  - Missões (`/gameplay/missions`)
  - Itens (`/gameplay/items`)
  - Monstros (`/gameplay/monsters`)
  - Técnicas/Habilidades (`/gameplay/spells`)
  - Vocações (`/gameplay/vocations`)
  - Cidades/Locais (`/gameplay/towns`)
- **Suporte**
  - Abrir ticket (`/support/new`)
  - Meus tickets (`/support/tickets`)
- **Loja**
  - Vitrine (`/shop/store`)
  - Bazar (`/shop/bazar`)
  - Comprar pontos (`/shop/donate`)
  - Mercado (`/shop/market`)

---

## 5. Painel Administrativo (`/admin`)

Toda a gestão do portal deve ser feita sob o escopo `/admin` protegido por sessões e privilégios de `group_id >= 5`.

### Recursos e CRUDs Administrativos:

- **Painel Geral**: Visualização de logs de auditoria, gráficos de jogadores online (`recharts`), histórico de compras.
- **Gerenciamento de Posts**: Permitir a criação, edição e exclusão de posts e notícias na landing page.
- **CRUD de Contas e Jogadores**: Edição de dados críticos, alteração de `group_id`, resets, e desbanimentos.
- **CRUD de Banimentos**: Gerenciamento de entradas na tabela `bans`.
- **CRUD de Sistemas (Lottery & Boosts)**: Configuração de monstros impulsionados (`monster_boost`) e prêmios da loteria (`lottery`).
- **CRUD de Recompensas Diárias**: Edição das tabelas `daily_rewards_monthly` e `daily_rewards_bonus_monthly`.

---

## 6. Mapeamento Prisma ORM (MySQL)

Abaixo está o mapeamento completo do schema SQL do banco de dados adaptado para a linguagem de schema do Prisma (`prisma/schema.prisma`):

```prisma
datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model ServerConfig {
  config String @id @db.VarChar(35)
  value  String @db.VarChar(255)

  @@map("server_config")
}

model ServerMotd {
  id      Int
  worldId Int @default(0) @map("world_id")
  text    String @db.Text

  @@id([id, worldId])
  @@map("server_motd")
}

model ServerRecord {
  record    Int
  worldId   Int @default(0) @map("world_id")
  timestamp Int

  @@id([record, worldId, timestamp])
  @@map("server_record")
}

model ServerReport {
  id        Int    @id @default(autoincrement())
  worldId   Int    @default(0) @map("world_id")
  playerId  Int    @default(0) @map("player_id")
  posx      Int    @default(0)
  posy      Int    @default(0)
  posz      Int    @default(0)
  timestamp Int    @default(0)
  report    String @db.Text
  reads     Int    @default(0)

  @@map("server_reports")
}

model Account {
  id             Int             @id @default(autoincrement())
  name           String          @unique @db.VarChar(255)
  password       String          @db.VarChar(255)
  premdays       Int             @default(0)
  lastday        Int             @default(0)
  email          String          @default("") @db.VarChar(255)
  key            String          @default("0") @db.VarChar(32)
  blocked        Boolean         @default(false)
  warnings       Int             @default(0)
  groupId        Int             @default(1) @map("group_id")
  salt           String          @default("") @db.VarChar(255)

  players        Player[]
  accountViplist AccountVipList[]

  @@map("accounts")
}

model Player {
  id                Int                     @id @default(autoincrement())
  name              String                  @unique @db.VarChar(255)
  worldId           Int                     @default(0) @map("world_id")
  groupId           Int                     @map("group_id")
  accountId         Int                     @map("account_id")
  rankId            Int                     @map("rank_id")
  level             Int                     @default(1)
  vocation          Int                     @default(0)
  health            Int                     @default(100)
  healthmax         Int                     @default(100)
  experience        BigInt                  @default(0)
  lookbody          Int                     @default(10)
  lookfeet          Int                     @default(10)
  lookhead          Int                     @default(10)
  looklegs          Int                     @default(10)
  looktype          Int                     @default(136)
  lookaddons        Int                     @default(0)
  maglevel          Int                     @default(0)
  mana              Int                     @default(100)
  manamax           Int                     @default(100)
  manaspent         BigInt                  @default(0)
  soul              Int                     @default(0)
  townId            Int                     @map("town_id")
  posx              Int                     @default(0)
  posy              Int                     @default(0)
  posz              Int                     @default(0)
  conditions        Bytes
  cap               Int                     @default(0)
  sex               Int                     @default(0)
  lastlogin         Int                     @default(0)
  lastip            Int                     @default(0)
  save              Boolean                 @default(true)
  skull             Int                     @default(0)
  skulltime         Int                     @default(0)
  guildnick         String                  @default("") @db.VarChar(255)
  lastlogout        Int                     @default(0)
  blessings         Int                     @default(0)
  balance           Int                     @default(0)
  stamina           BigInt                  @default(151200000)
  direction         Int                     @default(2)
  lossExperience    Int                     @default(100) @map("loss_experience")
  lossMana          Int                     @default(100) @map("loss_mana")
  lossSkills        Int                     @default(100) @map("loss_skills")
  lossContainers    Int                     @default(100) @map("loss_containers")
  lossItems         Int                     @default(100) @map("loss_items")
  premend           Int                     @default(0)
  online            Int                     @default(0) @db.TinyInt
  marriage          Int                     @default(0)
  promotion         Int                     @default(0)
  deleted           Int                     @default(0)
  description       String                  @default("") @db.VarChar(255)
  cast              Int                     @default(0) @db.TinyInt
  castViewers       Int                     @default(0)
  castDescription   String                  @default("") @db.VarChar(255)
  healthSkill       Int                     @default(0) @map("health_skill")
  manaSkill         Int                     @default(0) @map("mana_skill")
  bendSkill         Int                     @default(0) @map("bend_skill")
  dodgeSkill        Int                     @default(0) @map("dodge_skill")
  resets            Int                     @default(0)
  skillPoints       Int                     @default(0) @map("skill_points")
  onlineTime        Int                     @default(0) @map("online_time")
  age               Int                     @default(0)
  ageMinutes        Int                     @default(0) @map("age_minutes")
  unlockedVocations String                  @default("") @map("unlocked_vocations") @db.VarChar(255)
  dodge             Int                     @default(0)
  critical          Int                     @default(0)
  lookmount         Int                     @default(0)
  lookwings         Int                     @default(0)
  lookaura          Int                     @default(0)
  lookshader        Int                     @default(0)
  lookhealthbar     Int                     @default(0)
  lookmanabar       Int                     @default(0)

  account           Account                 @relation(fields: [accountId], references: [id])
  accountViplist    AccountVipList[]
  guildsOwned       Guild[]
  guildInvites      GuildInvite[]
  playerDeaths      PlayerDeath[]
  playerKillers     PlayerKiller[]
  playerDepotitems  PlayerDepotItem[]
  playerNamelocks   PlayerNamelock[]
  playerSkills      PlayerSkill[]
  playerStorage     PlayerStorage[]
  playerViplist     PlayerVipList[]         @relation("PlayerVipListPlayer")
  playerViplistVip  PlayerVipList[]         @relation("PlayerVipListVip")
  playerItems       PlayerItem[]
  playerSpells      PlayerSpell[]
  vocationRanks     PlayerVocationRank[]
  dailyRewards      PlayerDailyReward[]
  dailyRewardBonus  PlayerDailyRewardBonus[]
  skillPointsVoc    PlayerSkillPoints[]
  skillUpgrades     PlayerSkillUpgrades[]
  extoutfitUnlocks  PlayerExtOutfitUnlock[]
  houseAuctions     HouseAuctions[]

  @@unique([name, deleted])
  @@map("players")
}

model AccountVipList {
  accountId Int @map("account_id")
  worldId   Int @default(0) @map("world_id")
  playerId  Int @map("player_id")

  account Account @relation(fields: [accountId], references: [id])
  player  Player  @relation(fields: [playerId], references: [id])

  @@id([accountId, playerId])
  @@map("account_viplist")
}

model GlobalStorage {
  key     Int
  worldId Int @default(0) @map("world_id")
  value   String @default("0") @db.VarChar(255)

  @@id([key, worldId])
  @@map("global_storage")
}

model Guild {
  id           Int      @id @default(autoincrement())
  worldId      Int      @default(0) @map("world_id")
  name         String   @db.VarChar(255)
  ownerId      Int      @map("ownerid")
  creationdata Int
  checkdata    Int
  motd         String   @default("") @db.VarChar(255)

  owner        Player   @relation(fields: [ownerId], references: [id])
  invites      GuildInvite[]
  ranks        GuildRank[]
  wars         GuildWar[] @relation("GuildWars")
  enemyWars    GuildWar[] @relation("EnemyWars")
  guildKills   GuildKill[]

  @@unique([name, worldId])
  @@map("guilds")
}

model GuildWar {
  id         Int      @id @default(autoincrement())
  guildId    Int      @map("guild_id")
  enemyId    Int      @map("enemy_id")
  begin      Int      @default(0)
  end        Int      @default(0)
  frags      Int      @default(0)
  payment    Int      @default(0)
  guildKills Int      @default(0) @map("guild_kills")
  enemyKills Int      @default(0) @map("enemy_kills")
  status     Int      @default(0) @db.TinyInt

  guild      Guild    @relation("GuildWars", fields: [guildId], references: [id], onDelete: Cascade)
  enemy      Guild    @relation("EnemyWars", fields: [enemyId], references: [id], onDelete: Cascade)
  kills      GuildKill[]

  @@map("guild_wars")
}

model GuildKill {
  id      Int @id @default(autoincrement())
  guildId Int @map("guild_id")
  warId   Int @map("war_id")
  deathId Int @map("death_id")

  guild Guild       @relation(fields: [guildId], references: [id], onDelete: Cascade)
  war   GuildWar    @relation(fields: [warId], references: [id], onDelete: Cascade)
  death PlayerDeath @relation(fields: [deathId], references: [id], onDelete: Cascade)

  @@map("guild_kills")
}

model GuildInvite {
  playerId Int @map("player_id")
  guildId  Int @map("guild_id")

  player Player @relation(fields: [playerId], references: [id])
  guild  Guild  @relation(fields: [guildId], references: [id])

  @@id([playerId, guildId])
  @@map("guild_invites")
}

model GuildRank {
  id      Int @id @default(autoincrement())
  guildId Int @map("guild_id")
  name    String @db.VarChar(255)
  level   Int

  guild Guild @relation(fields: [guildId], references: [id])

  @@map("guild_ranks")
}

model House {
  id          Int
  worldId     Int @default(0) @map("world_id")
  owner       Int
  paid        Int @default(0)
  warnings    Int @default(0)
  lastwarning Int @default(0)
  name        String @db.VarChar(255)
  town        Int @default(0)
  size        Int @default(0)
  price       Int @default(0)
  rent        Int @default(0)
  doors       Int @default(0)
  beds        Int @default(0)
  tiles       Int @default(0)
  guild       Boolean @default(false)
  clear       Boolean @default(false)
  lists       HouseList[]
  houseData   HouseData?
  houseAuction HouseAuctions?

  @@id([id, worldId])
  @@map("houses")
}

model HouseList {
  houseId Int @map("house_id")
  worldId Int @default(0) @map("world_id")
  listid  Int
  list    String @db.Text

  house House @relation(fields: [houseId, worldId], references: [id, worldId])

  @@id([houseId, worldId, listid])
  @@map("house_lists")
}

model HouseData {
  houseId Int @map("house_id")
  worldId Int @default(0) @map("world_id")
  data    Bytes

  house House @relation(fields: [houseId, worldId], references: [id, worldId])

  @@id([houseId, worldId])
  @@map("house_data")
}

model HouseAuctions {
  houseId Int @map("house_id")
  worldId Int @default(0) @map("world_id")
  playerId Int @map("player_id")
  bid     Int @default(0)
  limit   Int @default(0)
  endtime Int @default(0)

  house House  @relation(fields: [houseId, worldId], references: [id, worldId])
  player Player @relation(fields: [playerId], references: [id])

  @@id([houseId, worldId])
  @@map("house_auctions")
}

model PlayerDeath {
  id       Int @id @default(autoincrement())
  playerId Int @map("player_id")
  date     Int
  level    Int

  player     Player      @relation(fields: [playerId], references: [id])
  killers    Killer[]
  guildKills GuildKill[]

  @@map("player_deaths")
}

model Killer {
  id          Int @id @default(autoincrement())
  deathId     Int @map("death_id")
  finalHit    Boolean @default(false) @map("final_hit")
  unjustified Boolean @default(false)
  war         Int @default(0)

  death              PlayerDeath         @relation(fields: [deathId], references: [id])
  playerKillers      PlayerKiller[]
  environmentKillers EnvironmentKiller[]

  @@map("killers")
}

model PlayerKiller {
  killId   Int @map("kill_id")
  playerId Int @map("player_id")

  killer Killer @relation(fields: [killId], references: [id])
  player Player @relation(fields: [playerId], references: [id])

  @@id([killId, playerId])
  @@map("player_killers")
}

model EnvironmentKiller {
  killId Int @map("kill_id")
  name   String @db.VarChar(255)

  killer Killer @relation(fields: [killId], references: [id])

  @@id([killId, name])
  @@map("environment_killers")
}

model PlayerDepotItem {
  playerId  Int @map("player_id")
  sid       Int
  pid       Int @default(0)
  itemtype  Int
  count     Int @default(0)
  attributes Bytes

  player Player @relation(fields: [playerId], references: [id])

  @@id([playerId, sid])
  @@map("player_depotitems")
}

model PlayerNamelock {
  playerId Int @map("player_id")
  name     String @db.VarChar(255)
  newName  String @map("new_name") @db.VarChar(255)
  date     Int @default(0)

  player Player @relation(fields: [playerId], references: [id])

  @@id([playerId, name])
  @@map("player_namelocks")
}

model PlayerSkill {
  playerId Int @map("player_id")
  skillid  Int
  value    Int @default(0)
  count    Int @default(0)

  player Player @relation(fields: [playerId], references: [id])

  @@id([playerId, skillid])
  @@map("player_skills")
}

model PlayerStorage {
  playerId Int @map("player_id")
  key      Int
  value    String @default("0") @db.VarChar(255)

  player Player @relation(fields: [playerId], references: [id])

  @@id([playerId, key])
  @@map("player_storage")
}

model PlayerVipList {
  playerId Int @map("player_id")
  vipId    Int @map("vip_id")

  player Player @relation("PlayerVipListPlayer", fields: [playerId], references: [id])
  vip    Player @relation("PlayerVipListVip", fields: [vipId], references: [id])

  @@id([playerId, vipId])
  @@map("player_viplist")
}

model Tile {
  id      Int
  worldId Int @default(0) @map("world_id")
  houseId Int @map("house_id")
  x       Int
  y       Int
  z       Int

  @@id([id, worldId])
  @@map("tiles")
}

model TileItem {
  tileId     Int @map("tile_id")
  worldId    Int @default(0) @map("world_id")
  sid        Int
  pid        Int @default(0)
  itemtype   Int
  count      Int @default(0)
  attributes Bytes

  @@id([tileId, worldId, sid])
  @@map("tile_items")
}

model PlayerItem {
  playerId   Int @map("player_id")
  sid        Int
  pid        Int @default(0)
  itemtype   Int
  count      Int @default(0)
  attributes Bytes

  player Player @relation(fields: [playerId], references: [id])

  @@id([playerId, sid])
  @@map("player_items")
}

model PlayerSpell {
  playerId Int @map("player_id")
  name     String @db.VarChar(255)

  player Player @relation(fields: [playerId], references: [id])

  @@id([playerId, name])
  @@map("player_spells")
}

model Ban {
  id        Int @id @default(autoincrement())
  type      Int
  value     Int
  param     Int @default(-1)
  active    Boolean @default(true)
  expires   Int
  added     Int
  adminId   Int @default(0) @map("admin_id")
  comment   String @db.Text
  reason    Int @default(0)
  action    Int @default(0)
  statement String @default("") @db.VarChar(255)

  @@map("bans")
}

model Lottery {
  id        Int @id @default(autoincrement())
  name      String @db.Text
  item      String @db.Text
  createdAt DateTime @default(now()) @map("created_at")

  @@index([name])
  @@map("lottery")
}

model PlayerVocationStats {
  playerId   Int @map("player_id")
  vocationId Int @map("vocation_id")
  level      Int @default(1)
  experience BigInt @default(0)
  healthmax  Int @default(150)
  manamax    Int @default(150)
  maglevel   Int @default(0)
  manaspent  BigInt @default(0)
  dodge      Int @default(0)
  critical   Int @default(0)

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, vocationId])
  @@map("player_vocation_stats")
}

model PlayerVocationSkills {
  playerId   Int @map("player_id")
  vocationId Int @map("vocation_id")
  skillid    Int
  value      Int @default(10)
  count      BigInt @default(0)

  @@id([playerId, vocationId, skillid])
  @@map("player_vocation_skills")
}

model PlayerVocationRank {
  id         Int @id @default(autoincrement())
  playerId   Int @map("player_id")
  vocationId Int @map("vocation_id")
  rank       Int @default(1) @db.TinyInt
  stars      Int @default(0) @db.TinyInt
  totalStars Int @default(0) @map("total_stars") @db.SmallInt

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@index([playerId, vocationId], name: "idx_player_vocation_ranks")
  @@map("player_vocation_ranks")
}

model PlayerDailyReward {
  playerId  Int @map("player_id")
  day       Int @db.TinyInt
  month     Int @db.TinyInt
  year      Int
  itemId    Int @map("item_id")
  count     Int
  timestamp Int

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, day, month, year])
  @@map("player_daily_rewards")
}

model DailyRewardsMonthly {
  month    Int @db.TinyInt
  year     Int @db.SmallInt
  day      Int @db.TinyInt
  itemId   Int @map("item_id")
  count    Int
  clientId Int @default(0) @map("client_id")

  @@id([month, year, day])
  @@map("daily_rewards_monthly")
}

model DailyRewardsBonusMonthly {
  month     Int @db.TinyInt
  year      Int @db.SmallInt
  streakDay Int @map("streak_day") @db.TinyInt
  itemId    Int @map("item_id")
  count     Int
  clientId  Int @default(0) @map("client_id")

  @@id([month, year, streakDay])
  @@map("daily_rewards_bonus_monthly")
}

model PlayerDailyRewardBonus {
  playerId  Int @map("player_id")
  month     Int @db.TinyInt
  year      Int @db.SmallInt
  streakDay Int @map("streak_day") @db.TinyInt
  claimedAt Int @default(0) @map("claimed_at")

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, month, year, streakDay])
  @@map("player_daily_reward_bonus")
}

model PlayerSkillPoints {
  playerId        Int @map("player_id")
  vocationId      Int @map("vocation_id")
  availablePoints Int @default(0) @map("available_points")
  spentPoints     Int @default(0) @map("spent_points")

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, vocationId])
  @@map("player_skill_points")
}

model PlayerSkillUpgrades {
  playerId     Int @map("player_id")
  vocationId   Int @map("vocation_id")
  skillName    String @map("skill_name") @db.VarChar(50)
  currentLevel Int @default(0) @map("current_level")

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, vocationId, skillName])
  @@map("player_skill_upgrades")
}

model PlayerExtOutfitUnlock {
  playerId Int @map("player_id")
  type     String @db.VarChar(20)
  id       Int

  player Player @relation(fields: [playerId], references: [id], onDelete: Cascade)

  @@id([playerId, type, id])
  @@map("player_extoutfit_unlocks")
}

model MonsterBoost {
  id      Int @id @default(autoincrement())
  monster String @default("0") @db.VarChar(255)
  loot    Int @default(0)
  exp     Int @default(0)
  date    DateTime @default(now())

  @@map("monster_boost")
}
```

---

## 7. Diretrizes para Desenvolvimento de Componentes e UX/UI

- **Tema Dark Mode**: Deve ser ativado por padrão usando a classe `.dark` em combinação com as variáveis OKLCH descritas no `globals.css` (ex: `bg-background`, `text-foreground`).
- **Validação de Formulários**: Sempre utilizar `@hookform/resolvers/zod` + `react-hook-form` + `zod` para criar esquemas rígidos de validação nos inputs de Login, Cadastro, Recuperação de conta e Edições Administrativas.
- **Feedback visual**: Utilizar a biblioteca `sonner` (`toast.success()`, `toast.error()`, `toast.loading()`) para dar retornos visuais fluidos em todas as mutações/ações.
- **Listagem de Dados (TanStack Table)**:
  - Utilizar `@tanstack/react-table` para renderizar tabelas de alta performance no Painel de Admin, Lista de Players, Highscores (Ranking), etc.
  - Implementar paginação no servidor ou cliente, filtros em tempo real e ordenação de colunas.
- **Gráficos**: Utilizar `recharts` para exibir contagem de players ativos ao longo do tempo, faturamento do Bazar e estatísticas de suporte no painel do administrador.

---

## 8. Otimizações de Performance, Acessibilidade & SEO

- **SEO**:
  - Utilizar o arquivo `metadata` do Next.js App Router para customizar metatags estáticas e dinâmicas (ex: títulos únicos para páginas de estatísticas de personagens: `Buscar Jogador - [Nome]`).
  - Utilizar tags HTML semânticas como `<header>`, `<main>`, `<nav>`, `<aside>` e `<footer>`.
- **Performance**:
  - Usar cache de dados via **SWR** ou em nível de servidor. Evitar re-fetchings excessivos de queries pesadas (ex: rankings de experiência e listas grandes de itens).
  - Usar Next.js Image Component (`next/image`) para carregar sprites e imagens do site com lazy loading.
- **Acessibilidade**:
  - Implementar suporte completo a teclado e leitores de tela utilizando componentes acessíveis baseados em `shadcn-ui` (que são construídos sobre Radix UI).
  - Manter contraste adequado nas cores oklch.

---

## 9. Configurações de Qualidade de Código (Linting & Formatting)

### ESLint (`eslint.config.mjs`):

- Deve ser configurado para estender as melhores regras do Next.js e TypeScript.
- Integrado com Prettier para formatação automática.
- Arquivo recomendado de prettier (`.prettierrc`):
  ```json
  {
    "semi": true,
    "trailingComma": "all",
    "singleQuote": false,
    "printWidth": 100,
    "tabWidth": 2
  }
  ```

---

## 10. DevOps & Docker

Utilizar Docker para empacotar o projeto em contêineres:

- **Dockerfile**: Dockerfile multi-estágio para build otimizado da aplicação Next.js em produção (`node:20-alpine`).
- **Docker Compose**: O `compose.yaml` na raiz do projeto (`../compose.yaml`, ver `../README-docker.md`) contendo:
  - Serviço Next.js (`ndbo-web`).
  - Serviço MySQL (`ndbo-db`) com volume persistente para sincronia com o banco de dados do OTSERVER.
- Se iniciar o projeto deve matar ele para o usuário validar manualmente após a validação

---

## 11. Checklist de Desenvolvimento Recomendado

- [ ] Configurar conexão com MySQL e rodar `npx prisma db pull` ou migrar o schema acima via `npx prisma db push`.
- [ ] Implementar NextAuth.js com Credentials Provider usando SHA-1.
- [ ] Desenhar o componente da Navbar responsiva com seus submenus dropdowns de Gameplay, Comunidade, Conta, etc.
- [ ] Criar as páginas de Autenticação (Login, Cadastro, Recuperação por e-mail).
- [ ] Implementar a página de Ranking de Experiência e Skills (usando TanStack Table).
- [ ] Implementar a busca de personagens (`Buscar jogador`) e exibição detalhada de equipamentos, resets e status.
- [ ] Desenvolver a estrutura base do Painel Administrativo (`/admin`) acessível apenas por `group_id >= 5`.
- [ ] Implementar os CRUDs de posts/notícias, monstros boostados, loteria e recompensas diárias.
