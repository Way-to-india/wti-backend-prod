import type { Request, Response } from 'express';
import { RoleService } from '../../services/admin/role.service';

export class RoleController {
  static async createRole(req: Request, res: Response) {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.deliver(400, false, undefined, 'Role name is required');
      }

      const role = await RoleService.createRole({ name, description });

      return res.deliver(201, true, role, 'Role created successfully');
    } catch (error) {
      console.error('Create role error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create role'
      );
    }
  }

  static async getAllRoles(req: Request, res: Response) {
    try {
      const { page = '1', limit = '10', search, isActive } = req.query;

      const result = await RoleService.getAllRoles(
        parseInt(page as string),
        parseInt(limit as string),
        search as string,
        isActive === 'true' ? true : isActive === 'false' ? false : undefined
      );

      return res.deliver(200, true, result);
    } catch (error) {
      console.error('Get all roles error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch roles'
      );
    }
  }

  static async getRoleById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const role = await RoleService.getRoleById(id);

      return res.deliver(200, true, role);
    } catch (error) {
      console.error('Get role error:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch role'
      );
    }
  }

  static async updateRole(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const role = await RoleService.updateRole(id, updateData);

      return res.deliver(200, true, role, 'Role updated successfully');
    } catch (error) {
      console.error('Update role error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update role'
      );
    }
  }

  static async deleteRole(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await RoleService.deleteRole(id);

      return res.deliver(200, true, undefined, 'Role deleted successfully');
    } catch (error) {
      console.error('Delete role error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete role'
      );
    }
  }
}
