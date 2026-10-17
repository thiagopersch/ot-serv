# NDBO — Portal Web do OTServer

Portal web para gerenciamento de contas, comunidade e administração do servidor NDBO.
Stack completa em `AGENTS.md`.

## Subir tudo com um comando

Requer [Docker Desktop](https://www.docker.com/products/docker-desktop/) rodando e Node.js 20+.

```bash
npm install
npm run up
```

Esse comando faz, em sequência:

1. Sobe o MySQL via Docker (serviço `db` do `../compose.yaml`) e espera ficar saudável.
2. Sincroniza o schema do Prisma com o banco (`prisma db push`).
3. Popula o banco com dados iniciais (`prisma/seed.ts`): conta `1`/`1` (Account Manager,
   compatível com o cliente de jogo) e conta admin do portal (grupo 6 — administrador
   master). Defina `SEED_ADMIN_NAME`, `SEED_ADMIN_PASSWORD` e `SEED_ADMIN_EMAIL` no `.env` para o administrador.
4. Inicia a aplicação em `npm run dev` (http://localhost:3000).

Pressione `Ctrl+C` para encerrar a aplicação (o container do banco continua rodando; use
`docker compose -f ../compose.yaml stop db` para derrubá-lo). Para subir tudo (banco, site e
servidor) em containers, veja `../README-docker.md`.

## Comandos individuais

```bash
npm run dev          # aplicação Next.js em modo desenvolvimento
npm run build         # build de produção
npm run start         # servir o build de produção
npm run db:push        # sincronizar prisma/schema.prisma com o banco
npm run db:migrate     # criar/aplicar migrations versionadas
npm run db:seed        # rodar o seeder isoladamente
npm run db:studio      # abrir o Prisma Studio
```
