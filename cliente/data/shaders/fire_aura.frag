uniform mat4 u_Color;
uniform sampler2D u_Tex0;
uniform float u_Time;
varying vec2 v_TexCoord;
varying vec2 v_TexCoord2;
varying vec2 v_TexCoord3;

const float ALPHA_TOLERANCE = 0.1;
const float BLUR_SIZE       = 3.8 / 410.0;

// ── Tunáveis ──────────────────────────────────
const float ANIM_SPEED    = 2.0;   // velocidade geral do fogo
const float FLAME_REACH   = 0.055; // alcance das chamas fora do sprite (UV space)
const float FLAME_DENSITY = 4.0;   // intensidade/opacidade das chamas externas
const float PARTICLE_SPEED = 1.6;  // velocidade de subida das partículas

// ─────────────────────────────────────────────
//  Noise / FBM
// ─────────────────────────────────────────────
float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 19.19);
    return fract(p.x * p.y);
}

float hash1(float n) {
    return fract(sin(n) * 43758.5453);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
        mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
        mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
        u.y
    );
}

float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p  = p * 2.1 + vec2(1.7, 9.2);
        a *= 0.5;
    }
    return v;
}

// ─────────────────────────────────────────────
//  Textura helpers
// ─────────────────────────────────────────────
vec4 blurTexture(vec2 uv, float sz) {
    vec4 c = vec4(0.0);
    for (int x = -1; x <= 1; x++)
        for (int y = -1; y <= 1; y++)
            c += texture2D(u_Tex0, uv + vec2(x,y) * sz) / 9.0;
    return c;
}

float spriteAlpha(vec2 uv) {
    return texture2D(u_Tex0, clamp(uv, 0.001, 0.999)).a;
}

bool isOuterEdge(vec2 uv) {
    vec4 orig = texture2D(u_Tex0, uv);
    vec4 blur = blurTexture(uv, BLUR_SIZE);
    return orig.a < 0.9 && abs(orig.a - blur.a) > 0.01;
}

// ─────────────────────────────────────────────
//  Paleta de fogo: vermelho → laranja → amarelo → branco
// ─────────────────────────────────────────────
vec3 firePalette(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.10, 0.00, 0.00); // brasa escura
    vec3 c1 = vec3(0.95, 0.04, 0.00); // vermelho vivo
    vec3 c2 = vec3(1.00, 0.40, 0.00); // laranja
    vec3 c3 = vec3(1.00, 0.85, 0.00); // amarelo
    vec3 c4 = vec3(1.00, 1.00, 0.80); // branco quente
    if (t < 0.25) return mix(c0, c1, t / 0.25);
    if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
    if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
    return           mix(c3, c4, (t - 0.75) / 0.25);
}

// ─────────────────────────────────────────────
//  PARTÍCULAS DE FOGO
//  Gera N línguas de fogo independentes subindo
//  ao redor do contorno do sprite
// ─────────────────────────────────────────────
vec4 fireParticles(vec2 uv, float t) {
    vec4 result = vec4(0.0);

    // Número de partículas/línguas de fogo
    const int NUM_PARTICLES = 18;

    for (int i = 0; i < NUM_PARTICLES; i++) {
        float fi = float(i);

        // Posição X base de cada partícula ao longo do sprite (distribuídas horizontalmente)
        float seedX = hash1(fi * 3.7 + 1.1);
        float seedY = hash1(fi * 5.3 + 2.2);

        // Cada partícula tem velocidade e fase de subida própria
        float speed   = PARTICLE_SPEED * (0.6 + hash1(fi * 7.1) * 0.8);
        float phase   = hash1(fi * 11.3); // fase de loop 0..1
        float lifetime = 0.4 + hash1(fi * 13.7) * 0.5; // duração do ciclo

        // Ciclo contínuo: a partícula sobe e reinicia
        float cycle = fract(t * speed / lifetime + phase);

        // Posição X da partícula – oscila levemente (chama balança)
        float px = seedX + 0.06 * sin(t * 2.5 + fi * 1.9) * (1.0 - cycle);

        // Posição Y: começa na base/lados do sprite e sobe
        // seedY controla de onde sai: 0 = base, 0.5 = meio, 1 = topo
        // Misturamos base e laterais
        float startY = 0.55 + seedY * 0.45; // emerge mais da base/meio para baixo
        float py = startY - cycle * lifetime * 1.2; // sobe

        // Distância deste pixel à partícula
        vec2 diff = uv - vec2(px, py);

        // Tamanho da partícula varia (começa pequena, cresce e some)
        float pSize = (0.012 + hash1(fi * 17.0) * 0.018)
                    * sin(cycle * 3.14159); // bell curve: nasce, cresce, some

        // Forma da língua de fogo: elipse achatada horizontalmente
        float dist = length(diff * vec2(2.5, 1.0)) / max(pSize, 0.001);

        // Intensidade cai com distância (suave)
        float intensity = smoothstep(1.0, 0.0, dist);

        // Descarta partícula se já saiu da tela (py muito negativo)
        if (py < -0.15 || py > 1.1) intensity = 0.0;

        // Cor baseada no ciclo: base vermelha → amarela na ponta
        float colorT = cycle * 0.85 + 0.1;
        vec3  col    = firePalette(colorT);

        // Transparência: some conforme sobe e no fim do ciclo
        float alpha = intensity * smoothstep(0.0, 0.15, cycle) * smoothstep(1.0, 0.7, cycle);

        // Compositing: acumula partículas (screen blend para não escurecer)
        result.rgb = max(result.rgb, col * alpha);
        result.a   = max(result.a, alpha);
    }

    return result;
}

