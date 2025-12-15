import prisma from '@/config/db';
import * as fs from 'fs';
import * as Papa from 'papaparse';
import * as path from 'path';

interface CSVRow {
  URL: string;
  PackageTitle: string;
  PackageDescription: string;
  PackagePrice: string;
  TotalDays: string;
  TotalNights: string;
  PackageInclusion: string;
  PackageExclusion: string;
  isActive: string;
  isFeatured: string;
  package_title: string;
  package_meta_desc: string;
  shortDesc: string;
  Highlights: string;
  DayNumber: string;
  ItineraryHead: string;
  ItineraryDetail: string;
  packageimages?: string;
  Slider1?: string;
  Slider2?: string;
  Slider3?: string;
  Slider4?: string;
  Slider5?: string;
  Slider6?: string;
  Slider7?: string;
  Slider8?: string;
  Slider9?: string;
  Slider10?: string;
  Slider11?: string;
  Slider12?: string;
  Slider13?: string;
  Slider14?: string;
  Slider15?: string;
  Slider16?: string;
  Slider17?: string;
  Slider18?: string;
}

function cleanHTML(html: string | null | undefined): string | null {
  if (!html) return null;
  let cleaned = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
  return cleaned || null;
}

function parseListItems(content: string | null | undefined): string[] {
  if (!content) return [];
  let cleaned = content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'");

  const lines = cleaned
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const items: string[] = [];

  for (let line of lines) {
    line = line
      .replace(/^[-•*➤►▪︎⦿○●]\s*/g, '')
      .replace(/^\d+\.\s*/g, '')
      .trim();
    if (line.length >= 5 && !/^(br|nbsp|amp)$/i.test(line)) {
      items.push(line);
    }
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const norm = item.toLowerCase().trim();
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

function parseHighlights(highlights: string | null | undefined): string[] {
  if (!highlights) return [];
  return highlights
    .split(/\n|Visit\s+/gi)
    .map((item) => item.trim())
    .filter((item) => item && item.length > 2)
    .map((item) => (item.toLowerCase().startsWith('visit') ? item : `Visit ${item}`));
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function findImageInFolder(imagePath: string | undefined, imagesDir: string): string | null {
  if (!imagePath || imagePath.trim() === '' || imagePath.toLowerCase() === 'null') return null;

  const filename = path.basename(imagePath.replace(/\\/g, '/'));
  if (!filename || filename === '') return null;

  const allFiles = fs.readdirSync(imagesDir);
  const matchedFile = allFiles.find((f) => f.toLowerCase() === filename.toLowerCase());

  if (matchedFile) {
    return `/images/${matchedFile}`;
  }

  const baseNameWithoutExt = filename.replace(/\.[^.]+$/, '');
  const similarFile = allFiles.find((f) =>
    f.toLowerCase().includes(baseNameWithoutExt.toLowerCase())
  );

  return similarFile ? `/images/${similarFile}` : null;
}

function collectTourImages(row: CSVRow, imagesDir: string): string[] {
  const images: string[] = [];
  const sliders = [
    row.packageimages,
    row.Slider1,
    row.Slider2,
    row.Slider3,
    row.Slider4,
    row.Slider5,
    row.Slider6,
    row.Slider7,
    row.Slider8,
    row.Slider9,
    row.Slider10,
    row.Slider11,
    row.Slider12,
    row.Slider13,
    row.Slider14,
    row.Slider15,
    row.Slider16,
    row.Slider17,
    row.Slider18,
  ];

  for (const slider of sliders) {
    const img = findImageInFolder(slider, imagesDir);
    if (img && !images.includes(img)) {
      images.push(img);
    }
  }

  return images;
}

async function addTourFromCSV(tourId: string, allCSVData: CSVRow[], imagesDir: string) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`🔄 Processing: ${tourId}`);
  console.log('='.repeat(80));

  const existingTour = await prisma.tour.findUnique({
    where: { id: tourId },
    select: { id: true, title: true },
  });

  if (existingTour) {
    console.log(`⚠️  Tour already exists in DB: ${existingTour.title}`);
    return { success: false, created: false, alreadyExists: true, error: 'Already exists in DB' };
  }

  console.log('✅ Tour not in DB - proceeding...');

  const tourRows = allCSVData.filter(
    (row) => row.URL && row.URL.toLowerCase().trim() === tourId.toLowerCase().trim()
  );

  if (tourRows.length === 0) {
    console.error(`❌ Tour not found in CSV: ${tourId}`);
    return { success: false, error: 'Not in CSV', created: false, alreadyExists: false };
  }

  console.log(`✅ Found in CSV (${tourRows.length} rows)`);

  const firstRow = tourRows[0];

  if (!firstRow.PackageTitle?.trim() || !firstRow.TotalDays || !firstRow.TotalNights) {
    console.error('❌ Missing required fields');
    return {
      success: false,
      error: 'Missing required fields',
      created: false,
      alreadyExists: false,
    };
  }

  const title = firstRow.PackageTitle.trim();
  const slug = generateSlug(title);
  const durationDays = parseInt(firstRow.TotalDays) || 0;
  const durationNights = parseInt(firstRow.TotalNights) || 0;
  const price = firstRow.PackagePrice ? parseInt(firstRow.PackagePrice) : 0;
  const isActive = firstRow.isActive === '1' || firstRow.isActive?.toLowerCase() === 'true';
  const isFeatured = firstRow.isFeatured === '1' || firstRow.isFeatured?.toLowerCase() === 'true';

  console.log(`\n📋 Tour Details:`);
  console.log(`   Title: ${title}`);
  console.log(`   Duration: ${durationDays}D/${durationNights}N`);
  console.log(`   Price: ₹${price}`);
  console.log(`   Active: ${isActive}`);
  console.log(`   Featured: ${isFeatured}`);

  const description = cleanHTML(firstRow.PackageDescription);
  const overview = cleanHTML(firstRow.shortDesc);
  const highlights = parseHighlights(firstRow.Highlights);
  const inclusions = parseListItems(firstRow.PackageInclusion);
  const exclusions = parseListItems(firstRow.PackageExclusion);
  const images = collectTourImages(firstRow, imagesDir);

  console.log(`\n📋 Parsed Content:`);
  console.log(`   Highlights: ${highlights.length}`);
  console.log(`   Inclusions: ${inclusions.length}`);
  console.log(`   Exclusions: ${exclusions.length}`);
  console.log(`   Images: ${images.length}`);

  const itineraries = tourRows
    .filter((row) => row.DayNumber && row.ItineraryHead)
    .map((row) => ({
      day: parseInt(row.DayNumber),
      title: row.ItineraryHead.trim(),
      description: cleanHTML(row.ItineraryDetail) || '',
    }))
    .sort((a, b) => a.day - b.day);

  console.log(`   Itineraries: ${itineraries.length} days`);

  const tourData: any = {
    id: tourId,
    title,
    slug,
    durationDays,
    durationNights,
    price,
    isActive,
    isFeatured,
    images,
    highlights,
    inclusions,
    exclusions,
  };

  if (description) tourData.description = description;
  if (overview) tourData.overview = overview;
  if (firstRow.package_title?.trim()) tourData.metatitle = firstRow.package_title.trim();
  if (firstRow.package_meta_desc?.trim()) tourData.metadesc = firstRow.package_meta_desc.trim();

  console.log(`\n💾 Creating tour in database...`);
  const createdTour = await prisma.tour.create({ data: tourData });
  console.log('✅ Tour created successfully!');

  if (itineraries.length > 0) {
    console.log(`\n💾 Creating ${itineraries.length} itineraries...`);
    let count = 0;
    for (const itinerary of itineraries) {
      try {
        await prisma.tourItinerary.create({
          data: {
            tourId,
            day: itinerary.day,
            title: itinerary.title,
            description: itinerary.description,
          },
        });
        count++;
        console.log(`   ✓ Day ${itinerary.day}: ${itinerary.title}`);
      } catch (err) {
        console.log(`   ✗ Day ${itinerary.day} failed`);
      }
    }
    console.log(`✅ Created ${count}/${itineraries.length} itineraries`);
  }

  console.log(`\n${'='.repeat(80)}`);
  console.log(`✅ Successfully added tour: ${title}`);
  console.log('='.repeat(80));

  return { success: true, created: true, alreadyExists: false };
}

const tourToAdd = 'kashmir-holiday-package';

async function main() {
  console.log('\n🚀 ADD SINGLE TOUR FROM CSV TO DATABASE\n');

  const csvFilePath = path.join(__dirname, 'tours.csv');
  const imagesDir = path.join(__dirname,"../", '..', 'images');

  if (!fs.existsSync(imagesDir)) {
    console.error(`❌ Images directory not found: ${imagesDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ CSV file not found: ${csvFilePath}`);
    process.exit(1);
  }

  console.log(`📂 Images directory: ${imagesDir}`);
  console.log(`📂 CSV file: ${csvFilePath}`);
  console.log(`🎯 Tour to add: ${tourToAdd}\n`);

  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');
  const allCSVData = await new Promise<CSVRow[]>((resolve, reject) => {
    Papa.parse<CSVRow>(fileContent, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: false,
      transformHeader: (h: string) => h.trim(),
      complete: (results) => resolve(results.data),
      error: (error: any) => reject(error),
    });
  });

  console.log(`✅ Loaded ${allCSVData.length} rows from CSV\n`);

  const result = await addTourFromCSV(tourToAdd, allCSVData, imagesDir);

  await prisma.$disconnect();

  console.log('\n✨ Done!\n');

  if (result.success && result.created) {
    console.log('🎉 Tour successfully added to database!');
  } else if (result.alreadyExists) {
    console.log('⚠️  Tour already exists in database - skipped');
  } else {
    console.log(`❌ Failed to add tour: ${result.error}`);
  }
}

main().catch(console.error);
