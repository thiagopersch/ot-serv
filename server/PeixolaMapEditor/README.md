# PeixolaMapEditor

Editor de mapas OpenTibia escrito em **Rust**, compatível com o Remere's Map Editor (RME):
lê e grava **OTBM** (com `-spawn.xml` / `-house.xml`), usa os **materiais do RME**
(`borders.xml`, `grounds.xml`, `walls.xml`, `doodads.xml`, `tilesets.xml`) e os sprites do
cliente (`Tibia.dat` / `Tibia.spr`, inclusive o `.spr` customizado de 1,3 GB).

Interface em **Português (BR)** e **Inglês** (menu *Idioma*).

## Como executar

```powershell
# compilar (release, otimizado) e abrir
.\run.ps1
# ou abrir um mapa direto
.\run.ps1 ..\data\world\main.otbm
```

O executável fica em **`server\PeixolaMapEditor\PeixolaMapEditor.exe`** (um único `.exe`, sem DLLs): basta dar
duplo clique. `build.ps1` e `run.ps1` recompilam e atualizam essa cópia.
Na primeira execução os caminhos são detectados automaticamente a partir desta pasta:

| Dado | Caminho padrão |
|---|---|
| items.otb / items.xml, monster/, npc/ | `server\data` |
| Tibia.dat / Tibia.spr / Tibia.otfi | `cliente\data\things\860` |
| Materiais (brushes) | `server\PeixolaMapEditor\data\materials\materials.xml` (cópia própria do editor) |
| Extensões de materiais | `server\PeixolaMapEditor\data\materials\extensions` |

