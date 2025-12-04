// Script to migrate and clean Inclusions/Exclusions to new database

import { promises as fs } from 'fs';
import path from 'path';
import prisma from '@/config/db';


interface InclusionData {
  id: string;
  title: string;
  description: string;
  order: number;
}

interface ExclusionData {
  id: string;
  title: string;
  description: string;
  order: number;
}

interface TourData {
  tourId: string;
  tourTitle: string;
  inclusions: InclusionData[];
  exclusions: ExclusionData[];
}

// Clean HTML tags and unnecessary characters
function cleanText(text: string): string {
  if (!text) return '';
  
  return text
    // Remove <br>, <br/>, <br />, \r, \n tags
    .replace(/<br\s*\/?>/gi, '')
    .replace(/\\r/g, '')
    .replace(/\\n/g, '')
    .replace(/\r\n/g, '')
    .replace(/\n/g, '')
    // Remove leading bullet points and whitespace
    .replace(/^[•\s]+/, '')
    // Remove multiple spaces
    .replace(/\s+/g, ' ')
    // Trim
    .trim();
}

// Check if text is just empty markup
function isEmptyContent(text: string): boolean {
  const cleaned = cleanText(text);
  return cleaned === '' || cleaned.length < 3;
}

// Extract meaningful items from messy data
function extractCleanItems(items: InclusionData[] | ExclusionData[]): string[] {
  const cleanItems: string[] = [];
  
  for (const item of items) {
    const cleanedText = cleanText(item.description);
    
    // Skip empty or near-empty content
    if (isEmptyContent(cleanedText)) {
      continue;
    }
    
    // Split by bullet points if multiple items in one entry
    const splits = cleanedText.split(/[•·]/).filter(s => s.trim().length > 0);
    
    for (const split of splits) {
      const finalText = split.trim();
      if (finalText && finalText.length > 3) {
        cleanItems.push(finalText);
      }
    }
  }
  
  return cleanItems;
}

async function migrateInclusionsExclusions() {
  try {
    console.log('📚 Starting migration...\n');

    // Read the JSON file
    const jsonPath = path.join(process.cwd(), 'inclusions-exclusions.json');
    const fileContent = await fs.readFile(jsonPath, 'utf-8');
    const toursData: TourData[] = JSON.parse(fileContent);

    console.log(`Found ${toursData.length} tours to process\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const tourData of toursData) {
      try {
        // Check if tour exists in new database
        const tour = await prisma.tour.findUnique({
          where: { slug: tourData.tourId }
        });

        if (!tour) {
          console.log(`⚠️  Tour not found: ${tourData.tourId}`);
          skipped++;
          continue;
        }

        // Extract and clean inclusions
        const cleanInclusions = extractCleanItems(tourData.inclusions);
        
        // Extract and clean exclusions
        const cleanExclusions = extractCleanItems(tourData.exclusions);

        // Update tour with cleaned data
        await prisma.tour.update({
          where: { id: tour.id },
          data: {
            inclusions: cleanInclusions,
            exclusions: cleanExclusions
          }
        });

        console.log(`✅ Updated: ${tour.title}`);
        console.log(`   Inclusions: ${cleanInclusions.length} items`);
        console.log(`   Exclusions: ${cleanExclusions.length} items`);
        
        if (cleanInclusions.length > 0) {
          console.log(`   Sample inclusion: "${cleanInclusions[0].substring(0, 60)}..."`);
        }
        console.log('');
        
        updated++;
      } catch (error) {
        console.error(`❌ Error processing ${tourData.tourId}:`, error);
        errors++;
      }
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Migration Summary');
    console.log('='.repeat(60));
    console.log(`✅ Successfully updated: ${updated} tours`);
    console.log(`⚠️  Skipped (not found): ${skipped} tours`);
    console.log(`❌ Errors: ${errors} tours`);
    console.log('='.repeat(60) + '\n');

    // Generate a sample output file to verify
    const sampleTour = await prisma.tour.findFirst({
      where: {
        inclusions: { isEmpty: false }
      },
      select: {
        title: true,
        inclusions: true,
        exclusions: true
      }
    });

    if (sampleTour) {
      const samplePath = path.join(process.cwd(), 'migration-sample.json');
      await fs.writeFile(samplePath, JSON.stringify(sampleTour, null, 2));
      console.log(`📄 Sample output saved to: ${samplePath}\n`);
    }

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateInclusionsExclusions()
  .then(() => {
    console.log('✨ Migration completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Migration failed:', error);
    process.exit(1);
  });