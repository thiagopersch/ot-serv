/** Textos em pt-BR (rótulos e explicações do (i)) do formulário de itens. O valor gravado no
 * banco/XML continua sendo a chave em inglês — aqui só muda o que o admin lê na tela. As
 * explicações foram escritas a partir do que o servidor C++ faz (items.cpp, item.cpp, tile.cpp,
 * player.cpp, game.cpp). */

export const FLAG_LABELS: Record<string, string> = {
  blocking: "Bloqueia passagem (blocking)",
  blockProjectile: "Bloqueia projéteis (blockProjectile)",
  blockPathfind: "Bloqueia rota de monstros (blockPathfind)",
  walkStack: "Permite empilhar criaturas (walkStack)",
  movable: "Movível (movable)",
  pickupable: "Pode ser pego (pickupable)",
  allowPickupable: "Aceita itens pegáveis por cima (allowPickupable)",
  rotable: "Rotacionável (rotable)",
  showCount: "Mostrar quantidade (showCount)",
  canReadText: "Pode ler texto (canReadText)",
  allowDistRead: "Ler de longe (allowDistRead)",
  preventLoss: "Protege contra perda (preventLoss)",
  preventDrop: "Protege contra drop (preventDrop)",
  dualWield: "Duas mãos / dual wield (dualWield)",
  invisible: "Invisibilidade (invisible)",
  forceSerialize: "Forçar salvamento (forceSerialize)",
  replacable: "Substituível (replacable)",
};

export const FLAG_TOOLTIPS: Record<string, string> = {
  blocking:
    "O item ocupa o tile inteiro: jogadores e monstros não conseguem andar por cima. Use em paredes, pedras, árvores e móveis grandes.",
  blockProjectile:
    "Barra flechas, magias e projéteis que passam pelo tile. Sem isso dá pra atirar através do item.",
  blockPathfind:
    "Monstros e o caminhar automático desviam do tile, e magias de área agressivas não são lançadas nele. Use em itens que não devem ser pisados (ex.: armadilhas, fogo).",
  walkStack:
    "Padrão: ligado. Se desligar, uma criatura não pode entrar (nem ser empurrada) para um tile que já tenha outra criatura em cima deste item.",
  movable:
    "Padrão: ligado. Desligado = ninguém consegue arrastar ou empurrar o item. Se também bloquear passagem, ele vira um obstáculo fixo. Itens imóveis só são salvos no mapa se 'Forçar salvamento' estiver ligado.",
  pickupable:
    "O jogador pode pegar o item e guardar na mochila. Sem isso ele só fica no chão. Atenção: no servidor o padrão é desligado.",
  allowPickupable:
    "Permite colocar itens pegáveis por cima deste item mesmo bloqueando o tile (ex.: balcão de loja com itens em cima). Também faz o 'usar' priorizar o que está embaixo.",
  rotable:
    "Marca o item como girável (ex.: móveis). Só funciona junto com 'Rotacionar para' (aba Decay/Transformação). Obs.: o servidor lê essa flag do .otb, não do items.xml — no XML ela é ignorada e gera aviso no log.",
  showCount:
    "Padrão: ligado. Em itens empilháveis, mostra 'N unidades' ao olhar o item. Desligue para ocultar a quantidade.",
  canReadText:
    "Permite ler o texto do item. Equivale a 'Legível' (aba Container/Texto). Obs.: o servidor não lê essa chave do items.xml, use o campo 'Legível'.",
  allowDistRead:
    "Permite ler o texto olhando de longe (ex.: placas). Obs.: o servidor lê isso só do .otb; no items.xml a chave não é reconhecida.",
  preventLoss:
    "Ao morrer o item é consumido (perde 1 carga ou some) no lugar de o jogador perder experiência/skills. Funciona como um amuleto de proteção.",
  preventDrop:
    "Ao morrer o item é consumido em vez de cair no corpo (loot). Funciona como uma proteção contra perda de itens.",
  dualWield:
    "Permite segurar o item nas duas mãos junto com outro item dual wield (duas armas). Aparece como 'dual wielding' na descrição.",
  invisible:
    "Ao equipar, o jogador fica invisível. Aparece como 'invisibility' na descrição do item.",
  forceSerialize:
    "Obriga o servidor a salvar o item no mapa/casas mesmo que ele não seja movível. Use em itens fixos que guardam dados (ex.: texto, ação).",
  replacable:
    "Padrão: ligado. Usado em campos mágicos: um campo novo pode substituir este que já está no tile.",
};

