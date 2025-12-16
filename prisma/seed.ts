import bcrypt from 'bcrypt';
import prisma from '@/config/db';

async function main() {
  const modules = await Promise.all([
    prisma.module.create({
      data: { name: 'Tours', label: 'Tours Management', order: 1 },
    }),
    prisma.module.create({
      data: { name: 'Users', label: 'Users Management', order: 2 },
    }),
    prisma.module.create({
      data: { name: 'Reviews', label: 'Reviews Management', order: 3 },
    }),
    prisma.module.create({
      data: { name: 'Themes', label: 'Themes Management', order: 4 },
    }),
    prisma.module.create({
      data: { name: 'Cities', label: 'Cities Management', order: 5 },
    }),
  ]);

  const superAdminRole = await prisma.role.create({
    data: {
      name: 'Super Admin',
      description: 'Full access to all modules',
    },
  });

  for (const module of modules) {
    await prisma.permission.create({
      data: {
        roleId: superAdminRole.id,
        moduleId: module.id,
        view: true,
        create: true,
        edit: true,
        delete: true,
      },
    });
  }

  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.admin.create({
    data: {           
      name: 'Super Admin',
      email: 'admin@wayindia.com',
      password: hashedPassword,
      roleId: superAdminRole.id,
    },
  });

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
