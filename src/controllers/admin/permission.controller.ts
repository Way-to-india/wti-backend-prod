import type { Request, Response } from 'express';
import { PermissionService } from '../../services/admin/permission.service';

export class PermissionController {
  
  static async setPermissions(req: Request, res: Response) {
    try {
      const { roleId, moduleId, view, create, edit, delete: del } = req.body;

      if (!roleId || !moduleId) {
        return res.deliver(400, false, undefined, 'Role ID and Module ID are required');
      }

      const permission = await PermissionService.setPermissions({
        roleId,
        moduleId,
        view: view ?? false,
        create: create ?? false,
        edit: edit ?? false,
        delete: del ?? false,
      });

      return res.deliver(200, true, permission, 'Permissions updated successfully');
    } catch (error) {
      console.error('Set permissions error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to set permissions'
      );
    }
  }

  static async getPermissionsByRole(req: Request, res: Response) {
    try {
      const { roleId } = req.params;

      const permissions = await PermissionService.getPermissionsByRole(roleId);

      return res.deliver(200, true, { permissions });
    } catch (error) {
      console.error('Get permissions error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch permissions'
      );
    }
  }

  static async deletePermission(req: Request, res: Response) {
    try {
      const { roleId, moduleId } = req.params;

      await PermissionService.deletePermission(roleId, moduleId);

      return res.deliver(200, true, undefined, 'Permission deleted successfully');
    } catch (error) {
      console.error('Delete permission error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete permission'
      );
    }
  }
}
