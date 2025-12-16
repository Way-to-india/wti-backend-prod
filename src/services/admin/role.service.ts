import prisma from '@/config/db';
import type { Prisma } from 'prisma/generated/prisma/client';

export interface CreateRoleInput {
  name: string;
  description?: string;
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export class RoleService {
  static async createRole(data: CreateRoleInput) {
    const existingRole = await prisma.role.findUnique({
      where: { name: data.name },
    });

    if (existingRole) {
      throw new Error('Role with this name already exists');
    }

    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
      },
    });

    return role;
  }

  static async getAllRoles(
    page: number = 1,
    limit: number = 10,
    search?: string,
    isActive?: boolean
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.RoleWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: { admins: true, permissions: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.role.count({ where }),
    ]);

    return {
      roles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getRoleById(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            module: true,
          },
        },
        _count: {
          select: { admins: true },
        },
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    return role;
  }

  static async updateRole(id: string, data: UpdateRoleInput) {
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    if (data.name && data.name !== role.name) {
      const existingRole = await prisma.role.findUnique({
        where: { name: data.name },
      });

      if (existingRole) {
        throw new Error('Role with this name already exists');
      }
    }

    const updatedRole = await prisma.role.update({
      where: { id },
      data,
      include: {
        permissions: {
          include: {
            module: true,
          },
        },
      },
    });

    return updatedRole;
  }

  static async deleteRole(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: { admins: true },
        },
      },
    });

    if (!role) {
      throw new Error('Role not found');
    }

    if (role._count.admins > 0) {
      throw new Error('Cannot delete role with assigned admins');
    }

    await prisma.role.delete({
      where: { id },
    });
  }
}
