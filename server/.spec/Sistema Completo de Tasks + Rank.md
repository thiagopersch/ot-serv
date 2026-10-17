# Sistema Completo de Tasks + Rank + Delivery + UI para OTServ Anime (TFS 0.4 + OTCv8)

## Contexto do Projeto

Estou desenvolvendo um servidor OTServ derivado de Tibia com temática de animes utilizando:

- TFS 0.4
- OTCv8 / OTClient
- Lua
- MySQL
- SQLite

O objetivo é reconstruir completamente o sistema de tasks atual do servidor, criando um sistema:

- moderno
- modular
- escalável
- otimizado
- persistente
- fácil de manter
- fácil de adicionar novas tasks
- desacoplado do NPC
- integrado ao client

---

# Estrutura dos Projetos

## Servidor

```txt
C:\Users\thiag\Projetos\server-tibia
```

## Client

```txt
C:\Users\thiag\Projetos\client
```

## Module Base para Tasks no Client

```txt
C:\Users\thiag\Projetos\client\modules_unsed\game_tasks
```

## Mod antigo existente

```txt
C:\Users\thiag\Projetos\server-tibia\mods\Simple Task.xml
```

IMPORTANTE:

- O mod atual é muito complexo
- NÃO reutilizar a arquitetura atual
- Pode reaproveitar apenas ideias úteis
- O novo sistema deve ser MUITO mais simples e organizado

---

# Objetivo Geral

Criar um framework completo de tasks para OTServ anime com:

- sistema de tasks
- sistema de rank/elo
- sistema de delivery de itens
- recompensas
- persistência em banco
- integração com OTCv8
- UI moderna
- otimizações de performance
- escalabilidade
- suporte a sagas e progressão

---

# Problemas Atuais do Sistema

O sistema atual possui vários problemas:

- O NPC Taskerman não verifica corretamente tasks ativas
- O player pode pegar task duplicada
- O progresso não persiste corretamente
- Os monstros mortos não atualizam corretamente a task
- O sistema não salva corretamente no banco
- A lógica está espalhada
- Difícil adicionar novas tasks
- Baixa escalabilidade
- Código confuso
- Alto custo de manutenção

---

# Objetivos Técnicos do Novo Sistema

O novo sistema deve:

- ser modular
- ter separação de responsabilidades
- ser extremamente simples de entender
- ser fácil de adicionar novas tasks
- ser leve e otimizado
- utilizar cache
- evitar loops desnecessários
- evitar consultas excessivas ao banco
- sincronizar corretamente com o client
- ser desacoplado do NPC
- ser preparado para centenas de tasks

---

# Arquitetura Desejada

## Estrutura Recomendada

```txt
data/
│
├── lib/
│   ├── tasks/
│   │   ├── task_core.lua
│   │   ├── task_rank.lua
│   │   ├── task_rewards.lua
│   │   ├── task_storage.lua
│   │   ├── task_kill.lua
│   │   ├── task_delivery.lua
│   │   ├── task_network.lua
│   │   ├── task_cache.lua
│   │   └── task_config.lua
│
├── creaturescripts/
│   ├── scripts/
│   │   └── task_kill.lua
│
├── talkactions/
│   ├── scripts/
│   │   └── task.lua
│
├── npc/
│   └── Taskerman.lua
│
└── mods/
    └── task_system.xml
```

---

# Regra Principal da Arquitetura

O NPC NÃO deve controlar as tasks.

O NPC apenas:

- lista tasks
- aceita tasks
- entrega rewards
- recebe itens de delivery
- exibe rank
- mostra progresso

Toda lógica deve ficar separada em módulos próprios.

---

# Sistema de Configuração de Tasks

Todas as tasks devem ser configuradas em:

```txt
task_config.lua
```

Adicionar uma nova task deve ser extremamente simples.

Exemplo desejado:

```lua
TASKS = {
    ["small_goku"] = {
        name = "Small Goku",

        category = "dragonball",

        monsters = {
            "Small Goku"
        },

        killsRequired = 100,

        points = 50,

        experience = 500000,

        rewards = {
            items = {
                {id = 2160, count = 10},
                {id = 2494, count = 1}
            }
        },

        delivery = {
            enabled = false
        }
    }
}
```

---

# Requisitos do Sistema de Tasks

## O sistema deve possuir:

- tasks de kill
- tasks de delivery
- tasks híbridas
- tasks de saga
- tasks diárias
- tasks de boss
- tasks de rank
- tasks repetíveis
- tasks únicas

