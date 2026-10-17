# doodads.xml — Guia de Referência

Documentação gerada a partir da análise completa do arquivo `doodads.xml` (RME 8.60,
~33.000 linhas, ~1.700 `<brush>`). Explica cada elemento, atributo e variação
encontrados no arquivo, para servir de referência ao criar novos doodads.

## Estrutura geral

```xml
<materials>
    <!-- comentário de seção -->
    <brush name="..." type="..." server_lookid="..." ...>
        <!-- conteúdo depende do type do brush -->
    </brush>
    ...
</materials>
```

Tudo fica dentro de uma única tag raiz `<materials>...</materials>`. Cada doodad é um
`<brush>`. A formatação dos atributos (uma linha só ou quebrada em várias linhas) é
apenas estilo — ambas funcionam igual para o parser.

Comentários HTML (`<!-- ... -->`) são usados livremente para dividir o arquivo em
seções temáticas (ex.: `<!-- Jungle -->`, `<!-- Ramps -->`) e não têm efeito funcional.

---

## 1. A tag `<brush>`

Atributos observados no arquivo:

| Atributo         | Obrigatório | Valores observados                        | Descrição |
|-------------------|:-----------:|--------------------------------------------|-----------|
| `name`            | sim | texto livre (ex.: `"green trees"`)          | Nome exibido no editor RME. |
| `type`            | sim | `doodad`, `carpet`, `wall`, `table`         | Define que tipo de conteúdo o brush contém (ver seções 2–5). |
| `server_lookid`   | sim | ID de item                                  | Item usado como ícone/preview do brush na paleta do editor. Geralmente é o "item principal" do doodad. |
| `draggable`       | não | `true` / `false`                            | Se `true`, o brush pode ser "arrastado" para pintar uma área contínua (em vez de clique único). Usado em `doodad`. |
| `on_blocking`     | não | `true` / `false`                            | Permite colocar o doodad sobre um tile marcado como bloqueado (ex.: paredes/objetos que bloqueiam passagem). |
| `thickness`       | não | fração `"N/100"` (também vistos `1/1`, `1/50`, `1/500`, `2/15`, `6/10`, `11/90`) | Densidade/probabilidade de o doodad aparecer ao pintar com brush aleatório de área — quanto maior a fração, mais denso. |
| `on_duplicate`    | não | `true`                                      | Permite duplicar/repetir o item ao "borrar" áreas (comportamento de auto-preenchimento). |
| `one_size`        | não | `true`                                      | Marca o doodad como de "tamanho único" — usado em conjunto com `redo_borders`, tipicamente em rampas e objetos compostos que não devem ser tratados como parte de bordas de terreno normais. |
| `redo_borders`    | não | `true`                                      | Força o recálculo das bordas (autoborder) do terreno ao redor após colocar o doodad. Comum em `ramp`s. |
| `reborder`        | não | `true`                                      | Similar a `redo_borders`; refaz as bordas ao redor de doodads grandes/compostos (ex.: `turtle`, `demon oak`). |

Exemplo mínimo:

```xml
<brush name="palm trees" type="doodad"
    server_lookid="2725" draggable="true" on_blocking="false" thickness="12/100">
    <item id="2725" chance="10" />
    <item id="2726" chance="10" />
</brush>
```

---

## 2. `type="doodad"` — o tipo mais comum

Brushes de decoração genérica (árvores, grama, pedras, objetos). O conteúdo interno
pode ser qualquer combinação dos elementos abaixo.

### 2.1 `<item>` — item simples

```xml
<item id="6218" chance="12" />
```

| Atributo | Obrigatório | Descrição |
|----------|:-----------:|-----------|
| `id`     | sim | ID do item do `items.otb`/`items.xml`. |
| `chance` | não (obrigatório em listas de variação) | Peso relativo de sorteio entre os itens do mesmo brush. Não precisa somar 100 — é apenas peso relativo. `chance="0"` existe (item nunca sorteado sozinho, ver seção sobre portas). |

Vários `<item>` soltos dentro de um `<brush>` = lista simples de variações
aleatórias de 1 tile (ex.: touceiras de grama, tocos, pedras soltas).

### 2.2 `<alternate>` — grupo de variações independente

```xml
<alternate>
    <item id="6960" chance="10" />
</alternate>
<alternate>
    <item id="6961" chance="10" />
</alternate>
```

Cada `<alternate>` é um "slot" de variação separado. Diferente de itens soltos no
mesmo brush (que competem entre si por chance), cada `<alternate>` pode conter seu
próprio item ou `<composite>`, e o editor trata cada bloco como uma alternativa
completa e independente (útil para variações de objetos grandes, como diferentes
poses de um mesmo doodad, ou para orientações diferentes, indicadas por comentários
inline: `<alternate> -- south --`, `<alternate> -- east --`).

### 2.3 `<composite>` — objeto multi-tile

Usado quando o doodad ocupa **mais de um tile** (ex.: árvores grandes, criaturas
decorativas, ruínas). Cada `<composite>` representa uma variação completa do objeto;
dentro dele, cada `<tile>` define o deslocamento relativo ao tile onde o usuário
clicou.

```xml
<composite chance="10">
    <tile x="0" y="0">
        <item id="8793" />
    </tile>
    <tile x="-1" y="0">
        <item id="8794" />
    </tile>
</composite>
```

| Atributo (composite) | Descrição |
|---|---|
| `chance` | Peso de sorteio dessa variação composta em relação às outras (outros `<item>`/`<composite>` no mesmo brush ou `<alternate>`). |

| Atributo (tile) | Descrição |
|---|---|
| `x`, `y` | Deslocamento em tiles a partir do ponto de origem (podem ser negativos). `x="0" y="0"` é o tile clicado. |
| `z`      | Opcional. Deslocamento de andar/piso (visto como `z="-1"`), usado para colocar um item "embaixo" (ex.: base/sombra de uma rampa) no mesmo tile. |

Cada `<tile>` pode conter um ou mais `<item>` (com ou sem `chance`).

Exemplo de rampa (`one_size` + `redo_borders`, usando `z` para o item de base):

```xml
<brush name="ramp" type="doodad" server_lookid="1395" draggable="true"
    on_blocking="false" one_size="true" redo_borders="true">
    <alternate>
        <composite chance="10">
            <tile x="0" y="0">
                <item id="1394" />
            </tile>
            <tile x="0" y="0" z="-1">
                <item id="459" />
            </tile>
            <tile x="0" y="1">
                <item id="1395" />
            </tile>
        </composite>
    </alternate>
</brush>
```

### 2.4 Combinação item + composite no mesmo brush

É comum misturar variações de 1 tile com variações multi-tile no mesmo brush —
o editor sorteia entre todas com base no `chance` de cada uma:

```xml
<brush name="broken palm trees" type="doodad" server_lookid="8792" draggable="true"
    on_blocking="false" thickness="12/100">
    <item id="8792" chance="10" />
    <composite chance="10">
        <tile x="0" y="0"><item id="8793" /></tile>
        <tile x="-1" y="0"><item id="8794" /></tile>
    </composite>
    <composite chance="10">
        <tile x="0" y="0"><item id="8795" /></tile>
        <tile x="0" y="-1"><item id="8796" /></tile>
    </composite>
</brush>
```

---

## 3. `type="carpet"` — bordas automáticas de "tapete"

Usado para doodads que cobrem áreas no chão e precisam de auto-bordas conforme os
tiles vizinhos (grama, gravetos, poças, cristais espalhados, etc.). Não usa `<item>`;
usa a tag `<carpet>` com um `id` fixo por posição de borda.

```xml
<brush name="ice floe" type="carpet" server_lookid="7145">
    <carpet align="n"      id="7147" />
    <carpet align="e"      id="7148" />
    <carpet align="s"      id="7146" />
    <carpet align="w"      id="7149" />
    <carpet align="cnw"    id="7152" />
    <carpet align="cne"    id="7153" />
    <carpet align="cse"    id="7150" />
    <carpet align="csw"    id="7151" />
    <carpet align="dnw"    id="7157" />
    <carpet align="dne"    id="7156" />
    <carpet align="dse"    id="7154" />
    <carpet align="dsw"    id="7155" />
    <carpet align="center" id="7145" />
</brush>
```

Valores de `align` observados (12 posições de borda + centro — o mesmo esquema do
sistema de "borders" do RME):

| `align` | Significado |
|---|---|
| `n`, `s`, `e`, `w` | Borda reta (Norte/Sul/Leste/Oeste). |
| `cnw`, `cne`, `cse`, `csw` | Canto côncavo (interno) — Noroeste/Nordeste/Sudeste/Sudoeste. |
| `dnw`, `dne`, `dse`, `dsw` | Canto diagonal/convexo (externo) — Noroeste/Nordeste/Sudeste/Sudoeste. |
| `center` | Tile totalmente cercado pelo mesmo carpet (preenchimento). `center` costuma repetir o mesmo id de `server_lookid`. Alguns brushes omitem `center` (ex.: variações "(tiny)"). |

Nem todo brush de carpet define as 13 posições — alguns só definem `n/e/s/w` +
cantos, sem `center`, dependendo do item.

---

## 4. `type="wall"` — decorações que seguem paredes

Usado para objetos que devem se orientar automaticamente conforme o traçado da
parede (trilhas, galhos, correntes, etc.), reaproveitando o sistema de auto-parede.
Usa a tag `<wall type="...">`, cada uma contendo um ou mais `<item>` (com `chance`).

```xml
<brush name="branches" type="wall" server_lookid="4233">
    <wall type="horizontal">
        <item id="4233" chance="1" />
        <item id="4234" chance="1" />
    </wall>
    <wall type="vertical">
        <item id="4231" chance="1" />
        <item id="4232" chance="1" />
    </wall>
    <wall type="pole">
        <item id="4229" chance="1" />
    </wall>
</brush>
```

Valores de `type` (do elemento `<wall>`) observados no arquivo:

