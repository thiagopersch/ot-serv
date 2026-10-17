# Roadmap

Evolução por fases (ver `docs/AUDIT.md` para a arquitetura e a linha de base de desempenho).
Cada fase só é marcada como concluída quando está integrada à interface, testada com dados
reais, documentada e pode ser desfeita quando altera o mapa.

## Fase 0 — Auditoria ✅
- [x] Mapeamento da arquitetura real, riscos e pontos de extensão (`docs/AUDIT.md`).
- [x] Linha de base de desempenho medida (`crates/pme-io/tests/bench.rs`).

## Fase 1 — Fundação ✅
- [x] `TileSource`: algoritmos de borda/parede/tapete/mesa rodam no mapa ou na prévia.
- [x] `Staged` / `StagedChanges`: prévia copy-on-write; `Editor::apply_staged` = um único desfazer.
- [x] Aleatoriedade reproduzível (`rng::with_seed`, `Editor::brush_seed`).
- [x] Prévia no app: fantasma, contorno, Aplicar (Enter) / Regenerar / Cancelar (Esc); bloqueio se o mapa mudou.

## Fase 2 — Produtividade (em andamento)
- [x] Distribuir objetos por densidade (pesos, densidade, distância mínima, semente, exclusões, chãos permitidos, prévia).
- [ ] Brushes de linha/caminho (estrada, rio, lava, trilho, cerca) com largura e irregularidade, usando as bordas reais.
- [ ] Preenchimento contextual (região conectada, limite de segurança, prévia).
- [ ] Variação natural no pincel de chão (frequências por item, anti-repetição).
- [ ] Transformações de seleção: rotação 90/180/270 (itens direcionais via `rotateTo` do items.xml), espelhamento de posições, deslocamento, cópia com deslocamento — com ajuste/aviso de referências (teleportes, casas, spawns, waypoints).
- [ ] Biblioteca de templates (formato próprio versionado, categorias, miniaturas, prévia de inserção).

## Fase 3 — Geração procedural
- [ ] Salas e corredores (presets: casa, loja, templo, arena, dungeon, sala de boss).
- [ ] Cavernas (autômato celular/ruído determinístico).
- [ ] Rios, lagos, montanhas, praias, ilhas.
- [ ] Vegetação (florestas, clareiras, margens) reaproveitando a distribuição.

## Fase 4 — Validação
- [ ] Painel de diagnóstico (erro/aviso/info, filtros, busca, navegação, exportação, revalidação).
- [ ] Regras: integridade, casas, teleportes, spawns, densidade; regras opcionais configuráveis.
- [ ] Correções automáticas sempre com prévia.

## Fase 5 — Jogabilidade
- [ ] Pathfinding com perfis de movimento (flags do items.otb + `floorchange` do items.xml; regras do TFS documentadas).
- [ ] Regiões isoladas, gargalos, conexões entre andares e teleportes.

## Fase 6 — Automação
- [ ] Macros versionadas sobre o mesmo mecanismo de comandos/prévia (sem aplicação parcial em caso de falha).

## Fase 7 — IA (opcional)
- [ ] Planejador que gera planos estruturados validados (IDs e referências), sempre com prévia e desfazer; o editor continua funcionando sem internet/chave.

## Fase 8 — Estabilização
- [ ] Medição de memória, benchmarks ampliados, invalidação de render por bloco, build de produção.

## Paridade com o RME (backlog)
- [x] Coloração de outfits e addons; direção da criatura conforme o spawn.
- [x] Animação, iluminação, HD Mode (xBRZ), itens invisíveis (tech items).
- [x] Substituir itens, editar contêineres, editar brushes e tilesets, Browse field, Select RAW/brush.
- [ ] Pincel de portas e de "optional border" (montanhas) separados.
- [ ] Limpeza do mapa (itens inválidos, tiles de casa sem chão, itens duplicados).
- [ ] Seleção por item e em vários andares.
- [ ] Outfits de pódios na janela de propriedades.
- [ ] Várias abas de mapa; importar mapa; exportar minimapa em PNG.
- [ ] Favoritos e histórico de pincéis; autosave.
- [ ] Edição colaborativa ao vivo; zone IDs numéricas (se o servidor suportar).