---

# Sistema de Kill

## Funcionamento esperado

Quando o player matar um monstro:

1. verificar tasks ativas
2. verificar se o monstro pertence à task
3. atualizar kills
4. salvar no banco
5. sincronizar client
6. verificar conclusão
7. enviar efeitos
8. enviar mensagens
9. liberar recompensa

---

# Otimização Obrigatória

NÃO percorrer todas as tasks.

Criar cache/indexação:

```lua
TASK_MONSTERS = {
   ["Small Goku"] = {"small_goku"},
   ["Hollow Fang"] = {"hollow_fang"}
}
```

O objetivo é:

- lookup O(1)
- baixo consumo
- alta performance

---

# Persistência no Banco

## Criar tabela de tasks

Em MySQL:

```sql
CREATE TABLE player_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    task_id VARCHAR(50) NOT NULL,
    kills INT DEFAULT 0,
    completed TINYINT(1) DEFAULT 0,
    rewarded TINYINT(1) DEFAULT 0,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Em SQLite:

```sql
CREATE TABLE player_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    task_id TEXT NOT NULL,
    kills INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    rewarded INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

# Sistema de Rank/Elo

Criar sistema de elo/rank baseado em task points.

Cada task completada fornece:

- pontos
- experiência
- rewards

Os pontos definem o rank do player e tasks para as vocations de dragon ball não podem ser completadas ou aceitas por vocations de bleach e vice-versa. As tarefas devem ser divididas por níveis.

- Nível fácil
- Nível médio
- Nível difícil
- Nível elite

---

# Sistema de Rank para Dragon Ball

```txt
0-100 - Cidadão
101-200 - Veterano
201-500 - Mestre
501-750 - Profissional
751-1500 - Elite
1501-3000 - Lendário
3001-5000 - Imortal
5001-10000 - Herói
10001-20000 - Deus da Destruição
20001-50000 - Deus da Criação
50001-100000 - Deus Supremo
```

---

# Sistema de Rank para Bleach

```txt
0-100 - Humano
101-200 - Hollow
201-500 - Shinigami
501-750 - Vaizard
751-1500 - Arrancar
1501-3000 - Espada
3001-5000 - Capitão
5001-10000 - Capitão Elite
10001-20000 - Capitão General
20001-50000 - Capitão Comandante Geral
50001-100000 - Rei dos Shinigami
```

---

# Regras do Sistema de Rank

O rank deve:

- depender da vocação
- atualizar automaticamente
- aparecer no look
- aparecer no profile
- aparecer na UI de tasks
- sincronizar com o client

---

# Exibição no Look do Player

Exemplo:

```txt
Tiago Persch
Rank: Lendário
Task Points: 3500
```

---

# Integração com game_player_profile

Adicionar:

- rank atual
- task points
- tasks completas
- progresso
- badge visual
- próxima rank elo

---

# Sistema de Rewards

IMPORTANTE:

A reward NÃO deve ser entregue automaticamente, exceto as tasks diárias.

Ao completar:

- task fica como completed
- reward fica pendente

O player deve voltar ao NPC Taskerman para receber.

---

# Sistema de Delivery (Quest Style)

O sistema deve permitir tasks baseadas em entrega de itens.

Exemplo:

```lua
delivery = {
    enabled = true,
    itemId = 5890,
    count = 25
}
```

Fluxo:

1. player aceita task
2. coleta itens
3. entrega ao NPC
4. NPC remove itens
5. entrega recompensa

---

# Regras do Delivery

O sistema deve:

- validar quantidade
- remover itens corretamente
- impedir exploits
- impedir entrega parcial inválida
- sincronizar com banco
- funcionar junto com kill tasks

---

# Sistema Híbrido

Tasks podem exigir:

- matar monstros
- coletar itens
- entregar itens
- matar boss
- tudo junto

---

# Sistema de Loja por Rank

Criar sistema de loja baseado em:

- rank mínimo
- task points
- acesso

Exemplo:

```lua
SHOP_ITEMS = {
   {
      itemId = 2494,
      price = 1000,
      requiredRank = "Elite"
   }
}
```

---

# Sistema de Áreas Bloqueadas por Rank

Exemplo:

```lua
if getPlayerTaskRank(cid) < RANK_ELITE then
   doPlayerSendCancel(cid, "Você precisa ser Elite.")
   return false
end
```

---

# Sistema de Daily Tasks

Adicionar suporte para:

```lua
daily = true,
resetHours = 24
```

