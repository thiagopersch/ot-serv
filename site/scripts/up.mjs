#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";

function step(label) {
  console.log(`\n→ ${label}`);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: isWindows });

  if (result.error) {
    console.error(`\n✖ Não foi possível executar "${command}": ${result.error.message}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`\n✖ Comando falhou: ${command} ${args.join(" ")}`);
    process.exit(result.status ?? 1);
  }
}

step("Subindo banco de dados MySQL (Docker)...");
// banco definido no compose.yaml da raiz do projeto (mesmo volume do stack completo)
run("docker", ["compose", "-f", "../compose.yaml", "up", "-d", "--wait", "db"]);

step("Sincronizando schema do Prisma com o banco...");
run("npx", ["prisma", "db", "push"]);

step("Populando banco com dados iniciais (seed)...");
run("npx", ["tsx", "prisma/seed.ts"]);

step("Iniciando aplicação Next.js (dev)...");
const dev = spawn("npx", ["next", "dev"], { stdio: "inherit", shell: isWindows });

dev.on("exit", (code) => process.exit(code ?? 0));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => dev.kill(signal));
}
