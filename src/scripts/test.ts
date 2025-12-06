import prisma from '@/config/db';
import * as fs from 'fs';
import * as Papa from 'papaparse';
import * as path from 'path';

interface CSVRow {
  URL: string;
  PackageTitle: string;
  [key: string]: any;
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

async function quickCompare() {
  console.log('\n' + '='.repeat(100));
  console.log('⚡ QUICK COMPARE: DATABASE vs CSV');
  console.log('='.repeat(100));

  try {
    // Load CSV
    console.log('\n📂 Loading CSV...');
    const csvFilePath = path.join(__dirname, 'tours.csv');
    const csvData = await parseCSVFile(csvFilePath);

    const csvTours = new Map<string, string>();
    csvData.forEach((row) => {
      if (row.URL && row.URL.trim()) {
        const id = row.URL.trim();
        if (!csvTours.has(id)) {
          csvTours.set(id, row.PackageTitle || 'N/A');
        }
      }
    });
    console.log(`✅ CSV: ${csvTours.size} unique tours`);

    // Load DB
    console.log('\n🗄️  Loading Database...');
    const dbTours = await prisma.tour.findMany({
      select: { id: true, title: true },
    });
    const dbToursMap = new Map(dbTours.map((t) => [t.id, t.title]));
    console.log(`✅ DB: ${dbTours.length} tours`);

    // Compare
    console.log('\n🔍 Comparing...\n');

    const inCsvNotInDb: string[] = [];
    const inDbNotInCsv: string[] = [];
    const inBoth: string[] = [];

    // Check CSV tours
    csvTours.forEach((title, id) => {
      if (dbToursMap.has(id)) {
        inBoth.push(id);
      } else {
        inCsvNotInDb.push(id);
      }
    });

    // Check DB tours
    dbToursMap.forEach((title, id) => {
      if (!csvTours.has(id)) {
        inDbNotInCsv.push(id);
      }
    });

    // Results
    console.log('='.repeat(100));
    console.log('📊 RESULTS');
    console.log('='.repeat(100));
    console.log(`✅ In BOTH: ${inBoth.length}`);
    console.log(`❌ In CSV but NOT in DB: ${inCsvNotInDb.length}`);
    console.log(`⚠️  In DB but NOT in CSV: ${inDbNotInCsv.length}`);
    console.log('='.repeat(100));

    // Show missing tours
    if (inCsvNotInDb.length > 0) {
      console.log(`\n❌ IN CSV BUT NOT IN DATABASE (${inCsvNotInDb.length}):`);
      console.log('-'.repeat(100));
      inCsvNotInDb.forEach((id, i) => {
        console.log(`${i + 1}. ${id}`);
        console.log(`   Title: ${csvTours.get(id)}`);
      });

      console.log('\n// Array for adding to DB:');
      console.log('const toursToAdd = [');
      inCsvNotInDb.forEach((id) => console.log(`  '${id}',`));
      console.log('];\n');
    }

    if (inDbNotInCsv.length > 0) {
      console.log(`\n⚠️  IN DB BUT NOT IN CSV (${inDbNotInCsv.length}):`);
      console.log('-'.repeat(100));
      inDbNotInCsv.forEach((id, i) => {
        console.log(`${i + 1}. ${id}`);
        console.log(`   Title: ${dbToursMap.get(id)}`);
      });

      console.log('\n// Array for reference:');
      console.log('const toursOnlyInDb = [');
      inDbNotInCsv.forEach((id) => console.log(`  '${id}',`));
      console.log('];\n');
    }

    // Save report
    const report = `
QUICK COMPARISON REPORT
Generated: ${new Date().toLocaleString()}
================================================================================

SUMMARY:
- Tours in CSV: ${csvTours.size}
- Tours in DB: ${dbTours.length}
- In BOTH: ${inBoth.length}
- In CSV but NOT in DB: ${inCsvNotInDb.length}
- In DB but NOT in CSV: ${inDbNotInCsv.length}

================================================================================
TOURS IN CSV BUT NOT IN DATABASE (${inCsvNotInDb.length}):
================================================================================
${inCsvNotInDb.map((id, i) => `${i + 1}. ${id}\n   ${csvTours.get(id)}`).join('\n\n')}

================================================================================
TOURS IN DB BUT NOT IN CSV (${inDbNotInCsv.length}):
================================================================================
${inDbNotInCsv.map((id, i) => `${i + 1}. ${id}\n   ${dbToursMap.get(id)}`).join('\n\n')}

================================================================================
ARRAYS FOR PROCESSING:
================================================================================

// Tours to add to DB from CSV:
const toursToAdd = [
${inCsvNotInDb.map((id) => `  '${id}',`).join('\n')}
];

// Tours only in DB:
const toursOnlyInDb = [
${inDbNotInCsv.map((id) => `  '${id}',`).join('\n')}
];
`;

    const reportPath = path.join(__dirname, 'quick-comparison.txt');
    fs.writeFileSync(reportPath, report);
    console.log(`\n📄 Report saved: ${reportPath}`);
    console.log('\n✅ DONE!\n');
  } catch (error: any) {
    console.error('\n❌ ERROR:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

quickCompare();
