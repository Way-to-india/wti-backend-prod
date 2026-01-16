import prisma from '@/config/db';

// ============================================
// LEAD TAGS
// ============================================

interface CreateLeadTagInput {
  name: string;
  label: string;
  color: string;
  icon?: string | null;
  description?: string | null;
  order?: number;
}

interface UpdateLeadTagInput {
  name?: string;
  label?: string;
  color?: string;
  icon?: string | null;
  description?: string | null;
  order?: number;
  isActive?: boolean;
}

export class LeadConfigService {
  // ============================================
  // LEAD TAGS
  // ============================================

  static async createLeadTag(data: CreateLeadTagInput) {
    const tag = await prisma.leadTag.create({
      data: {
        name: data.name,
        label: data.label,
        color: data.color,
        icon: data.icon,
        description: data.description,
        order: data.order || 0,
      },
    });

    return tag;
  }

  static async getAllLeadTags(includeInactive: boolean = false) {
    const tags = await prisma.leadTag.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { order: 'asc' },
    });

    return tags;
  }

  static async getLeadTagById(id: string) {
    const tag = await prisma.leadTag.findUnique({
      where: { id },
      include: {
        _count: {
          select: { leads: true },
        },
      },
    });

    if (!tag) {
      throw new Error('Lead tag not found');
    }

    return tag;
  }

  static async updateLeadTag(id: string, data: UpdateLeadTagInput) {
    const tag = await prisma.leadTag.update({
      where: { id },
      data,
    });

    return tag;
  }

  static async deleteLeadTag(id: string) {
    // Check if tag is in use
    const leadsCount = await prisma.lead.count({
      where: { tagId: id },
    });

    if (leadsCount > 0) {
      throw new Error(`Cannot delete tag. It is currently used by ${leadsCount} lead(s)`);
    }

    await prisma.leadTag.delete({
      where: { id },
    });

    return { success: true };
  }

  static async reorderLeadTags(tagOrders: Array<{ id: string; order: number }>) {
    const updates = tagOrders.map((item) =>
      prisma.leadTag.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    );

    await prisma.$transaction(updates);

    return { success: true };
  }

  // ============================================
  // LEAD SOURCES
  // ============================================

  static async createLeadSource(data: {
    name: string;
    label: string;
    icon?: string | null;
    color?: string | null;
    description?: string | null;
    order?: number;
  }) {
    const source = await prisma.leadSourceMaster.create({
      data: {
        name: data.name,
        label: data.label,
        icon: data.icon,
        color: data.color,
        description: data.description,
        order: data.order || 0,
      },
    });

    return source;
  }

  static async getAllLeadSources(includeInactive: boolean = false) {
    const sources = await prisma.leadSourceMaster.findMany({
      where: includeInactive ? undefined : { isActive: true },
      orderBy: { order: 'asc' },
    });

    return sources;
  }

  static async getLeadSourceById(id: string) {
    const source = await prisma.leadSourceMaster.findUnique({
      where: { id },
    });

    if (!source) {
      throw new Error('Lead source not found');
    }

    return source;
  }

  static async updateLeadSource(
    id: string,
    data: {
      name?: string;
      label?: string;
      icon?: string | null;
      color?: string | null;
      description?: string | null;
      order?: number;
      isActive?: boolean;
    }
  ) {
    const source = await prisma.leadSourceMaster.update({
      where: { id },
      data,
    });

    return source;
  }

  static async deleteLeadSource(id: string) {
    await prisma.leadSourceMaster.delete({
      where: { id },
    });

    return { success: true };
  }

  // ============================================
  // LEAD CATEGORIES
  // ============================================

  static async createLeadCategory(data: {
    name: string;
    label: string;
    icon?: string | null;
    description?: string | null;
    order?: number;
  }) {
    const category = await prisma.leadCategory.create({
      data: {
        name: data.name,
        label: data.label,
        icon: data.icon,
        description: data.description,
        order: data.order || 0,
      },
    });

    return category;
  }

  static async getAllLeadCategories(includeInactive: boolean = false) {
    const categories = await prisma.leadCategory.findMany({
      where: includeInactive ? undefined : { isActive: true },
      include: {
        _count: {
          select: { leads: true },
        },
      },
      orderBy: { order: 'asc' },
    });

    return categories;
  }

  static async getLeadCategoryById(id: string) {
    const category = await prisma.leadCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { leads: true },
        },
      },
    });

    if (!category) {
      throw new Error('Lead category not found');
    }

    return category;
  }

  static async updateLeadCategory(
    id: string,
    data: {
      name?: string;
      label?: string;
      icon?: string | null;
      description?: string | null;
      order?: number;
      isActive?: boolean;
    }
  ) {
    const category = await prisma.leadCategory.update({
      where: { id },
      data,
    });

    return category;
  }

  static async deleteLeadCategory(id: string) {
    // Check if category is in use
    const leadsCount = await prisma.lead.count({
      where: { categoryId: id },
    });

    if (leadsCount > 0) {
      throw new Error(`Cannot delete category. It is currently used by ${leadsCount} lead(s)`);
    }

    await prisma.leadCategory.delete({
      where: { id },
    });

    return { success: true };
  }

  static async reorderLeadCategories(categoryOrders: Array<{ id: string; order: number }>) {
    const updates = categoryOrders.map((item) =>
      prisma.leadCategory.update({
        where: { id: item.id },
        data: { order: item.order },
      })
    );

    await prisma.$transaction(updates);

    return { success: true };
  }

  // ============================================
  // BULK OPERATIONS
  // ============================================

  /**
   * Get all configuration data at once
   */
  static async getAllConfig() {
    const [tags, sources, categories] = await Promise.all([
      this.getAllLeadTags(),
      this.getAllLeadSources(),
      this.getAllLeadCategories(),
    ]);

    return {
      tags,
      sources,
      categories,
    };
  }

  /**
   * Seed default configuration
   */
  static async seedDefaultConfig() {
    // Default tags
    const defaultTags = [
      { name: 'NEW', label: 'New Lead', color: '#3B82F6', icon: 'new', order: 1 },
      { name: 'CONTACTED', label: 'Contacted', color: '#8B5CF6', icon: 'phone', order: 2 },
      { name: 'INTERESTED', label: 'Interested', color: '#06B6D4', icon: 'star', order: 3 },
      { name: 'QUOTED', label: 'Quoted', color: '#F59E0B', icon: 'document', order: 4 },
      { name: 'NEGOTIATING', label: 'Negotiating', color: '#EF4444', icon: 'chat', order: 5 },
      { name: 'CONFIRMED', label: 'Confirmed', color: '#10B981', icon: 'check', order: 6 },
      { name: 'LOST', label: 'Lost', color: '#6B7280', icon: 'x', order: 7 },
    ];

    // Default sources
    const defaultSources = [
      { name: 'WEBSITE_FORM', label: 'Website Form', icon: 'globe', color: '#3B82F6', order: 1 },
      { name: 'PHONE_CALL', label: 'Phone Call', icon: 'phone', color: '#10B981', order: 2 },
      { name: 'EMAIL', label: 'Email', icon: 'mail', color: '#8B5CF6', order: 3 },
      { name: 'WHATSAPP', label: 'WhatsApp', icon: 'whatsapp', color: '#25D366', order: 4 },
      { name: 'FACEBOOK', label: 'Facebook', icon: 'facebook', color: '#1877F2', order: 5 },
      { name: 'INSTAGRAM', label: 'Instagram', icon: 'instagram', color: '#E4405F', order: 6 },
      { name: 'GOOGLE_ADS', label: 'Google Ads', icon: 'google', color: '#4285F4', order: 7 },
      { name: 'REFERRAL', label: 'Referral', icon: 'users', color: '#F59E0B', order: 8 },
      { name: 'WALK_IN', label: 'Walk-in', icon: 'home', color: '#06B6D4', order: 9 },
    ];

    // Default categories
    const defaultCategories = [
      { name: 'ADVENTURE_TOUR', label: 'Adventure Tour', icon: 'mountain', order: 1 },
      { name: 'HONEYMOON_PACKAGE', label: 'Honeymoon Package', icon: 'heart', order: 2 },
      { name: 'FAMILY_TOUR', label: 'Family Tour', icon: 'users', order: 3 },
      { name: 'CORPORATE_TRAVEL', label: 'Corporate Travel', icon: 'briefcase', order: 4 },
      { name: 'HOTEL_BOOKING', label: 'Hotel Booking', icon: 'hotel', order: 5 },
      { name: 'TRANSPORT_SERVICE', label: 'Transport Service', icon: 'car', order: 6 },
      { name: 'VISA_ASSISTANCE', label: 'Visa Assistance', icon: 'document', order: 7 },
      { name: 'PILGRIMAGE', label: 'Pilgrimage', icon: 'temple', order: 8 },
    ];

    // Create tags
    for (const tag of defaultTags) {
      const existing = await prisma.leadTag.findUnique({ where: { name: tag.name } });
      if (!existing) {
        await prisma.leadTag.create({ data: tag });
      }
    }

    // Create sources
    for (const source of defaultSources) {
      const existing = await prisma.leadSourceMaster.findUnique({ where: { name: source.name } });
      if (!existing) {
        await prisma.leadSourceMaster.create({ data: source });
      }
    }

    // Create categories
    for (const category of defaultCategories) {
      const existing = await prisma.leadCategory.findUnique({ where: { name: category.name } });
      if (!existing) {
        await prisma.leadCategory.create({ data: category });
      }
    }

    return { success: true, message: 'Default configuration seeded successfully' };
  }
}
