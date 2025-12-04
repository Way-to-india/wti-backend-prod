import prisma from '@/config/db';


async function findToursWithNoImages(): Promise<void> {
  try {
    const tours = await prisma.tour.findMany({
      where: {
        OR: [
          { images: { equals: [] } }, 
          { images: { isEmpty: true } }, 
        ],
      },
      select: {
        id: true,
        title: true,
        images: true,
      },
    });

    console.log('\nTours with images.length === 0:\n');

    tours.forEach((tour) => {
      console.log(`ID: ${tour.id} | Title: ${tour.title}`);
    });

    console.log(`\nTotal: ${tours.length} tours`);
  } catch (error) {
    console.error('Error checking tours:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findToursWithNoImages();
