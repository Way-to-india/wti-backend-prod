import prisma from '@/config/db';
import * as fs from 'fs';
import * as Papa from 'papaparse';
import * as path from 'path';

interface CSVRow {
  CatId: string;
  PackageName: string;
  PackageTitle: string;
  PackageDescription: string;
  SearchKeyword: string;
  PackagePrice: string;
  TotalDays: string;
  TotalNights: string;
  PackageInclusion: string;
  PackageExclusion: string;
  isActive: string;
  isFeatured: string;
  URL: string;
  package_title: string;
  package_meta_desc: string;
  package_meta_key: string;
  shortDesc: string;
  Highlights: string;
  DayNumber: string;
  ItineraryHead: string;
  ItineraryDetail: string;
}

// Tours with missing/incomplete itineraries from the JSON report
const TOURS_TO_FIX = [
  'karnataka-heritage-tour',
  'rann-of-kutch-tour-package',
  'best-of-gujarat-tour-package',
  'orissa-trip',
  'darjeeling-sikkim-tour-package',
  'jim-corbett-park-weekend-tour-package-by-rail',
  'thattekad-thekkady-sanctuary-tour',
  'darjeeling-gangtok-kalimpong-tour-package',
  'hill-stations-of-south-india-tour',
  'heritage-of-rajasthan-tour-package',
  'nau-devi-yatra',
  'dalhousie-tour',
  'ranikhet-hill-tour',
  'corbett-elephant-safari-tour',
  'oberoi-cecil-shimla-packages',
  'golden-triangle-with-mumbai-tour',
  'orchha-khajuraho-tour',
  'ranthambore-package',
  'best-of-western-hill-tour',
  'khandala-tour',
  'tour-of-south-india',
  'bharatpur-bird-sanctuary-tour',
  'north-sikkim-tour',
  'north-india-heritage-tour',
  'romantic-tour-of-kerala',
  'nainital-almora-kausani-tour',
  'nainital-ranikhet-tour',
  'muslim-pilgrimage-tour',
  'mount-abu-tour-package',
  'chardham-yatra-tour-package',
  'buddha-tour',
  'shirdi-tour-package',
  'konkan-beach-resorts-tour',
  'heritage-kerala-tour-with-tree-house',
  'jim-corbett-park-with-nainital-tour',
  'south-india-temple-tour',
  'incredible-ladakh-holiday',
  'kerala-tour',
  'golden-triangle-with-ranthambore-bharatpur-luxury-group-tour',
  'golden-triangle-tour-with-tiger-safari',
  'golden-triangle-tour-with-jim-corbett-national-park',
  'golden-triangle-khajuraho-dance-festival-tour',
  'delhi-to-agra-tour-packages',
  'delhi-sultanpur-tour',
  'golden-goa-tour',
  'delhi-neemrana-tour',
  'chennai-beach-tour',
  'goa-carnival-festival-tour',
  'classic-india-tour',
  'bandhavgarh-wildlife-safari-tour-from-pune',
  'horse-safari-in-rajasthan',
  'kashmir-tour-package-from-kolkata',
  'bandhavgarh-national-park-tour',
];

function cleanHTML(html: string | null | undefined): string | null {
  if (!html) return null;
  let cleaned = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<\/p>/gi, '\n\n');
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();
  return cleaned || null;
}

function parseListItemsRobust(content: string | null | undefined): string[] {
  if (!content) return [];

  let cleaned = content.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  cleaned = cleaned.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
  cleaned = cleaned.replace(/<\/p>/gi, '\n');
  cleaned = cleaned.replace(/<\/div>/gi, '\n');
  cleaned = cleaned.replace(/<\/li>/gi, '\n');
  cleaned = cleaned.replace(/<[^>]+>/g, '');
  cleaned = cleaned
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  const lines = cleaned.split('\n');
  const items: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (line.length === 0) continue;
    line = line.replace(/^[-•*]\s*/, '');
    line = line.replace(/^\d+\.\s*/, '');
    line = line.trim();
    if (line.length >= 15 || (line.length >= 8 && /[.!]$/.test(line))) {
      items.push(line);
    }
  }

  return [...new Set(items)];
}

function parseHighlights(highlights: string | null | undefined): string[] {
  if (!highlights) return [];
  const items = highlights
    .split(/\n|Visit\s+/gi)
    .map((item) => item.trim())
    .filter((item) => item && item.length > 2);
  return items.map((item) => {
    if (!item.toLowerCase().startsWith('visit')) {
      return `Visit ${item}`;
    }
    return item;
  });
}

