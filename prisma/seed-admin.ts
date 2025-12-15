import prisma from '@/config/db';
import bcrypt from 'bcrypt';

async function main() {
  console.log('🌱 Starting seed...');

  const modulesData = [
    { name: 'Dashboard', label: 'Dashboard', icon: 'dashboard', order: 1 },
    { name: 'Tours', label: 'Tours Management', icon: 'tour', order: 2 },
    { name: 'Users', label: 'Users Management', icon: 'users', order: 3 },
    { name: 'Reviews', label: 'Reviews Management', icon: 'star', order: 4 },
    { name: 'Themes', label: 'Themes Management', icon: 'category', order: 5 },
    { name: 'Cities', label: 'Cities Management', icon: 'location', order: 6 },
    { name: 'Admins', label: 'Admin Management', icon: 'admin', order: 7 },
    { name: 'Roles', label: 'Role Management', icon: 'shield', order: 8 },
    { name: 'Modules', label: 'Module Management', icon: 'apps', order: 9 },
    { name: 'Permissions', label: 'Permission Management', icon: 'lock', order: 10 },
  ];

  const modules = [];
  for (const moduleData of modulesData) {
    const module = await prisma.module.upsert({
      where: { name: moduleData.name },
      update: {},
      create: moduleData,
    });
    modules.push(module);
    console.log(`✅ Created module: ${module.name}`);
  }

  // 2. Create Roles
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      name: 'Super Admin',
      description: 'Full access to all modules and actions',
    },
  });
  console.log(`✅ Created role: ${superAdminRole.name}`);

  const contentManagerRole = await prisma.role.upsert({
    where: { name: 'Content Manager' },
    update: {},
    create: {
      name: 'Content Manager',
      description: 'Can manage tours, themes, and cities',
    },
  });
  console.log(`✅ Created role: ${contentManagerRole.name}`);

  const moderatorRole = await prisma.role.upsert({
    where: { name: 'Moderator' },
    update: {},
    create: {
      name: 'Moderator',
      description: 'Can view and moderate reviews',
    },
  });
  console.log(`✅ Created role: ${moderatorRole.name}`);

  // 3. Set Permissions for Super Admin (full access)
  for (const module of modules) {
    await prisma.permission.upsert({
      where: {
        roleId_moduleId: {
          roleId: superAdminRole.id,
          moduleId: module.id,
        },
      },
      update: {},
      create: {
        roleId: superAdminRole.id,
        moduleId: module.id,
        view: true,
        create: true,
        edit: true,
        delete: true,
      },
    });
  }
  console.log(`✅ Set permissions for Super Admin`);

  // 4. Set Permissions for Content Manager
  const contentModules = modules.filter((m) =>
    ['Dashboard', 'Tours', 'Themes', 'Cities'].includes(m.name)
  );
  for (const module of contentModules) {
    await prisma.permission.upsert({
      where: {
        roleId_moduleId: {
          roleId: contentManagerRole.id,
          moduleId: module.id,
        },
      },
      update: {},
      create: {
        roleId: contentManagerRole.id,
        moduleId: module.id,
        view: true,
        create: module.name !== 'Dashboard',
        edit: module.name !== 'Dashboard',
        delete: module.name !== 'Dashboard',
      },
    });
  }
  console.log(`✅ Set permissions for Content Manager`);

  // 5. Set Permissions for Moderator
  const moderatorModules = modules.filter((m) =>
    ['Dashboard', 'Reviews', 'Users'].includes(m.name)
  );
  for (const module of moderatorModules) {
    await prisma.permission.upsert({
      where: {
        roleId_moduleId: {
          roleId: moderatorRole.id,
          moduleId: module.id,
        },
      },
      update: {},
      create: {
        roleId: moderatorRole.id,
        moduleId: module.id,
        view: true,
        create: false,
        edit: module.name === 'Reviews',
        delete: module.name === 'Reviews',
      },
    });
  }
  console.log(`✅ Set permissions for Moderator`);

  // 6. Create Super Admin User
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const superAdmin = await prisma.admin.upsert({
    where: { email: 'admin@wayindia.com' },
    update: {},
    create: {
      name: 'Super Admin',
      email: 'admin@wayindia.com',
      password: hashedPassword,
      roleId: superAdminRole.id,
    },
  });
  console.log(`✅ Created admin: ${superAdmin.email}`);

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
