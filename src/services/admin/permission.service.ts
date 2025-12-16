import prisma from '@/config/db';

export interface SetPermissionsInput {
  roleId: string;
  moduleId: string;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

export class PermissionService {
  static async setPermissions(data: SetPermissionsInput) {
    const { roleId, moduleId, ...permissions } = data;

    // Check if role and module exist
    const [role, module] = await Promise.all([
      prisma.role.findUnique({ where: { id: roleId } }),
      prisma.module.findUnique({ where: { id: moduleId } }),
    ]);

    if (!role) throw new Error('Role not found');
    if (!module) throw new Error('Module not found');

    // Upsert permission
    const permission = await prisma.permission.upsert({
      where: {
        roleId_moduleId: {
          roleId,
          moduleId,
        },
      },
      update: permissions,
      create: {
        roleId,
        moduleId,
        ...permissions,
      },
      include: {
        module: true,
      },
    });

    return permission;
  }

  static async getPermissionsByRole(roleId: string) {
    const permissions = await prisma.permission.findMany({
      where: { roleId },
      include: {
        module: true,
      },
      orderBy: {
        module: {
          order: 'asc',
        },
      },
    });

    return permissions;
  }

  static async deletePermission(roleId: string, moduleId: string) {
    await prisma.permission.delete({
      where: {
        roleId_moduleId: {
          roleId,
          moduleId,
        },
      },
    });
  }

  static async checkPermission(
    roleId: string,
    moduleName: string,
    action: 'view' | 'create' | 'edit' | 'delete'
  ) {
    const permission = await prisma.permission.findFirst({
      where: {
        roleId,
        module: {
          name: moduleName,
        },
      },
    });

    return permission ? permission[action] : false;
  }
}
