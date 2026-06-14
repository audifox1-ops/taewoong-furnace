import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      passwordHash: adminPasswordHash,
      role: 'admin',
    },
  });

  // Create regular user
  const userPasswordHash = await bcrypt.hash('user123', 10);
  await prisma.user.upsert({
    where: { username: 'user' },
    update: {},
    create: {
      username: 'user',
      passwordHash: userPasswordHash,
      role: 'user',
    },
  });

  console.log('Users seeded');

  // Create furnaces (1-20, excluding 7)
  const furnaces = [];
  for (let i = 1; i <= 20; i++) {
    if (i === 7) continue;
    furnaces.push({ no: i, name: `가열${i}호` });
  }

  for (const furnace of furnaces) {
    await prisma.furnace.upsert({
      where: { no: furnace.no },
      update: { name: furnace.name },
      create: furnace,
    });
  }

  console.log('Furnaces seeded');

  // Create sample gas readings (1 day for furnace 1)
  const furnace1 = await prisma.furnace.findUnique({ where: { no: 1 } });
  if (furnace1) {
    const startDate = new Date('2026-05-01T00:00:00');
    let cumulative = 1000;

    for (let i = 0; i < 1440; i++) { // 1 day, 1 minute intervals
      const ts = new Date(startDate.getTime() + i * 60 * 1000);
      const temp = 800 + Math.sin(i / 60) * 50 + Math.random() * 10;
      const gas = Math.random() > 0.3 ? Math.random() * 5 : 0;
      cumulative += gas;

      await prisma.gasReading.create({
        data: {
          furnaceId: furnace1.id,
          ts,
          temp,
          gas,
          gasCumulative: cumulative,
          temp2: temp + Math.random() * 5,
          temp3: temp - Math.random() * 5,
        },
      });
    }
  }

  console.log('Sample gas readings seeded');

  // Create sample charge entries
  const charges = [
    { chargeNo: '260610-001', furnaceNo: 1, shift: 'day', workDate: new Date('2026-06-10') },
    { chargeNo: '260610-002', furnaceNo: 1, shift: 'night', workDate: new Date('2026-06-10') },
    { chargeNo: '260611-001', furnaceNo: 1, shift: 'day', workDate: new Date('2026-06-11') },
    { chargeNo: '260611-002', furnaceNo: 1, shift: 'night', workDate: new Date('2026-06-11') },
  ];

  for (const charge of charges) {
    const furnace = await prisma.furnace.findUnique({ where: { no: charge.furnaceNo } });
    if (furnace) {
      const gasBefore = 1000 + Math.random() * 100;
      const gasAfter = gasBefore + 50 + Math.random() * 100;

      await prisma.chargeEntry.create({
        data: {
          chargeNo: charge.chargeNo,
          furnaceId: furnace.id,
          gasBefore,
          gasAfter,
          usage: gasAfter - gasBefore,
          workDate: charge.workDate,
          shift: charge.shift,
          source: 'manual',
        },
      });
    }
  }

  console.log('Sample charge entries seeded');
  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
