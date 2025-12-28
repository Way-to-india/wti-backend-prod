import prisma from '@/config/db';

export class PoiService {
  /**
   * Get all categories with monument counts
   */
  static async getAllCategories() {
    const categories = await prisma.poiCategory.findMany({
      orderBy: {
        monumentCount: 'desc',
      },
      select: {
        id: true,
        slug: true,
        name: true,
        monumentCount: true,
      },
    });

    return categories;
  }

  /**
   * Get category by slug with monuments
   */
  static async getCategoryBySlug(slug: string, page: number = 1, limit: number = 20) {
    const category = await prisma.poiCategory.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        monumentCount: true,
      },
    });

    if (!category) {
      return null;
    }

    const skip = (page - 1) * limit;

    const [monuments, total] = await Promise.all([
      prisma.poiMonument.findMany({
        where: {
          typeofPlace: category.name,
        },
        skip,
        take: limit,
        orderBy: {
          rating: 'desc',
        },
        select: {
          id: true,
          slug: true,
          monumentName: true,
          typeofPlace: true,
          description: true,
          rating: true,
          totalRatings: true,
          location: true,
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
      prisma.poiMonument.count({
        where: {
          typeofPlace: category.name,
        },
      }),
    ]);

    return {
      category,
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
   * Get all states with counts
   */
  static async getAllStates() {
    const states = await prisma.poiState.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        slug: true,
        name: true,
        monumentCount: true,
        cityCount: true,
      },
    });

    return states;
  }

  /**
   * Get state by slug with cities
   */
  static async getStateBySlug(slug: string) {
    const state = await prisma.poiState.findUnique({
      where: { slug },
      include: {
        cities: {
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            slug: true,
            name: true,
            monumentCount: true,
          },
        },
      },
    });

    return state;
  }

  /**
   * Get all cities in a state
   */
  static async getCitiesByState(stateSlug: string) {
    const state = await prisma.poiState.findUnique({
      where: { slug: stateSlug },
      include: {
        cities: {
          orderBy: {
            monumentCount: 'desc',
          },
          select: {
            id: true,
            slug: true,
            name: true,
            monumentCount: true,
          },
        },
      },
    });

    if (!state) {
      return null;
    }

    return {
      state: {
        id: state.id,
        name: state.name,
        slug: state.slug,
        monumentCount: state.monumentCount,
        cityCount: state.cityCount,
      },
      cities: state.cities,
    };
  }

  /**
   * Get all monuments in a state
   */
  static async getMonumentsByState(stateSlug: string, page: number = 1, limit: number = 20) {
    const state = await prisma.poiState.findUnique({
      where: { slug: stateSlug },
      select: { id: true, name: true, slug: true },
    });

    if (!state) {
      return null;
    }

    const skip = (page - 1) * limit;

    const [monuments, total] = await Promise.all([
      prisma.poiMonument.findMany({
        where: {
          city: {
            stateId: state.id,
          },
        },
        skip,
        take: limit,
        orderBy: {
          rating: 'desc',
        },
        select: {
          id: true,
          slug: true,
          monumentName: true,
          typeofPlace: true,
          description: true,
          rating: true,
          totalRatings: true,
          location: true,
          city: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.poiMonument.count({
        where: {
          city: {
            stateId: state.id,
          },
        },
      }),
    ]);

    return {
      state,
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
   * Get all cities with pagination
   */
  static async getAllCities(page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const [cities, total] = await Promise.all([
      prisma.poiCity.findMany({
        skip,
        take: limit,
        orderBy: {
          monumentCount: 'desc',
        },
        select: {
          id: true,
          slug: true,
          name: true,
          monumentCount: true,
          state: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.poiCity.count(),
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
   * Get city by slug with monuments
   */
  static async getCityBySlug(slug: string) {
    const city = await prisma.poiCity.findFirst({
      where: { slug },
      include: {
        state: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        monuments: {
          orderBy: {
            rating: 'desc',
          },
          select: {
            id: true,
            slug: true,
            monumentName: true,
            typeofPlace: true,
            description: true,
            rating: true,
            totalRatings: true,
            location: true,
          },
        },
      },
    });

    return city;
  }

  /**
   * Get all monuments in a city
   */
  static async getMonumentsByCity(citySlug: string, page: number = 1, limit: number = 20) {
    const city = await prisma.poiCity.findFirst({
      where: { slug: citySlug },
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
    });

    if (!city) {
      return null;
    }

    const skip = (page - 1) * limit;

    const [monuments, total] = await Promise.all([
      prisma.poiMonument.findMany({
        where: {
          cityId: city.id,
        },
        skip,
        take: limit,
        orderBy: {
          rating: 'desc',
        },
        select: {
          id: true,
          slug: true,
          monumentName: true,
          typeofPlace: true,
          description: true,
          besttime: true,
          openingtime: true,
          clossingtime: true,
          weeklyoff: true,
          entryFees: true,
          weather: true,
          connectivity: true,
          location: true,
          rating: true,
          totalRatings: true,
          website: true,
          phone: true,
        },
      }),
      prisma.poiMonument.count({
        where: {
          cityId: city.id,
        },
      }),
    ]);

    return {
      city,
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
   * Get all monuments with filters
   */
  static async getAllMonuments(filters: {
    page?: number;
    limit?: number;
    category?: string;
    stateSlug?: string;
    citySlug?: string;
    minRating?: number;
  }) {
    const { page = 1, limit = 20, category, stateSlug, citySlug, minRating } = filters;

    const skip = (page - 1) * limit;

    const where: any = {};

    if (category) {
      where.typeofPlace = category;
    }

    if (minRating) {
      where.rating = {
        gte: minRating,
      };
    }

    if (citySlug) {
      where.city = {
        slug: citySlug,
      };
    } else if (stateSlug) {
      where.city = {
        state: {
          slug: stateSlug,
        },
      };
    }

    const [monuments, total] = await Promise.all([
      prisma.poiMonument.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          rating: 'desc',
        },
        select: {
          id: true,
          slug: true,
          monumentName: true,
          typeofPlace: true,
          description: true,
          rating: true,
          totalRatings: true,
          location: true,
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
   * Get monument by slug
   */
  static async getMonumentBySlug(slug: string) {
    const monument = await prisma.poiMonument.findUnique({
      where: { slug },
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
    });

    return monument;
  }

  /**
   * Search monuments by name
   */
  static async searchMonuments(query: string, page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [monuments, total] = await Promise.all([
      prisma.poiMonument.findMany({
        where: {
          monumentName: {
            contains: query,
            mode: 'insensitive',
          },
        },
        skip,
        take: limit,
        orderBy: {
          rating: 'desc',
        },
        select: {
          id: true,
          slug: true,
          monumentName: true,
          typeofPlace: true,
          description: true,
          rating: true,
          totalRatings: true,
          location: true,
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
      prisma.poiMonument.count({
        where: {
          monumentName: {
            contains: query,
            mode: 'insensitive',
          },
        },
      }),
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
}