O editor **não depende da pasta do RME**: os materiais (bordas, chãos, paredes, doodads, tilesets e`nextensões) ficam em `data\materials` dentro da própria pasta do editor, no mesmo formato XML do RME.
Configurações antigas que apontavam para server\RME são migradas automaticamente na primeira execução.

Eles podem ser alterados em **Ferramentas → Configurações** (salvo em `%APPDATA%\PeixolaMapEditor\peixola.toml`).

## Funcionalidades

- **Tela inicial** (como a do RME): Novo mapa, Abrir mapa existente, Configurações e o histórico de mapas abertos
  (clique para abrir; arquivos que sumiram aparecem riscados e podem ser removidos). Desligue em
  "Mostrar esta janela ao iniciar" ou reabra por Arquivo → Tela inicial.

- **Mapa**: abrir/salvar OTBM v1–v3 (`main.otbm` de 3,4 milhões de tiles abre em ~0,5 s), spawns e casas em XML,
  cidades e waypoints. O salvamento é atômico (`.tmp` → renomeia) e mantém um backup `.bak`.
  Atributos dos itens são preservados exatamente (load → save não perde nada).
- **Pincéis (portados do RME)**
  - Terreno com **bordas automáticas** (mesmo algoritmo do RME, incluindo `specific cases`, `friend/enemy`, z-order).
  - Paredes com alinhamento automático, portas e decorações de parede.
  - Doodads (simples e compostos, variações, espessura), tapetes e mesas.
  - Item "raw", borracha (botão esquerdo: itens; direito: tudo).
  - **Zonas**: Protection Zone, No-PvP, No-Logout e PvP Zone (PZ/No-PvP/PvP exclusivas, como no servidor).
  - Casas (tiles + saída, door IDs automáticos), spawns, criaturas (monstros e NPCs do servidor) e waypoints.
  - Tamanho 1–16, quadrado ou círculo; Shift + arrastar preenche um retângulo.
- **Edição**: desfazer/refazer ilimitado por traço, seleção por área, copiar/recortar/colar com prévia,
  mover seleção arrastando, apagar seleção. **Ctrl + clique esquerdo** limpa o tile inteiro (com qualquer
  ferramenta; arrastando limpa vários; um único Ctrl+Z).
- **Browse Field** (botão direito → último item do menu, como no RME): lista os objetos empilhados no tile com
  sprite e `id - nome`; com um selecionado: Excluir (só ele), Select RAW, Select brush (abre o tileset),
  Propriedades. Mostra posição, quantidade de itens, zonas e casa. O menu também copia Server ID, Client ID e nome.
- **Visualização**: andares com perspectiva e sombreamento, zonas/casas/spawns coloridos, grade,
  destaque de tiles bloqueantes, minimapa navegável, zoom de 12,5% a 400%.
- **HD Mode**: botão "HD" na barra (ou Exibir → HD Mode) amplia as sprites de 32 para 64 px com xBRZ, igual ao
  HD Mode do cliente — vale para o mapa, a paleta e a prévia dos brushes.
- **Animação e luzes**: sprites animados no mapa e na paleta (liga/desliga na barra), prévia de iluminação
  com luz ambiente ajustável (Exibir → Luz ambiente).
- **Janela de propriedades** (botão direito → Propriedades, ou duplo clique): seções conforme o tipo — teleporte
  (destino + escolher no mapa), porta, depot, contêiner (itens dentro), escrevível, fluido, empilhável, criatura e spawn.
- **Criar brushes** (Ferramentas → Criar/editar brushes, ou "+ Novo brush" na paleta): terreno com borda existente ou
  nova, parede com portas, tapete, mesa e doodad (inclusive capturado de uma seleção do mapa). Salvos em
  `data/materials/extensions/peixola_brushes.xml` (formato compatível com o RME) e aparecem no tileset "Peixola (custom)".
- **Substituir itens** (Mapa → Substituir itens, Ctrl+H): várias regras de uma vez, no mapa inteiro, seleção, andar
  atual ou área visível, com contagem prévia e um único desfazer.
- **Criaturas/NPCs com cores**: roupas coloridas (head/body/legs/feet do XML) e addons, como no RME.
- **Spawns**: área laranja com marcador 🔥 no centro; monstros em vermelho/magenta, NPCs em ciano e criaturas fora de
  spawn piscando em vermelho.
- **Ferramentas**: propriedades do tile/item (action id, unique id, quantidade, texto, destino de teleporte,
  door id, depot id, zonas, casa) com Aplicar/Desfazer, encontrar item (ID, nome, `aid:`/`uid:`),
  ir para posição, estatísticas, propriedades do mapa e cidades.

Atalhos: veja **Ajuda → Atalhos de teclado**.

## Desempenho (por que é mais rápido que o RME)

- `Tibia.spr` é **mapeado em memória**; sprites são decodificados só quando aparecem na tela.
- Sprites ficam num **atlas** de texturas grandes na GPU (wgpu/DirectX 12/Vulkan), em vez de uma textura
  OpenGL por sprite; o mapa visível é desenhado com poucas chamadas e a malha é reaproveitada enquanto
  nada muda.
- Mapa em blocos 32×32 por andar num hash map (acesso O(1), iteração amigável ao cache).
- Leitor OTBM em fluxo sobre o arquivo mapeado, em thread separada com barra de progresso.

## Estrutura

```
crates/
  pme-core/   modelo do mapa, itens, materiais, pincéis (port do RME), editor, undo/redo
  pme-io/     OTBM, items.otb/xml, Tibia.dat/spr, houses/spawns XML, materials XML, monstros/NPCs
  pme-app/    interface (egui + wgpu): canvas do mapa, paletas, propriedades, minimapa, i18n
assets/i18n/  pt-BR.txt e en.txt (chave = texto)
tools/        gen_brush_tables.py (gera as tabelas de borda/parede/mesa/tapete a partir do RME)
```

## Testes

```powershell
cargo test --workspace                                   # testes unitários
cargo test --release -p pme-io -- --ignored --nocapture  # testes com os dados reais do projeto
```

Os testes com dados reais carregam `items.otb`, `Tibia.dat/.spr`, os materiais e o `main.otbm`,
fazem o round-trip do mapa **em memória** (nada é gravado nas pastas do servidor) e testam
bordas automáticas, paredes, zonas, casas, doodads, copiar/colar/mover e desfazer.
Testes que editam materiais (brushes, tilesets) trabalham numa **cópia temporária** de `data/materials`.

### Benchmarks

```powershell
cargo test --release -p pme-io --test bench -- --ignored --nocapture
```

Mede carregamento/serialização do `main.otbm`, pincel 101×101 com bordas, desfazer e a
distribuição de objetos (tudo em memória). Resultados de referência em `docs/AUDIT.md`.

## Prévia e operações em lote

Ferramentas que alteram muitos tiles de uma vez mostram primeiro uma **prévia** (fantasma no mapa
com contorno ciano) e uma barra **Aplicar (Enter) · Regenerar · Cancelar (Esc)**. Nada muda no
mapa até Aplicar, e a operação inteira vira **um único Ctrl+Z**. Se o mapa for editado depois da
prévia, Aplicar fica bloqueado até regenerar.

### Distribuir objetos (Ferramentas → Distribuir objetos...)

Espalha itens e/ou doodads (com pesos) na **seleção** — ou nos tiles visíveis do andar atual se
nada estiver selecionado:
- **Densidade** (chance por tile), **distância mínima** entre objetos e **semente** (mesma semente =
  mesmo resultado; 🎲 sorteia outra).
- **Regras**: só em tiles vazios, evitar bloqueados, casas, PZ, criaturas/spawns; opcionalmente
  só em certos chãos (ex.: só na grama).
- Doodads compostos só são colocados inteiros, e nunca são usados IDs que não existem no items.otb.

## Documentação técnica

- `docs/AUDIT.md` — arquitetura, pontos de extensão, riscos e linha de base de desempenho.
- `ROADMAP.md` — fases de evolução e o que já foi entregue.

## Licença

Port de lógica do Remere's Map Editor (GPL-3.0) → este projeto também é GPL-3.0-or-later.
