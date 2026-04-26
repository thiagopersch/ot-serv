# Diretrizes para Agentes (AGENTS.MD) - OTClientV8

Este documento atua como um guia para agentes de Inteligência Artificial interagirem, navegarem e desenvolverem neste projeto de Client. Trata-se do código-fonte e dos scripts de módulos do **OTClientV8** adaptado para o servidor customizado (WODBO/DBOSupreme).

## 1. Visão Geral do Projeto

**Repositório/Diretório:** `client` (Base OTClientV8 focado em DirectX/Windows, conforme executáveis locais).
**Linguagens Principais:** C++ (Motor Gráfico e Rede na pasta `src`), Lua (Construção de UI e Lógica Modular nas pastas `modules` e `mods`), OTML (Marcação de UI e Configuração).
**Renderer/Framework:** Escrito com bibliotecas de baixo nível encadeadas pelo framework próprio (`src/framework`), com suporte nativo a DirectX pelo nome do binário compilado, redesenho de UI em Lua, etc.

O Client utiliza uma arquitetura MVC (Model-View-Controller) orientada a eventos, com o "Heavy-lifting" (renderização, comunicação criptografada, pathfinding primário) feito em C++, exposto via _LuaEngine_ para os arquivos `.lua` dos módulos.

## 2. Estrutura de Diretórios

### `/` (Diretório Raiz)

- **`otclient_dx.exe` / `otclient_dx-bk.exe`:** Executáveis locais compilados com suporte a DirectX.
- **`init.lua`:** Arquivo de entrada principal do engine, dispara o load do `corelib` e carrega os primeiros módulos.
- **`CMakeLists.txt` / `vcpkg.json`:** Arquivos e dependências para compilar a `source`. O client depende de pacotes como `boost`, `physfs`, `luajit`, `glew`, etc., resolvidos via VCPKG.
- **`/android/`:** Assets e scripts de deploy prováveis caso decida gerar APK (via script `create_android_assets.ps1`).
- **`/layouts/`:** Podem conter variações visuais completas do client. Atualmente contendo `retro` e `mobile`.

### `/src/` (Código Fonte - C++)

Esta pasta contém o núcleo duro do client. Sempre que o core C++ sofrer alterações, é necessário **recompilar** o executável.

- **`/src/framework/` (O Motor Base):**
  - `core/`, `graphics/`, `sound/`, `net/`: Infraestrutura básica. Tratamento de janelas, gerador de texturas abstratas, som (OpenAL), e conexões HTTP/TCP puras.
  - `luaengine/`: Responsável pelo _binding/wrapper_ (ponte) onde funções C++ e instâncias da framework são exportadas para Lua.
  - `ui/` e `otml/`: Interpretador do layout OTML e UI Widgets genéricos (Botões, Janelas, Barras).

- **`/src/client/` (Regras de Jogo Específicas):**
  - Ficheiros como `protocolgame.cpp`, `protocolgameparse.cpp` e `protocolgamesend.cpp`: Lidam com a tradução literal dos bytes para ações e pacotes vindos do WODBO/TFS e vice-versa.
  - `creature.cpp`, `player.cpp`, `localplayer.cpp`: Controle das entidades visuais do jogo, offsets de sprites e caminhada (walk logic).
  - `map.cpp`, `mapview.cpp`, `tile.cpp`: Desenhadores (renderer) e gerenciador da matriz do mapa na tela. Efeitos, projéteis e ordenação de camadas (z-index de desenho).
  - `thing.h`, `item.cpp`, `outfit.cpp`: Representação visual do .dat e .spr.
  - `luafunctions_client.cpp`: Lista de todas as injeções de funções de jogo (Game) no ambiente LUA para os `modules`.

### `/modules/` e `/mods/` (Interface e Lógica Lua)

Onde o _game design_ acontece para o jogador final. Sem precisar recompilar o `.exe`, toda a UI é manipulável aqui via LUA + OTML.