function parseCSVFile(csvFilePath: string): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
    Papa.parse<CSVRow>(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(results.data),
      error: (error: any) => reject(error),
    });
  });
}

async function deleteAndReAddItinerary(
  tourId: string,
  allCSVData: CSVRow[]
): Promise<{
  success: boolean;
  error?: string;
  deletedCount: number;
  addedCount: number;
  updated: boolean;
}> {
  console.log(`\n🔄 Processing tour: ${tourId}`);

  try {
    // Filter rows for the specific tour
    const tourRows = allCSVData.filter(
      (row) => row.URL && row.URL.toLowerCase().trim() === tourId.toLowerCase().trim()
    );

    if (tourRows.length === 0) {
      console.error(`❌ No rows found in CSV for tour: ${tourId}`);
      return {
        success: false,
        error: 'No CSV data found',
        deletedCount: 0,
        addedCount: 0,
        updated: false,
      };
    }

    console.log(`🎯 Found ${tourRows.length} rows in CSV for: ${tourId}`);

    // Check if tour exists
    const existingTour = await prisma.tour.findUnique({
      where: { id: tourId },
      include: { itinerary: true },
    });

    if (!existingTour) {
      console.error(`❌ Tour not found in database: ${tourId}`);
      return {
        success: false,
        error: 'Tour not found in DB',
        deletedCount: 0,
        addedCount: 0,
        updated: false,
      };
    }

    console.log(`✅ Tour found: ${existingTour.title}`);
    console.log(`📊 Current itinerary count: ${existingTour.itinerary.length}`);
    console.log(`📅 Expected days: ${existingTour.durationDays}`);

    // STEP 1: DELETE ALL EXISTING ITINERARIES
    let deletedCount = 0;
    if (existingTour.itinerary.length > 0) {
      console.log(`\n🗑️  Deleting ${existingTour.itinerary.length} existing itineraries...`);
      const deleteResult = await prisma.tourItinerary.deleteMany({
        where: { tourId: tourId },
      });
      deletedCount = deleteResult.count;
      console.log(`✅ Deleted ${deletedCount} itineraries`);
    } else {
      console.log(`\nℹ️  No existing itineraries to delete`);
    }

    // STEP 2: UPDATE TOUR METADATA
    const firstRow = tourRows[0];
    const updatedData: any = {};

    if (firstRow.package_title?.trim()) {
      updatedData.metatitle = firstRow.package_title.trim();
    }
    if (firstRow.package_meta_desc?.trim()) {
      updatedData.metadesc = firstRow.package_meta_desc.trim();
    }
    if (firstRow.PackageDescription?.trim()) {
      updatedData.description = cleanHTML(firstRow.PackageDescription);
    }
    if (firstRow.shortDesc?.trim()) {
      updatedData.overview = cleanHTML(firstRow.shortDesc);
    }

    const highlights = parseHighlights(firstRow.Highlights);
    if (highlights.length > 0) {
      updatedData.highlights = highlights;
    }

    const inclusions = parseListItemsRobust(firstRow.PackageInclusion);
    if (inclusions.length > 0) {
      updatedData.inclusions = inclusions;
    }

    const exclusions = parseListItemsRobust(firstRow.PackageExclusion);
    if (exclusions.length > 0) {
      updatedData.exclusions = exclusions;
    }

    let updated = false;
    if (Object.keys(updatedData).length > 0) {
      console.log('\n📝 Updating tour metadata...');
      await prisma.tour.update({
        where: { id: tourId },
        data: {
          ...updatedData,
          updatedAt: new Date(),
        },
      });
      updated = true;
      console.log('✅ Tour metadata updated');
      console.log(`   - Meta title: ${updatedData.metatitle ? '✓' : '-'}`);
      console.log(`   - Meta desc: ${updatedData.metadesc ? '✓' : '-'}`);
      console.log(`   - Description: ${updatedData.description ? '✓' : '-'}`);
      console.log(`   - Overview: ${updatedData.overview ? '✓' : '-'}`);
      console.log(`   - Highlights: ${updatedData.highlights?.length || 0} items`);
      console.log(`   - Inclusions: ${updatedData.inclusions?.length || 0} items`);
      console.log(`   - Exclusions: ${updatedData.exclusions?.length || 0} items`);
    }

    // STEP 3: ADD NEW ITINERARIES FROM CSV
    const itineraries = tourRows
      .filter((row) => row.DayNumber && row.ItineraryHead)
      .map((row) => ({
        day: parseInt(row.DayNumber),
        title: row.ItineraryHead.trim(),
        description: cleanHTML(row.ItineraryDetail) || '',
      }))
      .sort((a, b) => a.day - b.day);

    console.log(`\n📝 Found ${itineraries.length} itineraries in CSV`);

    let addedCount = 0;
    if (itineraries.length === 0) {
      console.log('⚠️  No itineraries found in CSV');
    } else {
      console.log(`\n➕ Creating ${itineraries.length} new itineraries...`);

      for (const itinerary of itineraries) {
        await prisma.tourItinerary.create({
          data: {
            tourId,
            day: itinerary.day,
            title: itinerary.title,
            description: itinerary.description,
          },
        });
        console.log(`   ✓ Day ${itinerary.day}: ${itinerary.title}`);
        addedCount++;
        updated = true;
      }
    }

    console.log(`\n✅ Successfully processed: ${tourId}`);
    console.log(`   📊 Summary: Deleted ${deletedCount}, Added ${addedCount}`);

    return { success: true, deletedCount, addedCount, updated };
  } catch (error: any) {
    console.error(`❌ Error processing ${tourId}:`, error.message);
    return { success: false, error: error.message, deletedCount: 0, addedCount: 0, updated: false };
  }
}

