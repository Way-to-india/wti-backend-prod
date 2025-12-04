/*
  Warnings:

  - You are about to drop the `User` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "User";

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "email" VARCHAR(255) NOT NULL,
    "profileImage" VARCHAR(500),
    "profileCoverImage" VARCHAR(500),
    "address" VARCHAR(500),
    "pinCode" VARCHAR(10),
    "bio" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "password" VARCHAR(255) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tours" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(300) NOT NULL,
    "metatitle" VARCHAR(255),
    "metadesc" VARCHAR(500),
    "overview" TEXT,
    "description" TEXT,
    "durationDays" SMALLINT NOT NULL DEFAULT 0,
    "durationNights" SMALLINT NOT NULL DEFAULT 0,
    "price" INTEGER NOT NULL DEFAULT 0,
    "discountPrice" INTEGER,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'INR',
    "minGroupSize" SMALLINT NOT NULL DEFAULT 1,
    "maxGroupSize" SMALLINT NOT NULL DEFAULT 50,
    "bestTime" VARCHAR(255),
    "idealFor" VARCHAR(255),
    "difficulty" VARCHAR(50),
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "bookingCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "cancellationPolicy" TEXT,
    "travelTips" TEXT,
    "startCityId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "images" TEXT[],
    "highlights" TEXT[],
    "inclusions" TEXT[],
    "exclusions" TEXT[],

    CONSTRAINT "tours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_price_guide" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "order" SMALLINT NOT NULL DEFAULT 0,

    CONSTRAINT "tour_price_guide_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "icon" VARCHAR(100),
    "description" TEXT,
    "imageUrl" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "tourCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_themes" (
    "tourId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_themes_pkey" PRIMARY KEY ("tourId","themeId")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "rating" SMALLINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "comment" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "helpfulCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_images" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "key" VARCHAR(500) NOT NULL,
    "url" VARCHAR(1000) NOT NULL,
    "thumbnail" VARCHAR(1000),
    "uploadedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_itinerary" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "day" SMALLINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" VARCHAR(1000),

    CONSTRAINT "tour_itinerary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tour_cities" (
    "tourId" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tour_cities_pkey" PRIMARY KEY ("tourId","cityId")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "stateId" VARCHAR(100),
    "stateName" VARCHAR(150),
    "countryId" VARCHAR(100),
    "countryName" VARCHAR(150),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "imageUrl" VARCHAR(500),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tourCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" TEXT NOT NULL,
    "tourId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faq_questions" (
    "id" TEXT NOT NULL,
    "faqId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "order" SMALLINT NOT NULL,

    CONSTRAINT "faq_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_isActive_createdAt_idx" ON "users"("isActive", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "tours_slug_key" ON "tours"("slug");

-- CreateIndex
CREATE INDEX "tours_isActive_isFeatured_rating_idx" ON "tours"("isActive", "isFeatured", "rating" DESC);

-- CreateIndex
CREATE INDEX "tours_isActive_price_rating_idx" ON "tours"("isActive", "price", "rating" DESC);

-- CreateIndex
CREATE INDEX "tours_isActive_createdAt_idx" ON "tours"("isActive", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "tours_isActive_bookingCount_idx" ON "tours"("isActive", "bookingCount" DESC);

-- CreateIndex
CREATE INDEX "tours_isActive_viewCount_idx" ON "tours"("isActive", "viewCount" DESC);

-- CreateIndex
CREATE INDEX "tours_startCityId_isActive_rating_idx" ON "tours"("startCityId", "isActive", "rating" DESC);

-- CreateIndex
CREATE INDEX "tours_durationDays_isActive_rating_idx" ON "tours"("durationDays", "isActive", "rating" DESC);

-- CreateIndex
CREATE INDEX "tours_slug_idx" ON "tours"("slug");

-- CreateIndex
CREATE INDEX "tour_price_guide_tourId_idx" ON "tour_price_guide"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "tour_price_guide_tourId_order_key" ON "tour_price_guide"("tourId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "themes_slug_key" ON "themes"("slug");

-- CreateIndex
CREATE INDEX "themes_slug_idx" ON "themes"("slug");

-- CreateIndex
CREATE INDEX "themes_isActive_order_idx" ON "themes"("isActive", "order");

-- CreateIndex
CREATE INDEX "themes_isActive_tourCount_idx" ON "themes"("isActive", "tourCount" DESC);

-- CreateIndex
CREATE INDEX "tour_themes_themeId_idx" ON "tour_themes"("themeId");

-- CreateIndex
CREATE INDEX "tour_themes_tourId_idx" ON "tour_themes"("tourId");

-- CreateIndex
CREATE INDEX "reviews_tourId_isActive_rating_idx" ON "reviews"("tourId", "isActive", "rating" DESC);

-- CreateIndex
CREATE INDEX "reviews_tourId_isActive_createdAt_idx" ON "reviews"("tourId", "isActive", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reviews_tourId_isActive_helpfulCount_idx" ON "reviews"("tourId", "isActive", "helpfulCount" DESC);

-- CreateIndex
CREATE INDEX "reviews_userId_createdAt_idx" ON "reviews"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reviews_isActive_isVerified_idx" ON "reviews"("isActive", "isVerified");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_userId_tourId_key" ON "reviews"("userId", "tourId");

-- CreateIndex
CREATE INDEX "review_images_reviewId_idx" ON "review_images"("reviewId");

-- CreateIndex
CREATE INDEX "tour_itinerary_tourId_day_idx" ON "tour_itinerary"("tourId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "tour_itinerary_tourId_day_key" ON "tour_itinerary"("tourId", "day");

-- CreateIndex
CREATE INDEX "tour_cities_cityId_idx" ON "tour_cities"("cityId");

-- CreateIndex
CREATE INDEX "tour_cities_tourId_idx" ON "tour_cities"("tourId");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "cities_slug_idx" ON "cities"("slug");

-- CreateIndex
CREATE INDEX "cities_isActive_tourCount_idx" ON "cities"("isActive", "tourCount" DESC);

-- CreateIndex
CREATE INDEX "cities_isActive_name_idx" ON "cities"("isActive", "name");

-- CreateIndex
CREATE INDEX "cities_stateId_isActive_idx" ON "cities"("stateId", "isActive");

-- CreateIndex
CREATE INDEX "cities_countryId_isActive_idx" ON "cities"("countryId", "isActive");

-- CreateIndex
CREATE INDEX "faqs_tourId_isActive_idx" ON "faqs"("tourId", "isActive");

-- CreateIndex
CREATE INDEX "faq_questions_faqId_idx" ON "faq_questions"("faqId");

-- CreateIndex
CREATE UNIQUE INDEX "faq_questions_faqId_order_key" ON "faq_questions"("faqId", "order");

-- AddForeignKey
ALTER TABLE "tours" ADD CONSTRAINT "tours_startCityId_fkey" FOREIGN KEY ("startCityId") REFERENCES "cities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_price_guide" ADD CONSTRAINT "tour_price_guide_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_themes" ADD CONSTRAINT "tour_themes_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "themes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_themes" ADD CONSTRAINT "tour_themes_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_images" ADD CONSTRAINT "review_images_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_itinerary" ADD CONSTRAINT "tour_itinerary_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_cities" ADD CONSTRAINT "tour_cities_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tour_cities" ADD CONSTRAINT "tour_cities_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_tourId_fkey" FOREIGN KEY ("tourId") REFERENCES "tours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faq_questions" ADD CONSTRAINT "faq_questions_faqId_fkey" FOREIGN KEY ("faqId") REFERENCES "faqs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
