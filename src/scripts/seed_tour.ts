import puppeteer, { Browser, Page } from 'puppeteer';
import prisma from '@/config/db';
import fs from 'fs';

const TOUR_IDS: string[] = [
  'jhansi-orchha-khajuraho-tour',
  'neelkanth-base-camp-trek',
  '5-days-rajasthan-tour-package',
  'agra-fatehpur-sikri-tour',
  'dodital-darwa-pass-trek',
  'ajanta-ellora-tour',
  'kedarnath-and-vasuki-taal-trek',
  'agra-mathura-vrindavan-tour-from-delhi',
  'muktinath-yatra',
  'arupadai-veedu-tour',
  'kashmir-tour-package-from-ahmedabad',
  'rajasthan-wildlife-tour',
  'bandhavgarh-national-park-tour',
  'bandhavgarh-national-park-tour-package',
  'rajasthan-desert-tour',
  'kashmir-tour-package-from-kolkata',
  'horse-safari-in-rajasthan',
  'bandhavgarh-tour-from-mumbai',
  'bandhavgarh-wildlife-safari-tour-from-pune',
  'bandhavgarh-wildlife-safari-tour-from-ahmedabad',
  'kerala-trip-honeymoon-package',
  'banerghatta-national-park-tour',
  'kodaikanal-tour',
  'mumbai-to-mahabaleshwar-tour-package',
  'amarnath-yatra',
  'classic-india-tour',
  'srinagar-leh-ladakh-tour-package',
  'goa-carnival-festival-tour',
  'best-of-karnataka-tour',
  'best-of-kumaon-hill-tour',
  'amarnath-yatra-helicopter-services',
  'brahmpuri-river-rafting-package',
  'char-dham-yatra-in-india',
  'jaipur-tour-package-for-couples',
  'chanap-valley-trek',
  'lucknow-tour-package',
  'shimla-tour-package-from-delhi-for-couples',
  'chennai-beach-tour',
  'delhi-neemrana-tour',
  'chopta-chandrashila-trek',
  'charismatic-kashmir-tour',
  'mussoorie-tour-package-for-couples',
  'coorg-kabini-tour-package',
  'corbett-dhikala-tour-package',
  'kerala-honeymoon-tour-packages',
  'golden-goa-tour',
  'dalhousie-dharamshala-package',
  'marine-drive-river-rafting-package',
  'corbett-weekend-tour',
  'andaman-nicobar-tour',
  'tour-to-kerala',
  'delhi-agra-jaipur-udaipur-tour-package',
  'darjeeling-tour-package-for-couple',
  'delhi-agra-varanasi-tour-package',
  'delhi-sultanpur-tour',
  'golden-triangle-tour-with-varanasi',
  'dharamshala-tour',
  'golden-triangle-tour-by-car',
  'dwarka-somnath-package-from-delhi',
  'eastern-triangle-tour',
  'fascinating-gujarat-holiday-tour-package',
  'eravikulam-national-park-tour',
  'nainital-hill-tour',
  'delhi-to-agra-tour-packages',
  'taj-mahal-tour-by-car',
  'goa-trip-package-from-delhi',
  'golden-temple-tour-amritsar',
  'manali-tour-package-for-couples-from-delhi',
  'golden-temple-tour',
  'north-kerala-tour',
  'golden-triangle-khajuraho-dance-festival-tour',
  'golden-triangle-tour-by-train',
  'golden-triangle-tour-with-khajuraho',
  'andaman-tour-package-for-couples',
  'golden-triangle-tour-by-train-and-car',
  'golden-triangle-tour-with-haridwar',
  'golden-triangle-tour-with-jim-corbett-national-park',
  'elephant-festival-tour',
  'orissa-tour-package',
  'golden-triangle-tour-with-tiger-safari',
  'coastal-karnataka-tour',
  'corbett-nainital-package',
  'golden-triangle-tour-with-ranthambore',
  'jaipur-sariska-jungle-tour',
  'sundarbans-national-park-tour-packages',
  'golden-triangle-with-tiger-tour',
  'gujarat-wildlife-tour',
  'golden-triangle-with-ranthambore-bharatpur-luxury-group-tour',
  'agra-rajasthan-tour-package-from-delhi',
  'sariska-tour',
  'gujarat-holiday-packages',
  'kashmir-ladakh-tour-package',
  'rameshwaram-tour',
  'rajasthan-holidays',
  'haridwar-rishikesh-tour',
  'south-india-wildlife-tour-package',
  'sapta-puri-yatra',
  'hills-of-uttarakhand-package',
  'kerala-tour',
  'incredible-ladakh-holiday',
  'himachal-tour-package-for-couple',
  'rajasthan-tour-package-10-days',
  'shimla-manali-tour-package-from-delhi',
  'kerala-beach-tour',
  'south-india-temple-tour',
  'jim-corbett-park-with-nainital-tour',
  'south-india-hill-station-tour',
  'karnataka-temple-tour',
  'tirupati-to-kanchipuram-tour-package',
  'golden-triangle-and-gangaur-festival-tour',
  'tirupati-madurai-rameshwaram-kanyakumari-tour-package',
  'kagbhusandi-lake-trek',
  'kashmir-tour-package',
  'kerala-hill-station-tour-package',
  'heritage-kerala-tour-with-tree-house',
  'kovalam-tour-package',
  'kashmir-tour-packages-from-mumbai',
  'kaziranga-wildlife-tour',
  'jaipur-trip-for-2-days',
  'kerala-backwater-trip',
  'golden-triangle-tour',
  'kerala-family-packages',
  'kerala-holiday-tour',
  'ooty-kodaikanal-munnar-tour-package',
  'kerala-houseboat-tours',
  'golden-triangle-tour-5-days',
  'haridwar-rishikesh-varanasi-tour-package-from-delhi',
  'kerala-ltc-tour',
  'assam-meghalaya-tour',
  'agra-overnight-tour',
  'jodhpur-jaisalmer-tour',
  'bangalore-mysore-ooty-kodaikanal-tour-package',
  'kerala-travel-package',
  'kerala-wildlife-tour',
  'kerala-tour-package',
  'kashmir-tour',
  'kovalam-beach-tour',
  'kovalam-kanyakumari-tour',
  'konkan-beach-resorts-tour',
  'ayodhya-tour-package',
  'shirdi-tour-package',
  'kullu-manali-tour-package-from-hyderabad',
  'kullu-manali-tour-package-from-chennai',
  'kullu-manali-tour-package-from-delhi',
  'leh-ladakh-road-trip',
  'kerala-houseboat-tour',
  'buddha-tour',
  'kumarakom-lake-resort-package',
  'lonavala-khandala-tour-package',
  'leh-ladakh-tour-package-for-couples',
  'lucknow-ayodhya-allahabad-varanasi-tour',
  'lakshadweep-island-trip',
  'chardham-yatra-tour-package',
  'mahabaleshwar-tour',
  'maharashtra-tour',
  'gurudwara-in-punjab-tour',
  'manali-to-leh-tour',
  'rajaji-national-park-tour',
  'manali-leh-tour',
  'mewar-tour-packages',
  'mumbai-goa-beach-tour',
  'mumbai-goa-tour',
  'mount-abu-tour-package',
  'mumbai-goa-tour-packages',
  'india-wildlife-tour',
  'muslim-pilgrimage-tour',
  'mumbai-with-karla-caves-tour',
  'mussoorie-hill-station-tour',
  'munnar-ooty-kodaikanal-tour-package',
  'munnar-tour',
  'mani-mahesh-yatra-by-helicopter',
  'nainital-tour-package',
  'nainital-ranikhet-tour',
  'nainital-almora-kausani-tour',
  'srisailam-wildlife-tour',
  'romantic-tour-of-kerala',
  'north-india-heritage-tour',
  'north-sikkim-tour',
  'bharatpur-bird-sanctuary-tour',
  'kerala-honeymoon-tour',
  'orissa-golden-triangle-tour',
  'bhopal-sanchi-bhimbetka-tour-package',
  'tour-of-south-india',
  'puri-holiday-package',
  'pachmarhi-tour-package',
  'panch-kedar-trek',
  'khandala-tour',
  'rajasthan-tour-by-car',
  'rajasthan-desert-safari',
  'best-of-western-hill-tour',
  'rajasthan-tour-package',
  'bangalore-to-ooty-package',
  'rajasthan-tour-packages-from-delhi',
  'munnar-hill-tour',
  'majestic-ladakh-tour',
  'ranthambore-jaipur-package',
  'rann-of-kutch-festival-packages',
  'ranthambore-package',
  'jaipur-ajmer-pushkar-tour-packages-from-delhi',
  'golden-triangle-tour-with-goa',
  'golden-triangle-tour-with-udaipur',
  'orchha-khajuraho-tour',
  'kerala-honeymoon-package',
  'shimla-manali-tour-packages',
  'delhi-to-haridwar-rishikesh-tour-package',
  'himachal-holiday-tour-package',
  'golden-triangle-with-mumbai-tour',
  'ladakh-tour',
  'delhi-to-shimla-tour-package',
  'srinagar-to-leh-tour-package',
  'kerala-backwater-tour',
  'kaudiyala-river-rafting-package',
  'oberoi-cecil-shimla-packages',
  'corbett-elephant-safari-tour',
  'ranikhet-hill-tour',
  'rajasthan-luxury-tour-package',
  'tirupati-package-tour',
  'ooty-kodaikanal-tour-package',
  'kullu-manali-tour',
  'sai-baba-of-puttaparthi-tour',
  'badrinath-kedarnath-yatra',
  'same-day-taj-mahal-tour',
  'same-day-jaipur-tour',
  'haridwar-tour',
  'snake-boat-race-tour',
  'tirupati-tour-package-from-chennai',
  'shimla-tour-package-from-delhi',
  'tamil-nadu-temples-tour',
  'port-blair-ltc-tour',
  'south-karnataka-tour-package',
  'dalhousie-khajjiar-dharamshala-tour',
  'srinagar-houseboat-packages',
  'delhi-jaipur-udaipur-tour-package',
  'taj-mahal-trip-by-air',
  'goa-houseboat-tour-package',
  'bangalore-mysore-ooty-package',
  '12-jyotirlinga-tour-package',
  'amritsar-dalhousie-dharamshala-tour',
  'agra-jaipur-tour',
  'munnar-hill-station-tour',
  'south-india-tour',
  'lonavala-tour',
  'bandhavgarh-wildlife-safari-tour-from-bangalore',
  'bangalore-mysore-coorg-tour-package',
  'kuari-pass-trekking',
  'kedarkantha-trek',
  'bikaner-camel-festival-tour',
  'leh-ladakh-road-trip-by-car',
  'dalhousie-tour',
  'nau-devi-yatra',
  'corbett-national-park-tour',
  'karnataka-holidays',
  'chennai-to-kanchipuram-tour-package',
  'corbett-jeep-safari-tour',
  'darjeeling-gangtok-pelling-tour-package',
  'delhi-agra-tour-package-2-days',
  'delhi-sightseeing-tour',
  'golden-triangle-tour-with-goa-beach',
  'heritage-of-rajasthan-tour-package',
  'gangotri-gaumukh-tapovan-trek',
  'himachal-pradesh-honeymoon-package',
  'golden-triangle-luxury-tour',
  'ooty-tour-package',
  'har-ki-doon-trek',
  'assam-tour-package',
  'golden-triangle-tour-with-pushkar',
  'hampi-tour-from-hyderabad',
  'golden-triangle-tour-with-varanasi-and-khajuraho',
  'hyderabad-to-araku-tour-packages',
  'hill-stations-of-south-india-tour',
  'darjeeling-gangtok-kalimpong-tour-package',
  'thattekad-thekkady-sanctuary-tour',
  'kanha-national-park-tour-package',
  'jaipur-ajmer-pushkar-tour',
  'jaipur-tour-package',
  'golden-triangle-tour-with-mumbai',
  'himachal-tour-package',
  'shivpuri-river-rafting-package',
  'jim-corbett-park-weekend-tour-package-by-rail',
  'kerala-honeymoon-holidays',
  'haridwar-mussoorie-tour-package',
  'kodaikanal-holidays',
  'badrinath-yatra',
  'darjeeling-sikkim-tour-package',
  'bandhavgarh-safari',
  'bangalore-mysore-ooty-tour-package',
  'orissa-trip',
  'rafting-in-rishikesh-with-trekking-in-himalayas',
  'best-of-gujarat-tour-package',
  'rann-of-kutch-tour-package',
  'kullu-manali-tour-package-from-mumbai',
  'char-dham-yatra-by-helicopter-from-dehradun',
  'guwahati-shillong-cherrapunjee-tour',
  'badrinath-yatra-by-helicopter',
  'karnataka-heritage-tour',
  'pushkar-fair-tour-package',
  'navagraha-temple-tour-package-from-chennai',
  'kumaon-tour',
  'same-day-agra-tour-by-car',
  'kullu-manali-tour-package-from-pune',
  'kullu-manali-tour-package-from-ahmedabad',
  'madurai-rameshwaram-kanyakumari-tour-package',
  'amarnath-yatra-by-helicopter',
  'nageshwar-somnath-jyotirlinga-tour-package',
  'mahakaleshwar-omkareshwar-jyotirlinga-tour-package',
  'rameshwaram-jyotirlinga-tour-package',
  'baidyanath-jyotirlinga-tour-package',
  'mallikarjuna-jyotirlinga-tour-package',
  'kashi-vishwanath-jyotirlinga-tour-package',
  'kedarnath-jyotirlinga-tour-package',
  'rameshwaram-tour-package',
  'ranthambore-tour-package',
  'bangalore-mysore-ooty-coorg-tour-package',
  'ooty-tour-packages-from-coimbatore',
  'markha-valley-trek',
  'satopanth-trek',
];

