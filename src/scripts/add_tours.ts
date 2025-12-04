import * as fs from "fs";
import * as path from "path";
import Papa from "papaparse";
import prisma from '@/config/db';

interface CsvRow {
  [key: string]: string;
}

// Function to convert package name to slug format - CORRECT WAY
function toSlug(name: string): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // spaces to dash
    .replace(/&/g, "and") // & to and
    .replace(/[^\w-]/g, "") // remove special chars except dash
    .replace(/-+/g, "-") // multiple dashes to single
    .replace(/^-+|-+$/g, ""); // remove leading/trailing dashes
}

// Parse HTML/Text with <br> to array
function parseWithBrTags(text: string): string[] {
  if (!text || text === "NULL") return [];

  return text
    .split(/<br\s*\/?>/gi) // Split by br tags
    .map((item) => {
      // Remove all HTML tags
      let cleaned = item.replace(/<[^>]*>/g, "");
      // Decode HTML entities
      cleaned = cleaned
        .replace(/&nbsp;/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");
      // Trim and clean
      cleaned = cleaned.trim();
      return cleaned;
    })
    .filter((item) => item.length > 0); // Remove empty strings
}

// Parse HTML to plain text
function parseHtmlToPlainText(html: string): string {
  if (!html || html === "NULL") return "";

  let text = html
    .replace(/<[^>]*>/g, " ") // Remove HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ") // Normalize spaces
    .trim();

  return text;
}

// Parse CSV file using papaparse
async function parseCsvFile(filePath: string): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);

    Papa.parse(fileStream, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        resolve(results.data);
      },
      error: (error: any) => {
        reject(error);
      },
    });
  });
}

// Group CSV rows by tour slug
function groupToursBySlug(rows: CsvRow[]): Map<string, CsvRow[]> {
  const tourGroups = new Map<string, CsvRow[]>();

  rows.forEach((row) => {
    const packageName = row.PackageName?.trim();
    if (!packageName || packageName === "NULL") return;

    const slug = toSlug(packageName);

    if (!tourGroups.has(slug)) {
      tourGroups.set(slug, []);
    }
    tourGroups.get(slug)!.push(row);
  });

  return tourGroups;
}

