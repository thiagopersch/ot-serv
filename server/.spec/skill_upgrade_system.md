Você é um desenvolvedor especialista em TFS 0.4 (The Forgotten Server), OTC (OTClient), Lua, C++, sistemas MMORPG e arquitetura de servidores derivados de Tibia focados em animes.

Sua tarefa é criar um sistema COMPLETO, escalável, modular e performático de “Skill Upgrade System” para um servidor derivado de Tibia Anime baseado em TFS 0.4 + OTC.

O sistema deve ser desenvolvido pensando em:

- Alta performance
- Fácil manutenção
- Fácil expansão futura
- Compatibilidade com sistemas existentes
- Persistência por vocation
- Integração total com spells, combate, loot, XP e regeneração
- Interface visual moderna no OTC
- Banco de dados estruturado
- Configurações centralizadas
- Compatibilidade multiplayer

======================================================================
OBJETIVO DO SISTEMA
===================

O sistema permitirá que o jogador distribua “Upgrade Points” em diversas categorias de atributos/especializações.

Esses pontos serão obtidos através de:

- Gain de level
- Quests
- Missões/Sagas
- Eventos
- Recompensas customizadas

Os upgrades NÃO são globais do player.

Os upgrades DEVEM respeitar:

- vocation_ranks
- change_vocation
- multi-vocations desbloqueadas

Ou seja:
Cada vocation possui seus próprios upgrades independentes.

Exemplo:

- Goku SSJ possui upgrades próprios
- Vegeta SSJ possui upgrades próprios
- Naruto Sage possui upgrades próprios

Mesmo pertencendo ao mesmo player.

======================================================================
SKILLS/UPGRADES DO SISTEMA
==========================

O sistema deverá suportar as seguintes categorias:

1. Reduce Cooldown Techniques

- Reduz cooldown das magias
- Cada nível reduz mais o cooldown
- Deve funcionar em spells instant, rune, técnicas especiais e combos

2. Life Leech

- Chance de roubar HP do alvo
- Quanto maior o level:
  - maior chance
  - maior porcentagem drenada

3. Mana Leech

- Chance de roubar mana do alvo
- Quanto maior o level:
  - maior chance
  - maior porcentagem drenada

4. Critical Chance

- Chance de causar dano crítico

5. Critical Damage

- Multiplicador do dano crítico

6. Magic Damage

- Aumenta dano de spells/magias/técnicas

7. Healing Power

- Aumenta cura de HP
- Aumenta regeneração de mana
- Aumenta spells de healing

8. Combat Skills (possibilidade de upgrade individual para cada skill)

- Magic Level
- Fist
- Club
- Sword
- Axe
- Distance
- Shielding

9. Loot Chance

- Aumenta chance de loot
- Pode:
  - aumentar frequência
  - aumentar quantidade
  - aumentar raridade

- Deve ser configurável

10. Experience Bonus

- Aumenta ganho de XP

11. Reduce Cost Techniques

- Reduz custo de mana das magias

======================================================================
REGRAS DE EVOLUÇÃO
==================

Cada skill:

- Vai de 0 até 200
- Deve ser configurável individualmente

Exemplo:

- critical_chance = 100 max
- lifeleech = 300 max

As configurações DEVEM ficar centralizadas.

======================================================================
ESCALONAMENTO DE CUSTO
======================

O custo de upgrade NÃO será fixo.

Regra:

- A cada 5 níveis da skill:
  - o custo aumenta

Exemplo:
0~4 = 1 point
5~9 = 2 points
10~14 = 3 points
15~19 = 4 points

O cálculo precisa ser:

- dinâmico
- configurável
- reutilizável

IMPORTANTE:
O sistema deve permitir futuramente:

- fórmulas customizadas
- scaling exponencial
- scaling linear
- scaling por rarity
- scaling por vocation

======================================================================
REQUISITOS TÉCNICOS
===================

Você deve criar:

1. SISTEMA SERVER-SIDE COMPLETO

- Lua
- C++
- Events
- Combat hooks
- Creature events
- Talkactions
- Globalevents
- Storage system
- Cache system
- Persistence layer

2. SISTEMA CLIENT-SIDE OTC
   Criar:

- Module OTC completo
- Janela UI
- Tooltip dos atributos
- Barras
- Ícones
- Hover effects
- Upgrade buttons
- Reset button
- Confirmações
- Atualização em tempo real
- Packet parsing
- Comunicação client/server

3. BANCO DE DADOS
   Criar:

- tabelas
- índices
- constraints
- migration SQL

