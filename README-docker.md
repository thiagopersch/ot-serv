# OTServer no Docker (Windows, macOS e Linux)

Tudo compila a partir do código-fonte dentro de containers Linux, então o mesmo checkout
roda igual em Windows, macOS (Intel ou Apple Silicon) e Linux. Nada depende dos `.exe`/DLLs.

| Serviço  | O que é                         | Endereço                          | Sobe com              |
|----------|---------------------------------|-----------------------------------|-----------------------|
| `db`     | MySQL 8.4                       | `localhost:3307`                  | `docker compose up`   |
| `site`   | Next.js (portal + admin)        | http://localhost:3000             | `docker compose up`   |
| `server` | TFS 0.4 (Linux)                 | `localhost:7171` / `7172`         | `docker compose up`   |
| `client` | Cliente OTCv8 no navegador      | http://localhost:6080             | `--profile client`    |
| `editor` | PeixolaMapEditor no navegador   | http://localhost:6081             | `--profile editor`    |

Ordem de subida: **db (healthy) → site-migrate (`prisma db push` + seed) → site (healthy) → server**.

## Primeira vez

Requisito: Docker Desktop (Windows/macOS) ou Docker Engine + plugin compose (Linux).

```bash
cp .env.example .env
```

O banco fica no volume `otserver_db-data`. O `npm run up` do site sobe só o serviço `db`
deste compose, então os dois fluxos compartilham o mesmo banco e o mesmo container `ndbo-db`.

> **Nunca rode `docker compose down -v` nem `docker volume rm otserver_db-data`**: isso
> apaga o banco. `down` sem `-v` é seguro.

**Vindo do compose antigo do site** (volume `docker_ndbo-db-data`): pare a stack, copie os
dados para o volume novo e remova o container antigo. O volume antigo fica intacto como
backup:

```bash
docker rm -f ndbo-db
docker volume create --label com.docker.compose.project=otserver --label com.docker.compose.volume=db-data otserver_db-data
docker run --rm -v docker_ndbo-db-data:/from:ro -v otserver_db-data:/to alpine cp -a /from/. /to/
```

**Conta admin do seed:** o `site-migrate` usa `SEED_ADMIN_*` e `NEXTAUTH_*` do `site/.env`, o
mesmo do `npm run dev`. Sem esse arquivo, valem os padrões de `docker/site.defaults.env`.

## Dia a dia: script de start

Sobe tudo, espera o servidor ficar online, abre o cliente e mostra no terminal os logs de
todos os containers (e, no Windows, do `cliente\WodBleach.log`):

| Sistema | Comando | Cliente que abre |
|---------|---------|------------------|
| Windows | `.\start.ps1` (ou duplo clique em `start.cmd`) | `cliente\otclient_dx.exe` nativo |
| Windows | `.\start.ps1 -Browser` | cliente do Docker no navegador |
| macOS / Linux | `./start.sh` | cliente do Docker no navegador |

- `-NoBuild` (Windows) ou `--no-build` (Mac/Linux) pula a recompilação e sobe mais rápido.
- **Ctrl+C só para de mostrar os logs**; os containers continuam rodando.
- Se o PowerShell bloquear o script, use o `start.cmd`, que já passa `-ExecutionPolicy Bypass`.
- O servidor registra cada login no log: `[Login] conta 'x' (IP do cliente) -> IP:porta` e as
  recusas (conta inexistente/senha incorreta, sem a senha).
- `HttpSession unable to resolve` no log do cliente é normal: são as URLs de
  updater/stats vazias no `cliente/init.lua`.

> `docker compose --profile client up -d client` **não abre janela**: o cliente do Docker
> roda no navegador, em http://localhost:6080. Para o `.exe` nativo, use o `start.ps1`.

## Comandos avulsos

```bash
docker compose up -d --build                      # db -> site -> servidor
docker compose logs -f server                     # console do TFS
docker compose --profile client up -d client      # cliente: http://localhost:6080
docker compose --profile editor up -d editor      # editor:  http://localhost:6081
docker compose --profile client --profile editor down   # derruba tudo (o banco fica no volume)
```

- **Edições valem sem rebuild:** `server/` (config.lua, data/, mods/), `cliente/` (Lua, OTUI,
  data/) e `site/public/storage` são montados direto do disco. Reinicie o serviço
  (`docker compose restart server`) para o TFS recarregar.
- **Precisam de rebuild (`--build`):** mudanças no C++ do servidor (`server/src/source`), no
  C++ do cliente (`cliente/src`), no Rust do editor ou no código do site.
- O primeiro build do cliente baixa e compila as dependências do vcpkg (20–40 min). Os
  seguintes usam o cache do BuildKit.

## Jogar de fora da máquina

O TFS anuncia `SERVER_IP` na lista de personagens. O padrão `127.0.0.1` serve para o cliente
nativo na mesma máquina e para o cliente do Docker. No compose, `SERVER_IP_ONLY=1` impede o
TFS de anunciar o IP interno do container (`172.x`) para clientes que chegam pelo gateway do
Docker. Para outros jogadores, coloque o IP da
LAN ou o público no `.env` (`SERVER_IP=192.168.0.10`) e rode `docker compose up -d server`.

## Linux: permissões

No Linux, os containers escrevem em `server/` e `site/public/storage` com o UID do `.env`.
Ajuste para o seu usuário:

```bash
echo "HOST_UID=$(id -u)" >> .env && echo "HOST_GID=$(id -g)" >> .env
```

## Cliente e editor no navegador

- Rodam num X virtual (Xvfb) com renderização por software (Mesa llvmpipe/lavapipe), sem
  usar a GPU. Servem para testar e mapear; para jogar com FPS alto, use o cliente nativo.
- O cliente usa as portas `127.0.0.1:7171/7172`, como no Windows. O container encaminha essas
  portas para o serviço `server` (`socat`), então o `init.lua` não muda.
- O editor acha sozinho `server/data/items`, `cliente/data/things/860` e os materiais.
  Mapas abertos e salvos ficam em `server/data/world` no seu disco.
- O som do cliente fica desligado no container.
- Configurações do cliente e do editor ficam nos volumes `client-config` e `editor-config`.

## Backup do banco

```bash
docker exec ndbo-db sh -c 'mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction ndbo' > backup.sql
```

## Arquivos

- `compose.yaml`: todos os serviços.
- `docker/server/Dockerfile`: build autotools do TFS (Debian bookworm, Boost 1.74).
- `docker/gui/Dockerfile`: runtime noVNC compartilhado, com os targets `editor` (Rust) e
  `client` (CMake + vcpkg).
- `site/docker/Dockerfile`: imagem do site (estágio `builder` usado pelo `site-migrate`).