export const SKILL_LABELS: Record<string, string> = {
  sword: "Espada (sword)",
  axe: "Machado (axe)",
  club: "Clava (club)",
  distance: "Distância (distance)",
  shielding: "Escudo (shielding)",
  fishing: "Pesca (fishing)",
  fist: "Punho (fist)",
};

export const SKILL_TOOLTIP =
  "Bônus (ou penalidade, se negativo) somado à skill do jogador enquanto o item estiver equipado.";

export const ELEMENT_LABELS: Record<string, string> = {
  physical: "Físico (physical)",
  fire: "Fogo (fire)",
  energy: "Energia (energy)",
  earth: "Terra (earth)",
  ice: "Gelo (ice)",
  holy: "Sagrado (holy)",
  death: "Morte (death)",
  lifeDrain: "Drenar vida (lifeDrain)",
  manaDrain: "Drenar mana (manaDrain)",
  healing: "Cura (healing)",
  undefined: "Indefinido (undefined)",
  drown: "Afogamento (drown)",
  magic: "Mágico (magic)",
  all: "Todos (all)",
};

export const ELEMENT_DAMAGE_TOOLTIP =
  "Valor de dano deste elemento que a arma causa além do ataque físico. O servidor usa um elemento por arma.";
export const ABSORB_TOOLTIP =
  "Porcentagem do dano deste tipo que o jogador NÃO recebe enquanto usar o item (100 = imune, negativo = recebe mais dano).";
export const FIELD_ABSORB_TOOLTIP =
  "Porcentagem de proteção contra o dano contínuo de campos mágicos deste elemento (fogo, energia, terra).";
export const REFLECT_PERCENT_TOOLTIP =
  "Porcentagem do dano recebido deste tipo que é devolvido ao atacante quando a reflexão acontece.";
export const REFLECT_CHANCE_TOOLTIP =
  "Chance (%) de a reflexão deste tipo de dano acontecer a cada golpe recebido.";

export const SUPPRESS_LABELS: Record<string, string> = {
  energy: "Energia (energy)",
  fire: "Fogo (fire)",
  earth: "Terra / veneno (earth)",
  ice: "Gelo (ice)",
  holy: "Sagrado (holy)",
  death: "Morte (death)",
  drown: "Afogamento (drown)",
  physical: "Sangramento (physical)",
  haste: "Velocidade / haste (haste)",
  paralyze: "Paralisia (paralyze)",
  drunk: "Embriaguez (drunk)",
  regeneration: "Regeneração (regeneration)",
  soul: "Alma (soul)",
  outfit: "Mudança de outfit (outfit)",
  invisible: "Invisibilidade (invisible)",
  inFight: "Em combate (inFight)",
  exhaustion: "Exaustão (exhaustion)",
  muted: "Silenciado (muted)",
  pacified: "Pacificado (pacified)",
  light: "Luz (light)",
  attributes: "Atributos (attributes)",
  manaShield: "Escudo de mana (manaShield)",
  lifeDrain: "Drenar vida (lifeDrain)",
};

export const SUPPRESS_TOOLTIP =
  "Enquanto o item estiver equipado, o jogador fica imune a esta condição: ela não é aplicada nele.";

export const ENUM_LABELS: Record<string, Record<string, string>> = {
  type: {
    container: "Container",
    key: "Chave (key)",
    magicfield: "Campo mágico (magicfield)",
    depot: "Depot",
    mailbox: "Caixa de correio (mailbox)",
    trashholder: "Lixeira (trashholder)",
    teleport: "Teleporte (teleport)",
    door: "Porta (door)",
    bed: "Cama (bed)",
    rune: "Runa (rune)",
  },
  weaponType: {
    sword: "Espada (sword)",
    club: "Clava (club)",
    axe: "Machado (axe)",
    shield: "Escudo (shield)",
    distance: "Distância (distance)",
    wand: "Varinha/cajado (wand)",
    ammunition: "Munição (ammunition)",
    fist: "Punho (fist)",
  },
  slotType: {
    head: "Cabeça (head)",
    body: "Corpo (body)",
    legs: "Pernas (legs)",
    feet: "Pés (feet)",
    backpack: "Mochila (backpack)",
    "two-handed": "Duas mãos (two-handed)",
    necklace: "Colar (necklace)",
    ring: "Anel (ring)",
    ammo: "Munição (ammo)",
    hand: "Mão (hand)",
  },
  floorChange: {
    down: "Descer (down)",
    north: "Norte (north)",
    south: "Sul (south)",
    west: "Oeste (west)",
    east: "Leste (east)",
    northex: "Norte estendido (northex)",
    southex: "Sul estendido (southex)",
    westex: "Oeste estendido (westex)",
    eastex: "Leste estendido (eastex)",
  },
  fieldType: {
    fire: "Fogo (fire)",
    energy: "Energia (energy)",
    earth: "Terra (earth)",
    poison: "Veneno (poison)",
    ice: "Gelo (ice)",
    freezing: "Congelamento (freezing)",
    holy: "Sagrado (holy)",
    dazzled: "Ofuscado (dazzled)",
    death: "Morte (death)",
    cursed: "Amaldiçoado (cursed)",
    drown: "Afogamento (drown)",
    physical: "Físico (physical)",
  },
};

