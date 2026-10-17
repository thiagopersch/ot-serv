#!/usr/bin/env bash
# Sobe o projeto no Docker (db -> site -> servidor + cliente no navegador) e mostra os logs.
#
#   ./start.sh            sobe tudo e abre o cliente em http://localhost:6080
#   ./start.sh --no-build não recompila as imagens
#
# Ctrl+C para de mostrar os logs; os containers continuam rodando.
# Parar tudo: docker compose --profile client down   (nunca use -v: apaga o banco)
set -euo pipefail
cd "$(dirname "$0")"

build="--build"
[ "${1:-}" = "--no-build" ] && build=""

[ -f .env ] || { cp .env.example .env; echo ".env criado a partir do .env.example"; }

echo "==> Subindo containers (db -> site -> servidor -> cliente)..."
docker compose --profile client up -d $build

echo "==> Aguardando o servidor ficar online..."
started="$(docker inspect -f '{{.State.StartedAt}}' ndbo-server)"
for _ in $(seq 1 300); do
  docker logs --since "$started" ndbo-server 2>&1 | grep -q "servidor Online" && break
  if [ "$(docker inspect -f '{{.State.Running}}' ndbo-server)" != "true" ]; then
    docker logs --tail 40 ndbo-server; echo "O container do servidor parou." >&2; exit 1
  fi
  sleep 2
done
docker logs --since "$started" ndbo-server 2>&1 | grep -q "servidor Online" \
  || { docker logs --tail 40 ndbo-server; echo "O servidor não ficou online." >&2; exit 1; }
echo "Servidor online."

url="http://localhost:6080/vnc.html?autoconnect=1&resize=scale"
echo "==> Abrindo o cliente: $url"
if command -v open >/dev/null 2>&1; then open "$url"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 &
else echo "Abra no navegador: $url"; fi

echo "==> Logs (Ctrl+C para sair; os containers continuam rodando)"
trap 'echo; echo "Parar tudo: docker compose --profile client down   (sem -v)"' EXIT
docker compose --profile client logs -f --tail 50
