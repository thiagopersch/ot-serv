# Auditoria técnica (Fase 0)

Levantamento feito no código atual antes da evolução por fases. Serve de referência para as
próximas fases do `ROADMAP.md`.

## Arquitetura real

| Crate | Responsabilidade | Pontos de extensão |
|---|---|---|
| `pme-core` | `Map` (blocos 32×32 por andar), `Tile`, `Item` (atributos em lista, round-trip sem perdas), `ItemDb`, `Materials`, brushes portados do RME, `Editor`, `History` | `Editor` (todas as edições), `staged` (prévia), `source::TileSource`, `gen/*` (geradores) |
| `pme-io` | OTBM v1–v3, items.otb/xml, Tibia.dat/spr (mmap), materiais RME (leitura e edição no lugar), casas/spawns XML, monstros/NPCs | `xml_edit` (editar um elemento sem mexer no resto do arquivo), `tileset_edit`, `materials_writer` |
| `pme-app` | egui 0.31 + wgpu: canvas, paletas, propriedades, janelas, i18n | `pending` (prévia/aplicar/cancelar), janelas por ferramenta (`scatter_ui`, `replace`, `browse`...) |

## Edição e undo/redo
- Toda alteração do mapa passa por `Editor` → `History`. `Change::Tile` **troca o tile inteiro** (aplicar duas vezes volta ao estado anterior); casas, cidades e waypoints usam snapshots.
- Lotes aninhados (`begin`/`end`) agrupam um gesto num único passo de desfazer; memória limitada por `max_mem`.
- Medido: desfazer um traço de 101×101 tiles ≈ 0,1 ms (troca de ponteiros).

## Fundação adicionada nesta fase (Fase 1)
- **`source::TileSource`**: leitura de tiles comum ao `Map` e à camada de prévia. `do_borders`, `do_walls`, `do_carpets` e `do_tables` são genéricos — o mesmo algoritmo do RME roda no mapa ou na prévia (teste com dados reais prova resultado idêntico).
- **`staged::Staged` / `StagedChanges`**: camada copy-on-write. Geradores escrevem nela; nada toca o mapa até `Editor::apply_staged`, que grava **um único passo de desfazer**. Cancelar = descartar.
- **`rng::with_seed`**: semeia o gerador da thread durante uma operação e restaura depois → mesma semente + mesmo mapa = mesmo resultado. `Editor::brush_seed` torna traços de pincel reproduzíveis.
- **Prévia no app** (`pending.rs`): fantasma no mapa, contorno da área, barra Aplicar (Enter) / Regenerar / Cancelar (Esc). Se o mapa mudar depois da prévia, Aplicar fica bloqueado.

## Dados disponíveis para as próximas fases
- items.otb: flags `UNPASSABLE`, `BLOCK_MISSILES`, `BLOCK_PATHFINDER`, `HAS_ELEVATION`, `FLOORCHANGE*`, `ALWAYSONTOP`/`TOPORDER`.
- items.xml (servidor): `rotateTo` em 723 itens e `floorchange` em 494 — **ainda não lidos**; necessários para rotação segura (Módulo F) e pathfinding (Módulo E).
- Materiais completos (bordas com specific cases, paredes, doodads com alternativas e composições, tapetes, mesas, tilesets) em `data/materials` — cópia própria do editor, idêntica aos originais do RME 8.60 (teste `bundled_materials_match_rme_originals`). O editor não depende mais da pasta `server/RME`.

## Riscos conhecidos
- **Rotação/espelhamento**: sprites do Tibia não podem ser espelhados; só posições podem. Rotacionar itens direcionais exige `rotateTo` — sem ele, a transformação precisa avisar.
- **Pathfinding**: parte das regras de movimento está no código do TFS 0.4 (ex.: comportamento exato de floorchange, portas, campos). O que vier só das flags será documentado como inferido.
- **Invalidação de render**: o cache de malha usa a revisão global do mapa — qualquer edição reconstrói a área visível (1–10 ms). Há revisão por bloco ainda não usada (otimização futura, Módulo J).

## Linha de base de desempenho
Medida com `cargo test --release -p pme-io --test bench -- --ignored --nocapture` (dados reais, tudo em memória):

| Operação | Tempo |
|---|---|
| items.otb + items.xml + Tibia.dat | 103 ms |
| materiais (data/materials + extensões) | 41 ms |
| carregar main.otbm (3.427.934 tiles) | 349 ms |
| serializar main.otbm (30 MB) | 330 ms |
| pincel de chão 101×101 + bordas | 5,4 ms |
| desfazer esse traço | 0,1 ms |
| distribuir objetos em 200×200 | 2,4 ms (1.107 tiles) |
| aplicar prévia (1.107 tiles) | 0,2 ms |

Memória: o editor com `main.otbm` aberto ocupou **751 MB** de working set (medido pelo Windows após
abrir o mapa, sem edições). Ainda não há medição automática por teste; fica como pendência da Fase 8.

## Dependência do RME
Nenhuma em tempo de execução. Só as ferramentas de desenvolvimento `tools/gen_brush_tables.py` e `tools/gen_outfit_colors.py` leem o código-fonte do RME, e apenas para regenerar tabelas que já estão no repositório (`brush_tables.rs`, `outfit.rs`); não são necessárias para compilar nem para usar o editor.