export const FIELD_HELP = {
  id: "Número do item no servidor (o mesmo id usado nos scripts e no items.xml). Deve ser único.",
  name: "Nome exibido ao jogador ao olhar o item.",
  article: "Artigo que vem antes do nome na descrição, ex.: 'a' ou 'an' ('You see a sword').",
  plural: "Nome no plural, usado em itens empilháveis (ex.: 'gold coins').",
  editorSuffix:
    "Texto extra só para o editor de mapas (RME) diferenciar itens parecidos. Não aparece no jogo.",
  type: "Categoria especial do item. Define comportamento próprio: container abre como bolsa, teleport leva a outro lugar, door é porta, bed é cama etc. Deixe vazio para item comum.",
  clientId:
    "Id da sprite (imagem) no cliente do jogo. É diferente do id do servidor: vários ids do servidor podem usar a mesma sprite.",
  description: "Texto adicional mostrado ao olhar o item (após o nome e atributos).",
  published:
    "Se ligado, o item aparece nas páginas públicas do site (Gameplay > Itens). Não afeta o servidor do jogo.",
  weight: "Peso em oz, como no Tibia (ex.: 25.50). Digite com ponto ou vírgula; no items.xml é gravado ×100 (2550). Afeta a capacidade do jogador.",
  worth: "Valor em gold do item. Usado como moeda (ex.: gold coin = 1, platinum = 100) e no cálculo de valor de troca.",
  weaponType: "Tipo da arma. Define qual skill é usada e como o ataque funciona. Deixe vazio se não for arma.",
  slotType: "Em qual espaço do corpo o item é equipado (cabeça, corpo, mão etc.). Vazio = não equipável.",
  ammoType: "Tipo de munição que a arma de distância usa (ex.: arrow, bolt) ou que a munição representa.",
  ammoAction: "O que acontece com a munição ao ser usada (ex.: removecount gasta uma unidade).",
  shootType: "Animação do projétil disparado (ex.: arrow, bolt, spear).",
  effect: "Efeito visual que aparece ao usar o item (ex.: em armas de área ou munição).",
  corpseType: "Tipo de sangue/corpo deixado ao acertar (ex.: venom, blood, undead).",
  armor: "Pontos de armadura: reduzem o dano físico recebido enquanto o item estiver equipado.",
  defense: "Valor de defesa de escudos e armas: chance de bloquear golpes corpo a corpo.",
  extraDefense: "Bônus fixo de defesa somado à defesa base (aparece como '+N' na descrição).",
  attack: "Valor de ataque da arma. Quanto maior, mais dano.",
  extraAttack: "Bônus fixo de ataque somado ao ataque base (aparece como '+N' na descrição).",
  attackSpeed: "Intervalo entre ataques, em milissegundos. Quanto menor, mais rápido bate.",
  range: "Alcance máximo em tiles de armas de distância e varinhas.",
  hitChance: "Chance de acerto (%) de armas de distância. Vazio (-1) usa o padrão.",
  maxHitChance: "Limite máximo da chance de acerto (%), mesmo com skill alta.",
  breakChance: "Chance (%) de a munição quebrar e sumir após acertar o alvo.",
  runeSpellName: "Nome da magia lançada por esta runa. O XML sempre usa este texto.",
  decayTo:
    "Id do item em que este se transforma quando a duração acaba. Use 0 para o item simplesmente sumir; vazio para não decair.",
  duration: "Tempo (em segundos) até o item decair. Só tem efeito com 'Decair para' preenchido.",
  stopDuration: "Pausa o contador de duração quando o item está guardado (fora do chão/equipado).",
  showDuration: "Mostra na descrição quanto tempo o item ainda dura (ex.: tochas, poções de tempo).",
  transformEquipTo: "Item no qual este vira automaticamente ao ser equipado (ex.: anel apagado → aceso).",
  transformDeEquipTo: "Item no qual este vira ao ser retirado do corpo.",
  transformTo: "Item no qual este vira ao ser usado (ex.: alavanca esquerda → direita).",
  maleTransformTo: "Item no qual a cama vira quando um personagem masculino deita nela.",
  femaleTransformTo: "Item no qual a cama vira quando uma personagem feminina deita nela.",
  floorChange:
    "Faz o tile mudar o jogador de andar ao pisar (escadas, buracos, rampas). A direção indica para onde ele é levado.",
  rotateTo: "Id do item resultante ao girar este item. Precisa da flag 'Rotacionável' ligada.",
  charges: "Quantidade de usos do item. Cada uso gasta uma carga; ao zerar, o item some ou decai.",
  showCharges: "Mostra na descrição quantas cargas ainda restam.",
  showAttributes:
    "Força a descrição a listar armadura, bônus e proteções mesmo que o item não seja arma/armadura.",
  containerSize: "Quantidade de slots (espaços) do container. Também aparece como 'Vol:N' na descrição.",
  readable: "Permite ao jogador ler o texto do item ao usá-lo/olhá-lo (livros, placas).",
  writeable: "Permite ao jogador escrever texto no item (também o torna legível).",
  maxTextLen: "Limite de caracteres que podem ser escritos no item.",
  writeOnceItemId: "Depois de escrito uma vez, o item vira este outro id (ex.: papel em branco → carta escrita).",
  lightLevel: "Intensidade da luz emitida (0 a 255). Quanto maior, mais ilumina ao redor.",
  lightColor: "Cor da luz emitida, pelo índice de cor do Tibia (0 a 215).",
  speed: "Bônus de velocidade ao equipar (positivo acelera, negativo atrasa). No jogo o valor é dividido por 2.",
  healthGain: "Quanto de vida é recuperado a cada intervalo enquanto o item estiver equipado.",
  healthTicks: "Intervalo (ms) entre cada recuperação de vida.",
  manaGain: "Quanto de mana é recuperada a cada intervalo enquanto o item estiver equipado.",
  manaTicks: "Intervalo (ms) entre cada recuperação de mana.",
  manaShield: "Ao equipar, o dano recebido é retirado da mana antes da vida.",
  soulPoints: "Bônus fixo de pontos de alma (soul) do jogador ao equipar.",
  soulPointsPercent: "Bônus percentual de pontos de alma ao equipar.",
  maxHitPoints: "Bônus fixo de vida máxima ao equipar.",
  maxHitPointsPercent: "Bônus percentual de vida máxima ao equipar.",
  maxManaPoints: "Bônus fixo de mana máxima ao equipar.",
  maxManaPointsPercent: "Bônus percentual de mana máxima ao equipar.",
  magicLevelPoints: "Bônus fixo de magic level ao equipar.",
  magicLevelPointsPercent: "Bônus percentual de magic level ao equipar.",
  increaseMagicValue: "Dano de magia aumentado em um valor fixo enquanto equipado.",
  increaseMagicPercent: "Dano de magia aumentado em % enquanto equipado.",
  increaseHealingValue: "Cura das magias aumentada em um valor fixo enquanto equipado.",
  increaseHealingPercent: "Cura das magias aumentada em % enquanto equipado.",
  fieldEnabled: "Marque quando o item for um campo mágico (fogo, veneno...) que causa dano ao pisar.",
  fieldValue: "Tipo do dano causado pelo campo ao jogador que pisa nele.",
  fieldTicks: "Intervalo (ms) entre cada dano do campo.",
  fieldCount: "Quantas vezes o dano é aplicado antes de acabar.",
  fieldStart: "Dano inicial aplicado assim que a criatura pisa no campo.",
  fieldDamage: "Dano de cada aplicação seguinte (cada linha é um tick; a última se repete).",
} as const;

