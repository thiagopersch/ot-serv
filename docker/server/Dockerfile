# syntax=docker/dockerfile:1
# TFS 0.4 (server/src/source) compilado para Linux. Contexto de build: server/src/source.

FROM debian:bookworm AS build
RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential autoconf automake libtool pkg-config dos2unix \
      libboost-thread-dev libboost-regex-dev libboost-system-dev \
      libboost-date-time-dev libboost-filesystem-dev \
      liblua5.1-0-dev libxml2-dev libgmp-dev zlib1g-dev libsqlite3-dev \
      libmariadb-dev-compat libssl-dev libcrypto++-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /src
COPY . .
RUN find . -maxdepth 1 -type f \( -name '*.ac' -o -name '*.am' -o -name '*.sh' \) -exec dos2unix -q {} + \
 && autoreconf -fi \
 && ./configure --enable-mysql --enable-sqlite --enable-server-diag \
 # Makefile.am fixa CXXFLAGS=-pipe; os defines do Makefile.win (Dev-C++) entram via OTSERV_FLAGS.
 # -j limitado: cada g++ deste código passa de 1 GB e derruba o BuildKit com nproc alto.
 && make -j"$(( $(nproc) > 4 ? 4 : $(nproc) ))" \
      CXXFLAGS="-pipe -std=gnu++14 -fpermissive -w" \
      OTSERV_FLAGS="-D__CONSOLE__ -D__WAR_SYSTEM__" \
 && strip theforgottenserver

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      libboost-thread1.74.0 libboost-regex1.74.0 libboost-system1.74.0 \
      libboost-date-time1.74.0 libboost-filesystem1.74.0 \
      liblua5.1-0 libxml2 libgmp10 zlib1g libsqlite3-0 libmariadb3 libssl3 libcrypto++8 \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /src/theforgottenserver /usr/local/bin/tfs
COPY --chmod=755 <<'SH' /usr/local/bin/entrypoint.sh
#!/bin/bash
set -e
host="${SQL_HOST:-db}"
port="${SQL_PORT:-3306}"
echo "Aguardando MySQL em ${host}:${port}..."
until (exec 3<>"/dev/tcp/${host}/${port}") 2>/dev/null; do sleep 1; done
mkdir -p data/logs
exec /usr/local/bin/tfs "$@"
SH
# O TFS se recusa a rodar como root (otserv.cpp); o UID é sobrescrito pelo compose.
RUN useradd --uid 1001 --create-home tfs
USER 1001
# ./server é montado aqui (config.lua, data/, mods/) — edições no host valem sem rebuild.
WORKDIR /srv/server
EXPOSE 7171 7172
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
