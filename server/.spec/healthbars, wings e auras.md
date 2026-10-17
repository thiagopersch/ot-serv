Contexto: estou desenvolvendo um servidor OTServ Tibia 8.60 utilizando TFS 0.4 customizado com OTClient custom. Recentemente implementei suporte completo a Wings, Auras, Shaders, HealthBars e ManaBars no client, porém o sistema ainda não está integrado corretamente com o servidor. Atualmente todas as features estão sendo exibidas para todos os players automaticamente, sem controle de desbloqueio, persistência ou sincronização com o banco de dados.

Quero que você faça uma análise completa do projeto e implemente um sistema definitivo, totalmente funcional, escalável e persistente, onde todas essas features sejam controladas exclusivamente pelo servidor e sincronizadas corretamente com o client.

Objetivo principal:

- O servidor deve ser a fonte oficial de dados dessas features;
- Tudo deve ser salvo no banco de dados do personagem;
- O player deve manter suas configurações ao trocar de computador ou relogar;
- Apenas features desbloqueadas/adquiridas devem aparecer disponíveis para o player;
- O sistema deve ser preparado para futuras integrações com:
  - Actions;
  - Quests;
  - Eventos;
  - Store/In-game Shop;
  - Doações via website;
  - Rewards automáticas;
  - Comandos administrativos.

Analise toda a estrutura atual do servidor e client e implemente a solução completa seguindo os requisitos abaixo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1] SISTEMA DE PERSISTÊNCIA
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Implemente persistência completa no banco de dados para:

- Wings;
- Auras;
- Shaders;
- HealthBars;
- ManaBars;
- Qualquer outro extOutfit existente.

Crie todas as colunas necessárias no banco de dados, incluindo:

- Equipado atualmente;
- Lista de desbloqueados;
- Configuração visual ativa do personagem.

O sistema deve:

- Carregar automaticamente ao login;
- Atualizar em tempo real ao trocar outfit;
- Persistir ao logout;
- Funcionar em múltiplas máquinas;
- Ser compatível com TFS 0.4.

Verifique:

- Estruturas Player;
- ProtocolGame;
- IOLoginData;
- Creature/Player serialization;
- Network messages;
- Outfits;
- XML loading;
- Banco de dados.
  - o que ja tenho pronto nos schemas do banco de dados para analise: C:\Users\thiag\Projetos\server-tibia\schemas\mysql.sql e C:\Users\thiag\Projetos\server-tibia\schemas\sqlite.sql

━━━━━━━━━━━━━━━━━━━━━━━━━━━
[2] CONTROLE DE DESBLOQUEIO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Atualmente o servidor está exibindo TODOS os wings, auras, shaders e healthbars para qualquer player. Isso NÃO deve acontecer.

Implemente um sistema onde:

- O player veja apenas o que possui desbloqueado;
- O server envie apenas os IDs liberados;
- O client receba apenas o que o player realmente possui;
- A OutfitWindow mostre apenas conteúdos permitidos;
- Features bloqueadas não apareçam visualmente.

Crie:

- Sistema de unlocks;
- Verificação de permissões;
- Estrutura preparada para add/remove unlock;
- Funções reutilizáveis em Lua e C++;
- Compatibilidade futura com website/store.

Exemplos:

- addPlayerWing(player, id)
- removePlayerAura(player, id)
- playerHasShader(player, id)
- getUnlockedHealthbars(player)

━━━━━━━━━━━━━━━━━━━━━━━━━━━
[3] HEALTHBARS E MANABARS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Analise:
C:\Users\thiag\Projetos\server-tibia\data\items\items.xml

e:
C:\Users\thiag\Projetos\server-tibia\data\XML\extoutfits.xml

Objetivos:

- Verificar todas as HealthBars existentes no items.xml;
- Validar quais NÃO existem no extoutfits.xml;
- Criar automaticamente as entradas faltantes no extoutfits.xml;
- Organizar IDs corretamente;
- Evitar conflitos;
- Garantir compatibilidade com client.

Depois:

- Liste todas as novas HealthBars criadas;
- Informe exatamente quais IDs precisam ser adicionados no client;
- Explique onde registrar no client para aparecerem na OutfitWindow.

