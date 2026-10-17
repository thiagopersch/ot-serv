# syntax=docker/dockerfile:1
# Apps gráficos (cliente OTCv8 e PeixolaMapEditor) rodando em Linux e exibidos no navegador
# via noVNC — o mesmo em Windows, macOS e Linux. Contexto de build: raiz do projeto
# (Dockerfile.dockerignore só deixa entrar o código-fonte necessário).
#
# Targets: editor, client.

# ---------------------------------------------------------------------------
# Runtime comum: X virtual + window manager + VNC + noVNC + Mesa (render por software)
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim AS gui-runtime
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      xvfb x11vnc fluxbox novnc websockify socat procps \
      libgl1 libgl1-mesa-dri libglx-mesa0 libegl1 libvulkan1 mesa-vulkan-drivers \
      fonts-dejavu-core ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --uid 1001 --create-home app \
    && mkdir -p /tmp/.X11-unix /home/app/.config /home/app/.local/share \
    # 1777: o compose pode rodar com outro UID (HOST_UID no Linux); volumes novos herdam isso
    && chmod 1777 /tmp/.X11-unix /home/app /home/app/.config /home/app/.local/share
ENV HOME=/home/app
COPY --chmod=755 <<'SH' /usr/local/bin/start-gui
#!/bin/bash
# Uso: start-gui <comando...>. Sobe Xvfb + fluxbox + x11vnc + noVNC (porta 6080) e roda o app.
set -e
export DISPLAY=:99
export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/runtime-$(id -u)}"
mkdir -p "$XDG_RUNTIME_DIR" && chmod 700 "$XDG_RUNTIME_DIR"
GEOMETRY="${GUI_GEOMETRY:-1600x900}"
rm -f /tmp/.X99-lock
Xvfb :99 -screen 0 "${GEOMETRY}x24" -nolisten tcp &
until xdpyinfo >/dev/null 2>&1 || [ -e /tmp/.X11-unix/X99 ]; do sleep 0.2; done
fluxbox >/dev/null 2>&1 &
x11vnc -display :99 -forever -shared -nopw -quiet -localhost -rfbport 5900 >/dev/null 2>&1 &
websockify --web /usr/share/novnc 6080 localhost:5900 >/dev/null 2>&1 &

# Encaminha portas locais para outro container (ex.: "7171:server:7171 7172:server:7172"),
# para o app achar o serviço em 127.0.0.1 como no Windows.
for fwd in ${GUI_FORWARD:-}; do
  IFS=: read -r lport rhost rport <<< "$fwd"
  socat "TCP-LISTEN:${lport},bind=127.0.0.1,reuseaddr,fork" "TCP:${rhost}:${rport}" &
done

echo "Abra http://localhost:${GUI_PUBLIC_PORT:-6080}/vnc.html?autoconnect=1&resize=remote"
exec "$@"
SH
# página inicial do noVNC já conectando
RUN ln -sf vnc.html /usr/share/novnc/index.html
EXPOSE 6080

# ---------------------------------------------------------------------------
# PeixolaMapEditor (Rust, eframe/wgpu)
# ---------------------------------------------------------------------------
FROM rust:1-bookworm AS editor-build
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgtk-3-dev libxkbcommon-dev libx11-dev libxcursor-dev libxrandr-dev libxi-dev \
      libwayland-dev libvulkan-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY server/PeixolaMapEditor/Cargo.toml server/PeixolaMapEditor/Cargo.lock ./
COPY server/PeixolaMapEditor/crates ./crates
COPY server/PeixolaMapEditor/assets ./assets
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/src/target \
    cargo build --release --locked -p peixola_map_editor \
 && cp target/release/PeixolaMapEditor /usr/local/bin/PeixolaMapEditor

