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
      error: (error : any) => reject(error),
    });
  });
}

async function addMissingItinerary(
  tourId: string,
  allCSVData: CSVRow[]
): Promise<{
  success: boolean;
  error?: string;
  updated: boolean;
  itinerariesAdded: number;
}> {
  console.log(`\n🔄 Processing tour: ${tourId}`);

  try {
    // Filter rows for the specific tour
    const tourRows = allCSVData.filter(
      (row) => row.URL && row.URL.toLowerCase().trim() === tourId.toLowerCase().trim()
    );

    if (tourRows.length === 0) {
      console.error(`❌ No rows found for tour: ${tourId}`);
      return { success: false, error: 'No CSV data found', updated: false, itinerariesAdded: 0 };
    }

    console.log(`🎯 Found ${tourRows.length} rows for tour: ${tourId}`);

    // **FIXED**: Added retry logic and connection check
    let existingTour;
    let retries = 3;
    while (retries > 0) {
      try {
        existingTour = await prisma.tour.findUnique({
          where: { id: tourId },
          include: { itinerary: true },
        });
        break; // Success, exit retry loop
      } catch (err: any) {
        retries--;
        if (retries === 0) throw err;
        console.log(`⚠️  Database query failed, retrying... (${retries} attempts left)`);
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2s before retry
      }
    }

    if (!existingTour) {
      console.error(`❌ Tour not found in database: ${tourId}`);
      return { success: false, error: 'Tour not found in DB', updated: false, itinerariesAdded: 0 };
    }

    console.log(`✅ Tour found in DB: ${existingTour.title}`);
    console.log(`📊 Current itinerary count: ${existingTour.itinerary.length}`);
    console.log(`📅 Expected days: ${existingTour.durationDays}`);

    const firstRow = tourRows[0];
    const updatedData: any = {};

    // Only update if fields are empty
    if (!existingTour.metatitle && firstRow.package_title?.trim()) {
      updatedData.metatitle = firstRow.package_title.trim();
    }
    if (!existingTour.metadesc && firstRow.package_meta_desc?.trim()) {
      updatedData.metadesc = firstRow.package_meta_desc.trim();
    }
    if (!existingTour.description && firstRow.PackageDescription?.trim()) {
      updatedData.description = cleanHTML(firstRow.PackageDescription);
    }
    if (!existingTour.overview && firstRow.shortDesc?.trim()) {
      updatedData.overview = cleanHTML(firstRow.shortDesc);
    }
    if (!existingTour.highlights || existingTour.highlights.length === 0) {
      const highlights = parseHighlights(firstRow.Highlights);
      if (highlights.length > 0) {
        updatedData.highlights = highlights;
      }
    }
    if (!existingTour.inclusions || existingTour.inclusions.length === 0) {
      const inclusions = parseListItemsRobust(firstRow.PackageInclusion);
      if (inclusions.length > 0) {
        updatedData.inclusions = inclusions;
      }
    }
    if (!existingTour.exclusions || existingTour.exclusions.length === 0) {
      const exclusions = parseListItemsRobust(firstRow.PackageExclusion);
      if (exclusions.length > 0) {
        updatedData.exclusions = exclusions;
      }
    }

    let updated = false;

    // **FIXED**: Update tour with retry logic
    if (Object.keys(updatedData).length > 0) {
      console.log('\n📝 Updating tour metadata...');
      retries = 3;
      while (retries > 0) {
        try {
          await prisma.tour.update({
            where: { id: tourId },
            data: {
              ...updatedData,
              updatedAt: new Date(),
            },
          });
          updated = true;
          console.log('✅ Tour metadata updated');
          break;
        } catch (err: any) {
          retries--;
          if (retries === 0) throw err;
          console.log(`⚠️  Update failed, retrying... (${retries} attempts left)`);
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }

    // Parse itineraries
    const itineraries = tourRows
      .filter((row) => row.DayNumber && row.ItineraryHead)
      .map((row) => ({
        day: parseInt(row.DayNumber),
        title: row.ItineraryHead.trim(),
        description: cleanHTML(row.ItineraryDetail) || '',
      }))
      .sort((a, b) => a.day - b.day);

    console.log(`\n📝 Found ${itineraries.length} itineraries in CSV`);

    let itinerariesAdded = 0;

    if (itineraries.length === 0) {
      console.log('⚠️  No itineraries found in CSV');
    } else if (existingTour.itinerary.length > 0) {
      console.log(`⏭️  Itinerary already exists - skipping`);
    } else {
      console.log(`\n➕ Creating ${itineraries.length} itineraries...`);

      // **FIXED**: Create itineraries with retry and better error handling
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
            itinerariesAdded++;
            updated = true;
            break;
          } catch (err: any) {
            retries--;
            if (retries === 0) throw err;
            console.log(`⚠️  Failed to create itinerary for day ${itinerary.day}, retrying...`);
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }
    }

    console.log(`\n✅ Successfully processed: ${tourId}`);
    return { success: true, updated, itinerariesAdded };
  } catch (error: any) {
    console.error(`❌ Error processing ${tourId}:`, error.message);
    return { success: false, error: error.message, updated: false, itinerariesAdded: 0 };
  }
}

// List of all tours to process
const tourIds = [
  'ranthambore-tour-package',
  'pushkar-fair-tour-package',
  'karnataka-heritage-tour',
  'rann-of-kutch-tour-package',
  'best-of-gujarat-tour-package',
  'rafting-in-rishikesh-with-trekking-in-himalayas',
  'orissa-trip',
  'darjeeling-sikkim-tour-package',
  'haridwar-mussoorie-tour-package',
  'jim-corbett-park-weekend-tour-package-by-rail',
  'shivpuri-river-rafting-package',
  'jaipur-ajmer-pushkar-tour',
  'kanha-national-park-tour-package',
  'thattekad-thekkady-sanctuary-tour',
  'darjeeling-gangtok-kalimpong-tour-package',
  'hill-stations-of-south-india-tour',
  'golden-triangle-tour-with-varanasi-and-khajuraho',
  'golden-triangle-luxury-tour',
  'heritage-of-rajasthan-tour-package',
  'nau-devi-yatra',
  'dalhousie-tour',
  'leh-ladakh-road-trip-by-car',
  'kuari-pass-trekking',
  'bandhavgarh-wildlife-safari-tour-from-bangalore',
  'lonavala-tour',
  'goa-houseboat-tour-package',
  'taj-mahal-trip-by-air',
  'srinagar-houseboat-packages',
  'south-karnataka-tour-package',
  'port-blair-ltc-tour',
  'snake-boat-race-tour',
  'same-day-jaipur-tour',
  'sai-baba-of-puttaparthi-tour',
  'kullu-manali-tour',
  'tirupati-package-tour',
  'rajasthan-luxury-tour-package',
  'ranikhet-hill-tour',
  'corbett-elephant-safari-tour',
  'oberoi-cecil-shimla-packages',
  'kaudiyala-river-rafting-package',
  'golden-triangle-with-mumbai-tour',
  'orchha-khajuraho-tour',
  'jaipur-ajmer-pushkar-tour-packages-from-delhi',
  'ranthambore-package',
  'rann-of-kutch-festival-packages',
  'majestic-ladakh-tour',
  'munnar-hill-tour',
  'bangalore-to-ooty-package',
  'rajasthan-tour-package',
  'best-of-western-hill-tour',
  'khandala-tour',
  'tour-of-south-india',
  'orissa-golden-triangle-tour',
  'bharatpur-bird-sanctuary-tour',
  'north-sikkim-tour',
  'north-india-heritage-tour',
  'romantic-tour-of-kerala',
  'nainital-almora-kausani-tour',
  'nainital-ranikhet-tour',
  'nainital-tour-package',
  'mani-mahesh-yatra-by-helicopter',
  'munnar-tour',
  'munnar-ooty-kodaikanal-tour-package',
  'mussoorie-hill-station-tour',
  'mumbai-with-karla-caves-tour',
  'muslim-pilgrimage-tour',
  'india-wildlife-tour',
  'mount-abu-tour-package',
  'mewar-tour-packages',
  'manali-leh-tour',
  'rajaji-national-park-tour',
  'manali-to-leh-tour',
  'gurudwara-in-punjab-tour',
  'maharashtra-tour',
  'mahabaleshwar-tour',
  'chardham-yatra-tour-package',
  'lakshadweep-island-trip',
  'kumarakom-lake-resort-package',
  'buddha-tour',
  'shirdi-tour-package',
  'ayodhya-tour-package',
  'konkan-beach-resorts-tour',
  'kovalam-beach-tour',
  'kerala-tour-package',
  'kerala-wildlife-tour',
  'kerala-travel-package',
  'kerala-ltc-tour',
  'kerala-holiday-tour',
  'kerala-backwater-trip',
  'kaziranga-wildlife-tour',
  'kashmir-tour-packages-from-mumbai',
  'heritage-kerala-tour-with-tree-house',
  'golden-triangle-and-gangaur-festival-tour',
  'jim-corbett-park-with-nainital-tour',
  'south-india-temple-tour',
  'incredible-ladakh-holiday',
  'kerala-tour',
  'hills-of-uttarakhand-package',
  'sariska-tour',
  'golden-triangle-with-ranthambore-bharatpur-luxury-group-tour',
  'gujarat-wildlife-tour',
  'sundarbans-national-park-tour-packages',
  'golden-triangle-tour-with-tiger-safari',
  'orissa-tour-package',
  'elephant-festival-tour',
  'golden-triangle-tour-with-jim-corbett-national-park',
  'golden-triangle-tour-by-train-and-car',
  'golden-triangle-tour-by-train',
  'golden-triangle-khajuraho-dance-festival-tour',
  'golden-temple-tour',
  'taj-mahal-tour-by-car',
  'delhi-to-agra-tour-packages',
  'nainital-hill-tour',
  'eravikulam-national-park-tour',
  'fascinating-gujarat-holiday-tour-package',
  'eastern-triangle-tour',
  'delhi-sultanpur-tour',
  'tour-to-kerala',
  'andaman-nicobar-tour',
  'corbett-weekend-tour',
  'marine-drive-river-rafting-package',
  'golden-goa-tour',
  'corbett-dhikala-tour-package',
  'charismatic-kashmir-tour',
  'delhi-neemrana-tour',
  'chennai-beach-tour',
  'chanap-valley-trek',
  'brahmpuri-river-rafting-package',
  'amarnath-yatra-helicopter-services',
  'best-of-kumaon-hill-tour',
  'best-of-karnataka-tour',
  'goa-carnival-festival-tour',
  'classic-india-tour',
  'amarnath-yatra',
  'banerghatta-national-park-tour',
  'bandhavgarh-wildlife-safari-tour-from-ahmedabad',
  'bandhavgarh-wildlife-safari-tour-from-pune',
  'bandhavgarh-tour-from-mumbai',
  'horse-safari-in-rajasthan',
  'kashmir-tour-package-from-kolkata',
  'bandhavgarh-national-park-tour',
  'kashmir-tour-package-from-ahmedabad',
  'kedarnath-and-vasuki-taal-trek',
  'jhansi-orchha-khajuraho-tour',
];

// **FIXED**: Main process function with better error handling
async function processAllTours() {
  console.log(`\n🚀 Starting batch processing of ${tourIds.length} tours...\n`);

  const results = {
    success: [] as string[],
    failed: [] as { tourId: string; error: string }[],
    skipped: [] as string[],
    updated: [] as string[],
    totalItinerariesAdded: 0,
  };

  // **FIXED**: Parse CSV once at the start
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

  for (let i = 0; i < tourIds.length; i++) {
    const tourId = tourIds[i];
    console.log(`\n${'='.repeat(80)}`);
    console.log(`📦 Processing [${i + 1}/${tourIds.length}]: ${tourId}`);
    console.log('='.repeat(80));

    try {
      const result = await addMissingItinerary(tourId, allCSVData);

      if (result.success) {
        results.success.push(tourId);
        if (result.updated) {
          results.updated.push(tourId);
        }
        results.totalItinerariesAdded += result.itinerariesAdded;
      } else {
        results.failed.push({ tourId, error: result.error || 'Unknown error' });
      }
    } catch (error: any) {
      results.failed.push({ tourId, error: error.message });
      console.error(`❌ Unhandled error for ${tourId}:`, error.message);
    }

    // **FIXED**: Longer delay and connection refresh
    if (i < tourIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1500)); // Increased to 1.5s

      // **FIXED**: Explicitly disconnect and reconnect every 10 tours
      if ((i + 1) % 10 === 0) {
        console.log('\n🔄 Refreshing database connection...');
        await prisma.$disconnect();
        await new Promise((resolve) => setTimeout(resolve, 2000));
        // Connection will auto-reconnect on next query
      }
    }
  }

  // **FIXED**: Final cleanup
  await prisma.$disconnect();

  console.log(`\n${'='.repeat(80)}`);
  console.log('📊 BATCH PROCESSING SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Success: ${results.success.length}`);
  console.log(`📝 Updated: ${results.updated.length}`);
  console.log(`📅 Total Itineraries Added: ${results.totalItinerariesAdded}`);
  console.log(`❌ Failed: ${results.failed.length}`);
  console.log(`📦 Total: ${tourIds.length}`);
  console.log('='.repeat(80));

  if (results.failed.length > 0) {
    console.log('\n❌ FAILED TOURS:');
    console.log('='.repeat(80));
    results.failed.forEach(({ tourId, error }) => {
      console.log(`   • ${tourId}: ${error}`);
    });
  }

  if (results.updated.length > 0) {
    console.log('\n✅ UPDATED TOURS:');
    console.log('='.repeat(80));
    results.updated.forEach((tourId) => {
      console.log(`   • ${tourId}`);
    });
  }
}

// Run the batch process
processAllTours();
