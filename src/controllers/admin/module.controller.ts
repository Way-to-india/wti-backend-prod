import type { Request, Response } from 'express';
import { ModuleService } from '../../services/admin/module.service';

export class ModuleController {
  static async createModule(req: Request, res: Response) {
    try {
      const { name, label, description, icon, order } = req.body;

      if (!name || !label) {
        return res.deliver(400, false, undefined, 'Name and label are required');
      }

      const module = await ModuleService.createModule({ name, label, description, icon, order });

      return res.deliver(201, true, module, 'Module created successfully');
    } catch (error) {
      console.error('Create module error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create module'
      );
    }
  }

  static async getAllModules(req: Request, res: Response) {
    try {
      const { isActive } = req.query;

      const modules = await ModuleService.getAllModules(
        isActive === 'true' ? true : isActive === 'false' ? false : undefined
      );

      return res.deliver(200, true, { modules });
    } catch (error) {
      console.error('Get all modules error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch modules'
      );
    }
  }

  static async getModuleById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const module = await ModuleService.getModuleById(id);

      return res.deliver(200, true, module);
    } catch (error) {
      console.error('Get module error:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch module'
      );
    }
  }

  static async updateModule(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const module = await ModuleService.updateModule(id, updateData);

      return res.deliver(200, true, module, 'Module updated successfully');
    } catch (error) {
      console.error('Update module error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update module'
      );
    }
  }

  static async deleteModule(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await ModuleService.deleteModule(id);

      return res.deliver(200, true, undefined, 'Module deleted successfully');
    } catch (error) {
      console.error('Delete module error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete module'
      );
    }
  }
}