- **`/modules/corelib/` e `/modules/gamelib/`:** Bibliotecas globais Lua. Possibilitam chamadas orientadas a objetos estendidas.
- **`/modules/client_*/`:** Controlam funcionalidades antes do login e extra-jogo. Ex: `client_entergame` (tela de login), `client_options` (opções do jogo), `client_terminal`.
- **`/modules/game_*/`:** Módulos ativados dentro do jogo.
  - `game_interface`: Raiz da tela in-game.
  - `game_console`, `game_skills`, `game_inventory`, `game_battle`: Módulos de interface tradicionais do Tibia.
  - `game_bot` / `game_features`: Funcionalidades automatizadas e injeções extras visuais.
- **`/mods/`:** Módulos customizados frequentemente externos que não afetam severamente interações nativas se ligados/desligados. Exemplos reais atualmente no projeto: `game_healthbars`, `game_levelup`, `game_upgrades`.

### `/data/` (Visual Assets e Dados)

- **`images/`, `fonts/`, `cursors/`, `sounds/`:** Ativos brutos da UI. Modificar o cursor ou fundo principal envolve colocar os frames aqui.
- **`things/`:** Caminho padrão onde se inserem os arquivos de compilado gráfico do Tibia: `Tibia.dat`, `Tibia.spr`, etc., (Neste server custom, costumam ter nomes singulares dependendo as assinaturas do client).
- **`shaders/`:** Scripts GLSL parciais (.frag/.vert) de efeitos de tela, úteis para criar áuras e vibrações (ex: Hakai, Transformações) caso configurados no mapa ou tela.

## 3. Diretrizes para Agentes (IA)

### Ao Modificar a Source C++ (`/src/`)

1. **Protocolo WODBO (TFS 8.54/8.60):** O tráfego de pacotes (opcodes) deve estar perfeitamente compatível em _bytes_, _tipagem_ e na _ordem matemática_ com a source C++ do WODBO global. Edite `protocolgameparse.cpp` e `protocolgamesend.cpp` com extrema cautela e valide logs de `packet.log`.
2. **Expor Variáveis ao Lua:** Se um novo cálculo de opacidade ou cor for criado no `creature.cpp` (C++), lembre-se de expor via binding genérico ou no método de binding (`luafunctions_client.cpp` / `luaengine`). Senão, os módulos não poderão acessar o recurso.
3. **Cuidado com OpenGL/DirectX State Machine:** Ao construir _Lightviews_ ou _Shaders_, não quebre a rotina de renderização no `.cpp`. É comum criar render bugs que deixem o chão preto ou sprites invertidas se a matriz GL for alterada incorretamente.

### Ao Modificar Módulos e UI LUA (`/modules/` e `/mods/`)

1. **Separação UI e Lógica (OTML x LUA):** Sempre descreva layouts e widgets estáticos nos arquivos `.otml`. Use o `.lua` majoritariamente para captar os eventos (`onClick`, `onSetup`) dos elementos instanciados no `.otml`. Evite gerar dezenas de `g_ui.createWidget()` no script cego se não for dinâmico.
2. **Eventos do Opcodes Alargados (Extended Opcodes):** No desenvolvimento WODBO, magias complexas (Auras Círculo, Ki, Radar) frequentemente usam opcodes numéricos estendidos. Registe escutas de eventos do servidor pelo LUA via `ProtocolGame.registerExtendedOpcode`.
3. **Cache de Instâncias UI:** Preze por mostrar/esconder paineis via `hide()` e `show()` no lugar de destruir (`destroy()`) e recriar paineis toda vez. Isso evita travamentos de garbage collector na layer LUA do client.
4. **Gerenciamento G_Global:** Atente-se às chamadas de variáveis abertas `g_game`, `g_map`, `g_window`, elas são os singletons principais da source apontados para o Lua. Use com respeito sob escopo local para não desalinhar seus _pools_ de callbacks.

### Checklist antes de entregar alteração no Client:

- Os opcodes modificados casam os tipos de leitura (`msg->getU16()`, `msg->getString()`) espelhados com à Source do WODBO Server?
- A nova UI de `.otml` possui âncoras relativas corretas (`anchors.top`, `anchors.left`) para não quebrar responsividade ao redimensionar tela?
- Funções criadas no ambiente de `/mods/` chamam corretamente lógicas limpas na sua inicialização (`init()`) e finalização (`terminate()`) desfazendo conexões via `disconnect()` para prevenir phantom callbacks?
