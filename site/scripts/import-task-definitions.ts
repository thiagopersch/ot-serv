// Importa o catálogo de tasks a partir de data/lib/tasks/task_config.lua (servidor OT) para a
// tabela `task_definitions` do portal. Uso único: a partir daqui a tabela é editada via
// `/admin/tasks`, não reimportada — reexecute apenas se precisar repopular do zero.
//
// Uso: npx tsx scripts/import-task-definitions.ts [caminho-para-task_config.lua]

import 'dotenv/config';
import { readFileSync } from 'node:fs';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { PrismaClient, type Prisma } from '../lib/generated/prisma/client';

const DEFAULT_LUA_PATH =
  'C:\\Users\\thiag\\Projetos\\OTServer\\server\\data\\lib\\tasks\\task_config.lua';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

type ParsedTask = {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  type: string;
  levelRequired: number;
  rankRequired: number;
  killsRequired: number;
  points: number;
  experience: number;
  money: number;
  lookType: number;
  monsters: Prisma.InputJsonValue;
  rewards: Prisma.InputJsonValue;
  delivery: Prisma.InputJsonValue;
  monsterDetails: Prisma.InputJsonValue;
};

function extractField(block: string, field: string): string | undefined {
  const stringMatch = block.match(new RegExp(`\\b${field}\\s*=\\s*"([^"]*)"`));
  if (stringMatch) return stringMatch[1];

  const numberMatch = block.match(new RegExp(`\\b${field}\\s*=\\s*(-?\\d+)`));
  if (numberMatch) return numberMatch[1];

  return undefined;
}

// Extrai o texto bruto de uma sub-tabela Lua (ex.: `monsters = { ... }`), respeitando chaves
// aninhadas e strings, para depois ser convertido em JSON por `luaTableToJson`.
function extractTableSource(block: string, field: string): string | undefined {
  const marker = new RegExp(`\\b${field}\\s*=\\s*\\{`);
  const match = marker.exec(block);
  if (!match) return undefined;

  const start = match.index + match[0].length - 1; // posição do '{' de abertura
  let depth = 0;
  let inString = false;

  for (let i = start; i < block.length; i++) {
    const ch = block[i];
    if (inString) {
      if (ch === '\\') i++; // pula caractere escapado
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return block.slice(start, i + 1);
    }
  }

  return undefined;
}

// Parser mínimo de tabelas Lua literais (sem funções/expressões) -> valor JS equivalente.
// Suporta: tabelas aninhadas, arrays posicionais, pares `chave = valor`, strings, números,
// booleanos. Tabelas cujas entradas não têm chave viram array; com chave viram objeto.
function luaTableToJson(source: string): unknown {
  let pos = 0;

  function skipWhitespaceAndComments() {
    for (;;) {
      while (pos < source.length && /\s/.test(source[pos])) pos++;
      if (source.startsWith('--', pos)) {
        const newline = source.indexOf('\n', pos);
        pos = newline === -1 ? source.length : newline + 1;
        continue;
      }
      break;
    }
  }

  function parseValue(): unknown {
    skipWhitespaceAndComments();
    const ch = source[pos];

    if (ch === '{') return parseTable();

    if (ch === '"') {
      pos++;
      let value = '';
      while (source[pos] !== '"') {
        if (source[pos] === '\\') {
          value += source[pos + 1];
          pos += 2;
        } else {
          value += source[pos];
          pos++;
        }
      }
      pos++; // fecha aspas
      return value;
    }

    const rest = source.slice(pos);
    const boolMatch = rest.match(/^(true|false)/);
    if (boolMatch) {
      pos += boolMatch[0].length;
      return boolMatch[0] === 'true';
    }

    const numberMatch = rest.match(/^-?\d+(\.\d+)?/);
    if (numberMatch) {
      pos += numberMatch[0].length;
      return Number(numberMatch[0]);
    }

    throw new Error(`Token Lua inesperado em: ${rest.slice(0, 30)}`);
  }

  function parseTable(): unknown {
    pos++; // consome '{'
    const arrayItems: unknown[] = [];
    const objectItems: Record<string, unknown> = {};
    let isObject = false;

    for (;;) {
      skipWhitespaceAndComments();
      if (source[pos] === '}') {
        pos++;
        break;
      }

      const rest = source.slice(pos);
      const keyMatch = rest.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=(?!=)/);
      if (keyMatch) {
        isObject = true;
        pos += keyMatch[0].length;
        objectItems[keyMatch[1]] = parseValue();
      } else {
        arrayItems.push(parseValue());
      }

      skipWhitespaceAndComments();
      if (source[pos] === ',') {
        pos++;
        continue;
      }
      skipWhitespaceAndComments();
      if (source[pos] === '}') {
        pos++;
        break;
      }
    }

    return isObject ? objectItems : arrayItems;
  }

  return parseValue();
}

