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

/**
 * Clean HTML content and convert to plain text
 */
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
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'");
  cleaned = cleaned.replace(/\n\s*\n\s*\n/g, '\n\n').trim();

  return cleaned || null;
}

/**
 * Parse list items from HTML content
 */
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
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'");

  const lines = cleaned.split('\n');
  const items: string[] = [];

  for (let line of lines) {
    line = line.trim();
    if (!line || line.length === 0) continue;

    line = line.replace(/^[-•*➤►▪︎⦿○●]\s*/g, '');
    line = line.replace(/^\d+\.\s*/g, '');
    line = line.trim();

    if (line.length < 5) continue;
    if (/^(br|nbsp|amp)$/i.test(line)) continue;

    if (line.length >= 5 || (line.length >= 3 && /[.!?]$/.test(line))) {
      items.push(line);
    }
  }

  const seen = new Set<string>();
  const uniqueItems: string[] = [];

  for (const item of items) {
    const normalized = item.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      uniqueItems.push(item);
    }
  }

  return uniqueItems.filter((item, index) => {
    const itemLower = item.toLowerCase();
    for (let i = 0; i < uniqueItems.length; i++) {
      if (i !== index) {
        const otherLower = uniqueItems[i].toLowerCase();
        if (otherLower.includes(itemLower) && otherLower.length > itemLower.length) {
          return false;
        }
      }
    }
    return true;
  });
}

/**
 * Parse highlights from CSV
 */
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

/**
 * Generate slug from title
 */
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Parse CSV file
 */
function parseCSVFile(csvFilePath: string): Promise<CSVRow[]> {
  return new Promise((resolve, reject) => {
    try {
      const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
      Papa.parse<CSVRow>(fileContent, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        transformHeader: (header: string) => header.trim(),
        complete: (results) => resolve(results.data),
        error: (error: any) => reject(error),
      });
    } catch (error: any) {
      reject(error);
    }
  });
}

/**
 * Add a single tour from CSV to database
 */
