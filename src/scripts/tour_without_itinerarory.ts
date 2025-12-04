import prisma from '@/config/db';
import * as fs from 'fs';
import * as path from 'path';

interface TourWithoutItinerary {
  id: string;
  title: string;
  slug: string;
  durationDays: number;
  durationNights: number;
  price: number;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  itineraryCount: number;
}

async function findToursWithoutItinerary() {
  console.log('🔍 Searching for tours without itinerary...\n');

  try {
    const allTours = await prisma.tour.findMany({
      include: {
        itinerary: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const toursWithoutItinerary: TourWithoutItinerary[] = allTours
      .filter((tour) => tour.itinerary.length === 0)
      .map((tour) => ({
        id: tour.id,
        title: tour.title,
        slug: tour.slug,
        durationDays: tour.durationDays,
        durationNights: tour.durationNights,
        price: tour.price,
        isActive: tour.isActive,
        isFeatured: tour.isFeatured,
        createdAt: tour.createdAt,
        updatedAt: tour.updatedAt,
        itineraryCount: tour.itinerary.length,
      }));

    const toursWithItinerary = allTours.filter((tour) => tour.itinerary.length > 0);

    console.log('═══════════════════════════════════════════════════════════');
    console.log('           TOURS WITHOUT ITINERARY REPORT');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n');

    console.log('📊 STATISTICS:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Total tours in database:           ${allTours.length}`);
    console.log(`Tours WITH itinerary:              ${toursWithItinerary.length}`);
    console.log(`Tours WITHOUT itinerary:           ${toursWithoutItinerary.length}`);
    console.log(
      `Percentage without itinerary:      ${((toursWithoutItinerary.length / allTours.length) * 100).toFixed(2)}%`
    );
    console.log('\n');

    if (toursWithoutItinerary.length > 0) {
      console.log('🚨 TOURS WITHOUT ITINERARY:');
      console.log('─────────────────────────────────────────────────────────');

      toursWithoutItinerary.forEach((tour, index) => {
        console.log(`\n${index + 1}. ${tour.title}`);
        console.log(`   ID/Slug:     ${tour.id}`);
        console.log(`   Duration:    ${tour.durationDays}D/${tour.durationNights}N`);
        console.log(`   Price:       ₹${tour.price}`);
        console.log(`   Active:      ${tour.isActive ? '✅' : '❌'}`);
        console.log(`   Featured:    ${tour.isFeatured ? '⭐' : '  '}`);
        console.log(`   Created:     ${tour.createdAt.toISOString().split('T')[0]}`);
        console.log(`   Updated:     ${tour.updatedAt.toISOString().split('T')[0]}`);
      });

      console.log('\n');
      console.log('📋 TOUR IDs WITHOUT ITINERARY (for easy copy):');
      console.log('─────────────────────────────────────────────────────────');
      const ids = toursWithoutItinerary.map((t) => t.id);
      console.log(ids.join('\n'));
      console.log('\n');

      const outputDir = __dirname;
      const jsonPath = path.join(outputDir, 'tours-without-itinerary.json');
      const txtPath = path.join(outputDir, 'tours-without-itinerary-ids.txt');

      const reportData = {
        generatedAt: new Date().toISOString(),
        statistics: {
          totalTours: allTours.length,
          toursWithItinerary: toursWithItinerary.length,
          toursWithoutItinerary: toursWithoutItinerary.length,
          percentageWithoutItinerary:
            ((toursWithoutItinerary.length / allTours.length) * 100).toFixed(2) + '%',
        },
        toursWithoutItinerary,
      };

      fs.writeFileSync(jsonPath, JSON.stringify(reportData, null, 2));
      fs.writeFileSync(txtPath, ids.join('\n'));

      console.log('💾 Reports saved:');
      console.log(`   - ${jsonPath}`);
      console.log(`   - ${txtPath}`);
      console.log('\n');

      console.log('💡 RECOMMENDATIONS:');
      console.log('─────────────────────────────────────────────────────────');
      console.log('1. Check if these tours exist in CSV file');
      console.log('2. If exists in CSV, import itineraries using import script');
      console.log('3. If not in CSV, manually add itineraries or mark as inactive');
      console.log('\n');
    } else {
      console.log('✅ ALL TOURS HAVE ITINERARIES!');
      console.log('No action needed.\n');
    }

    console.log('═══════════════════════════════════════════════════════════');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findToursWithoutItinerary();