| `type` | Significado |
|---|---|
| `horizontal` | Segmento reto horizontal. |
| `vertical` | Segmento reto vertical. |
| `pole` | Poste isolado (ponta única, sem continuação). |
| `corner` | Curva de 90°. |
| `intersection` | Cruzamento (4 direções). |
| `north end`, `south end`, `east end`, `west end` | Ponta/extremidade da parede em cada direção. |
| `north T`, `south T`, `east T`, `west T` | Junção em T voltada para cada direção. |
| `northeast diagonal`, `northwest diagonal`, `southeast diagonal`, `southwest diagonal` | Segmentos diagonais. |

### 4.1 `<door>` dentro de `<wall>`

Paredes do tipo `wall` podem incluir portas/janelas como alternativa ao item normal
daquele segmento:

```xml
<wall type="horizontal">
    <item id="1623" chance="1" />
    <door id="1636" type="any door" open="false" hate="true" />
    <door id="1637" type="any door" open="true"  hate="true" />
</wall>
```

| Atributo | Valores observados | Descrição |
|---|---|---|
| `id`     | ID de item | Item da porta/janela. |
| `type`   | `any door`, `any window` | Categoria funcional reconhecida pelo servidor/editor. |
| `open`   | `true` / `false` | Define se este `id` representa o estado aberto ou fechado da porta. |
| `hate`   | `true` (opcional, só em `any door`) | Marca a porta como "hate door" (porta de quest/monstro, não abre por clique normal do jogador). Não aparece em `any window`. |

---

## 5. `type="table"` — mesas e objetos com orientação linear

Similar a `wall`, mas para objetos apoiados no chão que se conectam lado a lado
(mesas, bancadas). Usa a tag `<table align="...">`.

```xml
<brush name="log" type="table" server_lookid="4191">
    <table align="north">
        <item id="4194" chance="10" />
    </table>
    <table align="vertical">
        <item id="4195" chance="40" />
        <item id="4196" chance="10" />
        <item id="4197" chance="10" />
        <item id="4198" chance="15" />
        <item id="4199" chance="15" />
        <item id="4200" chance="20" />
    </table>
</brush>
```

Valores de `align` observados:

| `align` | Significado |
|---|---|
| `alone` | Peça isolada, sem vizinhos do mesmo table. |
| `horizontal` | Segmento de mesa na horizontal (entre duas peças). |
| `vertical` | Segmento de mesa na vertical. |
| `north`, `south`, `east`, `west` | Ponta da mesa voltada para aquela direção. |

---

## 6. Resumo rápido de todos os elementos filhos possíveis

| Elemento | Onde aparece | Atributos |
|---|---|---|
| `<item>` | direto em `<brush>`, dentro de `<alternate>`, `<tile>`, `<wall>`, `<table>` | `id` (sempre), `chance` (opcional/quando há variação) |
| `<alternate>` | direto em `<brush>` (tipo `doodad`) | nenhum atributo — apenas agrupa uma variação |
| `<composite>` | direto em `<brush>` ou dentro de `<alternate>` | `chance` |
| `<tile>` | dentro de `<composite>` | `x`, `y`, `z` (opcional) |
| `<carpet>` | direto em `<brush>` (tipo `carpet`) | `align`, `id` |
| `<wall>` | direto em `<brush>` (tipo `wall`) | `type` |
| `<door>` | dentro de `<wall>` | `id`, `type`, `open`, `hate` (opcional) |
| `<table>` | direto em `<brush>` (tipo `table`) | `align` |

---

## 7. Checklist para criar um novo doodad

1. Escolher o `type` certo:
   - decoração livre / multi-tile → `doodad`
   - "tapete" com bordas automáticas → `carpet`
   - segue traçado de parede → `wall`
   - mesa/objeto linear apoiado no chão → `table`
2. Definir `server_lookid` com o item que melhor representa o doodad na paleta.
3. Para doodad simples de 1 tile: listar `<item id="..." chance="..." />` direto no
   `<brush>`.
4. Para doodad multi-tile: usar `<composite chance="...">` com um `<tile x=".." y="..">`
   por posição ocupada, cada um com seu `<item>`. Usar `z="-1"` se precisar de um item
   de base no mesmo tile (ex.: sombra/base de rampa).
5. Para variações mutuamente exclusivas mais "fortes" (ex.: poses/orientações
   diferentes de um objeto grande), envolver cada opção em `<alternate>...</alternate>`.
6. Para `carpet`: definir todas as 12 posições de borda (`n/e/s/w`, `cnw/cne/cse/csw`,
   `dnw/dne/dse/dsw`) e, se aplicável, `center`.
7. Para `wall`: cobrir ao menos `horizontal`, `vertical`, `pole`, `corner`,
   `intersection` e os `end`/`T` necessários; adicionar `<door>` se o segmento tiver
   variante de porta/janela.
8. Para `table`: cobrir `alone`, `horizontal`, `vertical` e as pontas
   `north/south/east/west` necessárias.
9. Ajustar `thickness` (probabilidade de pintura em área), `draggable`,
   `on_blocking`, e — se o objeto exigir recalcular bordas do terreno ao redor —
   `one_size` + `redo_borders` (objetos "de tamanho fixo", ex. rampas) ou
   `reborder` (objetos grandes que alteram bordas vizinhas, ex. árvores/criaturas
   grandes).
