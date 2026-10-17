Contexto:
Estou desenvolvendo um servidor de OTServ Tibia 8.60 utilizando OTCv8/OpenGL ES 2.0 e preciso criar shaders `.frag` altamente visuais, otimizadas e compatíveis com sprites de creatures/outfits do Tibia.

Objetivo:
Crie uma shader `.frag` COMPLETA, PROFISSIONAL e PRONTA PARA USO no OTCv8, baseada na temática:
"[TEMA_DO_SHADER]"

Exemplos de tema:

- Dragon Ball Ultra Instinct
- Naruto Kurama Chakra
- Bleach Reiatsu
- Solo Leveling Shadow Monarch
- Nanatsu Demon Aura
- Fogo anime
- Aura elétrica
- Aura sombria
- Chakra flamejante
- Energy distortion
- Susanoo
- Amaterasu
- Kaioken
- Bankai
- Shadow extraction

Requisitos obrigatórios:

1. A shader deve funcionar corretamente em:

- OTCv8
- OTClient
- OpenGL ES 2.0
- GLSL ES
- Tibia 8.60

2. A shader deve respeitar o formato original da creature/sprite:

- NÃO pode ficar quadrada
- O efeito deve acompanhar apenas os pixels visíveis do sprite
- Deve utilizar o alpha da textura corretamente
- Não pode criar blocos/quadrados sólidos ao redor do personagem

3. O efeito deve ser visualmente impressionante e estilo anime AAA:

- Glow
- Distortion
- Dissolve
- Aura dinâmica
- Fogo procedural
- Energia
- Fumaça
- Partículas simuladas
- Ondulações
- Pulsação
- Heat distortion
- Electric arcs
- Outline anime
- Cel shading
- Energy waves
- Noise procedural

4. A shader deve possuir:

- animação contínua via `u_Time`
- intensidade ajustável
- velocidade ajustável
- suporte a glow emissivo
- blend suave
- alpha preservado
- compatibilidade com sprites transparentes

5. A shader deve ser otimizada:

- evitar loops pesados
- evitar múltiplos samples desnecessários
- funcionar bem com muitos players simultaneamente
- manter FPS alto

6. O visual esperado deve:

- parecer um MMORPG anime moderno
- ficar fluido
- ter aparência profissional
- possuir movimento orgânico
- não parecer um simples overlay estático

7. A shader deve incluir:

- comentários explicando cada parte
- parâmetros configuráveis
- constantes organizadas
- código limpo
- estrutura profissional

8. A shader deve utilizar:

- `uniform sampler2D u_Tex0`
- `uniform float u_Time`
- `varying vec2 v_TexCoord`

9. Caso necessário:

- usar noise procedural
- UV distortion
- radial glow
- edge detection
- fresnel effect
- emissive pulse
- scrolling textures simuladas proceduralmente

10. O efeito deve ficar concentrado:

- ao redor da creature
- nas bordas do sprite
- emitindo energia para fora
- sem ultrapassar exageradamente o tamanho do personagem

11. IMPORTANTE:

- NÃO gerar pseudocódigo
- NÃO explicar teoria
- RETORNAR APENAS O CÓDIGO `.frag` COMPLETO
- o código deve estar pronto para copiar e colar
- incluir `void main()`
- incluir todos os uniforms necessários
- incluir precisão GLSL correta

12. O efeito visual esperado é:
    "[DESCRIÇÃO_VISUAL_DETALHADA]"

Exemplos:

- “línguas de fogo saindo do corpo do personagem”
- “sombras líquidas subindo ao redor da creature”
- “energia azul elétrica pulsando violentamente”
- “chakra flamejante estilo Kurama”
- “aura preta com fumaça roxa estilo Shadow Monarch”
- “energia divina branca distorcendo o ar”
- “fogo negro estilo Amaterasu”
- “reiatsu espiritual azul envolvendo o personagem”

13. O shader deve preservar:

- detalhes do outfit
- cores originais do sprite
- transparência
- leitura visual da creature

14. O shader deve adicionar:

- camada extra de energia
- glow procedural
- animação viva
- sensação de poder extremo

15. Estrutura obrigatória de saída:

- Código GLSL completo
- Sem texto adicional
- Sem markdown extra
- Sem explicações
- Apenas o `.frag`

Tema atual:
[TEMA_DO_SHADER]

Descrição visual:
[DESCRIÇÃO_VISUAL_DETALHADA]
