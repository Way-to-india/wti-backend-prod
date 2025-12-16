import type { Request, Response } from 'express';
import prisma from '@/config/db';

const serializeBigInt = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeBigInt);
  }

  if (typeof obj === 'object') {
    const serialized: any = {};
    for (const key in obj) {
      serialized[key] = serializeBigInt(obj[key]);
    }
    return serialized;
  }

  return obj;
};

export const getDashboardAnalytics = async (req: Request, res: Response) => {
  try {
    const { timeRange = '30' } = req.query; // days
    const days = parseInt(timeRange as string);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Run all queries in parallel for better performance
    const [
      // Overview Stats
      totalUsers,
      activeUsers,
      totalTours,
      activeTours,
      featuredTours,
      totalReviews,
      verifiedReviews,
      totalBookings,
      totalRevenue,

      // Recent Period Stats
      newUsersCount,
      newToursCount,
      newReviewsCount,
      recentBookings,

      // Tours Analytics
      topRatedTours,
      mostViewedTours,
      mostBookedTours,
      toursByTheme,
      toursByCity,
      toursByDifficulty,

      // User Analytics
      recentUsers,
      usersGrowth,

      // Review Analytics
      recentReviews,
      averageRating,
      ratingDistribution,

      // Revenue Analytics
      revenueByMonth,
      topRevenueGeneratingTours,

      // City & Theme Analytics
      topCities,
      topThemes,

      // Admin & System Stats
      totalAdmins,
      activeAdmins,
      totalRoles,

      // Leads Stats
      totalLeads,
      newLeads,
      tourLeads,
      hotelLeads,
      transportLeads,
      contactUsLeads,
      leadsByStatus,
      recentLeads,
      leadsConversionRate,
    ] = await Promise.all([
      // Overview Stats
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.tour.count(),
      prisma.tour.count({ where: { isActive: true } }),
      prisma.tour.count({ where: { isActive: true, isFeatured: true } }),
      prisma.tourReview.count(),
      prisma.tourReview.count({ where: { isVerified: true } }),
      prisma.tour.aggregate({ _sum: { bookingCount: true } }),
      prisma.tour.aggregate({
        _sum: {
          price: true,
        },
        where: { isActive: true },
      }),

      // Recent Period Stats
      prisma.user.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.tour.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.tourReview.count({
        where: { createdAt: { gte: startDate } },
      }),
      prisma.tour.aggregate({
        _sum: { bookingCount: true },
        where: { updatedAt: { gte: startDate } },
      }),

      // Tours Analytics
      prisma.tour.findMany({
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          slug: true,
          rating: true,
          reviewCount: true,
          price: true,
          images: true,
        },
        orderBy: { rating: 'desc' },
        take: 5,
      }),
      prisma.tour.findMany({
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          slug: true,
          viewCount: true,
          rating: true,
          price: true,
          images: true,
        },
        orderBy: { viewCount: 'desc' },
        take: 5,
      }),
      prisma.tour.findMany({
        where: { isActive: true },
        select: {
          id: true,
          title: true,
          slug: true,
          bookingCount: true,
          rating: true,
          price: true,
          images: true,
        },
        orderBy: { bookingCount: 'desc' },
        take: 5,
      }),
      prisma.theme.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          label: true,
          tourCount: true,
          imageUrl: true,
        },
        orderBy: { tourCount: 'desc' },
        take: 10,
      }),
      prisma.city.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          tourCount: true,
          imageUrl: true,
        },
        orderBy: { tourCount: 'desc' },
        take: 10,
      }),
      prisma.tour.groupBy({
        by: ['difficulty'],
        _count: { id: true },
        where: {
          isActive: true,
          difficulty: { not: null },
        },
      }),

      // User Analytics
      prisma.user.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          email: true,
          profileImage: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('day', "createdAt") as date,
          COUNT(*)::int as count
        FROM users
        WHERE "createdAt" >= ${startDate}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date ASC
      `,

      // Review Analytics
      prisma.tourReview.findMany({
        where: { isActive: true },
        select: {
          id: true,
          rating: true,
          title: true,
          comment: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              profileImage: true,
            },
          },
          tour: {
            select: {
              title: true,
              slug: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.tourReview.aggregate({
        _avg: { rating: true },
        where: { isActive: true },
      }),
      prisma.tourReview.groupBy({
        by: ['rating'],
        _count: { id: true },
        where: { isActive: true },
      }),

      // Revenue Analytics
      prisma.$queryRaw`
        SELECT 
          DATE_TRUNC('month', "updatedAt") as month,
          SUM("bookingCount" * "price")::bigint as revenue,
          SUM("bookingCount")::int as bookings
        FROM tours
        WHERE "updatedAt" >= ${startDate} AND "isActive" = true
        GROUP BY DATE_TRUNC('month', "updatedAt")
        ORDER BY month DESC
        LIMIT 12
      `,
      prisma.tour.findMany({
        where: {
          isActive: true,
          bookingCount: { gt: 0 },
        },
        select: {
          id: true,
          title: true,
          slug: true,
          price: true,
          bookingCount: true,
          images: true,
        },
        orderBy: [{ bookingCount: 'desc' }],
        take: 10,
      }),

      // City & Theme Analytics
      prisma.city.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          tourCount: true,
          imageUrl: true,
          stateName: true,
        },
        orderBy: { tourCount: 'desc' },
        take: 8,
      }),
      prisma.theme.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          label: true,
          tourCount: true,
          imageUrl: true,
          icon: true,
        },
        orderBy: { tourCount: 'desc' },
        take: 8,
      }),

      // Admin & System Stats
      prisma.admin.count(),
      prisma.admin.count({ where: { isActive: true } }),
      prisma.role.count({ where: { isActive: true } }),

      // Leads Stats
      prisma.lead.count(),
      prisma.lead.count({
        where: {
          status: 'NEW',
          createdAt: { gte: startDate },
        },
      }),
      prisma.lead.count({ where: { source: 'TOUR_QUERY' } }),
      prisma.lead.count({ where: { source: 'HOTEL_QUERY' } }),
      prisma.lead.count({ where: { source: 'TRANSPORT_QUERY' } }),
      prisma.lead.count({ where: { source: 'CONTACT_US' } }),
      prisma.lead.groupBy({
        by: ['status'],
        _count: { id: true },
      }),
      prisma.lead.findMany({
        where: { createdAt: { gte: startDate } },
        select: {
          id: true,
          referenceNumber: true,
          fullName: true,
          email: true,
          phoneNumber: true,
          source: true,
          status: true,
          priority: true,
          createdAt: true,
          assignedTo: {
            select: {
              name: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.lead.aggregate({
        _count: {
          id: true,
        },
        where: {
          status: 'CONVERTED',
        },
      }),
    ]);

    // Calculate derived metrics
    const totalBookingsCount = totalBookings._sum.bookingCount || 0;
    const estimatedRevenue = totalRevenue._sum.price || 0;
    const recentBookingsCount = recentBookings._sum.bookingCount || 0;
    const avgRating = averageRating._avg.rating || 0;
    const convertedLeadsCount = leadsConversionRate._count.id || 0;
    const conversionRate =
      totalLeads > 0 ? ((convertedLeadsCount / totalLeads) * 100).toFixed(2) : '0';

    // Calculate growth percentages
    const userGrowthRate = totalUsers > 0 ? ((newUsersCount / totalUsers) * 100).toFixed(2) : '0';
    const tourGrowthRate = totalTours > 0 ? ((newToursCount / totalTours) * 100).toFixed(2) : '0';
    const reviewGrowthRate =
      totalReviews > 0 ? ((newReviewsCount / totalReviews) * 100).toFixed(2) : '0';

    // Format rating distribution
    const ratingStats = ratingDistribution.reduce(
      (acc, item) => {
        acc[`rating_${item.rating}`] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    // Format lead status distribution
    const leadStatusStats = leadsByStatus.reduce(
      (acc, item) => {
        acc[item.status.toLowerCase()] = item._count.id;
        return acc;
      },
      {} as Record<string, number>
    );

    // Calculate revenue from top tours
    const topRevenueWithCalculations = topRevenueGeneratingTours.map((tour) => ({
      ...tour,
      totalRevenue: tour.price * tour.bookingCount,
    }));

    // Serialize revenue data to handle BigInt
    const serializedRevenueByMonth = serializeBigInt(revenueByMonth);

    // Prepare response payload
    const dashboardData = {
      overview: {
        users: {
          total: totalUsers,
          active: activeUsers,
          inactive: totalUsers - activeUsers,
          newInPeriod: newUsersCount,
          growthRate: `${userGrowthRate}%`,
        },
        tours: {
          total: totalTours,
          active: activeTours,
          inactive: totalTours - activeTours,
          featured: featuredTours,
          newInPeriod: newToursCount,
          growthRate: `${tourGrowthRate}%`,
        },
        reviews: {
          total: totalReviews,
          verified: verifiedReviews,
          pending: totalReviews - verifiedReviews,
          newInPeriod: newReviewsCount,
          averageRating: Number(avgRating.toFixed(2)),
          growthRate: `${reviewGrowthRate}%`,
        },
        bookings: {
          total: totalBookingsCount,
          recentPeriod: recentBookingsCount,
          estimatedRevenue: estimatedRevenue,
        },
        admins: {
          total: totalAdmins,
          active: activeAdmins,
          roles: totalRoles,
        },
        leads: {
          total: totalLeads,
          new: newLeads,
          bySource: {
            tour: tourLeads,
            hotel: hotelLeads,
            transport: transportLeads,
            contactUs: contactUsLeads,
          },
          byStatus: leadStatusStats,
          converted: convertedLeadsCount,
          conversionRate: `${conversionRate}%`,
        },
      },

      analytics: {
        topRatedTours: topRatedTours.map((tour) => ({
          ...tour,
          rating: Number(tour.rating),
          image: tour.images[0] || null,
        })),
        mostViewedTours: mostViewedTours.map((tour) => ({
          ...tour,
          rating: Number(tour.rating),
          image: tour.images[0] || null,
        })),
        mostBookedTours: mostBookedTours.map((tour) => ({
          ...tour,
          rating: Number(tour.rating),
          image: tour.images[0] || null,
        })),
        topRevenueGeneratingTours: topRevenueWithCalculations.map((tour) => ({
          id: tour.id,
          title: tour.title,
          slug: tour.slug,
          price: tour.price,
          bookings: tour.bookingCount,
          totalRevenue: tour.totalRevenue,
          image: tour.images[0] || null,
        })),
      },

      distributions: {
        toursByTheme: toursByTheme,
        toursByCity: toursByCity.slice(0, 10),
        toursByDifficulty: toursByDifficulty,
        ratingDistribution: ratingStats,
      },

      trends: {
        usersGrowth: usersGrowth,
        revenueByMonth: serializedRevenueByMonth,
      },

      recent: {
        users: recentUsers,
        reviews: recentReviews,
        leads: recentLeads,
      },

      topPerformers: {
        cities: topCities,
        themes: topThemes,
      },

      metadata: {
        timeRange: `${days} days`,
        generatedAt: new Date().toISOString(),
      },
    };

    res.deliver(200, true, dashboardData, 'Dashboard analytics fetched successfully');
  } catch (error) {
    console.error('Dashboard Analytics Error:', error);
    res.deliver(500, false, null, 'Failed to fetch dashboard analytics');
  }
};
