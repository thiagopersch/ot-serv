# ot-serv

Monorepo do WodBleach: servidor, cliente, site e editor de mapas.

| Pasta | O que é |
|-------|---------|
| `server/` | Servidor TFS 0.4 (C++ em `server/src/source`, scripts em `server/data`) |
| `server/PeixolaMapEditor/` | Editor de mapas em Rust (port do RME) |
| `cliente/` | Cliente OTCv8 (C++ em `cliente/src`, módulos Lua em `cliente/modules`) |
| `site/` | Portal e painel admin (Next.js + Prisma) |
| `docker/`, `compose.yaml` | Tudo em containers, igual em Windows, macOS e Linux |

## Rodar

Veja o [README-docker.md](README-docker.md). Resumo:

```bash
cp .env.example .env
./start.sh          # macOS / Linux
.\start.ps1         # Windows (ou duplo clique em start.cmd)
```

## Arquivos que não estão no git

- **Sprites do cliente:** `cliente/data/things/860/` (`Tibia.spr` tem 1,3 GB). Copie essa pasta
  de uma instalação existente para cada máquina. Sem ela, o cliente e o editor de mapas não
  abrem.
- **Segredos:** `site/.env` (copie de `site/.env.example`) e `.env` (de `.env.example`).
- **Logs do servidor:** `server/data/logs/**/*.log` são gerados em runtime.

## Histórico

Este repositório junta três repositórios antigos, com o histórico completo de cada um:
`client-server-tibia` → `cliente/`, `wodbo-global-server` → `server/`, `ndbo-site` → `site/`.