async function addTourFromCSV(
  tourId: string,
  allCSVData: CSVRow[]
): Promise<{
  success: boolean;
  error?: string;
  created: boolean;
  alreadyExists: boolean;
}> {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔄 Processing Tour: ${tourId}`);
  console.log('='.repeat(80));

  try {
    // Step 1: Check if tour already exists
    console.log('📋 Step 1: Checking if tour exists in database...');

    let existingTour;
    let retries = 3;

    while (retries > 0) {
      try {
        existingTour = await prisma.tour.findUnique({
          where: { id: tourId },
          select: { id: true, title: true, isActive: true },
        });
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0) throw err;
        console.log(`⚠️  Retry ${3 - retries}/3...`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    if (existingTour) {
      console.log(`✅ Tour already exists: ${existingTour.title}`);
      console.log(`   Status: ${existingTour.isActive ? 'Active' : 'Inactive'}`);
      return {
        success: true,
        created: false,
        alreadyExists: true,
      };
    }

    console.log('✅ Tour does not exist - proceeding to create...');

    // Step 2: Find tour data in CSV
    console.log('\n📋 Step 2: Finding tour data in CSV...');
    console.log(`   Looking for tour ID: "${tourId}"`);

    // Debug: Show all unique URLs in CSV (first 10)
    const uniqueUrls = [...new Set(allCSVData.map((row) => row.URL).filter(Boolean))];
    console.log(`   Total unique URLs in CSV: ${uniqueUrls.length}`);

    // Try exact match first
    let tourRows = allCSVData.filter((row) => row.URL && row.URL.trim() === tourId.trim());

    // If not found, try case-insensitive match
    if (tourRows.length === 0) {
      console.log('   ⚠️  Exact match not found, trying case-insensitive...');
      tourRows = allCSVData.filter(
        (row) => row.URL && row.URL.toLowerCase().trim() === tourId.toLowerCase().trim()
      );
    }

    // If still not found, try partial match
    if (tourRows.length === 0) {
      console.log('   ⚠️  Case-insensitive match not found, trying partial match...');
      const possibleMatches = allCSVData.filter(
        (row) => row.URL && row.URL.toLowerCase().includes(tourId.toLowerCase())
      );
      if (possibleMatches.length > 0) {
        console.log(`   Found ${possibleMatches.length} possible matches:`);
        possibleMatches.slice(0, 5).forEach((m) => {
          console.log(`      - "${m.URL}"`);
        });
      }
    }

    if (tourRows.length === 0) {
      console.error(`❌ No CSV data found for: ${tourId}`);
      console.log(`   Checked against ${allCSVData.length} total CSV rows`);

      // Show similar tour IDs for debugging
      const similarIds = uniqueUrls.filter(
        (url) =>
          url.toLowerCase().includes('trimbakeshwar') ||
          url.toLowerCase().includes(tourId.split('-')[0])
      );
      if (similarIds.length > 0) {
        console.log(`   Similar IDs found: ${similarIds.slice(0, 5).join(', ')}`);
      }

      return {
        success: false,
        error: 'No CSV data found',
        created: false,
        alreadyExists: false,
      };
    }

    console.log(`✅ Found ${tourRows.length} rows in CSV`);

    const firstRow = tourRows[0];

    // Step 3: Validate required fields
    console.log('\n📋 Step 3: Validating required fields...');

    if (!firstRow.PackageTitle || !firstRow.PackageTitle.trim()) {
      console.error('❌ Missing required field: PackageTitle');
      return {
        success: false,
        error: 'Missing PackageTitle',
        created: false,
        alreadyExists: false,
      };
    }

    if (!firstRow.TotalDays || !firstRow.TotalNights) {
      console.error('❌ Missing required fields: TotalDays or TotalNights');
      return {
        success: false,
        error: 'Missing duration data',
        created: false,
        alreadyExists: false,
      };
    }

    console.log('✅ All required fields present');

    // Step 4: Parse and prepare data
    console.log('\n📋 Step 4: Parsing tour data...');

    const title = firstRow.PackageTitle.trim();
    const slug = generateSlug(title);
    const durationDays = parseInt(firstRow.TotalDays) || 0;
    const durationNights = parseInt(firstRow.TotalNights) || 0;
    const price = firstRow.PackagePrice ? parseFloat(firstRow.PackagePrice) : null;
    const isActive = firstRow.isActive === '1' || firstRow.isActive?.toLowerCase() === 'true';
    const isFeatured = firstRow.isFeatured === '1' || firstRow.isFeatured?.toLowerCase() === 'true';

    console.log(`   Title: ${title}`);
    console.log(`   Slug: ${slug}`);
    console.log(`   Duration: ${durationDays}D/${durationNights}N`);
    console.log(`   Price: ${price ? `₹${price}` : 'Not specified'}`);
    console.log(`   Active: ${isActive}`);
    console.log(`   Featured: ${isFeatured}`);

    // Parse content
    const description = cleanHTML(firstRow.PackageDescription);
    const overview = cleanHTML(firstRow.shortDesc);
    const highlights = parseHighlights(firstRow.Highlights);
    const inclusions = parseListItemsRobust(firstRow.PackageInclusion);
    const exclusions = parseListItemsRobust(firstRow.PackageExclusion);

    console.log(`   Highlights: ${highlights.length} items`);
    console.log(`   Inclusions: ${inclusions.length} items`);
    console.log(`   Exclusions: ${exclusions.length} items`);

    // Parse itineraries
    const itineraries = tourRows
      .filter((row) => row.DayNumber && row.ItineraryHead)
      .map((row) => ({
        day: parseInt(row.DayNumber),
        title: row.ItineraryHead.trim(),
        description: cleanHTML(row.ItineraryDetail) || '',
      }))
      .sort((a, b) => a.day - b.day);

    console.log(`   Itineraries: ${itineraries.length} days`);

    // Step 5: Create tour in database
    console.log('\n📋 Step 5: Creating tour in database...');

    const tourData: any = {
      id: tourId,
      title,
      slug,
      durationDays,
      durationNights,
      isActive,
      isFeatured,
    };

    // Add optional fields
    if (description) tourData.description = description;
    if (overview) tourData.overview = overview;
    if (price) tourData.price = price;
    if (highlights.length > 0) tourData.highlights = highlights;
    if (inclusions.length > 0) tourData.inclusions = inclusions;
    if (exclusions.length > 0) tourData.exclusions = exclusions;
    if (firstRow.package_title?.trim()) tourData.metatitle = firstRow.package_title.trim();
    if (firstRow.package_meta_desc?.trim()) tourData.metadesc = firstRow.package_meta_desc.trim();
    // Note: keywords field removed as it doesn't exist in schema

    // Create tour with retry
    retries = 3;
    let createdTour;

    while (retries > 0) {
      try {
        createdTour = await prisma.tour.create({
          data: tourData,
        });
        console.log('✅ Tour created successfully!');
        break;
      } catch (err: any) {
        retries--;
        if (retries === 0) throw err;
        console.log(`⚠️  Create failed, retrying... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Step 6: Create itineraries
    if (itineraries.length > 0) {
      console.log(`\n📋 Step 6: Creating ${itineraries.length} itineraries...`);

      let createdCount = 0;
      for (const itinerary of itineraries) {
        retries = 3;
        while (retries > 0) {
          try {
            await prisma.tourItinerary.create({
              data: {
                tourId,
                day: itinerary.day,
                title: itinerary.title,
                description: itinerary.description,
              },
            });
            console.log(`   ✓ Day ${itinerary.day}: ${itinerary.title}`);
            createdCount++;
            break;
          } catch (err: any) {
            retries--;
            if (retries === 0) {
              console.log(`   ✗ Failed to create itinerary for day ${itinerary.day}`);
              break;
            }
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }
      console.log(`✅ Created ${createdCount}/${itineraries.length} itineraries`);
    } else {
      console.log('\n⚠️  No itineraries found in CSV');
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ Successfully added tour: ${title}`);
    console.log('='.repeat(80));

    return {
      success: true,
      created: true,
      alreadyExists: false,
    };
  } catch (error: any) {
    console.error(`\n❌ Error adding tour ${tourId}:`, error.message);
    return {
      success: false,
      error: error.message,
      created: false,
      alreadyExists: false,
    };
  }
}

/**
 * MAIN FUNCTION: Add multiple tours from CSV
 *
 * Add your tour IDs to this array
 */
const toursToAdd = [
  'trimbakeshwar-grishneshwar-bhimashankar-jyotirlinga-tour',
  // Add more tour IDs here as needed
];

async function addToursFromCSV() {
  console.log(`\n${'='.repeat(100)}`);
  console.log('🚀 ADD TOURS FROM CSV TO DATABASE');
  console.log(`📦 Total tours to add: ${toursToAdd.length}`);
  console.log('='.repeat(100));

  const results = {
    created: [] as string[],
    alreadyExists: [] as string[],
    failed: [] as { tourId: string; error: string }[],
  };

  // Load CSV file
  let allCSVData: CSVRow[];
  try {
    const csvFilePath = path.join(__dirname, 'tours.csv');
    console.log(`\n📂 Loading CSV: ${csvFilePath}`);
    allCSVData = await parseCSVFile(csvFilePath);
    console.log(`✅ Loaded ${allCSVData.length} CSV rows\n`);
  } catch (error: any) {
    console.error(`❌ Failed to load CSV:`, error.message);
    process.exit(1);
  }

  // Process each tour
  for (let i = 0; i < toursToAdd.length; i++) {
    const tourId = toursToAdd[i];

    try {
      const result = await addTourFromCSV(tourId, allCSVData);

      if (result.success) {
        if (result.created) {
          results.created.push(tourId);
        } else if (result.alreadyExists) {
          results.alreadyExists.push(tourId);
        }
      } else {
        results.failed.push({ tourId, error: result.error || 'Unknown error' });
      }
    } catch (error: any) {
      results.failed.push({ tourId, error: error.message });
      console.error(`❌ Unhandled error for ${tourId}:`, error.message);
    }

    // Rate limiting
    if (i < toursToAdd.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  // Final cleanup
  await prisma.$disconnect();

  // Print summary
  console.log(`\n${'='.repeat(100)}`);
  console.log('📊 SUMMARY');
  console.log('='.repeat(100));
  console.log(`✅ Successfully Created: ${results.created.length}`);
  console.log(`⏭️  Already Existed: ${results.alreadyExists.length}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📦 Total Processed: ${toursToAdd.length}`);
  console.log('='.repeat(100));

  if (results.created.length > 0) {
    console.log('\n✅ SUCCESSFULLY CREATED:');
    results.created.forEach((tourId) => {
      console.log(`   • ${tourId}`);
    });
  }

  if (results.alreadyExists.length > 0) {
    console.log('\n⏭️  ALREADY EXISTED:');
    results.alreadyExists.forEach((tourId) => {
      console.log(`   • ${tourId}`);
    });
  }

  if (results.failed.length > 0) {
    console.log('\n❌ FAILED:');
    results.failed.forEach(({ tourId, error }) => {
      console.log(`   • ${tourId}: ${error}`);
    });
  }

  console.log('\n✨ Done!\n');
}

// Run the script
addToursFromCSV().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
