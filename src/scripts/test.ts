import * as fs from 'fs';
import * as path from 'path';
import prisma from '@/config/db';

async function findIncompleteTours() {
  // Fetch all tours with related data
  const tours = await prisma.tour.findMany({
    include: {
      startCity: true,
      itinerary: true,
      cities: true,
      themes: true,
      faqs: {
        include: {
          questions: true,
        },
      },
    },
  });

  const incompleteTours = tours.map((tour) => {
    const missingFields: string[] = [];

    // Check required metadata
    if (!tour.metatitle) missingFields.push('metatitle');
    if (!tour.metadesc) missingFields.push('metadesc');

    // Check content fields
    if (!tour.overview) missingFields.push('overview');
    if (!tour.description) missingFields.push('description');

    // Check duration
    if (tour.durationDays === 0) missingFields.push('durationDays');
    if (tour.durationNights === 0) missingFields.push('durationNights');

    // Check arrays
    if (!tour.images || tour.images.length === 0) missingFields.push('images');
    if (!tour.highlights || tour.highlights.length === 0) missingFields.push('highlights');
    if (!tour.inclusions || tour.inclusions.length === 0) missingFields.push('inclusions');
    if (!tour.exclusions || tour.exclusions.length === 0) missingFields.push('exclusions');

    // Check relations
    if (!tour.startCityId) missingFields.push('startCity');
    if (!tour.itinerary || tour.itinerary.length === 0) missingFields.push('itinerary');
    if (!tour.cities || tour.cities.length === 0) missingFields.push('cities');
    if (!tour.themes || tour.themes.length === 0) missingFields.push('themes');

    // Check optional but important fields
    if (!tour.bestTime) missingFields.push('bestTime');
    if (!tour.idealFor) missingFields.push('idealFor');
    if (!tour.difficulty) missingFields.push('difficulty');
    if (!tour.cancellationPolicy) missingFields.push('cancellationPolicy');
    if (!tour.travelTips) missingFields.push('travelTips');

    // Check FAQs
    const hasFaqs =
      tour.faqs &&
      tour.faqs.length > 0 &&
      tour.faqs.some((faq) => faq.questions && faq.questions.length > 0);
    if (!hasFaqs) missingFields.push('faqs');

    return {
      id: tour.id,
      title: tour.title,
      slug: tour.slug,
      isActive: tour.isActive,
      isFeatured: tour.isFeatured,
      missingFields,
      missingCount: missingFields.length,
      completionPercentage: Math.round(((19 - missingFields.length) / 19) * 100),
      // Include existing data for reference
      existingData: {
        metatitle: tour.metatitle,
        metadesc: tour.metadesc,
        overview: tour.overview ? 'EXISTS' : null,
        description: tour.description ? 'EXISTS' : null,
        durationDays: tour.durationDays,
        durationNights: tour.durationNights,
        imagesCount: tour.images?.length || 0,
        highlightsCount: tour.highlights?.length || 0,
        inclusionsCount: tour.inclusions?.length || 0,
        exclusionsCount: tour.exclusions?.length || 0,
        startCity: tour.startCity?.name || null,
        itineraryCount: tour.itinerary?.length || 0,
        citiesCount: tour.cities?.length || 0,
        themesCount: tour.themes?.length || 0,
        faqsCount: tour.faqs?.length || 0,
      },
    };
  });

  // Filter only incomplete tours
  const incomplete = incompleteTours.filter((t) => t.missingCount > 0);

  // Sort by missing count (most incomplete first)
  incomplete.sort((a, b) => b.missingCount - a.missingCount);

  console.log(`\n=== INCOMPLETE TOURS REPORT ===`);
  console.log(`Total Tours: ${tours.length}`);
  console.log(`Complete Tours: ${tours.length - incomplete.length}`);
  console.log(`Incomplete Tours: ${incomplete.length}\n`);

  incomplete.forEach((tour, index) => {
    console.log(`${index + 1}. ${tour.title}`);
    console.log(`   ID: ${tour.id}`);
    console.log(`   Slug: ${tour.slug}`);
    console.log(
      `   Status: ${tour.isActive ? 'Active' : 'Inactive'} ${tour.isFeatured ? '(Featured)' : ''}`
    );
    console.log(`   Completion: ${tour.completionPercentage}%`);
    console.log(`   Missing Fields (${tour.missingCount}):`);
    tour.missingFields.forEach((field) => {
      console.log(`     - ${field}`);
    });
    console.log('');
  });

  // Summary by missing field
  const fieldStats: Record<string, number> = {};
  incomplete.forEach((tour) => {
    tour.missingFields.forEach((field) => {
      fieldStats[field] = (fieldStats[field] || 0) + 1;
    });
  });

  console.log(`\n=== MISSING FIELDS SUMMARY ===`);
  const sortedFields = Object.entries(fieldStats).sort((a, b) => b[1] - a[1]);

  sortedFields.forEach(([field, count]) => {
    console.log(`${field}: ${count} tours (${Math.round((count / incomplete.length) * 100)}%)`);
  });

  // Save to JSON file
  const outputDir = path.join(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const jsonOutput = {
    generatedAt: new Date().toISOString(),
    summary: {
      totalTours: tours.length,
      completeTours: tours.length - incomplete.length,
      incompleteTours: incomplete.length,
    },
    fieldStatistics: Object.fromEntries(sortedFields),
    incompleteTours: incomplete,
  };

  const outputPath = path.join(outputDir, 'incomplete-tours.json');
  fs.writeFileSync(outputPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`\n✅ Data saved to: ${outputPath}`);

  // Also save as CSV for easy viewing in Excel
  const csvLines = ['ID,Title,Slug,Active,Featured,Completion %,Missing Count,Missing Fields'];

  incomplete.forEach((tour) => {
    csvLines.push(
      [
        tour.id,
        `"${tour.title.replace(/"/g, '""')}"`,
        tour.slug,
        tour.isActive ? 'Yes' : 'No',
        tour.isFeatured ? 'Yes' : 'No',
        tour.completionPercentage,
        tour.missingCount,
        `"${tour.missingFields.join(', ')}"`,
      ].join(',')
    );
  });

  const csvPath = path.join(outputDir, 'incomplete-tours.csv');
  fs.writeFileSync(csvPath, csvLines.join('\n'));
  console.log(`✅ CSV saved to: ${csvPath}`);

  return incomplete;
}

// Export for use in other files
export async function getIncompleteToursList() {
  return findIncompleteTours();
}

// Run if executed directly
if (require.main === module) {
  findIncompleteTours()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
