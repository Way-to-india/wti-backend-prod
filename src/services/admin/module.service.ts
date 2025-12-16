import prisma from '@/config/db';
import type { Prisma } from 'prisma/generated/prisma/client';

export interface CreateModuleInput {
  name: string;
  label: string;
  description?: string;
  icon?: string;
  order?: number;
}

export interface UpdateModuleInput {
  name?: string;
  label?: string;
  description?: string;
  icon?: string;
  order?: number;
  isActive?: boolean;
}

export class ModuleService {
  static async createModule(data: CreateModuleInput) {
    const existingModule = await prisma.module.findUnique({
      where: { name: data.name },
    });

    if (existingModule) {
      throw new Error('Module with this name already exists');
    }

    const module = await prisma.module.create({
      data,
    });

    return module;
  }

  static async getAllModules(isActive?: boolean) {
    const where: Prisma.ModuleWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    const modules = await prisma.module.findMany({
      where,
      orderBy: { order: 'asc' },
      include: {
        _count: {
          select: { permissions: true },
        },
      },
    });

    return modules;
  }

  static async getModuleById(id: string) {
    const module = await prisma.module.findUnique({
      where: { id },
      include: {
        _count: {
          select: { permissions: true },
        },
      },
    });

    if (!module) {
      throw new Error('Module not found');
    }

    return module;
  }

  static async updateModule(id: string, data: UpdateModuleInput) {
    const module = await prisma.module.findUnique({
      where: { id },
    });

    if (!module) {
      throw new Error('Module not found');
    }

    if (data.name && data.name !== module.name) {
      const existingModule = await prisma.module.findUnique({
        where: { name: data.name },
      });

      if (existingModule) {
        throw new Error('Module with this name already exists');
      }
    }

    const updatedModule = await prisma.module.update({
      where: { id },
      data,
    });

    return updatedModule;
  }

  static async deleteModule(id: string) {
    const module = await prisma.module.findUnique({
      where: { id },
    });

    if (!module) {
      throw new Error('Module not found');
    }

    await prisma.module.delete({
      where: { id },
    });
  }
}