// ─────────────────────────────────────────────
//  CHAMAS DE BORDA (fogo colado no contorno)
// ─────────────────────────────────────────────
float edgeFlame(vec2 uv, float t) {
    float wobble = 0.07 * sin(t * 1.5 + uv.y * 8.0)
                 + 0.03 * sin(t * 3.3 + uv.y * 16.0);
    vec2 wuv = uv + vec2(wobble, 0.0);

    vec2 nuv1 = wuv * vec2(5.0, 8.0) + vec2(0.0, -t * 1.5);
    float f1  = fbm(nuv1);

    vec2 nuv2 = wuv * vec2(10.0, 14.0) + vec2(3.1, -t * 2.8);
    float f2  = fbm(nuv2) * 0.3;

    float pulse = 0.80 + 0.20 * sin(t * 4.2);
    return clamp((f1 + f2) * pulse, 0.0, 1.0);
}

// Detecta se o pixel está perto do contorno (zona de alcance das chamas)
float nearEdgeDist(vec2 uv) {
    float closest = 1.0;
    float selfA   = spriteAlpha(uv);
    if (selfA > 0.5) return -1.0; // dentro do sprite

    for (int r = 1; r <= 10; r++) {
        float radius = float(r) * FLAME_REACH / 10.0;
        for (int d = 0; d < 8; d++) {
            float angle = float(d) * 0.7854;
            vec2  dir   = vec2(cos(angle), sin(angle));
            float a     = spriteAlpha(uv + dir * radius);
            if (a > 0.5) {
                float nd = float(r) / 10.0;
                if (nd < closest) closest = nd;
            }
        }
    }
    return closest; // 0..1 ou 1.0 se não encontrou
}

// ─────────────────────────────────────────────
//  Main
// ─────────────────────────────────────────────
void main() {
    vec4 texcolor  = texture2D(u_Tex0, v_TexCoord2);
    vec4 texcolor3 = texture2D(u_Tex0, v_TexCoord3);
    vec2 uv        = v_TexCoord;
    float t        = u_Time * ANIM_SPEED;

    float selfA = spriteAlpha(uv);
    bool  edge  = isOuterEdge(uv);

    // ── Pixel fora do sprite? → verificar se está na zona de fogo ──
    if (selfA < 0.1) {
        float nd = nearEdgeDist(uv);
        bool  inFireZone = nd < 1.0;

        // Partículas de fogo subindo (visíveis numa área maior acima do sprite)
        vec4 particles = fireParticles(uv, t);

        vec4 fireResult = vec4(0.0);

        if (inFireZone) {
            // Chama de borda: fogo colado ao contorno
            float f      = edgeFlame(uv, t);
            float falloff = 1.0 - smoothstep(0.0, 1.0, nd);
            f *= falloff * falloff;
            float fAlpha = smoothstep(0.03, 0.45, f) * FLAME_DENSITY;
            fAlpha = clamp(fAlpha, 0.0, 1.0);

            // Cor muda com distância: base vermelha, ponta amarela
            float colorT = (1.0 - nd) * 0.6 + f * 0.4;
            vec3 fireCol = firePalette(colorT);

            // Brasas espalhadas
            float eG   = floor(t * 12.0);
            float ember = step(0.95, hash(floor(uv * 60.0) + eG)) * step(0.3, f);
            fireCol = mix(fireCol, vec3(1.0, 0.95, 0.4), ember);

            fireResult = vec4(fireCol, fAlpha);
        }

        // Combina chamas de borda + partículas (tela máxima)
        vec3  finalCol   = max(fireResult.rgb, particles.rgb);
        float finalAlpha = max(fireResult.a,   particles.a);

        if (finalAlpha > 0.01) {
            gl_FragColor = vec4(finalCol, finalAlpha);
        } else {
            discard;
        }

    } else if (edge) {
        // Borda do sprite: fogo bem colado
        float f      = edgeFlame(uv, t);
        float fAlpha = clamp(smoothstep(0.04, 0.5, f) * FLAME_DENSITY, 0.0, 1.0);
        vec3  col    = firePalette(f * 0.9 + 0.1);
        gl_FragColor = vec4(col, fAlpha);

    } else {
        // ── Sprite normal ──
        gl_FragColor = texture2D(u_Tex0, uv);

        if (texcolor.r > 0.9) {
            gl_FragColor *= texcolor.g > 0.9 ? u_Color[0] : u_Color[1];
        } else if (texcolor.g > 0.9) {
            gl_FragColor *= u_Color[2];
        } else if (texcolor.b > 0.9) {
            gl_FragColor *= u_Color[3];
        }

        if (texcolor3.a > ALPHA_TOLERANCE && gl_FragColor.a < ALPHA_TOLERANCE) {
            gl_FragColor   = vec4(0.0, 0.7, 1.0, 1.0);
            gl_FragColor.a = 0.7;
        }

        if (gl_FragColor.a < 0.01) discard;
    }
}
