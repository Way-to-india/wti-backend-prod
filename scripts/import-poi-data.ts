import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../src/config/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface EntryFees {
  indianAdult: number;
  indianChild: number;
  foreignAdult: number;
  foreignChild: number;
  indianCamera: number;
  foreignCamera: number;
  indianVideoCamera: number;
  foreignVideoCamera: number;
}

interface Weather {
  temperature: string;
  humiditySummer: number;
  humidityWinter: number;
  humidityMonsoon: number;
}

interface Connectivity {
  air: string;
  rail: string;
  road: string;
}

interface Location {
  latitude: number;
  longitude: number;
  googleMapUrl: string;
}

interface Monument {
  id: string;
  slug: string;
  monumentName: string;
  cityId: string;
  typeofPlace: string | null;
  description: string | null;
  besttime: string | null;
  openingtime: string | null;
  clossingtime: string | null;
  weeklyoff: string | null;
  entryFees: EntryFees | null;
  weather: Weather | null;
  connectivity: Connectivity | null;
  location: Location | null;
  rating: number | null;
  totalRatings: number | null;
  website: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

interface City {
  id: string;
  slug: string;
  name: string;
  stateId: string;
  monumentCount: number;
  createdAt: string;
  updatedAt: string;
  monuments: Monument[];
}

interface State {
  id: string;
  slug: string;
  name: string;
  monumentCount: number;
  cityCount: number;
  createdAt: string;
  updatedAt: string;
  cities: City[];
}

interface Category {
  id: string;
  slug: string;
  name: string;
  monumentCount: number;
  createdAt: string;
  updatedAt: string;
}

interface Metadata {
  id: string;
  key: string;
  data: any;
  createdAt: string;
  updatedAt: string;
}

interface PoiData {
  categories: Category[];
  metadata: Metadata[];
  states: State[];
}

async function importPoiData() {
  console.log('🚀 Starting POI data import...\n');

  try {
    // Read the JSON file
    const jsonPath = path.join(__dirname, 'poi', 'poi-export-nested-2025-12-27T18-10-04-641Z.json');
    console.log(`📂 Reading data from: ${jsonPath}`);

    const rawData = fs.readFileSync(jsonPath, 'utf-8');
    const data: PoiData = JSON.parse(rawData);

    console.log(`✅ Data loaded successfully`);
    console.log(`   - Categories: ${data.categories.length}`);
    console.log(`   - Metadata: ${data.metadata.length}`);
    console.log(`   - States: ${data.states.length}`);
    console.log(`   - Cities: ${data.states.reduce((sum, state) => sum + state.cities.length, 0)}`);
    console.log(
      `   - Monuments: ${data.states.reduce((sum, state) => sum + state.cities.reduce((citySum, city) => citySum + city.monuments.length, 0), 0)}\n`
    );

    // Import data without transaction for better performance with large datasets
    // 1. Import Categories
    console.log('📦 Importing categories...');
    let categoryCount = 0;
    for (const category of data.categories) {
      await prisma.poiCategory.upsert({
        where: { id: category.id },
        update: {
          slug: category.slug,
          name: category.name,
          monumentCount: category.monumentCount,
          updatedAt: new Date(category.updatedAt),
        },
        create: {
          id: category.id,
          slug: category.slug,
          name: category.name,
          monumentCount: category.monumentCount,
          createdAt: new Date(category.createdAt),
          updatedAt: new Date(category.updatedAt),
        },
      });
      categoryCount++;
    }
    console.log(`   ✅ Imported ${categoryCount} categories\n`);

    // 2. Import Metadata
    console.log('📊 Importing metadata...');
    let metadataCount = 0;
    for (const metadata of data.metadata) {
      await prisma.poiMetadata.upsert({
        where: { id: metadata.id },
        update: {
          key: metadata.key,
          data: metadata.data,
          updatedAt: new Date(metadata.updatedAt),
        },
        create: {
          id: metadata.id,
          key: metadata.key,
          data: metadata.data,
          createdAt: new Date(metadata.createdAt),
          updatedAt: new Date(metadata.updatedAt),
        },
      });
      metadataCount++;
    }
    console.log(`   ✅ Imported ${metadataCount} metadata records\n`);

    // 3. Import States, Cities, and Monuments
    console.log('🗺️  Importing states, cities, and monuments...');
    let stateCount = 0;
    let cityCount = 0;
    let monumentCount = 0;

    for (const state of data.states) {
      // Import State
      await prisma.poiState.upsert({
        where: { id: state.id },
        update: {
          slug: state.slug,
          name: state.name,
          monumentCount: state.monumentCount,
          cityCount: state.cityCount,
          updatedAt: new Date(state.updatedAt),
        },
        create: {
          id: state.id,
          slug: state.slug,
          name: state.name,
          monumentCount: state.monumentCount,
          cityCount: state.cityCount,
          createdAt: new Date(state.createdAt),
          updatedAt: new Date(state.updatedAt),
        },
      });
      stateCount++;

      // Import Cities for this State
      for (const city of state.cities) {
        await prisma.poiCity.upsert({
          where: { id: city.id },
          update: {
            slug: city.slug,
            name: city.name,
            stateId: city.stateId,
            monumentCount: city.monumentCount,
            updatedAt: new Date(city.updatedAt),
          },
          create: {
            id: city.id,
            slug: city.slug,
            name: city.name,
            stateId: city.stateId,
            monumentCount: city.monumentCount,
            createdAt: new Date(city.createdAt),
            updatedAt: new Date(city.updatedAt),
          },
        });
        cityCount++;

        for (const monument of city.monuments) {
          await prisma.poiMonument.upsert({
            where: { id: monument.id },
            update: {
              slug: monument.slug,
              monumentName: monument.monumentName,
              cityId: monument.cityId,
              typeofPlace: monument.typeofPlace,
              description: monument.description,
              besttime: monument.besttime,
              openingtime: monument.openingtime,
              clossingtime: monument.clossingtime,
              weeklyoff: monument.weeklyoff,
              ...(monument.entryFees !== null && { entryFees: monument.entryFees as any }),
              ...(monument.weather !== null && { weather: monument.weather as any }),
              ...(monument.connectivity !== null && { connectivity: monument.connectivity as any }),
              ...(monument.location !== null && { location: monument.location as any }),
              rating: monument.rating,
              totalRatings: monument.totalRatings ?? 0,
              website: monument.website,
              phone: monument.phone,
              updatedAt: new Date(monument.updatedAt),
            },
            create: {
              id: monument.id,
              slug: monument.slug,
              monumentName: monument.monumentName,
              cityId: monument.cityId,
              typeofPlace: monument.typeofPlace,
              description: monument.description,
              besttime: monument.besttime,
              openingtime: monument.openingtime,
              clossingtime: monument.clossingtime,
              weeklyoff: monument.weeklyoff,
              ...(monument.entryFees !== null && { entryFees: monument.entryFees as any }),
              ...(monument.weather !== null && { weather: monument.weather as any }),
              ...(monument.connectivity !== null && { connectivity: monument.connectivity as any }),
              ...(monument.location !== null && { location: monument.location as any }),
              rating: monument.rating,
              totalRatings: monument.totalRatings ?? 0,
              website: monument.website,
              phone: monument.phone,
              createdAt: new Date(monument.createdAt),
              updatedAt: new Date(monument.updatedAt),
            },
          });
          monumentCount++;
        }
      }

      // Progress indicator
      if (stateCount % 10 === 0) {
        console.log(`   📍 Processed ${stateCount}/${data.states.length} states...`);
      }
    }

    console.log(`   ✅ Imported ${stateCount} states`);
    console.log(`   ✅ Imported ${cityCount} cities`);
    console.log(`   ✅ Imported ${monumentCount} monuments\n`);

    console.log('🎉 POI data import completed successfully!\n');

    // Verify the import
    console.log('🔍 Verifying import...');
    const counts = await Promise.all([
      prisma.poiCategory.count(),
      prisma.poiMetadata.count(),
      prisma.poiState.count(),
      prisma.poiCity.count(),
      prisma.poiMonument.count(),
    ]);

    console.log('   Database counts:');
    console.log(`   - Categories: ${counts[0]}`);
    console.log(`   - Metadata: ${counts[1]}`);
    console.log(`   - States: ${counts[2]}`);
    console.log(`   - Cities: ${counts[3]}`);
    console.log(`   - Monuments: ${counts[4]}\n`);

    // Sample query to verify relationships
    console.log('🔗 Testing relationships...');
    const sampleState = await prisma.poiState.findFirst({
      include: {
        cities: {
          take: 2,
          include: {
            monuments: {
              take: 2,
            },
          },
        },
      },
    });

    if (sampleState) {
      console.log(`   ✅ Sample state: ${sampleState.name}`);
      console.log(`      - Has ${sampleState.cities.length} cities (showing 2)`);
      if (sampleState.cities[0]) {
        console.log(
          `      - City: ${sampleState.cities[0].name} has ${sampleState.cities[0].monuments.length} monuments (showing 2)`
        );
      }
    }

    console.log('\n✨ All done! POI data is ready to use.');
  } catch (error) {
    console.error('❌ Error importing POI data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the import
importPoiData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
