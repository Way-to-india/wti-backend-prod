import prisma from '@/config/db';
import * as fs from 'fs';
import * as path from 'path';

interface State {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

interface City {
  id: string;
  name: string;
  slug: string;
  stateId: string;
  stateName: string;
  createdAt: string;
  updatedAt: string;
}

interface TravelGuideDataItem {
  id: string;
  cityId: string;
  citySlug: string | null;
  stateId: string;
  stateSlug: string | null;
  originalCityId: number | null;
  menuId: number | null;
  isActive: boolean;
  introduction: string | null;
  facts: string | null;
  foodAndDining: string | null;
  shopping: string | null;
  nearbyPlaces: string | null;
  gettingAround: string | null;
  historyCulture: string | null;
  otherDetails: string | null;
  bestTimeToVisit: string | null;
  placesToSeeTop: string | null;
  placesToSeeBottom: string | null;
  hotelDetails: string | null;
  cityImage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ImportData {
  states: State[];
  cities: City[];
  data: TravelGuideDataItem[];
  metadata: {
    exportedAt: string;
    totalStates: number;
    totalCities: number;
    totalDataRecords: number;
  };
}

async function importTravelGuideData() {
  console.log('🚀 Starting Travel Guide Data Import...\n');

  try {
    const jsonFilePath = path.join(
      __dirname,
      '../src/exports/travel-guide-export-2025-12-24T14-33-49-463Z.json'
    );

    console.log(`📖 Reading file: ${jsonFilePath}`);
    const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
    const importData: ImportData = JSON.parse(fileContent);

    console.log('\n📊 Import Statistics:');
    console.log(`   States: ${importData.metadata.totalStates}`);
    console.log(`   Cities: ${importData.metadata.totalCities}`);
    console.log(`   Data Records: ${importData.metadata.totalDataRecords}`);
    console.log(`   Exported At: ${importData.metadata.exportedAt}\n`);

    // Step 1: Import States (No transaction needed - fast operation)
    console.log('📍 Step 1/3: Importing States...');
    let statesImported = 0;
    let statesSkipped = 0;

    for (const state of importData.states) {
      try {
        await prisma.travelGuideState.upsert({
          where: { id: state.id },
          update: {
            name: state.name,
            slug: state.slug,
            updatedAt: new Date(state.updatedAt),
          },
          create: {
            id: state.id,
            name: state.name,
            slug: state.slug,
            createdAt: new Date(state.createdAt),
            updatedAt: new Date(state.updatedAt),
          },
        });
        statesImported++;
        process.stdout.write(`\r   Imported: ${statesImported}/${importData.states.length}`);
      } catch (error: any) {
        statesSkipped++;
        console.error(`\n   ⚠️  Error importing state ${state.name}:`, error.message);
      }
    }
    console.log(`\n   ✅ States imported: ${statesImported}, Skipped: ${statesSkipped}\n`);

    // Step 2: Import Cities (No transaction needed)
    console.log('🏙️  Step 2/3: Importing Cities...');
    let citiesImported = 0;
    let citiesSkipped = 0;

    for (const city of importData.cities) {
      try {
        await prisma.travelGuideCity.upsert({
          where: { id: city.id },
          update: {
            name: city.name,
            slug: city.slug,
            stateName: city.stateName,
            updatedAt: new Date(city.updatedAt),
          },
          create: {
            id: city.id,
            name: city.name,
            slug: city.slug,
            stateId: city.stateId,
            stateName: city.stateName,
            createdAt: new Date(city.createdAt),
            updatedAt: new Date(city.updatedAt),
          },
        });
        citiesImported++;
        process.stdout.write(`\r   Imported: ${citiesImported}/${importData.cities.length}`);
      } catch (error: any) {
        citiesSkipped++;
        console.error(`\n   ⚠️  Error importing city ${city.name}:`, error.message);
      }
    }
    console.log(`\n   ✅ Cities imported: ${citiesImported}, Skipped: ${citiesSkipped}\n`);

    // Step 3: Import Travel Guide Data (No transaction, no validation - trust the data)
    console.log('📝 Step 3/3: Importing Travel Guide Data...');
    let dataImported = 0;
    let dataSkipped = 0;

    for (const dataItem of importData.data) {
      try {
        await prisma.travelGuideData.upsert({
          where: { id: dataItem.id },
          update: {
            citySlug: dataItem.citySlug,
            stateSlug: dataItem.stateSlug,
            originalCityId: dataItem.originalCityId,
            menuId: dataItem.menuId,
            isActive: dataItem.isActive,
            introduction: dataItem.introduction,
            facts: dataItem.facts,
            foodAndDining: dataItem.foodAndDining,
            shopping: dataItem.shopping,
            nearbyPlaces: dataItem.nearbyPlaces,
            gettingAround: dataItem.gettingAround,
            historyCulture: dataItem.historyCulture,
            otherDetails: dataItem.otherDetails,
            bestTimeToVisit: dataItem.bestTimeToVisit,
            placesToSeeTop: dataItem.placesToSeeTop,
            placesToSeeBottom: dataItem.placesToSeeBottom,
            hotelDetails: dataItem.hotelDetails,
            cityImage: dataItem.cityImage,
            updatedAt: new Date(dataItem.updatedAt),
          },
          create: {
            id: dataItem.id,
            cityId: dataItem.cityId,
            citySlug: dataItem.citySlug,
            stateId: dataItem.stateId,
            stateSlug: dataItem.stateSlug,
            originalCityId: dataItem.originalCityId,
            menuId: dataItem.menuId,
            isActive: dataItem.isActive,
            introduction: dataItem.introduction,
            facts: dataItem.facts,
            foodAndDining: dataItem.foodAndDining,
            shopping: dataItem.shopping,
            nearbyPlaces: dataItem.nearbyPlaces,
            gettingAround: dataItem.gettingAround,
            historyCulture: dataItem.historyCulture,
            otherDetails: dataItem.otherDetails,
            bestTimeToVisit: dataItem.bestTimeToVisit,
            placesToSeeTop: dataItem.placesToSeeTop,
            placesToSeeBottom: dataItem.placesToSeeBottom,
            hotelDetails: dataItem.hotelDetails,
            cityImage: dataItem.cityImage,
            createdAt: new Date(dataItem.createdAt),
            updatedAt: new Date(dataItem.updatedAt),
          },
        });
        dataImported++;
        process.stdout.write(`\r   Imported: ${dataImported}/${importData.data.length}`);
      } catch (error: any) {
        dataSkipped++;
        console.error(
          `\n   ⚠️  Error importing data for cityId ${dataItem.cityId}:`,
          error.message
        );
      }
    }
    console.log(`\n   ✅ Data records imported: ${dataImported}, Skipped: ${dataSkipped}\n`);

    console.log('✨ Import completed successfully!\n');

    // Display final statistics
    const finalStats = await getFinalStatistics();
    console.log('📈 Final Database Statistics:');
    console.log(`   Total States: ${finalStats.states}`);
    console.log(`   Total Cities: ${finalStats.cities}`);
    console.log(`   Total Data Records: ${finalStats.data}`);
    console.log(`   Active Data Records: ${finalStats.activeData}\n`);
  } catch (error: any) {
    console.error('\n❌ Import failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function getFinalStatistics() {
  const [states, cities, data, activeData] = await Promise.all([
    prisma.travelGuideState.count(),
    prisma.travelGuideCity.count(),
    prisma.travelGuideData.count(),
    prisma.travelGuideData.count({ where: { isActive: true } }),
  ]);

  return { states, cities, data, activeData };
}

// Run the import
importTravelGuideData()
  .then(() => {
    console.log('🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
