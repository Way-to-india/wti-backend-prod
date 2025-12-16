import prisma from '@/config/db';
import { PasswordUtil } from '@/utils/password.util';
import type { Prisma } from 'prisma/generated/prisma/client';

export interface CreateAdminInput {
  name: string;
  email: string;
  password: string;
  roleId: string;
}

export interface UpdateAdminInput {
  name?: string;
  email?: string;
  password?: string;
  roleId?: string;
  isActive?: boolean;
}

export class AdminService {
  static async createAdmin(data: CreateAdminInput) {
    const existingAdmin = await prisma.admin.findUnique({
      where: { email: data.email },
    });

    if (existingAdmin) {
      throw new Error('Admin with this email already exists');
    }

    const role = await prisma.role.findUnique({
      where: { id: data.roleId },
    });

    if (!role || !role.isActive) {
      throw new Error('Invalid or inactive role');
    }

    const hashedPassword = await PasswordUtil.hash(data.password);

    const admin = await prisma.admin.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        roleId: data.roleId,
      },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                module: true,
              },
            },
          },
        },
      },
    });

    const { password: _, refreshToken: __, ...adminData } = admin;
    return adminData;
  }

  static async getAllAdmins(
    page: number = 1,
    limit: number = 10,
    search?: string,
    isActive?: boolean,
    roleId?: string
  ) {
    const skip = (page - 1) * limit;

    const where: Prisma.AdminWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    if (roleId) {
      where.roleId = roleId;
    }

    const [admins, total] = await Promise.all([
      prisma.admin.findMany({
        where,
        skip,
        take: limit,
        include: {
          role: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.admin.count({ where }),
    ]);

    const adminsWithoutSensitiveData = admins.map(({ password, refreshToken, ...admin }) => admin);

    return {
      admins: adminsWithoutSensitiveData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getAdminById(id: string) {
    const admin = await prisma.admin.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: {
              include: {
                module: true,
              },
            },
          },
        },
      },
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    const { password: _, refreshToken: __, ...adminData } = admin;
    return adminData;
  }

  static async updateAdmin(id: string, data: UpdateAdminInput) {
    const admin = await prisma.admin.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    if (data.email && data.email !== admin.email) {
      const existingAdmin = await prisma.admin.findUnique({
        where: { email: data.email },
      });

      if (existingAdmin) {
        throw new Error('Admin with this email already exists');
      }
    }

    if (data.roleId) {
      const role = await prisma.role.findUnique({
        where: { id: data.roleId },
      });

      if (!role || !role.isActive) {
        throw new Error('Invalid or inactive role');
      }
    }

    const updateData: any = { ...data };

    if (data.password) {
      updateData.password = await PasswordUtil.hash(data.password);
    }

    const updatedAdmin = await prisma.admin.update({
      where: { id },
      data: updateData,
      include: {
        role: {
          include: {
            permissions: {
              include: {
                module: true,
              },
            },
          },
        },
      },
    });

    const { password: _, refreshToken: __, ...adminData } = updatedAdmin;
    return adminData;
  }

  static async deleteAdmin(id: string) {
    const admin = await prisma.admin.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    await prisma.admin.delete({
      where: { id },
    });
  }

  static async toggleAdminStatus(id: string) {
    const admin = await prisma.admin.findUnique({
      where: { id },
    });

    if (!admin) {
      throw new Error('Admin not found');
    }

    const updatedAdmin = await prisma.admin.update({
      where: { id },
      data: { isActive: !admin.isActive },
      include: { role: true },
    });

    const { password: _, refreshToken: __, ...adminData } = updatedAdmin;
    return adminData;
  }
}
