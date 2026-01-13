import prisma from '@/config/db';

async function main() {
  console.log('🌱 Starting CRM permissions seed...');

  // 1. Create CRM Module
  const crmModule = await prisma.module.upsert({
    where: { name: 'CRM' },
    update: {},
    create: {
      name: 'CRM',
      label: 'CRM & Lead Management',
      icon: 'clipboard',
      order: 11,
    },
  });
  console.log(`✅ Created module: ${crmModule.name}`);

  // 2. Get Super Admin Role
  const superAdminRole = await prisma.role.findUnique({
    where: { name: 'Super Admin' },
  });

  if (!superAdminRole) {
    console.error('❌ Super Admin role not found. Please run seed-admin.ts first.');
    process.exit(1);
  }

  // 3. Set Full CRM Permissions for Super Admin
  await prisma.permission.upsert({
    where: {
      roleId_moduleId: {
        roleId: superAdminRole.id,
        moduleId: crmModule.id,
      },
    },
    update: {},
    create: {
      roleId: superAdminRole.id,
      moduleId: crmModule.id,
      view: true,
      create: true,
      edit: true,
      delete: true,
    },
  });
  console.log(`✅ Set CRM permissions for Super Admin`);

  // 4. Optional: Set CRM Permissions for Content Manager (view only)
  const contentManagerRole = await prisma.role.findUnique({
    where: { name: 'Content Manager' },
  });

  if (contentManagerRole) {
    await prisma.permission.upsert({
      where: {
        roleId_moduleId: {
          roleId: contentManagerRole.id,
          moduleId: crmModule.id,
        },
      },
      update: {},
      create: {
        roleId: contentManagerRole.id,
        moduleId: crmModule.id,
        view: true,
        create: true,
        edit: true,
        delete: false,
      },
    });
    console.log(`✅ Set CRM permissions for Content Manager`);
  }

  console.log('🎉 CRM permissions seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ CRM permissions seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
