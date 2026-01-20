import prisma from '../src/config/db';

/**
 * Script to check which tours don't have images
 * This will help identify tours that need image uploads
 */

interface TourWithoutImages {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
  imageCount: number;
}

async function checkToursWithoutImages() {
  console.log('🔍 Checking tours without images...\n');

  try {
    // Fetch all tours
    const allTours = await prisma.tour.findMany({
      select: {
        id: true,
        title: true,
        slug: true,
        images: true,
        isActive: true,
        isFeatured: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    console.log(`📊 Total tours in database: ${allTours.length}\n`);

    // Filter tours without images
    const toursWithoutImages: TourWithoutImages[] = allTours
      .filter((tour) => !tour.images || tour.images.length === 0)
      .map((tour) => ({
        id: tour.id,
        title: tour.title,
        slug: tour.slug,
        isActive: tour.isActive,
        isFeatured: tour.isFeatured,
        createdAt: tour.createdAt,
        updatedAt: tour.updatedAt,
        imageCount: tour.images?.length || 0,
      }));

    // Tours with images
    const toursWithImages = allTours.filter((tour) => tour.images && tour.images.length > 0);

    // Statistics
    console.log('📈 Statistics:');
    console.log(`   ✅ Tours with images: ${toursWithImages.length}`);
    console.log(`   ❌ Tours without images: ${toursWithoutImages.length}`);
    console.log(
      `   📊 Percentage without images: ${((toursWithoutImages.length / allTours.length) * 100).toFixed(2)}%\n`
    );

    // Active tours without images
    const activeToursWithoutImages = toursWithoutImages.filter((tour) => tour.isActive);
    const inactiveToursWithoutImages = toursWithoutImages.filter((tour) => !tour.isActive);

    console.log('🔴 Active tours without images:');
    console.log(`   Count: ${activeToursWithoutImages.length}\n`);

    if (activeToursWithoutImages.length > 0) {
      console.log('   List of active tours without images:');
      console.log('   ' + '='.repeat(80));
      activeToursWithoutImages.forEach((tour, index) => {
        console.log(`   ${index + 1}. ${tour.title}`);
        console.log(`      ID: ${tour.id}`);
        console.log(`      Slug: ${tour.slug}`);
        console.log(`      Featured: ${tour.isFeatured ? 'Yes' : 'No'}`);
        console.log(`      Created: ${tour.createdAt.toISOString().split('T')[0]}`);
        console.log(`      Updated: ${tour.updatedAt.toISOString().split('T')[0]}`);
        console.log('   ' + '-'.repeat(80));
      });
      console.log('');
    }

    console.log('⚪ Inactive tours without images:');
    console.log(`   Count: ${inactiveToursWithoutImages.length}\n`);

    if (inactiveToursWithoutImages.length > 0 && inactiveToursWithoutImages.length <= 10) {
      console.log('   List of inactive tours without images:');
      console.log('   ' + '='.repeat(80));
      inactiveToursWithoutImages.forEach((tour, index) => {
        console.log(`   ${index + 1}. ${tour.title}`);
        console.log(`      ID: ${tour.id}`);
        console.log(`      Slug: ${tour.slug}`);
        console.log(`      Created: ${tour.createdAt.toISOString().split('T')[0]}`);
        console.log('   ' + '-'.repeat(80));
      });
      console.log('');
    } else if (inactiveToursWithoutImages.length > 10) {
      console.log(`   (Too many to display - showing first 10)`);
      console.log('   ' + '='.repeat(80));
      inactiveToursWithoutImages.slice(0, 10).forEach((tour, index) => {
        console.log(`   ${index + 1}. ${tour.title}`);
        console.log(`      ID: ${tour.id}`);
        console.log(`      Slug: ${tour.slug}`);
        console.log('   ' + '-'.repeat(80));
      });
      console.log('');
    }

    // Featured tours without images (critical!)
    const featuredToursWithoutImages = toursWithoutImages.filter((tour) => tour.isFeatured);
    if (featuredToursWithoutImages.length > 0) {
      console.log('⚠️  CRITICAL: Featured tours without images:');
      console.log(`   Count: ${featuredToursWithoutImages.length}`);
      console.log('   ' + '='.repeat(80));
      featuredToursWithoutImages.forEach((tour, index) => {
        console.log(`   ${index + 1}. ${tour.title}`);
        console.log(`      ID: ${tour.id}`);
        console.log(`      Slug: ${tour.slug}`);
        console.log(`      Active: ${tour.isActive ? 'Yes' : 'No'}`);
        console.log('   ' + '-'.repeat(80));
      });
      console.log('');
    }

    // Summary
    console.log('📋 Summary:');
    console.log(`   Total tours: ${allTours.length}`);
    console.log(`   Tours with images: ${toursWithImages.length}`);
    console.log(`   Tours without images: ${toursWithoutImages.length}`);
    console.log(`   - Active: ${activeToursWithoutImages.length}`);
    console.log(`   - Inactive: ${inactiveToursWithoutImages.length}`);
    console.log(`   - Featured: ${featuredToursWithoutImages.length}`);

    // Average images per tour
    const totalImages = toursWithImages.reduce((sum, tour) => {
      const tourData = allTours.find((t) => t.id === tour.id);
      return sum + (tourData?.images?.length || 0);
    }, 0);
    const avgImages = toursWithImages.length > 0 ? (totalImages / toursWithImages.length).toFixed(2) : 0;
    console.log(`   Average images per tour (for tours with images): ${avgImages}`);

    console.log('\n✨ Check completed successfully!');
  } catch (error) {
    console.error('❌ Error checking tours:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkToursWithoutImages().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
