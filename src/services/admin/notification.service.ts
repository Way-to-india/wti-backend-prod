import prisma from '@/config/db';

export class NotificationService {
  
  static async createNotification(data: {
    adminId: string;
    title: string;
    message: string;
    type: string;
    link?: string;
  }) {
    try {
      return await prisma.notification.create({
        data: {
          adminId: data.adminId,
          title: data.title,
          message: data.message,
          type: data.type,
          link: data.link,
        },
      });
    } catch (error) {
      console.error('Create Notification Error:', error);
      // Don't throw error to avoid breaking the main flow
      return null;
    }
  }

  static async notifySuperAdmins(data: {
    title: string;
    message: string;
    type: string;
    link?: string;
  }) {
    try {
      const superAdmins = await prisma.admin.findMany({
        where: {
          role: { name: 'Super Admin' },
          isActive: true,
        },
      });

      const notifications = superAdmins.map((admin) => ({
        adminId: admin.id,
        title: data.title,
        message: data.message,
        type: data.type,
        link: data.link,
      }));

      if (notifications.length > 0) {
        return await prisma.notification.createMany({
          data: notifications,
        });
      }
    } catch (error) {
      console.error('Notify Super Admins Error:', error);
    }
  }

  /**
   * Get notifications for an admin
   */
  static async getAdminNotifications(adminId: string, limit = 20) {
    return await prisma.notification.findMany({
      where: { adminId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get unread count
   */
  static async getUnreadCount(adminId: string) {
    return await prisma.notification.count({
      where: { adminId, isRead: false },
    });
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(id: string, adminId: string) {
    return await prisma.notification.update({
      where: { id, adminId },
      data: { isRead: true },
    });
  }

  /**
   * Mark all as read
   */
  static async markAllAsRead(adminId: string) {
    return await prisma.notification.updateMany({
      where: { adminId, isRead: false },
      data: { isRead: true },
    });
  }
}
