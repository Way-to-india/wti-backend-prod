import prisma from '@/config/db';
import { EmailService } from '@/services/common/email.service';
import type { Request, Response } from 'express';

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '20',
      search = '',
      isActive,
      isEmailVerified,
      isPhoneVerified,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build where clause
    const where: any = {};

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    // Status filters
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (isEmailVerified !== undefined) {
      where.isEmailVerified = isEmailVerified === 'true';
    }
    if (isPhoneVerified !== undefined) {
      where.isPhoneVerified = isPhoneVerified === 'true';
    }

    // Build orderBy
    const orderBy: any = {};
    orderBy[sortBy as string] = sortOrder === 'asc' ? 'asc' : 'desc';

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limitNum,
        orderBy,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          countryCode: true,
          profileImage: true,
          isActive: true,
          isEmailVerified: true,
          isPhoneVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              reviews: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limitNum);

    return res.deliver(
      200,
      true,
      {
        users,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages,
          hasMore: pageNum < totalPages,
        },
      },
      'Users fetched successfully'
    );
  } catch (error: any) {
    console.error('Error fetching users:', error);
    return res.deliver(500, false, null, 'Failed to fetch users');
  }
};

export const getUserStats = async (req: Request, res: Response) => {
  try {
    const [total, active, emailVerified, phoneVerified, withReviews] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { isEmailVerified: true } }),
      prisma.user.count({ where: { isPhoneVerified: true } }),
      prisma.user.count({
        where: {
          reviews: {
            some: {},
          },
        },
      }),
    ]);

    return res.deliver(
      200,
      true,
      {
        total,
        active,
        inactive: total - active,
        emailVerified,
        phoneVerified,
        withReviews,
      },
      'User stats fetched successfully'
    );
  } catch (error: any) {
    console.error('Error fetching user stats:', error);
    return res.deliver(500, false, null, 'Failed to fetch user statistics');
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        countryCode: true,
        profileImage: true,
        profileCoverImage: true,
        address: true,
        pinCode: true,
        bio: true,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        createdAt: true,
        updatedAt: true,
        reviews: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            rating: true,
            title: true,
            comment: true,
            isActive: true,
            isVerified: true,
            createdAt: true,
            tour: {
              select: {
                id: true,
                title: true,
                slug: true,
              },
            },
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
    });

    if (!user) {
      return res.deliver(404, false, null, 'User not found');
    }

    return res.deliver(200, true, user, 'User fetched successfully');
  } catch (error: any) {
    console.error('Error fetching user:', error);
    return res.deliver(500, false, null, 'Failed to fetch user details');
  }
};

export const updateUserStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.deliver(400, false, null, 'isActive must be a boolean value');
    }

    const user = await prisma.user.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        isActive: true,
      },
    });

    return res.deliver(
      200,
      true,
      user,
      `User ${isActive ? 'activated' : 'deactivated'} successfully`
    );
  } catch (error: any) {
    console.error('Error updating user status:', error);

    if (error.code === 'P2025') {
      return res.deliver(404, false, null, 'User not found');
    }

    return res.deliver(500, false, null, 'Failed to update user status');
  }
};

/**
 * Send custom email to user
 */
export const sendEmailToUser = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { subject, message } = req.body;

    if (!subject || !message) {
      return res.deliver(400, false, null, 'Subject and message are required');
    }

    // Get user details
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        email: true,
        name: true,
      },
    });

    if (!user) {
      return res.deliver(404, false, null, 'User not found');
    }

    // Send email
    await EmailService.sendCustomEmail(user.email, subject, message, user.name);

    return res.deliver(200, true, null, 'Email sent successfully');
  } catch (error: any) {
    console.error('Error sending email:', error);
    return res.deliver(500, false, null, 'Failed to send email');
  }
};