function parseTasks(luaSource: string): ParsedTask[] {
  const tasksSection = luaSource.match(/TASKS\s*=\s*\{([\s\S]*)\n\}\s*\n\s*TASK_DIFFICULTY_ORDER/);
  if (!tasksSection) {
    throw new Error('Não foi possível localizar o bloco TASKS = { ... } no arquivo Lua.');
  }

  const body = tasksSection[1];
  // Cada entrada de task começa com `task_xxx = {` (4 espaços de indentação) e termina em `    }`.
  const blocks = body.split(/\n(?=\s{4}task_\w+\s*=\s*\{)/);

  const tasks: ParsedTask[] = [];
  for (const block of blocks) {
    const id = extractField(block, 'id');
    if (!id) continue;

    const monstersSource = extractTableSource(block, 'monsters');
    const rewardsSource = extractTableSource(block, 'rewards');
    const deliverySource = extractTableSource(block, 'delivery');
    const monsterDetailsSource = extractTableSource(block, 'monsterDetails');

    tasks.push({
      id,
      name: extractField(block, 'name') ?? id,
      category: extractField(block, 'category') ?? 'general',
      difficulty: extractField(block, 'difficulty') ?? 'easy',
      type: extractField(block, 'type') ?? 'kill',
      levelRequired: Number(extractField(block, 'levelRequired') ?? 0),
      rankRequired: Number(extractField(block, 'rankRequired') ?? 0),
      killsRequired: Number(extractField(block, 'killsRequired') ?? 0),
      points: Number(extractField(block, 'points') ?? 0),
      experience: Number(extractField(block, 'experience') ?? 0),
      money: Number(extractField(block, 'money') ?? 0),
      lookType: Number(extractField(block, 'lookType') ?? 0),
      monsters: (monstersSource ? luaTableToJson(monstersSource) : []) as Prisma.InputJsonValue,
      rewards: (rewardsSource
        ? luaTableToJson(rewardsSource)
        : { items: [] }) as Prisma.InputJsonValue,
      delivery: (deliverySource
        ? luaTableToJson(deliverySource)
        : { enabled: false }) as Prisma.InputJsonValue,
      monsterDetails: (monsterDetailsSource
        ? luaTableToJson(monsterDetailsSource)
        : []) as Prisma.InputJsonValue,
    });
  }

  return tasks;
}

async function main() {
  const luaPath = process.argv[2] ?? DEFAULT_LUA_PATH;
  const luaSource = readFileSync(luaPath, 'utf-8');
  const tasks = parseTasks(luaSource);

  if (tasks.length === 0) {
    throw new Error('Nenhuma task encontrada no arquivo Lua informado.');
  }

  for (const task of tasks) {
    await prisma.taskDefinition.upsert({
      where: { id: task.id },
      update: task,
      create: task,
    });
  }

  console.log(`Importadas/atualizadas ${tasks.length} tasks a partir de "${luaPath}".`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