async function fixAllMissingItineraries() {
  console.log(`\n🚀 Starting fix for ${TOURS_TO_FIX.length} tours with missing itineraries...\n`);

  const results = {
    success: [] as string[],
    failed: [] as { tourId: string; error: string }[],
    totalDeleted: 0,
    totalAdded: 0,
  };

  // Parse CSV once at the start
  let allCSVData: CSVRow[];
  try {
    const csvFilePath = path.join(__dirname, 'tours.csv');
    console.log(`📂 Loading CSV file: ${csvFilePath}`);
    allCSVData = await parseCSVFile(csvFilePath);
    console.log(`✅ Loaded ${allCSVData.length} CSV rows\n`);
  } catch (error: any) {
    console.error(`❌ Failed to load CSV file:`, error.message);
    process.exit(1);
  }

  for (let i = 0; i < TOURS_TO_FIX.length; i++) {
    const tourId = TOURS_TO_FIX[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📦 Processing [${i + 1}/${TOURS_TO_FIX.length}]: ${tourId}`);
    console.log('='.repeat(80));

    try {
      const result = await deleteAndReAddItinerary(tourId, allCSVData);

      if (result.success) {
        results.success.push(tourId);
        results.totalDeleted += result.deletedCount;
        results.totalAdded += result.addedCount;
      } else {
        results.failed.push({ tourId, error: result.error || 'Unknown error' });
      }
    } catch (error: any) {
      results.failed.push({ tourId, error: error.message });
      console.error(`❌ Unhandled error for ${tourId}:`, error.message);
    }

    // Delay between tours
    if (i < TOURS_TO_FIX.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Refresh connection every 10 tours
      if ((i + 1) % 10 === 0) {
        console.log('\n🔄 Refreshing database connection...');
        await prisma.$disconnect();
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  await prisma.$disconnect();

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 FIX SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Successfully fixed: ${results.success.length}/${TOURS_TO_FIX.length}`);
  console.log(`🗑️  Total itineraries deleted: ${results.totalDeleted}`);
  console.log(`➕ Total itineraries added: ${results.totalAdded}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log('='.repeat(80));

  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TOURS:');
    console.log('='.repeat(80));
    results.failed.forEach(({ tourId, error }) => {
      console.log(`   • ${tourId}: ${error}`);
    });
  }

  if (results.success.length > 0) {
    console.log('\n✅ SUCCESSFULLY FIXED TOURS:');
    console.log('='.repeat(80));
    results.success.forEach((tourId) => {
      console.log(`   • ${tourId}`);
    });
  }
}

// Run the fix
if (require.main === module) {
  fixAllMissingItineraries()
    .then(() => {
      console.log('\n✅ Fix completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Fix failed:', error);
      process.exit(1);
    });
}

export { fixAllMissingItineraries };