const BASE_URL = 'https://www.waytoindia.com';

interface DurationInfo {
  nights: number;
  days: number;
}

interface ScrapedTourData {
  title: string | null;
  duration: string | null;
  startingFrom: string | null;
  bestTime: string | null;
  idealFor: string | null;
  destinations: string[];
  themes: string[];
  highlights: string[];
  overview: string | null;
}

interface TourScrapResult extends ScrapedTourData {
  tourId: string;
  success: boolean;
  error?: string;
}

interface SaveResult {
  success: boolean;
  tourId?: string;
  skipped?: boolean;
  error?: string;
}

interface ScrapingResults {
  total: number;
  success: number;
  skipped: number;
  failed: number;
  errors: Array<{
    tourId: string;
    error: string;
    stage: string;
  }>;
}

function cleanText(text: string | null | undefined): string | null {
  if (!text) return null;
  return text.trim().replace(/\s+/g, ' ').replace(/&amp;/g, '&');
}

function parseDuration(durationText: string | null): DurationInfo {
  if (!durationText) return { nights: 0, days: 0 };

  const nightsMatch = durationText.match(/(\d+)\s*Night/i);
  const daysMatch = durationText.match(/(\d+)\s*Day/i);

  return {
    nights: nightsMatch ? parseInt(nightsMatch[1]) : 0,
    days: daysMatch ? parseInt(daysMatch[1]) : 0,
  };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function scrapeTourData(browser: Browser, tourId: string): Promise<TourScrapResult> {
  const page: Page = await browser.newPage();

  try {
    const url = `${BASE_URL}/${tourId}`;
    console.log(`\n📍 Scraping: ${tourId}`);

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    await page.waitForSelector('h1', { timeout: 10000 });

    const tourData = await page.evaluate((): ScrapedTourData => {
      const startCards = document.querySelectorAll('.border.border-gray-200.bg-white.rounded-xl');

      const title = document.querySelector('h1')?.textContent?.trim() || null;

      let duration: string | null = null;
      const durationCard = Array.from(document.querySelectorAll('p')).find(
        (p) => p.textContent?.includes('Nights') && p.textContent?.includes('Days')
      );
      if (durationCard) {
        duration = durationCard.textContent?.trim() || null;
      }

      let startingFrom: string | null = null;
      startCards.forEach((card) => {
        const label = card.querySelector('p.text-xs');
        const value = card.querySelector('p.text-sm.font-medium');
        if (label?.textContent?.includes('Starting From') && value) {
          startingFrom = value.textContent?.trim() || null;
        }
      });

      let bestTime: string | null = null;
      startCards.forEach((card) => {
        const label = card.querySelector('p.text-xs');
        const value = card.querySelector('p.text-sm.font-medium');
        if (label?.textContent?.includes('Best Time') && value) {
          bestTime = value.textContent?.trim() || null;
        }
      });

      let idealFor: string | null = null;
      startCards.forEach((card) => {
        const label = card.querySelector('p.text-xs');
        const value = card.querySelector('p.text-sm.font-medium');
        if (label?.textContent?.includes('Ideal For') && value) {
          idealFor = value.textContent?.trim() || null;
        }
      });

      const destinations: string[] = [];
      const destSpans = document.querySelectorAll('span.bg-orange-100.text-orange-800');
      destSpans.forEach((span) => {
        const text = span.textContent?.trim();
        if (text && !text.includes('More')) {
          destinations.push(text);
        }
      });

      const themes: string[] = [];
      startCards.forEach((card) => {
        const label = card.querySelector('p.text-xs');
        const value = card.querySelector('p.text-sm.font-medium');
        if (label?.textContent?.includes('Themes') && value) {
          const themeText = value.textContent?.trim();
          if (themeText && !themeText.includes('Themes')) {
            themes.push(themeText);
          }
        }
      });

      const highlights: string[] = [];
      const highlightSection = document.querySelector('[aria-labelledby="tour-highlights"]');
      if (highlightSection) {
        const items = highlightSection.querySelectorAll('li');
        items.forEach((li) => {
          const text = li.textContent?.replace(/^[•\-\s]+/, '').trim();
          if (text) {
            highlights.push(text);
          }
        });
      }

      let overview: string | null = null;
      const overviewPanel = document.querySelector('[role="tabpanel"]');
      if (overviewPanel) {
        const firstParagraph = overviewPanel.querySelector('p.text-gray-700');
        if (firstParagraph) {
          overview = firstParagraph.textContent?.trim() || null;
        }
      }

      return {
        title,
        duration,
        startingFrom,
        bestTime,
        idealFor,
        destinations: [...new Set(destinations)],
        themes: [...new Set(themes)],
        highlights: [...new Set(highlights)],
        overview,
      };
    });

    await page.close();
    return { tourId, ...tourData, success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error scraping ${tourId}:`, errorMessage);
    await page.close();
    return {
      tourId,
      success: false,
      error: errorMessage,
      title: null,
      duration: null,
      startingFrom: null,
      bestTime: null,
      idealFor: null,
      destinations: [],
      themes: [],
      highlights: [],
      overview: null,
    };
  }
}

async function saveTourToDatabase(tourData: TourScrapResult): Promise<SaveResult> {
  try {
    const {
      tourId,
      title,
      duration,
      startingFrom,
      bestTime,
      idealFor,
      destinations,
      themes,
      highlights,
      overview,
    } = tourData;

    const tourSlug = slugify(tourId);
    const existingTour = await prisma.tour.findFirst({
      where: {
        OR: [{ slug: tourSlug }, { id: tourId }],
      },
    });

    if (existingTour) {
      console.log(`  ⚠️  Tour already exists in database, skipping: ${title || tourId}`);
      return { success: true, tourId: existingTour.id, skipped: true };
    }

    if (title) {
      const existingByTitle = await prisma.tour.findFirst({
        where: {
          title: {
            equals: cleanText(title) || '',
            mode: 'insensitive',
          },
        },
      });

      if (existingByTitle) {
        console.log(`  ⚠️  Tour with similar title already exists, skipping: ${title}`);
        return { success: true, tourId: existingByTitle.id, skipped: true };
      }
    }

    const { nights, days } = parseDuration(duration);

    let startCityId: string | null = null;
    if (startingFrom) {
      const citySlug = slugify(startingFrom);

      const city = await prisma.city.upsert({
        where: { slug: citySlug },
        update: {
          tourCount: { increment: 1 },
        },
        create: {
          name: startingFrom,
          label: startingFrom,
          slug: citySlug,
          isActive: true,
          tourCount: 1,
        },
      });

      startCityId = city.id;
      console.log(`  ✅ Using city: ${startingFrom}`);
    }

    const cleanedTitle = cleanText(title) || 'Untitled Tour';
    const tour = await prisma.tour.create({
      data: {
        id: tourId,
        slug: tourSlug,
        title: cleanedTitle,
        overview: cleanText(overview),
        durationDays: days,
        durationNights: nights,
        bestTime: cleanText(bestTime),
        idealFor: cleanText(idealFor),
        startCityId: startCityId,
        isActive: true,
        highlights: highlights
          .filter((h) => h && h.trim().length > 0)
          .map((h) => cleanText(h) || '')
          .filter((h) => h.length > 0),
        images: [],
        inclusions: [],
        exclusions: [],
      },
    });

    console.log(`  ✅ Created tour: ${cleanedTitle}`);

    for (const themeName of themes) {
      if (!themeName) continue;

      const themeSlug = slugify(themeName);

      const theme = await prisma.theme.upsert({
        where: { slug: themeSlug },
        update: {
          tourCount: { increment: 1 },
        },
        create: {
          name: themeName.substring(0, 100),
          label: themeName.substring(0, 150),
          slug: themeSlug.substring(0, 150),
          isActive: true,
          tourCount: 1,
        },
      });

      try {
        await prisma.tourTheme.create({
          data: {
            tourId: tour.id,
            themeId: theme.id,
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unique constraint')) {
          console.log(`  ⚠️  Theme relation already exists: ${themeName}`);
        } else {
          throw error;
        }
      }
    }

    for (let i = 0; i < destinations.length; i++) {
      const destName = destinations[i];
      if (!destName) continue;

      const destSlug = slugify(destName);

      const city = await prisma.city.upsert({
        where: { slug: destSlug },
        update: {
          tourCount: { increment: 1 },
        },
        create: {
          name: destName.substring(0, 150),
          label: destName.substring(0, 150),
          slug: destSlug.substring(0, 200),
          isActive: true,
          tourCount: 1,
        },
      });

      try {
        await prisma.tourCity.create({
          data: {
            tourId: tour.id,
            cityId: city.id,
            order: i,
          },
        });
      } catch (error) {
        if (error instanceof Error && error.message.includes('Unique constraint')) {
          console.log(`  ⚠️  City relation already exists: ${destName}`);
        } else {
          throw error;
        }
      }
    }

    return { success: true, tourId: tour.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  ❌ Database error:`, errorMessage);

    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        console.error(`  ℹ️  This appears to be a duplicate entry issue`);
      } else if (error.message.includes('Foreign key constraint')) {
        console.error(`  ℹ️  This appears to be a relationship constraint issue`);
      }
    }

    return { success: false, error: errorMessage };
  }
}

async function checkExistingTours(): Promise<Set<string>> {
  try {
    console.log('🔍 Checking for existing tours in database...');

    const existingTours = await prisma.tour.findMany({
      select: { id: true, slug: true },
      where: {
        OR: [{ id: { in: TOUR_IDS } }, { slug: { in: TOUR_IDS.map((id) => slugify(id)) } }],
      },
    });

    const existingIds = new Set(
      existingTours.flatMap((t) => [t.id, t.slug].filter(Boolean) as string[])
    );

    console.log(`✅ Found ${existingIds.size} tours already in database\n`);
    return existingIds;
  } catch (error) {
    console.error('❌ Error checking existing tours:', error);
    return new Set();
  }
}

async function main(): Promise<void> {
  const browser = await puppeteer.launch({
    headless: 'new' as any,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath:
      process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  });

  const results: ScrapingResults = {
    total: TOUR_IDS.length,
    success: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  console.log(`\n🚀 Starting bulk scrape for ${TOUR_IDS.length} tours...\n`);

  const existingTourIds = await checkExistingTours();

  const toursToScrape = TOUR_IDS.filter(
    (tourId) => !existingTourIds.has(tourId) && !existingTourIds.has(slugify(tourId))
  );

  if (toursToScrape.length < TOUR_IDS.length) {
    const alreadyExists = TOUR_IDS.length - toursToScrape.length;
    console.log(`⚠️  Skipping ${alreadyExists} tours that already exist in database`);
    results.skipped = alreadyExists;
  }

  console.log(`📝 Processing ${toursToScrape.length} new tours...\n`);

  for (let i = 0; i < toursToScrape.length; i++) {
    const tourId = toursToScrape[i];
    console.log(`\n[${i + 1}/${toursToScrape.length}] Processing: ${tourId}`);

    try {
      const scrapedData = await scrapeTourData(browser, tourId);

      if (!scrapedData.success) {
        results.failed++;
        results.errors.push({
          tourId,
          error: scrapedData.error || 'Unknown error',
          stage: 'scraping',
        });
        continue;
      }

      const saveResult = await saveTourToDatabase(scrapedData);

      if (saveResult.success) {
        if (saveResult.skipped) {
          results.skipped++;
          console.log(`  ⚠️  Skipped (already exists)`);
        } else {
          results.success++;
          console.log(`  ✅ Saved to database`);
        }
      } else {
        results.failed++;
        results.errors.push({
          tourId,
          error: saveResult.error || 'Unknown error',
          stage: 'database',
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      results.failed++;
      results.errors.push({ tourId, error: errorMessage, stage: 'general' });
      console.error(`  ❌ Error:`, errorMessage);
    }
  }

  await browser.close();
  await prisma.$disconnect();

  console.log('\n' + '='.repeat(60));
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tours: ${results.total}`);
  console.log(`✅ Success: ${results.success}`);
  console.log(`⚠️  Skipped: ${results.skipped}`);
  console.log(`❌ Failed: ${results.failed}`);

  if (results.errors.length > 0) {
    console.log('\n❌ Failed Tours:');
    results.errors.forEach((err) => {
      console.log(`  - ${err.tourId} (${err.stage}): ${err.error}`);
    });
  }

  const resultsWithTimestamp = {
    ...results,
    timestamp: new Date().toISOString(),
    completedAt: new Date().toLocaleString(),
  };

  fs.writeFileSync('scrape-results.json', JSON.stringify(resultsWithTimestamp, null, 2));
  console.log('\n📄 Full results saved to scrape-results.json');
}

main().catch(console.error);