/** Rótulos dos campos de topo do `ItemInput` — os mesmos `label` usados no formulário de itens,
 * reaproveitados pela tabela de comparação (dialog de conflito de id). */
export const ITEM_FIELD_LABELS: Record<string, string> = {
  id: "ID (server id)",
  clientId: "Client ID (sprite no cliente)",
  name: "Nome (Name)",
  lookTypeId: "Sprite",
  article: "Artigo (article)",
  plural: "Plural",
  editorSuffix: "Sufixo do editor (RME, cosmético)",
  description: "Descrição (Description)",
  published: "Publicado no site",
  type: "Tipo (type)",
  weaponType: "Tipo de arma (Weapon type)",
  slotType: "Tipo de slot (Slot type)",
  ammoType: "Tipo de munição (Ammo type)",
  ammoAction: "Ação de munição (Ammo action)",
  corpseType: "Tipo de corpo (Corpse type)",
  shootType: "Tipo de projétil (Shoot type)",
  effect: "Efeito visual (Effect)",
  fluidSource: "Fonte de fluido (Fluid source)",
  floorChange: "Direção (Floor change)",
  weight: "Peso (Weight)",
  worth: "Valor (Worth)",
  armor: "Armadura (Armor)",
  defense: "Defesa (Defense)",
  extraDefense: "Defesa extra (Extra defense)",
  attack: "Ataque (Attack)",
  extraAttack: "Ataque extra (Extra attack)",
  attackSpeed: "Velocidade de ataque (Attack speed)",
  range: "Alcance (Range)",
  hitChance: "Chance de acerto (Hit chance)",
  maxHitChance: "Chance máxima de acerto (Max hit chance)",
  breakChance: "Chance de quebra (Break chance)",
  containerSize: "Tamanho do container (Container size)",
  maxTextLen: "Tamanho máximo do texto (Max text length)",
  writeOnceItemId: "Vira este item após escrever (Write once item id)",
  readable: "Legível (Readable)",
  writeable: "Escrevível (Writeable)",
  decayTo: "Decair para (Decay to)",
  duration: "Duração em segundos (Duration)",
  stopDuration: "Pausar duração (Stop duration)",
  showDuration: "Mostrar duração (Show duration)",
  transformTo: "Transformar ao usar (Transform to)",
  transformEquipTo: "Transformar ao equipar (Transform equip to)",
  transformDeEquipTo: "Transformar ao desequipar (Transform de-equip to)",
  rotateTo: "Rotacionar para (Rotate to)",
  maleTransformTo: "Cama: ocupada por homem (Male transform to)",
  femaleTransformTo: "Cama: ocupada por mulher (Female transform to)",
  charges: "Cargas (Charges)",
  showCharges: "Mostrar cargas (Show charges)",
  showAttributes: "Mostrar atributos (Show attributes)",
  lightLevel: "Nível de luz (Light level)",
  lightColor: "Cor da luz (Light color)",
  speed: "Velocidade (Speed)",
  healthGain: "Ganho de vida (Health gain)",
  healthTicks: "Intervalo de vida (Health ticks)",
  manaGain: "Ganho de mana (Mana gain)",
  manaTicks: "Intervalo de mana (Mana ticks)",
  manaShield: "Escudo de mana (Mana shield)",
  maxHitPoints: "Vida máxima (Max HP)",
  maxHitPointsPercent: "Vida máxima % (Max HP %)",
  maxManaPoints: "Mana máxima (Max mana)",
  maxManaPointsPercent: "Mana máxima % (Max mana %)",
  magicLevelPoints: "Nível mágico (Magic level)",
  magicLevelPointsPercent: "Nível mágico % (Magic level %)",
  soulPoints: "Pontos de alma (Soul points)",
  soulPointsPercent: "Pontos de alma % (Soul points %)",
  increaseMagicValue: "Aumento de dano mágico (Increase magic)",
  increaseMagicPercent: "Aumento de dano mágico % (Increase magic %)",
  increaseHealingValue: "Aumento de cura (Increase healing)",
  increaseHealingPercent: "Aumento de cura % (Increase healing %)",
  runeSpellName: "Nome da magia da runa (Rune spell name)",
  "field.enabled": "Este item tem bloco de campo",
  "field.value": "Tipo de dano",
  "field.ticks": "Intervalo em ms (Ticks)",
  "field.count": "Repetições (Count)",
  "field.start": "Dano inicial (Start)",
  "field.damages": "Danos seguintes (Damages)",
  extraAttributes: "Atributos extras (attribute key)",
};
