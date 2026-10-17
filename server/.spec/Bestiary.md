Você é um desenvolvedor especialista em OTCv8 (OTClient V8), Lua, OTUI, TFS 0.4 e sistemas de interface inspirados no Tibia Global.
Desenvolva um módulo completo chamado **Bestiary** para OTCv8, utilizando boas práticas de arquitetura, separação de responsabilidades e otimização de performance.

---

# Objetivo

Criar um botão na Top Menu (TopButton) do OTCv8 que abra uma janela de Bestiary inspirada na Bestiary oficial do Tibia, porém adaptada para exibir as criaturas em formato de grade (grid).
O módulo deverá ler todos os monstros configurados no servidor através dos arquivos XML localizados em:

```txt
C:\Users\thiag\Projetos\server-tibia\data\monster
```

---

# Estrutura dos Arquivos

O módulo deverá ser criado em:

```txt
C:\Users\thiag\Projetos\client\modules
```

Contendo:

```txt
game_bestiary.lua
game_bestiary.otui
game_bestiary.otmod
```

---

# Alteração Necessária no XML dos Monstros

Adicionar um novo atributo obrigatório em todos os XML:

```xml
<monster
    name="Demon"
    bestiary="monster">
```

ou

```xml
<monster
    name="Ferumbras"
    bestiary="boss">
```

Valores permitidos:

```txt
monster
boss
```

Este atributo determinará em qual aba da Bestiary a criatura será exibida.

---

# Comunicação Cliente x Servidor

Utilizar Extended Opcode.

O servidor deverá:

1. Ler todos os XML do diretório de monstros.
2. Interpretar:
   - Nome
   - Health
   - Experience
   - Speed
   - Armor
   - Resistências
   - Loot
   - Looktype
   - Categoria Bestiary

3. Montar um JSON.
4. Enviar ao cliente.

---

# Janela Principal

Ao clicar no botão Bestiary deverá abrir uma janela centralizada.

Layout geral:

```txt
+--------------------------------------------------------------+
|                          BESTIARY                            |
+--------------------------------------------------------------+
| [Monsters] [Bosses]                                          |
+--------------------------------------------------------------+
| Search Monster...                                            |
+--------------------------------------------------------------+
|                                                              |
| [ ] [ ] [ ] [ ] [ ]                                          |
| [ ] [ ] [ ] [ ] [ ]                                          |
| [ ] [ ] [ ] [ ] [ ]                                          |
|                                                              |
| Grid de criaturas                                            |
|                                                              |
+--------------------------------------------------------------+
| Página 1 de 20                                               |
+--------------------------------------------------------------+
```

---

# Abas

A janela deverá possuir duas abas:

### Monsters

Exibir apenas:

```xml
bestiary="monster"
```

### Bosses

Exibir apenas:

```xml
bestiary="boss"
```

---

# Ordenação

Todas as criaturas deverão ser exibidas em ordem alfabética crescente.

Exemplo:

```txt
Ancient Scarab
Behemoth
Cyclops
Demon
Dragon
Hydra
Orc
Rat
```

A ordenação deverá ocorrer tanto para Monsters quanto para Bosses.

---

# Exibição em Grid

A listagem NÃO deve ser exibida em formato de lista vertical.

A listagem deverá utilizar um sistema de grid semelhante ao Bestiary moderno.

Regras:

- 5 criaturas por linha.
- Quantidade ilimitada de linhas.
- Scroll vertical.
- Paginação opcional para grandes quantidades.
- Layout responsivo ao tamanho da janela.

Cada criatura deverá ser exibida dentro de um card quadrado.

Exemplo visual:

```txt
+---------+ +---------+ +---------+ +---------+ +---------+
| Sprite  | | Sprite  | | Sprite  | | Sprite  | | Sprite  |
|         | |         | |         | |         | |         |
| Demon   | | Dragon  | | Hydra   | | Orc     | | Rat     |
+---------+ +---------+ +---------+ +---------+ +---------+
```