FROM gui-runtime AS editor
RUN apt-get update && apt-get install -y --no-install-recommends \
      libgtk-3-0 libxkbcommon0 libxkbcommon-x11-0 libxcursor1 libxrandr2 libxi6 \
      libwayland-client0 libwayland-egl1 xdg-utils \
      # o rfd abre os diálogos de arquivo via zenity quando não há portal XDG
      zenity \
    && rm -rf /var/lib/apt/lists/*
COPY --from=editor-build /usr/local/bin/PeixolaMapEditor /usr/local/bin/PeixolaMapEditor
USER 1001
# ./server e ./cliente são montados aqui, lado a lado, como no Windows: o editor acha
# server/data/items e cliente/data/things/860 sozinho (settings.rs).
WORKDIR /work
# settings.rs grava em %APPDATA%/PeixolaMapEditor/peixola.toml
ENV APPDATA=/home/app/.config WGPU_BACKEND=vulkan
CMD ["start-gui", "PeixolaMapEditor"]

# ---------------------------------------------------------------------------
# Cliente OTCv8 (CMake + vcpkg, OpenGL desktop via GLEW/X11)
# ---------------------------------------------------------------------------
FROM debian:bookworm AS client-build
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential git curl zip unzip tar pkg-config ninja-build cmake ccache \
      autoconf automake autoconf-archive libtool python3 bison flex linux-libc-dev \
      libx11-dev libxext-dev libxi-dev libxrandr-dev libxcursor-dev libxinerama-dev \
      libgl1-mesa-dev libglu1-mesa-dev libasound2-dev ca-certificates \
    && rm -rf /var/lib/apt/lists/*
# baseline do cliente/vcpkg.json
ARG VCPKG_COMMIT=0d1150cbd2f8b3eb9247c51c9f41efbb3be9454b
ENV VCPKG_ROOT=/opt/vcpkg VCPKG_FORCE_SYSTEM_BINARIES=1 VCPKG_DEFAULT_BINARY_CACHE=/vcpkg-cache
RUN git clone https://github.com/microsoft/vcpkg.git "$VCPKG_ROOT" \
 && git -C "$VCPKG_ROOT" checkout "$VCPKG_COMMIT" \
 && "$VCPKG_ROOT/bootstrap-vcpkg.sh" -disableMetrics
WORKDIR /src
# dependências primeiro (camada cacheada enquanto vcpkg.json não muda)
COPY cliente/vcpkg.json ./
RUN --mount=type=cache,target=/vcpkg-cache \
    "$VCPKG_ROOT/vcpkg" install --x-install-root=/src/vcpkg_installed
COPY cliente/CMakeLists.txt cliente/CMakePresets.json ./
COPY cliente/cmake ./cmake
COPY cliente/src ./src
RUN --mount=type=cache,target=/vcpkg-cache \
    --mount=type=cache,target=/root/.cache/ccache \
    cmake --preset linux-release -DVCPKG_INSTALLED_DIR=/src/vcpkg_installed -DOPTIONS_ENABLE_IPO=OFF \
 && cmake --build build/linux-release -j"$(( $(nproc) > 6 ? 6 : $(nproc) ))" \
 && install -m755 otclient /usr/local/bin/otclient

FROM gui-runtime AS client
RUN apt-get update && apt-get install -y --no-install-recommends \
      libx11-6 libxext6 libxi6 libxrandr2 libxcursor1 libxinerama1 libglu1-mesa libasound2 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=client-build /usr/local/bin/otclient /usr/local/bin/otclient
USER 1001
# ./cliente é montado em /client (init.lua, data/, modules/, mods/, layouts/): edições de
# Lua/OTUI no host valem sem rebuild. Configurações ficam em ~/.local/share/WodBleach (volume).
WORKDIR /client
# O servidor anuncia 127.0.0.1 na lista de personagens; o socat leva isso até o container `server`.
ENV GUI_FORWARD="7171:server:7171 7172:server:7172"
# sem placa de som no container: OpenAL usa o driver nulo em vez de reclamar do ALSA
ENV ALSOFT_DRIVERS=null
CMD ["start-gui", "/usr/local/bin/otclient"]
