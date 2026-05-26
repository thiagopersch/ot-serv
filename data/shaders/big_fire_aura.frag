uniform float u_Time;
uniform sampler2D u_Tex0;
varying vec2 v_TexCoord;

// ==========================================
// PARÂMETROS CONFIGURÁVEIS (Estilo Goku Aura)
// ==========================================
const vec3 COLOR_CORE = vec3(1.0, 1.0, 0.5); // Amarelo bem claro/branco (centro do ki)
const vec3 COLOR_MID  = vec3(1.0, 0.6, 0.0); // Laranja vivo
const vec3 COLOR_EDGE = vec3(1.0, 0.1, 0.0); // Vermelho nas pontas

// Tamanho da expansão da aura.
// Mantenha próximo de 0.01 para não invadir outros sprites no atlas.
const float AURA_SIZE = 0.012; 
const float ANIMATION_SPEED = 3.0;

// ==========================================
// FUNÇÕES DE NOISE
// ==========================================
float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
}

float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float f = 0.0;
    float amp = 0.5;
    for(int i = 0; i < 4; i++) {
        f += amp * noise(p);
        p *= 2.0;
        amp *= 0.5;
    }
    return f;
}

void main() {
    vec4 baseColor = texture2D(u_Tex0, v_TexCoord);
    float time = u_Time * ANIMATION_SPEED;
    
    // ==========================================
    // NOISE ESTILO AURA KI (Vertical e Fino)
    // ==========================================
    // Escala X maior que Y para criar linhas verticais (efeito do Ki do Goku subindo)
    vec2 noiseUV = v_TexCoord * vec2(12.0, 4.0);
    noiseUV.y -= time * 1.5;
    
    float n1 = fbm(noiseUV);
    float n2 = fbm(noiseUV * 1.5 - vec2(time * 0.2, time * 1.2));
    float auraNoise = (n1 + n2) * 0.5;

    // ==========================================
    // MÁSCARA DA AURA (Gradiente Suave)
    // ==========================================
    // Cria um borrado direcional puxando a silhueta pra cima.
    float mask = baseColor.a;
    
    // Distorção leve nas coordenadas para que a chama "dance" na base
    vec2 wobble = vec2((fbm(noiseUV + 5.0) - 0.5) * 0.005, auraNoise * 0.005);
    
    // Amostras subindo com pesos decrescentes (Gera o fade out natural pro topo)
    mask += texture2D(u_Tex0, v_TexCoord + wobble + vec2(0.0, AURA_SIZE * 0.2)).a * 0.9;
    mask += texture2D(u_Tex0, v_TexCoord + wobble + vec2(0.0, AURA_SIZE * 0.4)).a * 0.7;
    mask += texture2D(u_Tex0, v_TexCoord + wobble + vec2(0.0, AURA_SIZE * 0.6)).a * 0.5;
    mask += texture2D(u_Tex0, v_TexCoord + wobble + vec2(0.0, AURA_SIZE * 0.8)).a * 0.3;
    mask += texture2D(u_Tex0, v_TexCoord + wobble + vec2(0.0, AURA_SIZE * 1.0)).a * 0.1;
    
    // Amostras laterais para dar volume ao redor do corpo
    mask += texture2D(u_Tex0, v_TexCoord + wobble + vec2(AURA_SIZE * 0.4, AURA_SIZE * 0.3)).a * 0.6;
    mask += texture2D(u_Tex0, v_TexCoord + wobble + vec2(-AURA_SIZE * 0.4, AURA_SIZE * 0.3)).a * 0.6;
    
    mask = clamp(mask, 0.0, 1.0);
    
    // Fade de segurança nas bordas absolutas para não cortar como um quadrado
    float quadFade = smoothstep(0.0, 0.05, v_TexCoord.x) * smoothstep(1.0, 0.95, v_TexCoord.x) *
                     smoothstep(0.0, 0.05, v_TexCoord.y) * smoothstep(1.0, 0.95, v_TexCoord.y);
    mask *= quadFade;

    // ==========================================
    // INTENSIDADE E COR
    // ==========================================
    // Combina o shape do borrado com o noise vertical
    float intensity = mask * auraNoise;
    
    // Suaviza e destaca as chamas
    intensity = smoothstep(0.1, 0.85, intensity);
    
    // Mapeamento de cores (fogo clássico)
    vec3 auraColor = mix(COLOR_EDGE, COLOR_MID, intensity);
    auraColor = mix(auraColor, COLOR_CORE, pow(intensity, 2.0));
    
    // Leve pulsação global
    float pulse = 0.9 + 0.1 * sin(time * 5.0);

    // ==========================================
    // COMPOSIÇÃO FINAL (Additive Blending)
    // ==========================================
    // Imagem referência do Goku: A aura é semi-transparente e passa por cima dele, 
    // iluminando as roupas e a pele intensamente.
    
    vec4 finalColor = baseColor;
    
    // Força do brilho da aura
    vec3 fireOutput = auraColor * intensity * 1.6 * pulse;
    float fireAlpha = clamp(intensity * 1.5, 0.0, 1.0);
    
    // Mistura Aditiva: Soma as cores (Gera o aspecto de luz e glow por cima do sprite)
    finalColor.rgb += fireOutput;
    
    // O Alpha final mantém o que for maior: o corpo sólido ou a aura
    finalColor.a = max(finalColor.a, fireAlpha);

    gl_FragColor = finalColor;
}
