/**
 * Preview no browser dos shaders de outfit do OTClient (`cliente/data/shaders/*.frag`), imitando o
 * pipeline do cliente (`cliente/src/client/thingtype.cpp` + `outfit.cpp`):
 *
 * - `u_Tex0` é um atlas com a camada base e a máscara de cor do frame. Aqui o atlas tem 3 células
 *   horizontais `[base | máscara | vazio]`; `u_Offset` é o deslocamento (em pixels do atlas) da
 *   base até a máscara, então `v_TexCoord2` lê a máscara e `v_TexCoord3` (2x o offset) cai numa
 *   célula vazia — mesmo comportamento do cliente, onde o atlas só tem 2 camadas.
 * - `a_TexCoord` é em pixels do atlas e `u_TextureMatrix = diag(1/w, 1/h)` converte para UV.
 * - `u_Color` (mat4) = cores head/body/legs/feet (uma por coluna, `u_Color[0]` = head).
 * - `u_Time` em segundos desde a compilação do programa.
 */

/** `cliente/data/shaders/outfit_default_vertex.frag` — vertex de todo `createOutfitShader`. */
export const DEFAULT_OUTFIT_VERTEX = `attribute vec2 a_Vertex;
attribute vec2 a_TexCoord;
uniform mat3 u_TextureMatrix;
varying vec2 v_TexCoord;
varying vec2 v_TexCoord2;
varying vec2 v_TexCoord3;
uniform mat3 u_TransformMatrix;
uniform mat3 u_ProjectionMatrix;
uniform vec2 u_Offset;

void main()
{
    gl_Position = vec4((u_ProjectionMatrix * u_TransformMatrix * vec3(a_Vertex.xy, 1.0)).xy, 1.0, 1.0);
    v_TexCoord = (u_TextureMatrix * vec3(a_TexCoord,1.0)).xy;
    v_TexCoord2 = (u_TextureMatrix * vec3(a_TexCoord + u_Offset,1.0)).xy;
    v_TexCoord3 = (u_TextureMatrix * vec3(a_TexCoord + u_Offset * 2.0,1.0)).xy;
}
`;

export type ShaderColor = { r: number; g: number; b: number };

/** O cliente compila GLSL desktop sem `precision`; GLSL ES (WebGL) exige no fragment. */
function withPrecision(source: string, stage: "vertex" | "fragment"): string {
  if (/^\s*precision\s/m.test(source)) return source;
  return stage === "fragment"
    ? `#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n${source}`
    : `precision highp float;\n${source}`;
}

type ImageSource = HTMLImageElement | HTMLCanvasElement;

export class OutfitShaderRenderer {
  readonly canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  private program: WebGLProgram | null = null;
  private startTime = 0;
  private atlasCanvas = document.createElement("canvas");
  private tex0: WebGLTexture;
  private tex1: WebGLTexture | null = null;
  private vertexBuffer: WebGLBuffer;
  private texCoordBuffer: WebGLBuffer;

  constructor() {
    this.canvas = document.createElement("canvas");
    const attributes = { premultipliedAlpha: false, preserveDrawingBuffer: true, alpha: true };
    const gl =
      (this.canvas.getContext("webgl2", attributes) as WebGL2RenderingContext | null) ??
      (this.canvas.getContext("webgl", attributes) as WebGLRenderingContext | null);
    if (!gl) throw new Error("WebGL não suportado neste navegador.");
    this.gl = gl;
    this.tex0 = gl.createTexture()!;
    this.vertexBuffer = gl.createBuffer()!;
    this.texCoordBuffer = gl.createBuffer()!;
  }

  /** Programas já compilados por chave (`selectCachedProgram`) — um único contexto WebGL serve
   * várias miniaturas sem recompilar a cada frame. */
  private programCache = new Map<string, { program: WebGLProgram | null; error: string | null; startTime: number }>();
  private programIsCached = false;

  /** Compila o par vertex/fragment. Retorna o log de erro (ou `null` se ok). */
  setProgram(fragmentSource: string, vertexSource?: string | null): string | null {
    if (this.program && !this.programIsCached) this.gl.deleteProgram(this.program);
    this.program = null;
    this.programIsCached = false;
    const { program, error } = this.compileProgram(fragmentSource, vertexSource);
    this.program = program;
    this.startTime = performance.now();
    return error;
  }

  /** Ativa o programa da chave, compilando só na primeira vez. Retorna o erro (ou `null`). */
  selectCachedProgram(key: string, fragmentSource: string, vertexSource?: string | null): string | null {
    if (this.program && !this.programIsCached) this.gl.deleteProgram(this.program);
    let cached = this.programCache.get(key);
    if (!cached) {
      cached = { ...this.compileProgram(fragmentSource, vertexSource), startTime: performance.now() };
      this.programCache.set(key, cached);
    }
    this.program = cached.program;
    this.programIsCached = true;
    this.startTime = cached.startTime;
    return cached.error;
  }