// Create or update tour from CSV data
async function createOrUpdateTour(tourRows: CsvRow[]): Promise<void> {
  if (tourRows.length === 0) return;

  const firstRow = tourRows[0];
  const packageName = firstRow.PackageName?.trim() || "";
  const slug = toSlug(packageName);

  console.log(`\n${"=".repeat(120)}`);
  console.log(`🔄 Processing Tour: ${packageName}`);
  console.log(`📌 Slug: ${slug}`);
  console.log(`${"=".repeat(120)}`);

  try {
    // Extract tour data from first row
    const title = firstRow.PackageTitle?.trim() || packageName;
    const description = parseHtmlToPlainText(firstRow.PackageDescription || "");
    const overview = parseHtmlToPlainText(firstRow.shortDesc || ""); // Short description becomes overview
    const durationDays = parseInt(firstRow.TotalDays) || 0;
    const durationNights = parseInt(firstRow.TotalNights) || 0;
    const inclusions = parseWithBrTags(firstRow.PackageInclusion || "");
    const exclusions = parseWithBrTags(firstRow.PackageExclusion || "");

    console.log(`📋 Title: ${title}`);
    console.log(`👁️  Overview: ${overview.substring(0, 80)}...`);
    console.log(`⏱️  Duration: ${durationDays} days, ${durationNights} nights`);
    console.log(`✓ Inclusions: ${inclusions.length} items`);
    console.log(`✗ Exclusions: ${exclusions.length} items`);

    // Check if tour exists
    let existingTour = await prisma.tour.findUnique({
      where: { slug },
    });

    let tour;

    if (!existingTour) {
      // Create new tour with slug as ID
      tour = await prisma.tour.create({
        data: {
          id: slug, // Use slug as ID instead of CUID
          title,
          slug,
          description,
          overview,
          durationDays,
          durationNights,
          inclusions,
          exclusions,
          isActive: true,
        },
      });
      console.log(`\n✅ Tour CREATED (ID: ${tour.id})`);
    } else {
      // Update existing tour
      tour = await prisma.tour.update({
        where: { id: existingTour.id },
        data: {
          title,
          description,
          overview,
          durationDays,
          durationNights,
          inclusions,
          exclusions,
        },
      });
      console.log(`\n✅ Tour UPDATED (ID: ${tour.id})`);
    }

    // Get existing itineraries
    const existingItineraries = await prisma.tourItinerary.findMany({
      where: { tourId: tour.id },
      orderBy: { day: "asc" },
    });

    const existingDays = new Set(existingItineraries.map((it) => it.day));

    // Add all itineraries from CSV
    console.log(`\n${"─".repeat(120)}`);
    console.log(`📍 Processing Itineraries`);
    console.log(`${"─".repeat(120)}`);

    let addedCount = 0;
    let skippedCount = 0;

    for (const row of tourRows) {
      const dayNumber = parseInt(row.DayNumber) || 0;
      const itineraryHead = row.ItineraryHead?.trim() || "";
      const itineraryDetail = parseHtmlToPlainText(row.ItineraryDetail || "");

      if (dayNumber > 0 && itineraryHead && itineraryDetail) {
        if (!existingDays.has(dayNumber)) {
          await prisma.tourItinerary.create({
            data: {
              tourId: tour.id,
              day: dayNumber,
              title: itineraryHead.substring(0, 255),
              description: itineraryDetail,
            },
          });

          console.log(
            `✅ Day ${dayNumber}: ${itineraryHead.substring(0, 60)}...`
          );
          addedCount++;
          existingDays.add(dayNumber);
        } else {
          skippedCount++;
        }
      }
    }

    console.log(`\n${"─".repeat(120)}`);
    console.log(`✨ SUMMARY`);
    console.log(`${"─".repeat(120)}`);
    console.log(`Tour ID: ${tour.id}`);
    console.log(`Title: ${tour.title}`);
    console.log(`Slug: ${tour.slug}`);
    console.log(`Duration: ${tour.durationDays} days / ${tour.durationNights} nights`);
    console.log(`Inclusions: ${tour.inclusions.length}`);
    console.log(`Exclusions: ${tour.exclusions.length}`);
    console.log(`Itineraries Added: ${addedCount}`);
    console.log(`Itineraries Skipped: ${skippedCount}`);
    console.log(`${"─".repeat(120)}\n`);
  } catch (error) {
    console.error("❌ Error processing tour:", error);
    throw error;
  }
}

// Main execution
async function main(): Promise<void> {
  console.log("\n🚀 Starting Robust Tour CSV Import Script...\n");

  const csvPath = path.join(process.cwd(), "final_tour.csv");

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV file not found: ${csvPath}\n`);
    process.exit(1);
  }

  console.log(`📂 CSV File: ${csvPath}\n`);

  try {
    // Parse CSV with papaparse
    console.log("📖 Parsing CSV file...");
    const csvRows = await parseCsvFile(csvPath);
    console.log(`✅ Loaded ${csvRows.length} rows\n`);

    // Group by tour slug
    const tourGroups = groupToursBySlug(csvRows);
    console.log(`✅ Found ${tourGroups.size} unique tours\n`);

    // Process only first tour for testing
    const tourSlugs = Array.from(tourGroups.keys());
    
    if (tourSlugs.length === 0) {
      console.log("❌ No tours found in CSV\n");
      process.exit(1);
    }

    const firstTourSlug = tourSlugs[0];
    const tourRows = tourGroups.get(firstTourSlug)!;
    
    console.log(`${"=".repeat(120)}`);
    console.log(`🧪 TEST MODE: Processing ONLY First Tour`);
    console.log(`Total tours in CSV: ${tourSlugs.length}`);
    console.log(`Current tour: ${tourRows[0].PackageName}`);
    console.log(`Rows for this tour: ${tourRows.length}`);
    console.log(`${"=".repeat(120)}\n`);
    
    await createOrUpdateTour(tourRows);
    
    console.log(`\n${"=".repeat(120)}`);
    console.log(`ℹ️  Testing complete! First tour processed.`);
    console.log(`Remaining tours in CSV: ${tourSlugs.length - 1}`);
    console.log(`${"=".repeat(120)}\n`);
  } catch (error) {
    console.error("\n❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});