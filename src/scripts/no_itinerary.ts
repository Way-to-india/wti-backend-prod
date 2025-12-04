import * as fs from 'fs';
import prisma from '@/config/db';


interface TourWithItineraryCount {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  durationDays: number;
  durationNights: number;
  _count: {
    itinerary: number;
  };
}

interface ExportData {
  summary: {
    totalTours: number;
    toursWithMismatch: number;
    activeWithMismatch: number;
    inactiveWithMismatch: number;
    toursWithNoItinerary: number;
    generatedAt: string;
  };
  tours: Array<{
    id: string;
    title: string;
    slug: string;
    isActive: boolean;
    durationDays: number;
    itineraryCount: number;
    difference: number;
    issue: string;
  }>;
}

async function checkTourItineraryMismatch(): Promise<void> {
  try {
    console.log('🔍 Checking for tours where duration days ≠ itinerary count...\n');

    // Find all tours with their itinerary count
    const tours: TourWithItineraryCount[] = await prisma.tour.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        isActive: true,
        durationDays: true,
        durationNights: true,
        _count: {
          select: {
            itinerary: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Filter tours where duration days != itinerary count
    const toursWithMismatch = tours.filter((tour) => tour.durationDays !== tour._count.itinerary);

    console.log(`📊 Total Tours: ${tours.length}`);
    console.log(`⚠️  Tours with Mismatch: ${toursWithMismatch.length}\n`);

    if (toursWithMismatch.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Tours with Duration vs Itinerary Mismatch:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      toursWithMismatch.forEach((tour, index) => {
        const diff = tour.durationDays - tour._count.itinerary;
        const diffStr = diff > 0 ? `+${diff}` : `${diff}`;

        let issue = '';
        if (tour._count.itinerary === 0) {
          issue = 'NO ITINERARY';
        } else if (tour._count.itinerary < tour.durationDays) {
          issue = 'MISSING DAYS';
        } else {
          issue = 'EXTRA DAYS';
        }

        console.log(`${index + 1}. ${tour.title}`);
        console.log(`   ID: ${tour.id}`);
        console.log(`   Slug: ${tour.slug}`);
        console.log(`   Duration Days: ${tour.durationDays}`);
        console.log(`   Itinerary Count: ${tour._count.itinerary}`);
        console.log(`   Difference: ${diffStr} (${issue})`);
        console.log(`   Active: ${tour.isActive ? '✅' : '❌'}`);
        console.log('');
      });

      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      // Categorize issues
      const noItinerary = toursWithMismatch.filter((t) => t._count.itinerary === 0);
      const missingDays = toursWithMismatch.filter(
        (t) => t._count.itinerary > 0 && t._count.itinerary < t.durationDays
      );
      const extraDays = toursWithMismatch.filter((t) => t._count.itinerary > t.durationDays);
      const activeWithMismatch = toursWithMismatch.filter((t) => t.isActive);
      const inactiveWithMismatch = toursWithMismatch.filter((t) => !t.isActive);

      console.log('📈 Issue Breakdown:');
      console.log(`   ❌ No Itinerary at all: ${noItinerary.length}`);
      console.log(`   ⚠️  Missing Days (itinerary < duration): ${missingDays.length}`);
      console.log(`   ➕ Extra Days (itinerary > duration): ${extraDays.length}`);
      console.log('');
      console.log(`   🟢 Active Tours with Mismatch: ${activeWithMismatch.length}`);
      console.log(`   🔒 Inactive Tours with Mismatch: ${inactiveWithMismatch.length}\n`);

      // Export to JSON
      const exportData: ExportData = {
        summary: {
          totalTours: tours.length,
          toursWithMismatch: toursWithMismatch.length,
          activeWithMismatch: activeWithMismatch.length,
          inactiveWithMismatch: inactiveWithMismatch.length,
          toursWithNoItinerary: noItinerary.length,
          generatedAt: new Date().toISOString(),
        },
        tours: toursWithMismatch.map((tour) => {
          const diff = tour.durationDays - tour._count.itinerary;
          let issue = '';
          if (tour._count.itinerary === 0) {
            issue = 'NO_ITINERARY';
          } else if (tour._count.itinerary < tour.durationDays) {
            issue = 'MISSING_DAYS';
          } else {
            issue = 'EXTRA_DAYS';
          }

          return {
            id: tour.id,
            title: tour.title,
            slug: tour.slug,
            isActive: tour.isActive,
            durationDays: tour.durationDays,
            itineraryCount: tour._count.itinerary,
            difference: diff,
            issue: issue,
          };
        }),
      };

      const fileName = `tours-itinerary-mismatch-${Date.now()}.json`;
      fs.writeFileSync(fileName, JSON.stringify(exportData, null, 2));
      console.log(`💾 Results exported to: ${fileName}\n`);
    } else {
      console.log('✅ All tours have matching duration days and itinerary count!\n');
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkTourItineraryMismatch().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
