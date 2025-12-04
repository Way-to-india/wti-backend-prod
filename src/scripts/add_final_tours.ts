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

interface TourData {
  id: string;
  title: string;
  slug: string;
  metatitle: string | null;
  metadesc: string | null;
  overview: string | null;
  description: string | null;
  durationDays: number;
  durationNights: number;
  price: number;
  isActive: boolean;
  isFeatured: boolean;
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
}

interface ItineraryData {
  day: number;
  title: string;
  description: string;
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

function parseListItems(content: string | null | undefined): string[] {
  if (!content) return [];
  const items = content
    .split(/<br\s*\/?>/gi)
    .map((item) => cleanHTML(item))
    .filter((item) => item && item.trim().length > 0)
    .map((item) => item!.trim());
  return items;
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

async function parseTourFromCSV(
  rows: CSVRow[]
): Promise<{ tour: TourData; itineraries: ItineraryData[] }> {
  const firstRow = rows[0];
  const tourData: TourData = {
    id: firstRow.URL.toLowerCase().trim(),
    title: firstRow.PackageName.trim(),
    slug: firstRow.URL.toLowerCase().trim(),
    metatitle: firstRow.package_title?.trim() || null,
    metadesc: firstRow.package_meta_desc?.trim() || null,
    overview: cleanHTML(firstRow.shortDesc),
    description: cleanHTML(firstRow.PackageDescription),
    durationDays: parseInt(firstRow.TotalDays) || 0,
    durationNights: parseInt(firstRow.TotalNights) || 0,
    price: parseInt(firstRow.PackagePrice) || 0,
    isActive: firstRow.isActive === '1',
    isFeatured: firstRow.isFeatured === '1',
    highlights: parseHighlights(firstRow.Highlights),
    inclusions: parseListItems(firstRow.PackageInclusion),
    exclusions: parseListItems(firstRow.PackageExclusion),
  };

  const itineraries: ItineraryData[] = rows
    .filter((row) => row.DayNumber && row.ItineraryHead)
    .map((row) => ({
      day: parseInt(row.DayNumber),
      title: row.ItineraryHead.trim(),
      description: cleanHTML(row.ItineraryDetail) || '',
    }))
    .sort((a, b) => a.day - b.day);

  return { tour: tourData, itineraries };
}

async function upsertTour(tourData: TourData, itineraries: ItineraryData[]) {
  console.log(`\n🔄 Processing tour: ${tourData.title}`);
  console.log(`📍 Tour ID/Slug: ${tourData.id}`);
  console.log(`📅 Duration: ${tourData.durationDays}D/${tourData.durationNights}N`);
  console.log(`📝 Itineraries: ${itineraries.length}`);

  try {
    const existingTour = await prisma.tour.findUnique({
      where: { id: tourData.id },
      include: { itinerary: true },
    });

    if (existingTour) {
      console.log(`✏️  Tour exists, updating...`);
      await prisma.tour.update({
        where: { id: tourData.id },
        data: {
          title: tourData.title,
          slug: tourData.slug,
          metatitle: tourData.metatitle,
          metadesc: tourData.metadesc,
          overview: tourData.overview,
          description: tourData.description,
          durationDays: tourData.durationDays,
          durationNights: tourData.durationNights,
          price: tourData.price,
          isActive: tourData.isActive,
          isFeatured: tourData.isFeatured,
          highlights: tourData.highlights,
          inclusions: tourData.inclusions,
          exclusions: tourData.exclusions,
          updatedAt: new Date(),
        },
      });
      console.log(`🗑️  Deleting ${existingTour.itinerary.length} existing itineraries...`);
      await prisma.tourItinerary.deleteMany({
        where: { tourId: tourData.id },
      });
    } else {
      console.log(`✨ Creating new tour...`);
      await prisma.tour.create({
        data: {
          id: tourData.id,
          title: tourData.title,
          slug: tourData.slug,
          metatitle: tourData.metatitle,
          metadesc: tourData.metadesc,
          overview: tourData.overview,
          description: tourData.description,
          durationDays: tourData.durationDays,
          durationNights: tourData.durationNights,
          price: tourData.price,
          isActive: tourData.isActive,
          isFeatured: tourData.isFeatured,
          highlights: tourData.highlights,
          inclusions: tourData.inclusions,
          exclusions: tourData.exclusions,
        },
      });
    }

    console.log(`➕ Creating ${itineraries.length} itineraries...`);
    for (const itinerary of itineraries) {
      await prisma.tourItinerary.create({
        data: {
          tourId: tourData.id,
          day: itinerary.day,
          title: itinerary.title,
          description: itinerary.description,
        },
      });
      console.log(`   ✓ Day ${itinerary.day}: ${itinerary.title}`);
    }

    console.log(`✅ Successfully processed tour: ${tourData.title}\n`);
  } catch (error) {
    console.error(`❌ Error processing tour:`, error);
    throw error;
  }
}

async function importTourFromCSV(csvFilePath: string, tourUrl: string) {
  console.log(`📂 Reading CSV file: ${csvFilePath}`);
  const fileContent = fs.readFileSync(csvFilePath, 'utf-8');

  Papa.parse<CSVRow>(fileContent, {
    header: true,
    skipEmptyLines: true,
    complete: async (results) => {
      console.log(`📊 Total rows in CSV: ${results.data.length}`);
      const tourRows = results.data.filter(
        (row) => row.URL && row.URL.toLowerCase().trim() === tourUrl.toLowerCase().trim()
      );

      if (tourRows.length === 0) {
        console.error(`❌ No rows found for tour URL: ${tourUrl}`);
        return;
      }

      console.log(`🎯 Found ${tourRows.length} rows for tour: ${tourUrl}`);

      try {
        const { tour, itineraries } = await parseTourFromCSV(tourRows);
        console.log('\n📋 Parsed Tour Data:');
        console.log('-------------------');
        console.log(`Title: ${tour.title}`);
        console.log(`Meta Title: ${tour.metatitle}`);
        console.log(`Meta Desc: ${tour.metadesc}`);
        console.log(`Duration: ${tour.durationDays}D/${tour.durationNights}N`);
        console.log(`Price: ₹${tour.price}`);
        console.log(`Active: ${tour.isActive}`);
        console.log(`Featured: ${tour.isFeatured}`);
        console.log(`Highlights: ${tour.highlights.length} items`);
        console.log(`Inclusions: ${tour.inclusions.length} items`);
        console.log(`Exclusions: ${tour.exclusions.length} items`);
        console.log(`Itineraries: ${itineraries.length} days`);

        await upsertTour(tour, itineraries);

        const savedTour = await prisma.tour.findUnique({
          where: { id: tour.id },
          include: { itinerary: { orderBy: { day: 'asc' } } },
        });

        console.log('\n✨ Final Result:');
        console.log('===============');
        console.log(JSON.stringify(savedTour, null, 2));
      } catch (error) {
        console.error('❌ Error during import:', error);
      } finally {
        await prisma.$disconnect();
      }
    },
    error: (error: any) => {
      console.error('❌ Error parsing CSV:', error);
    },
  });
}

const csvFilePath = path.join(__dirname, 'tours.csv');
const tourUrl = 'golden-triangle-with-ranthambore';
importTourFromCSV(csvFilePath, tourUrl);
