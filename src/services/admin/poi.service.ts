import prisma from '@/config/db';
import type { Prisma } from 'prisma/generated/prisma/client';

export class PoiService {
  // ============================================
  // CATEGORIES MANAGEMENT
  // ============================================

  /**
   * Get all categories with pagination and sorting
   */
  static async getAllCategories(
    page: number = 1,
    limit: number = 50,
    sortBy: string = 'monumentCount',
    sortOrder: string = 'desc'
  ) {
    const skip = (page - 1) * limit;
    const orderBy: Prisma.PoiCategoryOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [categories, total] = await Promise.all([
      prisma.poiCategory.findMany({
        skip,
        take: limit,
        orderBy,
      }),
      prisma.poiCategory.count(),
    ]);

    return {
      categories,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get category by ID
   */
  static async getCategoryById(id: string) {
    const category = await prisma.poiCategory.findUnique({
      where: { id },
    });

    if (!category) {
      throw new Error('Category not found');
    }

    return category;
  }

  /**
   * Create new category
   */
  static async createCategory(data: { name: string; slug?: string }) {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-');

    const category = await prisma.poiCategory.create({
      data: {
        name: data.name,
        slug,
        monumentCount: 0,
      },
    });

    return category;
  }

  /**
   * Update category
   */
  static async updateCategory(id: string, data: { name?: string; slug?: string }) {
    const category = await prisma.poiCategory.update({
      where: { id },
      data,
    });

    return category;
  }

  /**
   * Delete category
   */
  static async deleteCategory(id: string) {
    await prisma.poiCategory.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Sync monument counts for categories
   */
  static async syncCategoryCounts() {
    const categories = await prisma.poiCategory.findMany();

    for (const category of categories) {
      const count = await prisma.poiMonument.count({
        where: {
          typeofPlace: category.name,
        },
      });

      await prisma.poiCategory.update({
        where: { id: category.id },
        data: { monumentCount: count },
      });
    }

    return { success: true, message: 'Category counts synchronized' };
  }

  // ============================================
  // STATES MANAGEMENT
  // ============================================

  /**
   * Get all states with pagination and sorting
   */
  static async getAllStates(
    page: number = 1,
    limit: number = 50,
    sortBy: string = 'name',
    sortOrder: string = 'asc'
  ) {
    const skip = (page - 1) * limit;
    const orderBy: Prisma.PoiStateOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [states, total] = await Promise.all([
      prisma.poiState.findMany({
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: {
              cities: true,
            },
          },
        },
      }),
      prisma.poiState.count(),
    ]);

    return {
      states,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get state by ID with cities
   */
  static async getStateById(id: string) {
    const state = await prisma.poiState.findUnique({
      where: { id },
      include: {
        cities: {
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!state) {
      throw new Error('State not found');
    }

    return state;
  }

  /**
   * Create new state
   */
  static async createState(data: { name: string; slug?: string }) {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-');

    const state = await prisma.poiState.create({
      data: {
        name: data.name,
        slug,
        monumentCount: 0,
        cityCount: 0,
      },
    });

    return state;
  }

  /**
   * Update state
   */
  static async updateState(id: string, data: { name?: string; slug?: string }) {
    const state = await prisma.poiState.update({
      where: { id },
      data,
    });

    return state;
  }

  /**
   * Delete state
   */
  static async deleteState(id: string) {
    await prisma.poiState.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Sync monument and city counts for states
   */
  static async syncStateCounts() {
    const states = await prisma.poiState.findMany();

    for (const state of states) {
      const [cityCount, monumentCount] = await Promise.all([
        prisma.poiCity.count({
          where: { stateId: state.id },
        }),
        prisma.poiMonument.count({
          where: {
            city: {
              stateId: state.id,
            },
          },
        }),
      ]);

      await prisma.poiState.update({
        where: { id: state.id },
        data: {
          cityCount,
          monumentCount,
        },
      });
    }

    return { success: true, message: 'State counts synchronized' };
  }

  // ============================================
  // CITIES MANAGEMENT
  // ============================================

  /**
   * Get all cities with pagination, filtering, and sorting
   */
  static async getAllCities(
    page: number = 1,
    limit: number = 50,
    filters: {
      stateId?: string;
      search?: string;
    } = {},
    sortBy: string = 'name',
    sortOrder: string = 'asc'
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.PoiCityWhereInput = {};

    if (filters.stateId) {
      where.stateId = filters.stateId;
    }

    if (filters.search) {
      where.name = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    const orderBy: Prisma.PoiCityOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [cities, total] = await Promise.all([
      prisma.poiCity.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          state: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          _count: {
            select: {
              monuments: true,
            },
          },
        },
      }),
      prisma.poiCity.count({ where }),
    ]);

    return {
      cities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get city by ID with monuments
   */
  static async getCityById(id: string) {
    const city = await prisma.poiCity.findUnique({
      where: { id },
      include: {
        state: true,
        monuments: {
          orderBy: {
            monumentName: 'asc',
          },
        },
      },
    });

    if (!city) {
      throw new Error('City not found');
    }

    return city;
  }

  /**
   * Create new city
   */
  static async createCity(data: { name: string; slug: string; stateId: string }) {
    const city = await prisma.poiCity.create({
      data: {
        name: data.name,
        slug: data.slug,
        stateId: data.stateId,
        monumentCount: 0,
      },
      include: {
        state: true,
      },
    });

    return city;
  }

  /**
   * Update city
   */
  static async updateCity(
    id: string,
    data: {
      name?: string;
      slug?: string;
      stateId?: string;
    }
  ) {
    const city = await prisma.poiCity.update({
      where: { id },
      data,
      include: {
        state: true,
      },
    });

    return city;
  }

  /**
   * Delete city
   */
  static async deleteCity(id: string) {
    await prisma.poiCity.delete({
      where: { id },
    });

    return { success: true };
  }

  /**
   * Sync monument counts for cities
   */
  static async syncCityCounts() {
    const cities = await prisma.poiCity.findMany();

    for (const city of cities) {
      const count = await prisma.poiMonument.count({
        where: { cityId: city.id },
      });

      await prisma.poiCity.update({
        where: { id: city.id },
        data: { monumentCount: count },
      });
    }

    return { success: true, message: 'City counts synchronized' };
  }

  // ============================================
  // MONUMENTS MANAGEMENT
  // ============================================

  /**
   * Get all monuments with pagination and filtering
   */
  static async getAllMonuments(
    page: number = 1,
    limit: number = 50,
    filters: {
      cityId?: string;
      typeofPlace?: string;
      search?: string;
    } = {},
    sortBy: string = 'createdAt',
    sortOrder: string = 'desc'
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.PoiMonumentWhereInput = {};

    if (filters.cityId) {
      where.cityId = filters.cityId;
    }

    if (filters.typeofPlace) {
      where.typeofPlace = filters.typeofPlace;
    }

    if (filters.search) {
      where.monumentName = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    const orderBy: Prisma.PoiMonumentOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [monuments, total] = await Promise.all([
      prisma.poiMonument.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          city: {
            select: {
              id: true,
              name: true,
              slug: true,
              state: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
      prisma.poiMonument.count({ where }),
    ]);

    return {
      monuments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get monument by ID
   */
  static async getMonumentById(id: string) {
    const monument = await prisma.poiMonument.findUnique({
      where: { id },
      include: {
        city: {
          include: {
            state: true,
          },
        },
      },
    });

    if (!monument) {
      throw new Error('Monument not found');
    }

    return monument;
  }

  /**
   * Create new monument
   */
  static async createMonument(data: {
    monumentName: string;
    slug?: string;
    cityId: string;
    typeofPlace?: string;
    description?: string;
    besttime?: string;
    openingtime?: string;
    clossingtime?: string;
    weeklyoff?: string;
    entryFees?: any;
    weather?: any;
    connectivity?: any;
    location?: any;
    rating?: number;
    totalRatings?: number;
    website?: string;
    phone?: string;
  }) {
    const slug = data.slug || data.monumentName.toLowerCase().replace(/\s+/g, '-');

    const monument = await prisma.poiMonument.create({
      data: {
        ...data,
        slug,
        rating: data.rating || null,
        totalRatings: data.totalRatings || 0,
      },
      include: {
        city: {
          include: {
            state: true,
          },
        },
      },
    });

    return monument;
  }

  /**
   * Update monument
   */
  static async updateMonument(
    id: string,
    data: {
      monumentName?: string;
      slug?: string;
      cityId?: string;
      typeofPlace?: string;
      description?: string;
      besttime?: string;
      openingtime?: string;
      clossingtime?: string;
      weeklyoff?: string;
      entryFees?: any;
      weather?: any;
      connectivity?: any;
      location?: any;
      rating?: number;
      totalRatings?: number;
      website?: string;
      phone?: string;
    }
  ) {
    const monument = await prisma.poiMonument.update({
      where: { id },
      data,
      include: {
        city: {
          include: {
            state: true,
          },
        },
      },
    });

    return monument;
  }

  /**
   * Delete monument
   */
  static async deleteMonument(id: string) {
    await prisma.poiMonument.delete({
      where: { id },
    });

    return { success: true };
  }
}
