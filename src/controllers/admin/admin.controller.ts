import type { Request, Response } from 'express';
import { AdminService } from '@/services/admin/admin.service';

export class AdminController {
  static async createAdmin(req: Request, res: Response) {
    try {
      console.log(req.body);
      const { name, email, password, roleId } = req.body;

      if (!name || !email || !password || !roleId) {
        return res.deliver(400, false, undefined, 'All fields are required');
      }

      const admin = await AdminService.createAdmin({ name, email, password, roleId });

      return res.deliver(201, true, admin, 'Admin created successfully');
    } catch (error) {
      console.error('Create admin error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to create admin'
      );
    }
  }

  static async getAllAdmins(req: Request, res: Response) {
    try {
      const { page = '1', limit = '10', search, isActive, roleId } = req.query;

      const result = await AdminService.getAllAdmins(
        parseInt(page as string),
        parseInt(limit as string),
        search as string,
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        roleId as string
      );

      return res.deliver(200, true, result);
    } catch (error) {
      console.error('Get all admins error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch admins'
      );
    }
  }

  static async getAdminById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const admin = await AdminService.getAdminById(id);

      return res.deliver(200, true, admin);
    } catch (error) {
      console.error('Get admin error:', error);
      return res.deliver(
        404,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to fetch admin'
      );
    }
  }

  static async updateAdmin(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const admin = await AdminService.updateAdmin(id, updateData);

      return res.deliver(200, true, admin, 'Admin updated successfully');
    } catch (error) {
      console.error('Update admin error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update admin'
      );
    }
  }

  static async deleteAdmin(req: Request, res: Response) {
    try {
      const { id } = req.params;

      await AdminService.deleteAdmin(id);

      return res.deliver(200, true, undefined, 'Admin deleted successfully');
    } catch (error) {
      console.error('Delete admin error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to delete admin'
      );
    }
  }

  static async toggleAdminStatus(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const admin = await AdminService.toggleAdminStatus(id);

      return res.deliver(200, true, admin, 'Admin status updated successfully');
    } catch (error) {
      console.error('Toggle admin status error:', error);
      return res.deliver(
        500,
        false,
        undefined,
        error instanceof Error ? error.message : 'Failed to update admin status'
      );
    }
  }
}
