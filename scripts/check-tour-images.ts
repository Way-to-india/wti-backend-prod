import prisma from '../src/config/db';

async function checkTour() {
  const tour = await prisma.tour.findUnique({
    where: { slug: 'agra-overnight-tour' },
    select: { images: true, title: true },
  });

  console.log('\n📊 Tour:', tour?.title);
  console.log('\n🖼️  Images:');
  tour?.images.forEach((img, idx) => {
    console.log(`   ${idx + 1}. ${img}`);
  });
  console.log(`\n✅ Total images: ${tour?.images.length}`);

  await prisma.$disconnect();
}

checkTour();
