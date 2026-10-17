import 'dotenv/config';

import { PrismaMariaDb } from '@prisma/adapter-mariadb';

import { sha1 } from '../lib/crypto';
import { PrismaClient } from '../lib/generated/prisma/client';

const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
const prisma = new PrismaClient({ adapter });

async function main() {
  await prisma.serverConfig.upsert({
    where: { config: 'db_version' },
    update: {},
    create: { config: 'db_version', value: '26' },
  });

  await prisma.serverMotd.upsert({
    where: { id_worldId: { id: 1, worldId: 0 } },
    update: {},
    create: { id: 1, worldId: 0, text: 'Welcome to NDBO!' },
  });

  await prisma.serverRecord.upsert({
    where: {
      record_worldId_timestamp: { record: 0, worldId: 0, timestamp: 0 },
    },
    update: {},
    create: { record: 0, worldId: 0, timestamp: 0 },
  });

  // Conta "Account Manager" (id 1), compatível com o account manager nativo do OTServer.
  const managerAccount = await prisma.account.upsert({
    where: { name: '1' },
    update: {},
    create: {
      name: '1',
      password: sha1('1'),
      email: '',
      groupId: 1,
    },
  });

  await prisma.player.upsert({
    where: { name_deleted: { name: 'Account Manager', deleted: 0 } },
    update: {},
    create: {
      name: 'Account Manager',
      groupId: 1,
      accountId: managerAccount.id,
      rankId: 0,
      townId: 1,
      conditions: Buffer.alloc(0),
    },
  });

  // Conta de administrador do portal (group_id = 6 = admin master).
  const adminName = process.env.SEED_ADMIN_NAME ?? 'admin';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ndbot0000@##';
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 're-reply@ndbo.com';
  const adminAccount = await prisma.account.upsert({
    where: { name: adminName },
    update: {},
    create: {
      name: adminName,
      password: sha1(adminPassword),
      email: adminEmail,
      groupId: 6,
    },
  });

  await prisma.player.upsert({
    where: { name_deleted: { name: 'Admin', deleted: 0 } },
    update: {},
    create: {
      name: 'Admin',
      groupId: 6,
      accountId: adminAccount.id,
      rankId: 0,
      townId: 1,
      level: 100,
      conditions: Buffer.alloc(0),
    },
  });

  await prisma.post.upsert({
    where: { slug: 'bem-vindo-ao-ndbo' },
    update: {},
    create: {
      authorId: adminAccount.id,
      title: 'Bem-vindo ao NDBO!',
      slug: 'bem-vindo-ao-ndbo',
      excerpt: 'O portal do servidor está no ar.',
      content: 'Esta é a primeira notícia do portal. Boas vindas, aventureiro!',
      published: true,
      publishedAt: new Date(),
    },
  });

  console.log('Seed concluído.');
  console.log(
    // a senha não vai para o log (os logs do Docker ficam visíveis no terminal do start)
    `  Conta admin: name="${adminName}" senha=SEED_ADMIN_PASSWORD (group_id=6)`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
