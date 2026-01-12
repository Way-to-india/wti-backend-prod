import { NotificationService } from '@/services/admin/notification.service';
import type { Request, Response } from 'express';

export class NotificationController {

  static async getMyNotifications(req: Request, res: Response) {
    try {
      const adminId = (req as any).admin.id;
      const notifications = await NotificationService.getAdminNotifications(adminId);
      const unreadCount = await NotificationService.getUnreadCount(adminId);

      res.deliver(200, true, { notifications, unreadCount }, 'Notifications fetched successfully');
    } catch (error) {
      console.error('Get Notifications Error:', error);
      res.deliver(500, false, null, 'Failed to fetch notifications');
    }
  }

  static async markAsRead(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const adminId = (req as any).admin.id;
      await NotificationService.markAsRead(id, adminId);

      res.deliver(200, true, null, 'Notification marked as read');
    } catch (error) {
      console.error('Mark as Read Error:', error);
      res.deliver(500, false, null, 'Failed to mark notification as read');
    }
  }

  static async markAllAsRead(req: Request, res: Response) {
    try {
      const adminId = (req as any).admin.id;
      await NotificationService.markAllAsRead(adminId);

      res.deliver(200, true, null, 'All notifications marked as read');
    } catch (error) {
      console.error('Mark all as Read Error:', error);
      res.deliver(500, false, null, 'Failed to mark all as read');
    }
  }
}
