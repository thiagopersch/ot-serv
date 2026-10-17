# Diretrizes para Agentes (AGENTS.MD)

Este documento atua como um guia para agentes de Inteligência Artificial interagirem, navegarem e desenvolverem neste projeto. Trata-se do código-fonte e dos scripts de dados de um servidor de Tibia customizado (WODBO/DBOSupreme - base The Forgotten Server/TFS).

## 1. Visão Geral do Projeto

**Repositório:** `wodbo-global-server` (identificado como "DBOSupreme" através do `config.lua`).
**Linguagens Principais:** C++ (Motor/Source), Lua (Scripts In-game/Conteúdo), XML (Configurações e Estruturas).
**Banco de Dados:** Atualmente configurado para SQLite, mas possui integrações para MySQL/PostgreSQL expostas no código fonte.

O servidor adota as lógicas e protocolos base do _The Forgotten Server_ (possivelmente fork focado em versão 8.54 / 8.60 baseando-se nos nomes dos subdiretórios antigos comuns nessas bases, e pelas lógicas descritas). Modificações pesadas que requerem reestruturação do motor, gerenciamento de rede, pacotes e IA são feitas na _Source_. Modificações de conteúdo do mundo, como magias, interações entre npcs, monstros e afins são feitas na pasta _Data_.

## 2. Estrutura de Diretórios

### `/` (Diretório Raiz)

- **`TheForgottenServer.exe`:** Compilado executável do servidor para Windows.
- **`config.lua`:** Arquivo de configuração base contendo rates de experiência, loot, limites estruturais, informações de banco de dados e definições fundamentais do motor.
- **`*.dll`:** Bibliotecas estáticas e dinâmicas necessárias para o motor funcionar localmente no ambiente Windows (lua5.1, sqlite, mysql, xml2, etc).
- **`/RME/`** e **`/schemas/`:** Diretórios utilizados para definir a forma de interpretação e edição do mapa através do Remere's Map Editor.
- **`/mods/`:** Arquivos XML que encapsulam rotinas customizadas usando o _modmaker system_.

### `/src/source` e `/src/` (Código Fonte - C++)

Esta pasta contém o núcleo (engine) do jogo executado em C++. Qualquer modificação nesta pasta requer a **recompilação do executável** para surtir efeito.

- **Core Engine:** Ficheiros principais do loop do servidor e despachadores base (`game.cpp`, `scheduler.cpp`, `dispatcher.cpp`).
- **Mecânicas Internas:**
  - `combat.cpp` / `condition.cpp` / `weapons.cpp`: Definição rígida do funcionamento de combates, aplicações de condições (Dano ao longo do tempo, Exaustão, etc).
  - `player.cpp` / `creature.cpp` / `monster.cpp` / `npc.cpp`: Regras de negócio de cada tipo de criatura inserida no jogo.
  - `protocolgame.cpp` e `protocollogin.cpp`: Implementação dos protocolos e pacotes (packets) enviados entre Client e Server.
  - `luascript.cpp`: A ponte para criar funções (C++ para Lua), fundamental caso seja preciso exportar métodos do motor C++ para que sejam acessados na vida do jogo na pasta `data`.
  - `databasemanager.cpp` e afins: Classes para realizar Queries do banco e controle da persistência.

### `/data/` (Arquivos de Dados / Scripts)

O núcleo de game design e conteúdo. Tudo neste diretório molda o jogo _sem_ necessidade de compilar.

- **`/actions/`:** Lógica de itens clickáveis/usáveis.
- **`/creaturescripts/`:** Eventos ativados a ações cruciais de criaturas (onLogin, onDeath, onAdvance, onThink, etc).
- **`/globalevents/`:** Scripts que são executados ciclicamente baseados em tempo global no servidor.
- **`/items/`:** Registros XML de atributos de itens (ataque, defesa e descrições).
- **`/monster/`:** Configurações (XML) e comportamento de classes de monstros do mapa.
- **`/movements/`:** Mecânicas ativadas ao pisar/sair/arrastar itens e tiles estruturais (pisos com action id, etc).
- **`/npc/`:** XML de descrição do npc e os Lua Scripts para diálogo.
- **`/spells/`:** Fórmulas de magia, buff, debuff (como os scripts _Hakai_ e de auras revisados anteriormente).
- **`/talkactions/`:** Comandos falados que originam ações internas do servidor (iniciados com prefixos ex: `!`, `/` e `!buff`).

## 3. Diretrizes para Agentes (IA)

### Ao Modificar a Source C++ (`/src/source`)

1. **Gerenciamento de Memória:** O TFS/OTX requer muita atenção com pointeiros para não ocasionar crashe ou vazamento de memória (memory leaks). Ao adicionar objetos como listas ou mapas, tenha certeza que estão sendo limpados após o seu ciclo de vida.
2. **Integração Lua (LUAScript):** Se for criar funções para os scripts utilizarem (como getters para buscar variáveis exclusivas recém-criadas na Source), exponha-as obrigatoriamente através dos ficheiros em `luascript.cpp` / `luascript.h`.
3. **Persistência de Dados (DB):** Ao estender o servidor de banco de dados (por exemplo expandir logs ou features persistentes nos players), estenda `IOLoginData` e inclua o tratamento em `databasemanager.cpp`.
4. **Retrocompatibilidade:** Muitas features devem manter sua casca por padrão. Procure injetar flags nas classes sem remover propriedades clássicas.

### Ao Modificar Scripts (`/data/`)

1. **Priorize LUA:** Sempre que possível, implemente lógicas visíveis e mecânicas não críticas e que não impactem profundamente em performance utilizando scripts e _globalevents_ / _creaturescripts_, poupando manutenção futura nas Sources C++.
2. **Modularização no `/lib/`:** Códigos ou fórmulas densas utilizadas por mais de uma magia/ação devem ser inseridos em ficheiros dentro da pasta `/data/lib/`.
3. **Storages Limits:** Ao lidar com flags temporárias do usuário ou controles de missão, evite ocupar _storage values_ padrões globais já usados por quests famosas do jogo, a não ser que os limpe corretamente.
4. **Tratamento de Exaustão:** Para sistemas como buffs, auras ou transformações, controle e isole a exaustão com `os.time()` e crie storages organizados por faixas (ex: _100000+_ para sistemas únicos de servidor).

### Checklist antes de entregar o código:

- Verificou se a modificação C++ requer ser adicionada ao header derivado (`.h`)?
- Validou se as assinaturas (parâmetros da função Lua chamando C++) correm de acordo com os push/pop na Stack do interpretador em LuaScript.cpp?
- Identificou eventuais impactos e conflitos com buffs de velocidade base ou mecânicas padronizadas?
- Otimizou blocos redundantes em magias como _addEvent()_ aninhados desnecessários com grande risco de memory overload?
