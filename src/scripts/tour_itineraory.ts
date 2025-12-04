// Script to migrate ONLY valid tour itineraries to new database
import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/config/db';


interface ItineraryItem {
  id: string;
  day: number;
  title: string;
  description: string;
  imageUrl: string | null;
  order: number;
}

interface TourWithItinerary {
  tourId: string;
  tourTitle: string;
  durationDays: number;
  durationNights: number;
  itinerary: ItineraryItem[];
}

// Clean HTML and formatting issues
function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/\\r/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/^[•·\s]+/gm, '')
    .replace(/[ \t]+/g, ' ')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n')
    .trim();
}

// Validate if itinerary is real (not fake/placeholder)
function isValidItinerary(tour: TourWithItinerary): {
  isValid: boolean;
  reason?: string;
} {
  const { durationDays, itinerary } = tour;
  
  // Rule 1: Itinerary count MUST match duration days (CRITICAL)
  if (itinerary.length !== durationDays) {
    return {
      isValid: false,
      reason: `Count mismatch: ${itinerary.length} items but ${durationDays} days`
    };
  }
  
  // Rule 2: ALL descriptions are empty = fake data
  const emptyCount = itinerary.filter(item => 
    !item.description || item.description.trim().length === 0
  ).length;
  
  if (emptyCount === itinerary.length) {
    return {
      isValid: false,
      reason: 'All descriptions are empty (placeholder data)'
    };
  }
  
  // Rule 3: At least 70% should have meaningful descriptions (20+ chars)
  const meaningfulCount = itinerary.filter(item => 
    item.description && item.description.trim().length > 20
  ).length;
  
  const meaningfulPercentage = (meaningfulCount / itinerary.length) * 100;
  
  if (meaningfulCount < itinerary.length * 0.7) {
    return {
      isValid: false,
      reason: `Only ${meaningfulCount}/${itinerary.length} (${meaningfulPercentage.toFixed(0)}%) have meaningful descriptions`
    };
  }
  
  return { isValid: true };
}

async function migrateValidItineraries() {
  try {
    console.log('🚀 Starting itinerary migration...\n');

    // Read the JSON file
    const jsonPath = path.join(process.cwd(), 'tour-itineraries.json');
    const fileContent = await fs.readFile(jsonPath, 'utf-8');
    const toursData: TourWithItinerary[] = JSON.parse(fileContent);

    console.log(`📚 Found ${toursData.length} tours in file\n`);
    console.log('='.repeat(80));

    const stats = {
      total: toursData.length,
      valid: 0,
      invalid: 0,
      migrated: 0,
      errors: 0,
      notFound: 0
    };

    const validTours: TourWithItinerary[] = [];
    const invalidTours: Array<{ tour: TourWithItinerary; reason: string }> = [];

    // Step 1: Validate all tours
    console.log('\n📋 VALIDATION PHASE\n');
    console.log('='.repeat(80));

    for (const tourData of toursData) {
      const validation = isValidItinerary(tourData);
      
      if (validation.isValid) {
        stats.valid++;
        validTours.push(tourData);
        console.log(`✅ VALID: ${tourData.tourTitle}`);
        console.log(`   ${tourData.durationDays} days, ${tourData.itinerary.length} items`);
      } else {
        stats.invalid++;
        invalidTours.push({ tour: tourData, reason: validation.reason! });
        console.log(`❌ SKIP:  ${tourData.tourTitle}`);
        console.log(`   ${validation.reason}`);
      }
    }

    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Valid: ${stats.valid}`);
    console.log(`❌ Invalid: ${stats.invalid}`);
    console.log('\n' + '='.repeat(80));

    // Step 2: Migrate valid tours
    console.log('\n🔄 MIGRATION PHASE\n');
    console.log('='.repeat(80));

    for (const tourData of validTours) {
      try {
        // Find tour by slug in new database
        const tour = await prisma.tour.findUnique({
          where: { slug: tourData.tourId }
        });

        if (!tour) {
          console.log(`⚠️  NOT FOUND: ${tourData.tourTitle} (${tourData.tourId})`);
          stats.notFound++;
          continue;
        }

        // Clean and prepare itinerary data
        const cleanedItinerary = tourData.itinerary.map(item => ({
          day: item.day,
          title: cleanText(item.title),
          description: cleanText(item.description),
          imageUrl: item.imageUrl
        }));

        // Delete existing itinerary
        await prisma.tourItinerary.deleteMany({
          where: { tourId: tour.id }
        });

        // Create new itinerary
        await prisma.tourItinerary.createMany({
          data: cleanedItinerary.map(item => ({
            tourId: tour.id,
            day: item.day,
            title: item.title,
            description: item.description,
            imageUrl: item.imageUrl
          }))
        });

        console.log(`✅ MIGRATED: ${tour.title}`);
        console.log(`   Created ${cleanedItinerary.length} itinerary items`);
        stats.migrated++;

      } catch (error) {
        console.error(`❌ ERROR: ${tourData.tourTitle}`, error);
        stats.errors++;
      }
    }

    // Step 3: Generate reports
    const outputDir = path.join(process.cwd(), 'output');
    await fs.mkdir(outputDir, { recursive: true });

    // Save invalid tours report
    const invalidReport = invalidTours.map(item => ({
      tourId: item.tour.tourId,
      tourTitle: item.tour.tourTitle,
      durationDays: item.tour.durationDays,
      itineraryCount: item.tour.itinerary.length,
      reason: item.reason
    }));

    await fs.writeFile(
      path.join(outputDir, 'invalid-itineraries.json'),
      JSON.stringify(invalidReport, null, 2)
    );

    // Save migration summary
    const summary = {
      timestamp: new Date().toISOString(),
      statistics: stats,
      validTours: validTours.map(t => t.tourId),
      invalidTours: invalidTours.map(i => ({
        tourId: i.tour.tourId,
        reason: i.reason
      }))
    };

    await fs.writeFile(
      path.join(outputDir, 'migration-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    // Print final statistics
    console.log('\n' + '='.repeat(80));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Tours in File:    ${stats.total}`);
    console.log(`Valid Tours:            ${stats.valid} (${((stats.valid/stats.total)*100).toFixed(1)}%)`);
    console.log(`Invalid Tours:          ${stats.invalid} (${((stats.invalid/stats.total)*100).toFixed(1)}%)`);
    console.log(`Successfully Migrated:  ${stats.migrated}`);
    console.log(`Not Found in DB:        ${stats.notFound}`);
    console.log(`Errors:                 ${stats.errors}`);
    console.log('='.repeat(80));
    console.log(`\n💾 Reports saved in: ${outputDir}`);
    console.log(`   - invalid-itineraries.json`);
    console.log(`   - migration-summary.json\n`);

  } catch (error) {
    console.error('💥 Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateValidItineraries()
  .then(() => {
    console.log('✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });