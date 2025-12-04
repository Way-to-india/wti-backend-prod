import prisma from '@/config/db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ----------------------------------------------------
// BUN / ESM Compatible __dirname Replacement
// ----------------------------------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface FaqQuestion {
    question: string;
    answer: string;
    order: number;
}

interface FaqData {
    id: string;
    tourName: string;
    schemaContext: string;
    schemaType: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    questions: FaqQuestion[];
}

interface TourData {
    travelTips?: string;
    faqs?: FaqData[];
}

interface JsonData {
    metadata: {
        totalTours: number;
        toursWithTravelTips: number;
        toursWithFaqs: number;
        totalFaqs: number;
    };
    tours: {
        [tourId: string]: TourData;
    };
}

interface ImportResults {
    totalTours: number;
    travelTipsUpdated: number;
    faqsCreated: number;
    questionsCreated: number;
    skipped: number;
    errors: Array<{
        tourId: string;
        error: string;
    }>;
}

async function importTravelTipsAndFaqs(jsonFilePath: string): Promise<ImportResults> {
    const results: ImportResults = {
        totalTours: 0,
        travelTipsUpdated: 0,
        faqsCreated: 0,
        questionsCreated: 0,
        skipped: 0,
        errors: [],
    };

    try {
        console.log('📖 Reading JSON file...');
        const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
        const data: JsonData = JSON.parse(fileContent);

        console.log('\n📊 Metadata:');
        console.log(`  Total Tours: ${data.metadata.totalTours}`);
        console.log(`  Tours with Travel Tips: ${data.metadata.toursWithTravelTips}`);
        console.log(`  Tours with FAQs: ${data.metadata.toursWithFaqs}`);
        console.log(`  Total FAQs: ${data.metadata.totalFaqs}\n`);

        const tourIds = Object.keys(data.tours);
        results.totalTours = tourIds.length;

        console.log(`🚀 Processing ${tourIds.length} tours...\n`);

        const BATCH_SIZE = 10;

        for (let i = 0; i < tourIds.length; i += BATCH_SIZE) {
            const batch = tourIds.slice(i, i + BATCH_SIZE);

            await Promise.all(
                batch.map(async (tourId) => {
                    try {
                        const tourData = data.tours[tourId];

                        const tour = await prisma.tour.findFirst({
                            where: { id: tourId }
                        });

                        if (!tour) {
                            console.log(`  ⚠️  Tour not found: ${tourId}`);
                            results.skipped++;
                            return;
                        }

                        // ---------- UPDATE TRAVEL TIPS ----------
                        if (tourData.travelTips) {
                            const cleanedTips = tourData.travelTips;

                            if (cleanedTips && cleanedTips.length > 10) {
                                await prisma.tour.update({
                                    where: { id: tour.id },
                                    data: { travelTips: cleanedTips }
                                });

                                results.travelTipsUpdated++;
                                console.log(`  ✅ Updated travel tips: ${tourId}`);
                            }
                        }

                        // ---------- UPSERT FAQ ----------
                        if (tourData.faqs && tourData.faqs.length > 0) {
                            for (const faqData of tourData.faqs) {
                                const existingFaq = await prisma.faq.findFirst({
                                    where: { tourId: tour.id },
                                    include: { questions: true },
                                });

                                if (!existingFaq) {
                                    // CREATE NEW FAQ
                                    await prisma.faq.create({
                                        data: {
                                            tourId: tour.id,
                                            isActive: faqData.isActive,
                                            questions: {
                                                create: faqData.questions.map(q => ({
                                                    question: q.question,
                                                    answer: q.answer,
                                                    order: q.order,
                                                }))
                                            }
                                        }
                                    });

                                    results.faqsCreated++;
                                    results.questionsCreated += faqData.questions.length;

                                    console.log(
                                        `  ✅ Created FAQ with ${faqData.questions.length} questions: ${tourId}`
                                    );
                                } else {
                                    // UPDATE EXISTING FAQ & ADD NEW QUESTIONS
                                    console.log(`  ✏️ Updating existing FAQ for: ${tourId}`);

                                    const existingTexts = new Set(
                                        existingFaq.questions.map(q => q.question.trim().toLowerCase())
                                    );

                                    const newQuestions = faqData.questions.filter(
                                        q => !existingTexts.has(q.question.trim().toLowerCase())
                                    );

                                    if (newQuestions.length > 0) {
                                        await prisma.faq.update({
                                            where: { id: existingFaq.id },
                                            data: {
                                                isActive: faqData.isActive,
                                                questions: {
                                                    create: newQuestions.map(q => ({
                                                        question: q.question,
                                                        answer: q.answer,
                                                        order: q.order,
                                                    }))
                                                }
                                            },
                                        });

                                        results.questionsCreated += newQuestions.length;

                                        console.log(
                                            `  🔼 Added ${newQuestions.length} new questions to FAQ: ${tourId}`
                                        );
                                    } else {
                                        console.log(`  ⚠️ No new questions to add for: ${tourId}`);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        results.errors.push({
                            tourId,
                            error: error instanceof Error ? error.message : "Unknown error",
                        });

                        console.error(`  ❌ Error processing ${tourId}: ${error}`);
                    }
                })
            );

            console.log(`\n📈 Progress: ${Math.min(i + BATCH_SIZE, tourIds.length)}/${tourIds.length}\n`);
        }

    } catch (error) {
        console.error("❌ Fatal error:", error);
        throw error;
    }

    return results;
}

async function main() {
    const startTime = Date.now();

    const jsonFilePath = process.argv[2] || path.join(__dirname, "tour_data.json");

    if (!fs.existsSync(jsonFilePath)) {
        console.error(`❌ File not found: ${jsonFilePath}`);
        console.log('\nUsage: bun src/scripts/seed_faq.ts <json-file>');
        process.exit(1);
    }

    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 IMPORTING TRAVEL TIPS & FAQS');
    console.log('═══════════════════════════════════════════════════════\n');
    console.log(`📁 File: ${jsonFilePath}\n`);

    try {
        const results = await importTravelTipsAndFaqs(jsonFilePath);

        const duration = ((Date.now() - startTime) / 1000).toFixed(2);

        console.log('\n' + '═'.repeat(60));
        console.log('📊 IMPORT SUMMARY');
        console.log('═'.repeat(60));

        console.log(`Total Tours Processed: ${results.totalTours}`);
        console.log(`Travel Tips Updated: ${results.travelTipsUpdated}`);
        console.log(`FAQs Created: ${results.faqsCreated}`);
        console.log(`Questions Created: ${results.questionsCreated}`);
        console.log(`Skipped: ${results.skipped}`);
        console.log(`Errors: ${results.errors.length}`);
        console.log(`Duration: ${duration}s`);

    } catch (error) {
        console.error('❌ Import failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);
