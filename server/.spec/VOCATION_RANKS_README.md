# Sistema de Rank/Estrelas por Vocation - Documentação

## Visão Geral
Sistema onde cada vocação tem um rank (Bronze → Prata → Ouro → Diamante) com 5 estrelas por rank.
Ao upar, ganha bônus de stats. As estrelas são exibidas abaixo do nome do jogador no jogo.

## Arquivos Criados/Modificados

### Servidor (server-tibia)

1. **Banco de Dados**
   - `schemas/sqlite.sql` - Adicionada tabela `player_vocation_ranks`
   - `schemas/mysql.sql` - Adicionada tabela `player_vocation_ranks`
   - `src/schemas/sqlite.sql` - Adicionada tabela `player_vocation_ranks`
   - `src/schemas/mysql.sql` - Adicionada tabela `player_vocation_ranks`
   - `data/sql/migration_vocation_ranks.sql` - Script de migração

2. **Bibliotecas Lua**
   - `data/lib/vocation_ranks_config.lua` - Configuração (PREENCHA ITENS E STATS)
   - `data/lib/vocation_ranks_lib.lua` - Funções core do sistema

3. **Scripts**
   - `data/actions/scripts/vocation_rank_upgrade.lua` - Usar item para upgrade
   - `data/creaturescripts/scripts/vocation_ranks.lua` - Aplica bônus no login
   - `data/creaturescripts/scripts/extendedopcode_vocation_ranks.lua` - Handler opcode 235
   - `data/talkactions/scripts/vocation_rank.lua` - Comando !rank

4. **Registros em XML**
   - `data/actions/actions.xml` - Registro do item de upgrade (TROQUE YOUR_ITEM_ID_HERE)
   - `data/creaturescripts/creaturescripts.xml` - Registro dos eventos
   - `data/talkactions/talkactions.xml` - Registro do comando !rank

### Cliente (client)

1. **Módulo game_vocation_ranks**
   - `modules/game_vocation_ranks/vocation_ranks.otmod` - Manifesto
   - `modules/game_vocation_ranks/vocation_ranks.otui` - Interface
   - `modules/game_vocation_ranks/vocation_ranks.lua` - Lógica Lua
   - `modules/game_vocation_ranks/README.txt` - Instruções

2. **Imagens Necessárias (VOCÊ DEVE CRIAR)**
   - `data/images/ranks/bronze_star.png` (16x16)
   - `data/images/ranks/silver_star.png` (16x16)
   - `data/images/ranks/gold_star.png` (16x16)
   - `data/images/ranks/diamond_star.png` (16x16)
   - `data/images/topbuttons/ranks.png` (ícone do botão)

## Configuração Necessária (VOCÊ DEVE FAZER)

### 1. Editar `data/lib/vocation_ranks_config.lua`:
- Preencher `UniversalUpgradeItem.itemId` com o ID do item universal
- Preencher `specificUpgradeItemId` para cada vocação
- Ajustar `maxRank` para cada vocação (1=Bronze, 2=Prata, 3=Ouro, 4=Diamante)
- Ajustar `statsPerStar` com os bônus desejados por estrela

### 2. Editar `data/actions/actions.xml`:
- Trocar `YOUR_ITEM_ID_HERE` pelo ID real do item de upgrade

### 3. Criar imagens das estrelas em `client/data/images/ranks/`

## Como Usar

1. **Ver rank atual**: `!rank`
2. **Tentar upgrade**: Use o item de upgrade na hotkey
3. **Ver interface**: Clique no botão "Ranks" no topo da tela
4. **Estrelas**: Aparecem automaticamente abaixo do nome quando você tem rank

## Opcode
- **235** é usado para comunicação servidor-cliente (livre para uso)

## Funcionamento das Estrelas
- Bronze: 1-5 estrelas bronze
- Prata: 1-5 estrelas prata (após 5 bronze)
- Ouro: 1-5 estrelas ouro (após 5 prata)
- Diamante: 1-5 estrelas diamante (após 5 ouro)

Ao evoluir pela primeira vez, mostra 1 estrela do rank inicial (Bronze).
Conforme faz upgrades, as estrelas aparecem abaixo do nome.
Ao completar 5 estrelas, próximo upgrade vai para o próximo rank.
