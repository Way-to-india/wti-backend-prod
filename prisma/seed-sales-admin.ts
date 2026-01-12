import prisma from '@/config/db';
import bcrypt from 'bcrypt';

async function main() {     

  console.log('🌱 Starting Sales Admin seed...');

  // 1. Get CRM Module
  const crmModule = await prisma.module.findUnique({
    where: { name: 'CRM' },
  });

  if (!crmModule) {
    console.error('❌ CRM module not found. Please run seed-crm-permissions.ts first.');
    process.exit(1);
  }

  // 2. Create Sales Admin Role
  const salesAdminRole = await prisma.role.upsert({
    where: { name: 'Sales Admin' },
    update: {},
    create: {
      name: 'Sales Admin',
      description: 'Handles lead management and customer follow-ups',
    },
  });
  console.log(`✅ Created role: ${salesAdminRole.name}`);

  // 3. Set CRM Permissions for Sales Admin
  await prisma.permission.upsert({
    where: {
      roleId_moduleId: {
        roleId: salesAdminRole.id,
        moduleId: crmModule.id,
      },
    },
    update: {},
    create: {
      roleId: salesAdminRole.id,
      moduleId: crmModule.id,
      view: true,
      create: true,
      edit: true,
      delete: false,
    },
  });
  console.log(`✅ Set CRM permissions for Sales Admin`);

  // 4. Create Sales Admin User
  const hashedPassword = await bcrypt.hash('sales123', 10);
  const salesAdmin = await prisma.admin.upsert({
    where: { email: 'sales@wayindia.com' },
    update: {},
    create: {
      name: 'Sales Manager',
      email: 'sales@wayindia.com',
      password: hashedPassword,
      roleId: salesAdminRole.id,
    },
  });
  console.log(`✅ Created admin: ${salesAdmin.email}`);

  console.log('🎉 Sales Admin seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