---

# Sistema de Saga

Exemplo:

```txt
Saga Saiyajin
→ Saga Freeza
→ Saga Cell
→ Saga Majin Boo
```

---

# Dependência entre Tasks

Permitir:

```lua
requiredTask = "freeza_saga"
```

---

# Sistema de Boss Tasks

Adicionar suporte:

```lua
type = "boss"
```

---

# Sistema de Conquistas

Permitir integração futura com:

- achievements
- titles
- auras
- outfits
- transformations
- passivas

---

# Sistema de Cache

Criar cache otimizado:

```lua
PLAYER_TASK_CACHE[cid]
```

Persistir:

- login
- logout
- complete
- reward
- save server

---

# Segurança e Anti-Exploit

Adicionar validações:

## Ao aceitar task

```lua
if hasTask(player, taskId) then
```

## Ao receber reward

```lua
if not completed then
```

## Delivery

```lua
if getPlayerItemCount < required then
```

---

# Integração OTCv8 / OTClient

Usar como base:

```txt
C:\Users\thiag\Projetos\client\modules_unsed\game_tasks
```

Criar novo módulo:

```txt
game_tasks
```

---

# UI Desejada para Tasks

A interface deve ser:

- moderna
- bonita
- temática anime
- otimizada
- responsiva
- organizada
- dividir as tasks por abas

---

# Dragon Ball

    * tasks de kill
    * tasks de delivery
    * tasks híbridas
    * tasks de saga
    * tasks diárias
    * tasks de boss
    * tasks de rank
    * tasks repetíveis
    * tasks únicas

---

# Bleach

    * tasks de kill
    * tasks de delivery
    * tasks híbridas
    * tasks de saga
    * tasks diárias
    * tasks de boss
    * tasks de rank
    * tasks repetíveis
    * tasks únicas

## Dentro de cada aba deve aparecer as tarefas disponiveis para aquele nível do jogador

Se o jogador não tiver level para iniciar uma task, deve aparecer como indisponível
Se o jogador não tiver os requisitos para iniciar uma task, deve aparecer como indisponível
Se o jogador pode iniciar quantas tasks desejar, mas só pode fazer uma de cada tipo por vez

---

# Informações que devem aparecer na UI

## Lista de Tasks

Mostrar:

- nome
- sprite/looktype do monstro
- categoria Dragon ball ou Bleach
- dificuldade do nível
- rank necessário para iniciar

---

# Painel Detalhado

Mostrar:

- nome do monstro
- looktype
- quantidade necessária
- quantidade morta
- barra de progresso
- task points
- experiência
- rewards
- delivery items
- botão abandonar
- botão navegar
- status da task

---

# Barra de Progresso em porcentagem e em tempo real

Exemplo:

```txt
87 / 100
████████░░
```

---

# Popup ao Completar

Quando completar:

```txt
TASK COMPLETA!

+500 Task Points
+1.500.000 EXP
+10 Crystal Coins

Retorne ao Taskerman para receber sua recompensa.
```

---

# Comunicação Client/Server

Utilizar:

- ExtendedOpcode

Evitar:

- parsing de storages
- excessos de packets
- talkactions desnecessárias

---

# Opcodes Recomendados

## Server → Client

```lua
OPCODE_TASK_LIST
OPCODE_TASK_UPDATE
OPCODE_TASK_COMPLETE
OPCODE_TASK_RANK
```

---

# Sistema de Visual de Rank

Adicionar:

- cores
- badges
- ícones
- tags
- efeitos visuais

Exemplo:

```txt
[ELITE] Tiago
```

---

# Performance Obrigatória

O sistema deve:

- evitar loops desnecessários
- evitar queries excessivas
- usar cache
- usar lookup rápido
- ser preparado para centenas de tasks
- ser preparado para centenas de players simultâneos

---

# Objetivo Final

Quero um sistema:

- profissional
- extremamente organizado
- fácil de manter
- escalável
- moderno
- otimizado
- agradável visualmente
- preparado para expansões futuras
- ideal para OTServ anime de longa duração

---

# Resultado Esperado

O resultado final deve incluir:

- arquitetura completa
- sistema modular
- código organizado
- persistência em banco
- cache
- sistema de rank
- sistema de delivery
- sistema de rewards
- integração OTCv8
- UI moderna
- anti-exploit
- performance otimizada
- facilidade para adicionar novas tasks
- facilidade para adicionar novos ranks
- facilidade para adicionar novos animes/sagas futuramente
