import prisma from '@/config/db';

interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

export class LeadAnalyticsService {
  /**
   * Get conversion metrics
   */
  static async getConversionMetrics(
    filters: DateRangeFilter & { adminId?: string; source?: string; categoryId?: string }
  ) {
    const where: any = {};

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) where.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) where.createdAt.lte = new Date(filters.endDate);
    }

    if (filters.adminId) where.assignedToId = filters.adminId;
    if (filters.source) where.source = filters.source;
    if (filters.categoryId) where.categoryId = filters.categoryId;

    const [
      totalLeads,
      confirmedLeads,
      closedWonLeads,
      closedLostLeads,
      notInterestedLeads,
      activeLeads,
      totalRevenue,
      estimatedRevenue,
    ] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.count({ where: { ...where, status: 'CONFIRMED' } }),
      prisma.lead.count({ where: { ...where, status: 'CLOSED_WON' } }),
      prisma.lead.count({ where: { ...where, status: 'CLOSED_LOST' } }),
      prisma.lead.count({ where: { ...where, status: 'NOT_INTERESTED' } }),
      prisma.lead.count({
        where: {
          ...where,
          status: {
            notIn: ['CONFIRMED', 'CLOSED_WON', 'CLOSED_LOST', 'NOT_INTERESTED'],
          },
        },
      }),
      prisma.lead.aggregate({
        where: { ...where, actualValue: { not: null } },
        _sum: { actualValue: true },
      }),
      prisma.lead.aggregate({
        where: { ...where, estimatedValue: { not: null } },
        _sum: { estimatedValue: true },
      }),
    ]);

    const convertedLeads = confirmedLeads + closedWonLeads;
    const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

    return {
      totalLeads,
      activeLeads,
      convertedLeads,
      confirmedLeads,
      closedWonLeads,
      closedLostLeads,
      notInterestedLeads,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalRevenue: totalRevenue._sum.actualValue || 0,
      estimatedRevenue: estimatedRevenue._sum.estimatedValue || 0,
    };
  }

  /**
   * Get admin performance metrics
   */
  static async getAdminPerformance(adminId?: string, dateRange?: DateRangeFilter) {
    const where: any = {};

    if (dateRange?.startDate || dateRange?.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = new Date(dateRange.startDate);
      if (dateRange.endDate) where.createdAt.lte = new Date(dateRange.endDate);
    }

    if (adminId) {
      where.assignedToId = adminId;
    }

    // Get all admins with their lead counts
    const admins = await prisma.admin.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const performanceData = await Promise.all(
      admins.map(async (admin) => {
        const adminWhere = { ...where, assignedToId: admin.id };

        const [
          totalLeads,
          activeLeads,
          convertedLeads,
          overdueLeads,
          avgResponseTime,
          totalRevenue,
        ] = await Promise.all([
          prisma.lead.count({ where: adminWhere }),
          prisma.lead.count({
            where: {
              ...adminWhere,
              status: {
                notIn: ['CONFIRMED', 'CLOSED_WON', 'CLOSED_LOST', 'NOT_INTERESTED'],
              },
            },
          }),
          prisma.lead.count({
            where: {
              ...adminWhere,
              status: { in: ['CONFIRMED', 'CLOSED_WON'] },
            },
          }),
          prisma.lead.count({
            where: {
              ...adminWhere,
              isOverdue: true,
            },
          }),
          prisma.lead.aggregate({
            where: {
              ...adminWhere,
              responseTimeMinutes: { not: null },
            },
            _avg: { responseTimeMinutes: true },
          }),
          prisma.lead.aggregate({
            where: {
              ...adminWhere,
              actualValue: { not: null },
            },
            _sum: { actualValue: true },
          }),
        ]);

        const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

        return {
          admin: {
            id: admin.id,
            name: admin.name,
            email: admin.email,
          },
          metrics: {
            totalLeads,
            activeLeads,
            convertedLeads,
            overdueLeads,
            conversionRate: Math.round(conversionRate * 100) / 100,
            avgResponseTimeMinutes: Math.round(avgResponseTime._avg.responseTimeMinutes || 0),
            totalRevenue: totalRevenue._sum.actualValue || 0,
          },
        };
      })
    );

    // Sort by total leads descending
    return performanceData.sort((a, b) => b.metrics.totalLeads - a.metrics.totalLeads);
  }

  /**
   * Get response time statistics
   */
  static async getResponseTimeStats(adminId?: string, dateRange?: DateRangeFilter) {
    const where: any = {
      responseTimeMinutes: { not: null },
    };

    if (dateRange?.startDate || dateRange?.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = new Date(dateRange.startDate);
      if (dateRange.endDate) where.createdAt.lte = new Date(dateRange.endDate);
    }

    if (adminId) {
      where.assignedToId = adminId;
    }

    const leads = await prisma.lead.findMany({
      where,
      select: {
        responseTimeMinutes: true,
        priority: true,
        assignedToId: true,
      },
    });

    const responseTimes = leads.map((l) => l.responseTimeMinutes!);

    if (responseTimes.length === 0) {
      return {
        totalLeadsResponded: 0,
        averageResponseTime: 0,
        medianResponseTime: 0,
        fastestResponse: 0,
        slowestResponse: 0,
        byPriority: {
          HOT: { count: 0, avgResponseTime: 0 },
          WARM: { count: 0, avgResponseTime: 0 },
          COLD: { count: 0, avgResponseTime: 0 },
        },
      };
    }

    const sorted = [...responseTimes].sort((a, b) => a - b);
    const average = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    const median = sorted[Math.floor(sorted.length / 2)];

    // Calculate by priority
    const byPriority = {
      HOT: { count: 0, avgResponseTime: 0 },
      WARM: { count: 0, avgResponseTime: 0 },
      COLD: { count: 0, avgResponseTime: 0 },
    };

    leads.forEach((lead) => {
      const priority = lead.priority as 'HOT' | 'WARM' | 'COLD';
      byPriority[priority].count++;
      byPriority[priority].avgResponseTime += lead.responseTimeMinutes!;
    });

    Object.keys(byPriority).forEach((priority) => {
      const p = priority as 'HOT' | 'WARM' | 'COLD';
      if (byPriority[p].count > 0) {
        byPriority[p].avgResponseTime = Math.round(
          byPriority[p].avgResponseTime / byPriority[p].count
        );
      }
    });

    return {
      totalLeadsResponded: responseTimes.length,
      averageResponseTime: Math.round(average),
      medianResponseTime: median,
      fastestResponse: sorted[0],
      slowestResponse: sorted[sorted.length - 1],
      byPriority,
    };
  }

  /**
   * Get source ROI analysis
   */
  static async getSourceROI(dateRange?: DateRangeFilter) {
    const where: any = {};

    if (dateRange?.startDate || dateRange?.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = new Date(dateRange.startDate);
      if (dateRange.endDate) where.createdAt.lte = new Date(dateRange.endDate);
    }

    const leads = await prisma.lead.findMany({
      where,
      select: {
        source: true,
        status: true,
        actualValue: true,
        estimatedValue: true,
      },
    });

    const sourceStats: Record<string, any> = {};

    leads.forEach((lead) => {
      const source = lead.source;

      if (!sourceStats[source]) {
        sourceStats[source] = {
          source,
          totalLeads: 0,
          convertedLeads: 0,
          conversionRate: 0,
          totalRevenue: 0,
          estimatedRevenue: 0,
          avgLeadValue: 0,
        };
      }

      sourceStats[source].totalLeads++;

      if (['CONFIRMED', 'CLOSED_WON'].includes(lead.status)) {
        sourceStats[source].convertedLeads++;
        sourceStats[source].totalRevenue += lead.actualValue || 0;
      }

      sourceStats[source].estimatedRevenue += lead.estimatedValue || 0;
    });

    // Calculate rates and averages
    Object.keys(sourceStats).forEach((source) => {
      const stats = sourceStats[source];
      stats.conversionRate =
        stats.totalLeads > 0
          ? Math.round((stats.convertedLeads / stats.totalLeads) * 10000) / 100
          : 0;
      stats.avgLeadValue =
        stats.convertedLeads > 0 ? Math.round(stats.totalRevenue / stats.convertedLeads) : 0;
    });

    // Convert to array and sort by conversion rate
    return Object.values(sourceStats).sort((a: any, b: any) => b.conversionRate - a.conversionRate);
  }

  /**
   * Get lead pipeline visualization data
   */
  static async getLeadPipeline(adminId?: string, dateRange?: DateRangeFilter) {
    const where: any = {};

    if (dateRange?.startDate || dateRange?.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = new Date(dateRange.startDate);
      if (dateRange.endDate) where.createdAt.lte = new Date(dateRange.endDate);
    }

    if (adminId) {
      where.assignedToId = adminId;
    }

    const statuses = [
      'NEW',
      'CONTACTED',
      'INTERESTED',
      'QUOTED',
      'NEGOTIATING',
      'FOLLOW_UP_SCHEDULED',
      'CONFIRMED',
      'CLOSED_WON',
      'CLOSED_LOST',
      'NOT_INTERESTED',
    ];

    const pipeline = await Promise.all(
      statuses.map(async (status) => {
        const [count, totalValue] = await Promise.all([
          prisma.lead.count({ where: { ...where, status: status as any } }),
          prisma.lead.aggregate({
            where: { ...where, status: status as any, estimatedValue: { not: null } },
            _sum: { estimatedValue: true },
          }),
        ]);

        return {
          status,
          count,
          totalValue: totalValue._sum.estimatedValue || 0,
        };
      })
    );

    return pipeline;
  }

  /**
   * Get performance leaderboard
   */
  static async getPerformanceLeaderboard(dateRange?: DateRangeFilter) {
    const performance = await this.getAdminPerformance(undefined, dateRange);

    // Sort by conversion rate, then by total revenue
    return performance.sort((a, b) => {
      if (b.metrics.conversionRate !== a.metrics.conversionRate) {
        return b.metrics.conversionRate - a.metrics.conversionRate;
      }
      return b.metrics.totalRevenue - a.metrics.totalRevenue;
    });
  }

  /**
   * Get daily lead report
   */
  static async getDailyLeadReport(date?: string) {
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const where = {
      createdAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    };

    const [totalLeads, bySource, byPriority, byStatus, assigned, unassigned] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.groupBy({
        by: ['source'],
        where,
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['priority'],
        where,
        _count: true,
      }),
      prisma.lead.groupBy({
        by: ['status'],
        where,
        _count: true,
      }),
      prisma.lead.count({ where: { ...where, assignedToId: { not: null } } }),
      prisma.lead.count({ where: { ...where, assignedToId: null } }),
    ]);

    return {
      date: targetDate.toISOString().split('T')[0],
      totalLeads,
      assigned,
      unassigned,
      bySource,
      byPriority,
      byStatus,
    };
  }

  /**
   * Get lost lead analysis
   */
  static async getLostLeadAnalysis(dateRange?: DateRangeFilter) {
    const where: any = {
      status: { in: ['CLOSED_LOST', 'NOT_INTERESTED'] },
    };

    if (dateRange?.startDate || dateRange?.endDate) {
      where.closedAt = {};
      if (dateRange.startDate) where.closedAt.gte = new Date(dateRange.startDate);
      if (dateRange.endDate) where.closedAt.lte = new Date(dateRange.endDate);
    }

    const lostLeads = await prisma.lead.findMany({
      where,
      select: {
        id: true,
        referenceNumber: true,
        fullName: true,
        status: true,
        lostReason: true,
        source: true,
        priority: true,
        estimatedValue: true,
        closedAt: true,
      },
    });

    // Group by reason
    const reasonStats: Record<string, number> = {};
    let totalLostValue = 0;

    lostLeads.forEach((lead) => {
      const reason = lead.lostReason || 'Not specified';
      reasonStats[reason] = (reasonStats[reason] || 0) + 1;
      totalLostValue += lead.estimatedValue || 0;
    });

    return {
      totalLostLeads: lostLeads.length,
      totalLostValue,
      byReason: Object.entries(reasonStats)
        .map(([reason, count]) => ({
          reason,
          count,
        }))
        .sort((a, b) => b.count - a.count),
      recentLostLeads: lostLeads.slice(0, 10),
    };
  }

  /**
   * Get follow-up compliance report
   */
  static async getFollowupCompliance(adminId?: string, dateRange?: DateRangeFilter) {
    const where: any = {};

    if (dateRange?.startDate || dateRange?.endDate) {
      where.createdAt = {};
      if (dateRange.startDate) where.createdAt.gte = new Date(dateRange.startDate);
      if (dateRange.endDate) where.createdAt.lte = new Date(dateRange.endDate);
    }

    if (adminId) {
      where.assignedToId = adminId;
    }

    const [totalReminders, completedReminders, overdueReminders, snoozedReminders] =
      await Promise.all([
        prisma.leadReminder.count({ where }),
        prisma.leadReminder.count({ where: { ...where, isCompleted: true } }),
        prisma.leadReminder.count({
          where: {
            ...where,
            isCompleted: false,
            isSnoozed: false,
            scheduledFor: { lt: new Date() },
          },
        }),
        prisma.leadReminder.count({ where: { ...where, isSnoozed: true } }),
      ]);

    const complianceRate =
      totalReminders > 0 ? Math.round((completedReminders / totalReminders) * 10000) / 100 : 0;

    return {
      totalReminders,
      completedReminders,
      overdueReminders,
      snoozedReminders,
      complianceRate,
    };
  }

  /**
   * Get dashboard summary
   */
  static async getDashboardSummary(adminId?: string) {
    const [conversionMetrics, todaysLeads, overdueFollowups, hotLeads, recentActivity] =
      await Promise.all([
        this.getConversionMetrics({ adminId }),
        prisma.lead.count({
          where: {
            assignedToId: adminId,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
        prisma.lead.count({
          where: {
            assignedToId: adminId,
            isOverdue: true,
          },
        }),
        prisma.lead.count({
          where: {
            assignedToId: adminId,
            priority: 'HOT',
            status: {
              notIn: ['CONFIRMED', 'CLOSED_WON', 'CLOSED_LOST', 'NOT_INTERESTED'],
            },
          },
        }),
        prisma.leadActivity.count({
          where: {
            performedById: adminId,
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
          },
        }),
      ]);

    return {
      conversionMetrics,
      todaysLeads,
      overdueFollowups,
      hotLeads,
      recentActivity,
    };
  }
}