  private compileProgram(
    fragmentSource: string,
    vertexSource?: string | null,
  ): { program: WebGLProgram | null; error: string | null } {
    const gl = this.gl;
    const compile = (type: number, source: string, label: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader) ?? "erro desconhecido";
        gl.deleteShader(shader);
        throw new Error(`${label}: ${log}`);
      }
      return shader;
    };

    try {
      const vs = compile(gl.VERTEX_SHADER, withPrecision(vertexSource || DEFAULT_OUTFIT_VERTEX, "vertex"), "Vertex");
      const fs = compile(gl.FRAGMENT_SHADER, withPrecision(fragmentSource, "fragment"), "Fragment");
      const program = gl.createProgram()!;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.bindAttribLocation(program, 0, "a_Vertex");
      gl.bindAttribLocation(program, 1, "a_TexCoord");
      gl.linkProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        const log = gl.getProgramInfoLog(program) ?? "erro desconhecido";
        gl.deleteProgram(program);
        return { program: null, error: `Link: ${log}` };
      }
      return { program, error: null };
    } catch (error) {
      return { program: null, error: (error as Error).message };
    }
  }

  setTex1(image: ImageSource | null) {
    const gl = this.gl;
    if (!image) {
      if (this.tex1) gl.deleteTexture(this.tex1);
      this.tex1 = null;
      return;
    }
    this.tex1 ??= gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.tex1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    // O cliente usa smooth + repeat (`addMultiTexture`); REPEAT em textura NPOT só funciona no WebGL2.
    const repeat = "texStorage2D" in gl ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, repeat);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, repeat);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  private setUniform(name: string, values: number[] | Float32Array) {
    const gl = this.gl;
    const program = this.program!;
    const location = gl.getUniformLocation(program, name);
    if (!location) return;
    const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    let type = 0;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info && info.name.replace(/\[0\]$/, "") === name) type = info.type;
    }
    switch (type) {
      case gl.FLOAT:
        gl.uniform1f(location, values[0] ?? 0);
        break;
      case gl.FLOAT_VEC2:
        gl.uniform2f(location, values[0] ?? 0, values[1] ?? 0);
        break;
      case gl.FLOAT_VEC3:
        gl.uniform3f(location, values[0] ?? 0, values[1] ?? 0, values[2] ?? 0);
        break;
      case gl.FLOAT_VEC4:
        gl.uniform4f(location, values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 0);
        break;
      case gl.INT:
      case gl.BOOL:
      case gl.SAMPLER_2D:
        gl.uniform1i(location, values[0] ?? 0);
        break;
      case gl.INT_VEC2:
      case gl.BOOL_VEC2:
        gl.uniform2i(location, values[0] ?? 0, values[1] ?? 0);
        break;
      case gl.FLOAT_MAT3:
        gl.uniformMatrix3fv(location, false, values);
        break;
      case gl.FLOAT_MAT4:
        gl.uniformMatrix4fv(location, false, values);
        break;
    }
  }

  /** Desenha um frame com o shader. `mask` = camada de máscara de cor (ou `null`). Devolve o
   * canvas do WebGL (tamanho do frame) para ser composto num canvas 2D. */
  render(base: ImageSource, mask: ImageSource | null, colors: [ShaderColor, ShaderColor, ShaderColor, ShaderColor]) {
    const gl = this.gl;
    if (!this.program) return this.canvas;

    const width = base.width;
    const height = base.height;
    const atlasWidth = width * 3;

    this.atlasCanvas.width = atlasWidth;
    this.atlasCanvas.height = height;
    const atlasCtx = this.atlasCanvas.getContext("2d")!;
    atlasCtx.clearRect(0, 0, atlasWidth, height);
    atlasCtx.drawImage(base, 0, 0);
    if (mask) atlasCtx.drawImage(mask, width, 0);

    this.canvas.width = width;
    this.canvas.height = height;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex0);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlasCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    if (this.tex1) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.tex1);
    }

    const quad = new Float32Array([0, 0, width, 0, 0, height, 0, height, width, 0, width, height]);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);

    // Matrizes mat3 em column-major (mesma convenção do `Painter` do cliente).
    this.setUniform("u_ProjectionMatrix", [2 / width, 0, 0, 0, -2 / height, 0, -1, 1, 1]);
    this.setUniform("u_TransformMatrix", [1, 0, 0, 0, 1, 0, 0, 0, 1]);
    this.setUniform("u_TextureMatrix", [1 / atlasWidth, 0, 0, 0, 1 / height, 0, 0, 0, 1]);
    this.setUniform("u_Offset", [width, 0]);
    this.setUniform(
      "u_Color",
      colors.flatMap((color) => [color.r / 255, color.g / 255, color.b / 255, 1]),
    );
    this.setUniform("u_Time", [(performance.now() - this.startTime) / 1000]);
    this.setUniform("u_Resolution", [width, height]);
    this.setUniform("u_Center", [0, 0]);
    this.setUniform("u_Depth", [0]);
    this.setUniform("u_Opacity", [1]);
    this.setUniform("u_Tex0", [0]);
    this.setUniform("u_Tex1", [1]);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
    return this.canvas;
  }

  dispose() {
    const gl = this.gl;
    if (this.program && !this.programIsCached) gl.deleteProgram(this.program);
    for (const cached of this.programCache.values()) if (cached.program) gl.deleteProgram(cached.program);
    this.programCache.clear();
    gl.deleteTexture(this.tex0);
    if (this.tex1) gl.deleteTexture(this.tex1);
    gl.deleteBuffer(this.vertexBuffer);
    gl.deleteBuffer(this.texCoordBuffer);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
  }
}
