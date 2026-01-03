import prisma from '@/config/db';
import type { Prisma } from 'prisma/generated/prisma/client';

export class TravelGuideService {

  static async getAllStates(
    page: number = 1,
    limit: number = 50,
    sortBy: string = 'name',
    sortOrder: string = 'asc'
  ) {
    const skip = (page - 1) * limit;
    const orderBy: Prisma.TravelGuideStateOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [states, total] = await Promise.all([
      prisma.travelGuideState.findMany({
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: {
              cities: true,
              data: true,
            },
          },
        },
      }),
      prisma.travelGuideState.count(),
    ]);

    return {
      states: states.map((state) => ({
        ...state,
        citiesCount: state._count.cities,
        dataCount: state._count.data,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getStateById(id: string) {
    const state = await prisma.travelGuideState.findUnique({
      where: { id },
      include: {
        cities: {
          orderBy: {
            name: 'asc',
          },
        },
        data: true,
      },
    });

    if (!state) {
      throw new Error('State not found');
    }

    return state;
  }

  static async createState(data: { name: string; slug?: string }) {
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-');

    const state = await prisma.travelGuideState.create({
      data: {
        name: data.name,
        slug,
      },
    });

    return state;
  }

  static async updateState(id: string, data: { name?: string; slug?: string }) {
    const state = await prisma.travelGuideState.update({
      where: { id },
      data,
    });

    return state;
  }

  static async deleteState(id: string) {
    await prisma.travelGuideState.delete({
      where: { id },
    });

    return { success: true };
  }

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
    const where: Prisma.TravelGuideCityWhereInput = {};

    if (filters.stateId) {
      where.stateId = filters.stateId;
    }

    if (filters.search) {
      where.name = {
        contains: filters.search,
        mode: 'insensitive',
      };
    }

    const orderBy: Prisma.TravelGuideCityOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [cities, total] = await Promise.all([
      prisma.travelGuideCity.findMany({
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
              data: true,
            },
          },
        },
      }),
      prisma.travelGuideCity.count({ where }),
    ]);

    return {
      cities: cities.map((city) => ({
        ...city,
        dataCount: city._count.data,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getCityById(id: string) {
    const city = await prisma.travelGuideCity.findUnique({
      where: { id },
      include: {
        state: true,
        data: true,
      },
    });

    if (!city) {
      throw new Error('City not found');
    }

    return city;
  }

  static async createCity(data: {
    name: string;
    slug?: string;
    stateId: string;
    stateName: string;
  }) {
    // Generate slug if not provided
    const slug = data.slug || data.name.toLowerCase().replace(/\s+/g, '-');

    const city = await prisma.travelGuideCity.create({
      data: {
        name: data.name,
        slug,
        stateId: data.stateId,
        stateName: data.stateName,
      },
      include: {
        state: true,
      },
    });

    return city;
  }

  static async updateCity(
    id: string,
    data: {
      name?: string;
      slug?: string;
      stateId?: string;
      stateName?: string;
    }
  ) {
    const city = await prisma.travelGuideCity.update({
      where: { id },
      data,
      include: {
        state: true,
      },
    });

    return city;
  }

  static async deleteCity(id: string) {
    await prisma.travelGuideCity.delete({
      where: { id },
    });

    return { success: true };
  }

  static async getAllGuideData(
    page: number = 1,
    limit: number = 50,
    filters: {
      cityId?: string;
      stateId?: string;
      isActive?: boolean;
    } = {},
    sortBy: string = 'createdAt',
    sortOrder: string = 'desc'
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.TravelGuideDataWhereInput = {};

    if (filters.cityId) {
      where.cityId = filters.cityId;
    }

    if (filters.stateId) {
      where.stateId = filters.stateId;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const orderBy: Prisma.TravelGuideDataOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    const [guideData, total] = await Promise.all([
      prisma.travelGuideData.findMany({
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
            },
          },
          state: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      }),
      prisma.travelGuideData.count({ where }),
    ]);

    return {
      guideData,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getGuideDataById(id: string) {
    const guideData = await prisma.travelGuideData.findUnique({
      where: { id },
      include: {
        city: true,
        state: true,
      },
    });

    if (!guideData) {
      throw new Error('Guide data not found');
    }

    return guideData;
  }

  static async createGuideData(data: {
    cityId: string;
    citySlug?: string;
    stateId: string;
    stateSlug?: string;
    originalCityId?: number;
    menuId?: number;
    isActive?: boolean;
    introduction?: string;
    facts?: string;
    foodAndDining?: string;
    shopping?: string;
    nearbyPlaces?: string;
    gettingAround?: string;
    historyCulture?: string;
    otherDetails?: string;
    bestTimeToVisit?: string;
    placesToSeeTop?: string;
    placesToSeeBottom?: string;
    hotelDetails?: string;
    cityImage?: string;
  }) {
    const guideData = await prisma.travelGuideData.create({
      data: {
        ...data,
        isActive: data.isActive ?? true,
      },
      include: {
        city: true,
        state: true,
      },
    });

    return guideData;
  }

  static async updateGuideData(
    id: string,
    data: {
      cityId?: string;
      citySlug?: string;
      stateId?: string;
      stateSlug?: string;
      originalCityId?: number;
      menuId?: number;
      isActive?: boolean;
      introduction?: string;
      facts?: string;
      foodAndDining?: string;
      shopping?: string;
      nearbyPlaces?: string;
      gettingAround?: string;
      historyCulture?: string;
      otherDetails?: string;
      bestTimeToVisit?: string;
      placesToSeeTop?: string;
      placesToSeeBottom?: string;
      hotelDetails?: string;
      cityImage?: string;
    }
  ) {
    const guideData = await prisma.travelGuideData.update({
      where: { id },
      data,
      include: {
        city: true,
        state: true,
      },
    });

    return guideData;
  }

  static async deleteGuideData(id: string) {
    await prisma.travelGuideData.delete({
      where: { id },
    });

    return { success: true };
  }
}
