import prisma from '@/config/db';

export class TravelGuideService {
  /**
   * Get all states with their cities grouped
   */
  static async getAllStatesWithCities() {
    const states = await prisma.travelGuideState.findMany({
      orderBy: {
        name: 'asc',
      },
      include: {
        cities: {
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    return states.map((state) => ({
      id: state.id,
      name: state.name,
      slug: state.slug,
      citiesCount: state.cities.length,
      cities: state.cities,
    }));
  }

  /**
   * Get city details by slug with all travel guide data
   */
  static async getCityBySlug(citySlug: string) {
    const city = await prisma.travelGuideCity.findUnique({
      where: { slug: citySlug },
      include: {
        state: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        data: {
          where: {
            isActive: true,
          },
          select: {
            id: true,
            introduction: true,
            facts: true,
            foodAndDining: true,
            shopping: true,
            nearbyPlaces: true,
            gettingAround: true,
            historyCulture: true,
            otherDetails: true,
            bestTimeToVisit: true,
            placesToSeeTop: true,
            placesToSeeBottom: true,
            hotelDetails: true,
            cityImage: true,
            travelTipsStructured: true,
          },
        },
      },
    });

    if (!city) {
      return null;
    }

    // Get the first active data record (should only be one per city)
    const guideData = city.data[0] || null;

    return {
      id: city.id,
      name: city.name,
      slug: city.slug,
      state: city.state,
      guide: guideData,
    };
  }

  /**
   * Get city details by ID with all travel guide data
   */
  static async getCityById(cityId: string) {
    const city = await prisma.travelGuideCity.findUnique({
      where: { id: cityId },
      include: {
        state: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        data: {
          where: {
            isActive: true,
          },
        },
      },
    });

    if (!city) {
      return null;
    }

    const guideData = city.data[0] || null;

    return {
      id: city.id,
      name: city.name,
      slug: city.slug,
      state: city.state,
      guide: guideData,
    };
  }

  /**
   * Get all cities for a specific state
   */
  static async getCitiesByState(stateSlug: string) {
    const state = await prisma.travelGuideState.findUnique({
      where: { slug: stateSlug },
      include: {
        cities: {
          orderBy: {
            name: 'asc',
          },
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    });

    if (!state) {
      return null;
    }

    return {
      id: state.id,
      name: state.name,
      slug: state.slug,
      cities: state.cities,
    };
  }

  /**
   * Search cities by name
   */
  static async searchCities(query: string) {
    const cities = await prisma.travelGuideCity.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive',
        },
      },
      take: 10,
      include: {
        state: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });

    return cities.map((city) => ({
      id: city.id,
      name: city.name,
      slug: city.slug,
      state: city.state,
    }));
  }
}