Estrutura pensada para:

- milhões de registros
- leitura rápida
- save otimizado

======================================================================
PERSISTÊNCIA POR VOCATION
=========================

O sistema DEVE salvar:

- player_id
- current_vocation
- skill_name
- current_level
- spent_points
- available_points

Cada vocation precisa ter:

- árvore independente
- progressão independente

======================================================================
SISTEMA DE RESET
================

Criar sistema de reset:

- por item
- por comando
- por NPC
- por premium
- por moeda do jogo

Configuração:

- reset parcial
- reset total
- custo configurável

======================================================================
INTEGRAÇÃO COM COMBATE
======================

O sistema DEVE modificar:

- combat.cpp
- spells.cpp
- condition.cpp
- player.cpp
- weapons.cpp
- combat formulas

Quando necessário.

As alterações precisam:

- evitar impacto de performance
- evitar cálculos repetitivos
- utilizar cache
- utilizar pré-cálculos
- evitar lookup excessivo em storages

======================================================================
CACHE E PERFORMANCE
===================

O sistema PRECISA ter:

- cache em memória
- preload ao logar
- save inteligente
- dirty state
- sync otimizado

Evitar:

- queries constantes
- acesso excessivo ao banco
- recalcular stats toda hora

======================================================================
SISTEMA DE CONFIGURAÇÃO
=======================

Criar arquivo central:
Exemplo:

- data/lib/skill_upgrade_config.lua

Configurações:

- max level
- fórmulas
- scaling
- costs
- limits
- effects
- percentages
- critical formulas
- leech formulas
- cooldown reduction caps
- mana reduction caps

======================================================================
SISTEMA DE BALANCEAMENTO
========================

O sistema DEVE possuir:

- caps máximos
- diminishing returns
- proteção anti-overpower
- limites configuráveis

Exemplo:

- cooldown reduction máximo = 60%
- critical chance máximo = 75%
- mana reduction máximo = 80%

======================================================================
INTERFACE OTC
=============

Criar interface moderna estilo RPG/Anime:

- painel de talentos
- categorias
- ícones
- descrição dinâmica
- preview de bônus
- pontos disponíveis
- pontos gastos
- confirmação de upgrade
- animações
- efeitos sonoros opcionais

A UI deve:

- funcionar em OTC
- atualizar em tempo real
- suportar futuras expansões
- suportar paginação

======================================================================
PROTOCOLO CLIENT/SERVER
=======================

Implementar:

- opcodes customizados
- envio de dados
- sincronização
- atualização parcial
- atualização total
- validações server-side

O servidor deve ser totalmente autoritativo.

======================================================================
SEGURANÇA
=========

Prevenir:

- packet injection
- duplication
- exploits
- race conditions
- rollback abuse
- invalid upgrades
- bypass de costs
- spoofing OTC

Toda validação deve ocorrer no servidor.

======================================================================
ARQUITETURA
===========

O sistema deve seguir:

- separação de responsabilidades
- código modular
- fácil extensão
- baixo acoplamento
- alta coesão

======================================================================
ESTRUTURA ESPERADA
==================

Você deverá gerar:

1. Estrutura completa de diretórios
2. Arquivos necessários
3. SQLs
4. Sources modificadas
5. Código Lua
6. Código C++
7. Código OTC
8. OTUI
9. Protocol parsing
10. Sistema de cache
11. Fluxo completo
12. Diagrama lógico
13. Explicação técnica
14. Hooks necessários
15. Fórmulas
16. Estratégias de otimização
17. Estratégias anti-cheat
18. Estratégias de expansão futura

======================================================================
IMPORTANTE
==========

Antes de implementar:

1. Analise a arquitetura do TFS 0.4
2. Analise limitações do OTC
3. Analise sistema de vocation_ranks
4. Analise sistema change_vocation
5. Identifique o melhor local para hooks
6. Minimize impacto de performance
7. Priorize cache em memória
8. Evite soluções temporárias/gambiarras

Se necessário:

- modificar sources
- adicionar packets
- criar novas classes
- criar managers
- criar registries
- criar enums
- criar handlers

======================================================================
RESULTADO ESPERADO
==================

O resultado final deve ser um sistema AAA:

- profissional
- otimizado
- escalável
- modular
- fácil manutenção
- preparado para MMORPG de longa duração
- preparado para futuras skills/animes/classes

O código gerado deve ser:

- limpo
- comentado
- organizado
- desacoplado
- performático
- pronto para produção
- compatível com TFS 0.4
- compatível com OTC