---

# Card da Criatura

Cada quadrado deverá conter:

### Parte Superior

Sprite renderizada do monstro.

Centralizada.

### Parte Inferior

Nome da criatura.

Exemplo:

```txt
+-------------+
|             |
|   Sprite    |
|             |
|    Demon    |
+-------------+
```

---

# Seleção

Ao clicar em um card:

- Destacar o card selecionado.
- Abrir painel detalhado da criatura.

---

# Painel de Detalhes

O painel deverá abrir abaixo da grade ou ao lado direito, dependendo do espaço disponível.

Inspirado na Bestiary do Tibia Global.

---

# Informações Exibidas

## Cabeçalho

Exibir:

- Sprite ampliada
- Nome
- Barra de progresso da Bestiary

Exemplo:

```txt
Demon

███████████████████████
2500 / 2500
```

---

## Estatísticas

Exibir:

```txt
Health: 8200
Experience: 6000
Speed: 220
Armor: 40
```

---

# Resistências

Exibir barras percentuais semelhantes ao Tibia Global.

Tipos:

```txt
Physical
Earth
Fire
Ice
Energy
Holy
Death
Life Drain
Mana Drain
```

Interpretar automaticamente os elementos definidos no XML.

---

# Sistema de Loot

Na parte inferior do painel.

Separar os itens em:

```txt
Common
Uncommon
Semi-Rare
Rare
Very Rare
```

---

# Classificação de Loot

Utilizar o atributo chance do XML.

```txt
Common:
>= 50000

Uncommon:
10000 - 49999

Semi-Rare:
1000 - 9999

Rare:
100 - 999

Very Rare:
< 100
```

---

# Exibição dos Itens

Cada item deverá exibir:

- Sprite
- Quantidade

Tooltip:

```txt
Item: Demon Shield
Chance: 0.12%
Quantidade: 1
```

---

# Campo de Busca

Adicionar busca instantânea.

Exemplo:

```txt
Search monster...
```

Enquanto o usuário digita:

- Filtrar em tempo real.
- Ignorar maiúsculas/minúsculas, acentos e caracteres especiais.
- Funcionar nas duas abas.

---

# Paginação

Caso existam muitos monstros:

```txt
< Página 1 de 20 >
```

Ou utilizar scroll virtualizado para melhor performance.

---

# Top Button

Adicionar botão ao Top Menu.

Configuração:

```txt
Ícone: C:\Users\thiag\Projetos\client\data\images\bestiary\bestiary.png
Tooltip: Bestiary
height: 32
```

Ação:

```lua
toggle()
```

---

# Performance

O sistema deverá suportar:

- Mais de 2000 monstros.
- Mais de 500 bosses.
- Busca instantânea.
- Carregamento único.
- Cache local.
- Atualização apenas quando receber novos dados do servidor.

---

# Arquitetura

Separar responsabilidades em:

## UI

Responsável pela interface.

## Controller

Responsável pelos eventos.

## Network

Responsável pelos Extended Opcodes.

## Parser

Responsável por interpretar os dados recebidos.

## Cache

Responsável pelo armazenamento local das informações da Bestiary.

---

# Entregáveis

Gerar completamente:

1. game_bestiary.lua
2. game_bestiary.otui
3. game_bestiary.otmod
4. Código do servidor TFS 0.4
5. Sistema de leitura dos XML
6. Sistema Extended Opcode
7. Sistema de cache
8. Sistema de busca
9. Sistema de paginação
10. Sistema de loot
11. Sistema de resistências
12. Sistema de categorização Monsters/Bosses
13. Sistema de grid com 5 criaturas por linha
14. Ordenação alfabética automática
15. Interface visual moderna inspirada na Bestiary oficial do Tibia
16. Código totalmente comentado e pronto para utilização no OTCv8.
17. Se tiver alguma tabela de configuração, deve ser totalmente facil de dar manutenção e totalmente escalável.
