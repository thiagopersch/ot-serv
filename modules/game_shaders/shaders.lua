local function createOutfitShader(name)
  g_shaders.createOutfitShader(name, "/shaders/outfit_default_vertex", "/shaders/" .. name)
end

function init()
  -- map shaders
  g_shaders.createShader("map_default", "/shaders/map_default_vertex", "/shaders/map_default_fragment")

  g_shaders.createShader("map_rainbow", "/shaders/map_rainbow_vertex", "/shaders/map_rainbow_fragment")
  g_shaders.addTexture("map_rainbow", "/images/shaders/rainbow.png")

  -- outfit shaders
  g_shaders.createOutfitShader("outfit_default", "/shaders/outfit_default_vertex", "/shaders/outfit_default_fragment")

  g_shaders.createOutfitShader("outfit_rainbow", "/shaders/outfit_rainbow_vertex", "/shaders/outfit_rainbow_fragment")
  g_shaders.addTexture("outfit_rainbow", "/images/shaders/rainbow.png")

  createOutfitShader("ShaderChargeBlue")
  createOutfitShader("ShaderChargeGreen")
  createOutfitShader("ShaderChargeYellow")
  createOutfitShader("ShaderChargeRed")
  createOutfitShader("ShaderChargeLightPink")
  createOutfitShader("ShaderChargeMultiColors")
  createOutfitShader("ShaderChargeObito")
  createOutfitShader("ShaderOutBlack")
  createOutfitShader("ShaderOutBlue")
  createOutfitShader("ShaderOutRed")
  createOutfitShader("ShaderOutPurple")
  createOutfitShader("ShaderOutMultiColors")
  createOutfitShader("ShaderEstaticYellow")
  createOutfitShader("upgrade")
  createOutfitShader("lendario")
  createOutfitShader("mitico")
  createOutfitShader("epico")
  createOutfitShader("especial")
end

function terminate()
end
