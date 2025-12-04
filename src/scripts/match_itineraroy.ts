import prisma from '@/config/db';
import * as fs from 'fs';
import * as path from 'path';

interface ItineraryMismatch {
  id: string;
  title: string;
  slug: string;
  durationDays: number;
  durationNights: number;
  itineraryCount: number;
  mismatchType: 'MISSING_DAYS' | 'EXTRA_DAYS' | 'DUPLICATE_DAYS' | 'GAP_IN_DAYS';
  details: string;
  missingDays?: number[];
  duplicateDays?: number[];
  itineraryDays?: number[];
}

async function validateItineraryDays() {
  console.log('🔍 Validating itinerary days match with tour duration...\n');

  try {
    const allTours = await prisma.tour.findMany({
      include: {
        itinerary: {
          orderBy: { day: 'asc' },
        },
      },
      where: {
        itinerary: {
          some: {},
        },
      },
    });

    console.log(`📊 Total tours with itinerary: ${allTours.length}\n`);

    const mismatches: ItineraryMismatch[] = [];
    const valid: { id: string; title: string; days: number; itineraries: number }[] = [];

    allTours.forEach((tour) => {
      const itineraryDays = tour.itinerary.map((i) => i.day);
      const itineraryCount = tour.itinerary.length;
      const expectedDays = tour.durationDays;

      // Check for duplicate days
      const duplicates = itineraryDays.filter((day, index) => itineraryDays.indexOf(day) !== index);
      const uniqueDuplicates = [...new Set(duplicates)];

      // Check for missing days (1 to durationDays)
      const expectedDaysArray = Array.from({ length: expectedDays }, (_, i) => i + 1);
      const missingDays = expectedDaysArray.filter((day) => !itineraryDays.includes(day));

      // Check for gaps in sequence
      const hasGaps = itineraryDays.some((day, index) => {
        if (index === 0) return false;
        return day !== itineraryDays[index - 1] + 1;
      });

      if (uniqueDuplicates.length > 0) {
        mismatches.push({
          id: tour.id,
          title: tour.title,
          slug: tour.slug,
          durationDays: tour.durationDays,
          durationNights: tour.durationNights,
          itineraryCount,
          mismatchType: 'DUPLICATE_DAYS',
          details: `Duplicate day numbers found: ${uniqueDuplicates.join(', ')}`,
          duplicateDays: uniqueDuplicates,
          itineraryDays,
        });
      } else if (itineraryCount < expectedDays) {
        mismatches.push({
          id: tour.id,
          title: tour.title,
          slug: tour.slug,
          durationDays: tour.durationDays,
          durationNights: tour.durationNights,
          itineraryCount,
          mismatchType: 'MISSING_DAYS',
          details: `Expected ${expectedDays} days, but only ${itineraryCount} itineraries found. Missing days: ${missingDays.join(', ')}`,
          missingDays,
          itineraryDays,
        });
      } else if (itineraryCount > expectedDays) {
        mismatches.push({
          id: tour.id,
          title: tour.title,
          slug: tour.slug,
          durationDays: tour.durationDays,
          durationNights: tour.durationNights,
          itineraryCount,
          mismatchType: 'EXTRA_DAYS',
          details: `Expected ${expectedDays} days, but ${itineraryCount} itineraries found`,
          itineraryDays,
        });
      } else if (hasGaps && missingDays.length > 0) {
        mismatches.push({
          id: tour.id,
          title: tour.title,
          slug: tour.slug,
          durationDays: tour.durationDays,
          durationNights: tour.durationNights,
          itineraryCount,
          mismatchType: 'GAP_IN_DAYS',
          details: `Has gaps in day sequence. Days present: [${itineraryDays.join(', ')}]. Missing: ${missingDays.join(', ')}`,
          missingDays,
          itineraryDays,
        });
      } else {
        valid.push({
          id: tour.id,
          title: tour.title,
          days: tour.durationDays,
          itineraries: itineraryCount,
        });
      }
    });

    console.log('═══════════════════════════════════════════════════════════');
    console.log('         ITINERARY VALIDATION REPORT');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n');

    console.log('📊 STATISTICS:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Total tours with itinerary:        ${allTours.length}`);
    console.log(`Valid tours (days match):          ${valid.length} ✅`);
    console.log(`Tours with mismatches:             ${mismatches.length} ❌`);
    console.log(
      `Percentage with issues:            ${((mismatches.length / allTours.length) * 100).toFixed(2)}%`
    );
    console.log('\n');

    // Group mismatches by type
    const missingDays = mismatches.filter((m) => m.mismatchType === 'MISSING_DAYS');
    const extraDays = mismatches.filter((m) => m.mismatchType === 'EXTRA_DAYS');
    const duplicateDays = mismatches.filter((m) => m.mismatchType === 'DUPLICATE_DAYS');
    const gapDays = mismatches.filter((m) => m.mismatchType === 'GAP_IN_DAYS');

    console.log('📉 MISMATCH BREAKDOWN:');
    console.log('─────────────────────────────────────────────────────────');
    console.log(`Missing Days (less than expected):  ${missingDays.length}`);
    console.log(`Extra Days (more than expected):    ${extraDays.length}`);
    console.log(`Duplicate Days:                     ${duplicateDays.length}`);
    console.log(`Gaps in Day Sequence:               ${gapDays.length}`);
    console.log('\n');

    if (mismatches.length > 0) {
      console.log('❌ TOURS WITH ITINERARY MISMATCHES:');
      console.log('─────────────────────────────────────────────────────────');

      mismatches.forEach((mismatch, index) => {
        console.log(`\n${index + 1}. ${mismatch.title}`);
        console.log(`   ID:              ${mismatch.id}`);
        console.log(`   Duration:        ${mismatch.durationDays}D/${mismatch.durationNights}N`);
        console.log(`   Itineraries:     ${mismatch.itineraryCount}`);
        console.log(`   Issue Type:      ${mismatch.mismatchType}`);
        console.log(`   Details:         ${mismatch.details}`);
        console.log(`   Itinerary Days:  [${mismatch.itineraryDays?.join(', ')}]`);
      });
    }

    console.log('\n');
    console.log('✅ VALID TOURS (Sample - First 10):');
    console.log('─────────────────────────────────────────────────────────');
    valid.slice(0, 10).forEach((tour, index) => {
      console.log(`${index + 1}. ${tour.title}`);
      console.log(`   Days: ${tour.days} | Itineraries: ${tour.itineraries}`);
    });
    if (valid.length > 10) {
      console.log(`   ... and ${valid.length - 10} more valid tours`);
    }

    console.log('\n');
    console.log('═══════════════════════════════════════════════════════════');

    // Save reports
    const outputDir = __dirname;
    const mismatchJsonPath = path.join(outputDir, 'itinerary-mismatches.json');
    const mismatchTxtPath = path.join(outputDir, 'itinerary-mismatches-ids.txt');
    const validJsonPath = path.join(outputDir, 'itinerary-valid.json');

    const reportData = {
      generatedAt: new Date().toISOString(),
      statistics: {
        totalTours: allTours.length,
        validTours: valid.length,
        toursWithMismatches: mismatches.length,
        percentageWithIssues: ((mismatches.length / allTours.length) * 100).toFixed(2) + '%',
      },
      breakdown: {
        missingDays: missingDays.length,
        extraDays: extraDays.length,
        duplicateDays: duplicateDays.length,
        gapDays: gapDays.length,
      },
      mismatches,
      valid,
    };

    fs.writeFileSync(mismatchJsonPath, JSON.stringify(reportData, null, 2));
    fs.writeFileSync(mismatchTxtPath, mismatches.map((m) => m.id).join('\n'));
    fs.writeFileSync(validJsonPath, JSON.stringify({ valid }, null, 2));

    console.log('\n💾 Reports saved:');
    console.log(`   - ${mismatchJsonPath}`);
    console.log(`   - ${mismatchTxtPath}`);
    console.log(`   - ${validJsonPath}`);
    console.log('\n');

    // Print actionable summary
    console.log('🔧 ACTION ITEMS:');
    console.log('─────────────────────────────────────────────────────────');
    if (missingDays.length > 0) {
      console.log(`1. Fix ${missingDays.length} tours with missing days`);
    }
    if (extraDays.length > 0) {
      console.log(`2. Review ${extraDays.length} tours with extra days`);
    }
    if (duplicateDays.length > 0) {
      console.log(`3. Fix ${duplicateDays.length} tours with duplicate days`);
    }
    if (gapDays.length > 0) {
      console.log(`4. Fix ${gapDays.length} tours with gaps in day sequence`);
    }
    console.log('\n');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

validateItineraryDays();
