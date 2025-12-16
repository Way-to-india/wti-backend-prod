import prisma from '@/config/db';
import * as fs from 'fs';
import * as path from 'path';

interface TourInclusionExclusion {
  tourId: string;
  inclusions: string[];
  exclusions: string[];
}

interface UpdateReport {
  tourId: string;
  status: 'updated' | 'not_found' | 'skipped' | 'error';
  message: string;
  addedInclusions: boolean;
  addedExclusions: boolean;
  inclusionsCount?: number;
  exclusionsCount?: number;
}

interface BackupData {
  tourId: string;
  title: string;
  previousInclusions: string[];
  previousExclusions: string[];
  newInclusions: string[];
  newExclusions: string[];
  timestamp: string;
}

async function updateToursFromJson(jsonFilePath: string) {
  console.log(`📂 Reading JSON file: ${jsonFilePath}`);

  const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
  const toursData: TourInclusionExclusion[] = JSON.parse(fileContent);

  console.log(`📊 Total tours in JSON: ${toursData.length}\n`);
  console.log(`${'='.repeat(70)}`);
  console.log(`🔄 Starting Update Process`);
  console.log(`${'='.repeat(70)}\n`);

  const reports: UpdateReport[] = [];
  const backupData: BackupData[] = [];
  let processedCount = 0;

  for (const tourData of toursData) {
    processedCount++;
    console.log(`[${processedCount}/${toursData.length}] Processing: ${tourData.tourId}`);

    try {
      // Find tour in database
      const existingTour = await prisma.tour.findUnique({
        where: { id: tourData.tourId },
        select: {
          id: true,
          title: true,
          inclusions: true,
          exclusions: true,
        },
      });

      if (!existingTour) {
        console.log(`   ❌ Tour not found in database\n`);
        reports.push({
          tourId: tourData.tourId,
          status: 'not_found',
          message: 'Tour does not exist in database',
          addedInclusions: false,
          addedExclusions: false,
        });
        continue;
      }

      const hasInclusions = existingTour.inclusions && existingTour.inclusions.length > 0;
      const hasExclusions = existingTour.exclusions && existingTour.exclusions.length > 0;

      const willUpdateInclusions = tourData.inclusions.length > 0;
      const willUpdateExclusions = tourData.exclusions.length > 0;

      if (!willUpdateInclusions && !willUpdateExclusions) {
        console.log(`   ⏭️  No inclusions or exclusions in JSON, skipping\n`);
        reports.push({
          tourId: tourData.tourId,
          status: 'skipped',
          message: 'No inclusions or exclusions in JSON data',
          addedInclusions: false,
          addedExclusions: false,
          inclusionsCount: existingTour.inclusions?.length || 0,
          exclusionsCount: existingTour.exclusions?.length || 0,
        });
        continue;
      }

      // Create backup before updating
      const backup: BackupData = {
        tourId: existingTour.id,
        title: existingTour.title,
        previousInclusions: existingTour.inclusions || [],
        previousExclusions: existingTour.exclusions || [],
        newInclusions: tourData.inclusions,
        newExclusions: tourData.exclusions,
        timestamp: new Date().toISOString(),
      };
      backupData.push(backup);

      // Prepare update data - always replace if data exists in JSON
      const updateData: any = {};

      if (willUpdateInclusions) {
        if (hasInclusions) {
          console.log(
            `   🔄 Replacing ${existingTour.inclusions?.length || 0} existing inclusions with ${tourData.inclusions.length} new ones`
          );
        } else {
          console.log(`   ➕ Adding ${tourData.inclusions.length} inclusions`);
        }
        updateData.inclusions = tourData.inclusions;
      }

      if (willUpdateExclusions) {
        if (hasExclusions) {
          console.log(
            `   🔄 Replacing ${existingTour.exclusions?.length || 0} existing exclusions with ${tourData.exclusions.length} new ones`
          );
        } else {
          console.log(`   ➕ Adding ${tourData.exclusions.length} exclusions`);
        }
        updateData.exclusions = tourData.exclusions;
      }

      // Update the tour (ONLY inclusions and exclusions - nothing else)
      await prisma.tour.update({
        where: { id: tourData.tourId },
        data: updateData,
      });

      console.log(`   ✅ Successfully updated!\n`);

      reports.push({
        tourId: tourData.tourId,
        status: 'updated',
        message: 'Successfully updated',
        addedInclusions: willUpdateInclusions,
        addedExclusions: willUpdateExclusions,
        inclusionsCount: tourData.inclusions.length,
        exclusionsCount: tourData.exclusions.length,
      });
    } catch (error) {
      console.log(`   ❌ Error: ${error}\n`);
      reports.push({
        tourId: tourData.tourId,
        status: 'error',
        message: `Error: ${error}`,
        addedInclusions: false,
        addedExclusions: false,
      });
    }
  }

  // Generate summary report
  console.log(`\n${'='.repeat(70)}`);
  console.log(`📊 UPDATE SUMMARY REPORT`);
  console.log(`${'='.repeat(70)}\n`);

  const stats = {
    total: reports.length,
    updated: reports.filter((r) => r.status === 'updated').length,
    notFound: reports.filter((r) => r.status === 'not_found').length,
    skipped: reports.filter((r) => r.status === 'skipped').length,
    errors: reports.filter((r) => r.status === 'error').length,
    addedInclusions: reports.filter((r) => r.addedInclusions).length,
    addedExclusions: reports.filter((r) => r.addedExclusions).length,
    addedBoth: reports.filter((r) => r.addedInclusions && r.addedExclusions).length,
  };

  console.log(`📦 Total Tours Processed: ${stats.total}`);
  console.log(`✅ Successfully Updated: ${stats.updated}`);
  console.log(`⏭️  Skipped (No Data in JSON): ${stats.skipped}`);
  console.log(`❌ Not Found in Database: ${stats.notFound}`);
  console.log(`⚠️  Errors: ${stats.errors}`);
  console.log(`\n📋 Updated Inclusions: ${stats.addedInclusions} tours`);
  console.log(`📋 Updated Exclusions: ${stats.addedExclusions} tours`);
  console.log(`🎯 Updated Both: ${stats.addedBoth} tours`);

  // Detailed reports
  const updatedTours = reports.filter((r) => r.status === 'updated');
  if (updatedTours.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`✅ UPDATED TOURS (${updatedTours.length})`);
    console.log(`${'='.repeat(70)}`);
    updatedTours.forEach((report, index) => {
      console.log(`\n${index + 1}. ${report.tourId}`);
      if (report.addedInclusions) {
        console.log(`   ✓ Updated Inclusions: ${report.inclusionsCount} items`);
      }
      if (report.addedExclusions) {
        console.log(`   ✓ Updated Exclusions: ${report.exclusionsCount} items`);
      }
    });
  }

  const notFoundTours = reports.filter((r) => r.status === 'not_found');
  if (notFoundTours.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`❌ TOURS NOT FOUND IN DATABASE (${notFoundTours.length})`);
    console.log(`${'='.repeat(70)}`);
    notFoundTours.forEach((report, index) => {
      console.log(`${index + 1}. ${report.tourId}`);
    });
  }

  const skippedTours = reports.filter((r) => r.status === 'skipped');
  if (skippedTours.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`⏭️  SKIPPED TOURS (No Data in JSON) (${skippedTours.length})`);
    console.log(`${'='.repeat(70)}`);
    skippedTours.forEach((report, index) => {
      console.log(
        `${index + 1}. ${report.tourId} - Current Inc: ${report.inclusionsCount}, Exc: ${report.exclusionsCount}`
      );
    });
  }

  const errorTours = reports.filter((r) => r.status === 'error');
  if (errorTours.length > 0) {
    console.log(`\n${'='.repeat(70)}`);
    console.log(`⚠️  ERRORS (${errorTours.length})`);
    console.log(`${'='.repeat(70)}`);
    errorTours.forEach((report, index) => {
      console.log(`${index + 1}. ${report.tourId}`);
      console.log(`   Error: ${report.message}`);
    });
  }

  // Save detailed report to file
  const reportFilePath = path.join(__dirname, './update-report.json');
  fs.writeFileSync(reportFilePath, JSON.stringify(reports, null, 2), 'utf-8');

  // Save backup data to file
  const backupFilePath = path.join(__dirname, `./backup-before-update-${Date.now()}.json`);
  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');

  console.log(`\n${'='.repeat(70)}`);
  console.log(`📄 Detailed report saved to: ${reportFilePath}`);
  console.log(`💾 Backup file saved to: ${backupFilePath}`);
  console.log(`${'='.repeat(70)}`);
  console.log(
    `\n⚠️  IMPORTANT: Keep the backup file safe! You can use it to restore previous data if needed.`
  );
  console.log(`${'='.repeat(70)}\n`);

  await prisma.$disconnect();
}

// File paths
const jsonFilePath = path.join(__dirname, './tour-inclusions-exclusions.json');

// Run the update
updateToursFromJson(jsonFilePath)
  .then(() => {
    console.log('✨ Update process completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