Também:

- Verifique se ManaBars seguem o mesmo padrão;
- Corrija inconsistências;
- Padronize toda a estrutura.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
[4] SISTEMA DE WINGS E AURAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

As Wings e Auras são outfits/extOutfits configurados em:

C:\Users\thiag\Projetos\server-tibia\data\XML\extoutfits.xml

Analise completamente:

- Parsing XML;
- Carregamento dos extOutfits;
- Envio para o client;
- Aplicação visual;
- Equipamento/remoção;
- Atualização em tempo real.

Garanta:

- Persistência;
- Controle por unlock;
- Equipamento correto;
- Sincronização completa;
- Atualização visual instantânea.

Verifique se:

- IDs estão corretos;
- Client reconhece corretamente;
- OutfitWindow está lendo tudo;
- Existe conflito entre IDs;
- Há problemas de serialização;
- Existem limitações no protocol 8.60.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
[5] SISTEMA DE SHADERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Os shaders NÃO estão funcionando visualmente no personagem.

Analise detalhadamente:

SERVER:

- C:\Users\thiag\Projetos\server-tibia\data\XML\extoutfits.xml

CLIENT:

- C:\Users\thiag\Projetos\client\modules\game_shaders
- C:\Users\thiag\Projetos\client\data\shaders
- C:\Users\thiag\Projetos\client\data\images\shaders

Objetivos:

- Descobrir por que os shaders não estão sendo aplicados;
- Corrigir definitivamente;
- Garantir sincronização server → client;
- Verificar packets;
- Verificar ProtocolGame;
- Verificar Outfit serialization;
- Verificar OTClient rendering;
- Verificar aplicação nos creatures;
- Verificar draw calls;
- Verificar framebuffer/shader binding;
- Verificar nomes, IDs e paths;
- Verificar inicialização do módulo game_shaders;
- Verificar carregamento das texturas;
- Verificar uniforms e bindings;
- Verificar se o shader realmente está sendo aplicado no creature.

O shader deve:

- Ser equipado/desquipado;
- Persistir;
- Ser enviado corretamente pelo servidor;
- Aplicar visualmente no personagem;
- Atualizar em tempo real;
- Funcionar para outros players visualizando o personagem.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
[6] SINCRONIZAÇÃO CLIENT ↔ SERVER
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Faça uma revisão completa da comunicação entre client e server envolvendo:

- Extended opcodes;
- ProtocolGame;
- Outfit packets;
- Creature updates;
- Login packets;
- Change outfit packets;
- Serialization/deserialization;
- extOutfits;
- Cache visual.

Corrija qualquer problema onde:

- O client tenha informações que o servidor não controla;
- O client esteja liberando conteúdo sozinho;
- O server não esteja enviando dados corretamente;
- O visual não atualize em tempo real.

O servidor deve controlar absolutamente tudo.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
[7] ORGANIZAÇÃO E ESCALABILIDADE
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Refatore e organize todo o sistema para:

- Fácil manutenção;
- Fácil expansão futura;
- Código limpo;
- Separação correta de responsabilidades;
- Estrutura modular;
- Evitar hardcodes;
- Facilitar integração futura com website/store.

Crie:

- Managers;
- Helpers;
- Funções reutilizáveis;
- Estruturas de enums;
- Tabelas centralizadas;
- Sistemas de cache;
- APIs Lua reutilizáveis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
[8] RESULTADO ESPERADO
━━━━━━━━━━━━━━━━━━━━━━━━━━━

Ao finalizar:

- Todas as features devem funcionar 100%;
- Apenas unlocks liberados devem aparecer;
- Tudo deve persistir corretamente;
- Shaders devem funcionar visualmente;
- OutfitWindow deve refletir exatamente o estado do servidor;
- Sistema preparado para futuras expansões;
- Sem gambiarra;
- Sem dependência manual no client;
- Código limpo e profissional.

Além da implementação:

- Explique todos os problemas encontrados;
- Explique todas as correções realizadas;
- Liste arquivos alterados;
- Liste tabelas/colunas criadas;
- Liste packets alterados;
- Liste novas funções criadas;
- Informe tudo que ainda precisará ser configurado manualmente no client.
