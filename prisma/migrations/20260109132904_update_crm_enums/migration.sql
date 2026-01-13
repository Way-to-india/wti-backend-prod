-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'INTERESTED', 'QUOTED', 'NEGOTIATING', 'FOLLOW_UP_SCHEDULED', 'CONFIRMED', 'CLOSED_WON', 'CLOSED_LOST', 'NOT_INTERESTED');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WEBSITE_FORM', 'PHONE_CALL', 'EMAIL', 'WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'GOOGLE_ADS', 'REFERRAL', 'WALK_IN', 'TOUR_QUERY', 'HOTEL_QUERY', 'TRANSPORT_QUERY', 'CONTACT_US', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadPriority" AS ENUM ('HOT', 'WARM', 'COLD');

-- CreateEnum
CREATE TYPE "LeadQuality" AS ENUM ('A', 'B', 'C');

-- CreateEnum
CREATE TYPE "LeadServiceType" AS ENUM ('TOUR', 'HOTEL', 'TRANSPORT', 'MIXED');

-- CreateEnum
CREATE TYPE "CommunicationType" AS ENUM ('CALL', 'EMAIL', 'WHATSAPP', 'SMS', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "CommunicationDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "ReminderType" AS ENUM ('FOLLOW_UP', 'CALLBACK', 'QUOTE_FOLLOW_UP', 'GENERAL');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "email" VARCHAR(255) NOT NULL,
    "profileImage" VARCHAR(500),
    "profileCoverImage" VARCHAR(500),
    "address" VARCHAR(500),
    "pinCode" VARCHAR(10),
    "bio" TEXT,
    "password" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "countryCode" INTEGER NOT NULL DEFAULT 91,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
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

-- CreateTable
CREATE TABLE "travel_guide_states" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(200),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "travel_guide_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_guide_cities" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "slug" VARCHAR(200),
    "stateId" TEXT NOT NULL,
    "stateName" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "travel_guide_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_guide_data" (
    "id" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "citySlug" VARCHAR(200),
    "stateId" TEXT NOT NULL,
    "stateSlug" VARCHAR(200),
    "originalCityId" INTEGER,
    "menuId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "introduction" TEXT,
    "facts" TEXT,
    "foodAndDining" TEXT,
    "shopping" TEXT,
    "nearbyPlaces" TEXT,
    "gettingAround" TEXT,
    "historyCulture" TEXT,
    "otherDetails" TEXT,
    "bestTimeToVisit" VARCHAR(255),
    "placesToSeeTop" TEXT,
    "placesToSeeBottom" TEXT,
    "hotelDetails" TEXT,
    "cityImage" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "travel_guide_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "roleId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMPTZ(3),
    "refreshToken" VARCHAR(500),
    "refreshTokenExpiry" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modules" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "description" TEXT,
    "icon" VARCHAR(100),
    "order" SMALLINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "view" BOOLEAN NOT NULL DEFAULT false,
    "create" BOOLEAN NOT NULL DEFAULT false,
    "edit" BOOLEAN NOT NULL DEFAULT false,
    "delete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_tags" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "icon" VARCHAR(50),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_source_masters" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "icon" VARCHAR(50),
    "color" VARCHAR(7),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_source_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_categories" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "label" VARCHAR(150) NOT NULL,
    "icon" VARCHAR(50),
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "referenceNumber" VARCHAR(20) NOT NULL,
    "source" "LeadSource" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "priority" "LeadPriority" NOT NULL DEFAULT 'WARM',
    "quality" "LeadQuality",
    "serviceType" "LeadServiceType",
    "fullName" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phoneNumber" VARCHAR(20),
    "alternatePhone" VARCHAR(20),
    "city" VARCHAR(150),
    "destination" VARCHAR(255),
    "travelStartDate" TIMESTAMPTZ(3),
    "travelEndDate" TIMESTAMPTZ(3),
    "numberOfTravelers" SMALLINT,
    "numberOfAdults" SMALLINT,
    "numberOfChildren" SMALLINT,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "specialRequests" TEXT,
    "tagId" TEXT,
    "categoryId" TEXT,
    "assignedToId" TEXT,
    "assignedAt" TIMESTAMPTZ(3),
    "firstResponseAt" TIMESTAMPTZ(3),
    "responseTimeMinutes" INTEGER,
    "lastActivityAt" TIMESTAMPTZ(3),
    "nextFollowUpAt" TIMESTAMPTZ(3),
    "followUpCount" INTEGER NOT NULL DEFAULT 0,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "leadScore" SMALLINT NOT NULL DEFAULT 0,
    "conversionProbability" DECIMAL(5,2),
    "estimatedValue" INTEGER,
    "actualValue" INTEGER,
    "lostReason" TEXT,
    "closedAt" TIMESTAMPTZ(3),
    "details" JSONB,
    "ipAddress" VARCHAR(50),
    "userAgent" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "contactedAt" TIMESTAMPTZ(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_activities" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "activityType" VARCHAR(50) NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "performedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_history" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStatus" VARCHAR(50),
    "toStatus" VARCHAR(50) NOT NULL,
    "fromTag" VARCHAR(100),
    "toTag" VARCHAR(100),
    "notes" TEXT,
    "changedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_quotations" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "version" SMALLINT NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "fileKey" VARCHAR(500) NOT NULL,
    "fileUrl" VARCHAR(1000) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "fileType" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "amount" INTEGER,
    "isAccepted" BOOLEAN NOT NULL DEFAULT false,
    "acceptedAt" TIMESTAMPTZ(3),
    "sentViaEmail" BOOLEAN NOT NULL DEFAULT false,
    "emailOpenedAt" TIMESTAMPTZ(3),
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_communications" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "type" "CommunicationType" NOT NULL,
    "direction" "CommunicationDirection" NOT NULL,
    "subject" VARCHAR(255),
    "content" TEXT,
    "duration" INTEGER,
    "status" VARCHAR(50),
    "metadata" JSONB,
    "performedById" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_reminders" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMPTZ(3) NOT NULL,
    "reminderType" "ReminderType" NOT NULL,
    "notes" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMPTZ(3),
    "isSnoozed" BOOLEAN NOT NULL DEFAULT false,
    "snoozeReason" TEXT,
    "snoozedUntil" TIMESTAMPTZ(3),
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "assignedToId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "lead_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poi_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monument_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poi_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poi_metadata" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poi_metadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poi_states" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monument_count" INTEGER NOT NULL DEFAULT 0,
    "city_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poi_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poi_cities" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state_id" TEXT NOT NULL,
    "monument_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poi_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poi_monuments" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "monument_name" TEXT NOT NULL,
    "city_id" TEXT NOT NULL,
    "type_of_place" TEXT,
    "description" TEXT,
    "best_time" TEXT,
    "opening_time" TEXT,
    "closing_time" TEXT,
    "weekly_off" TEXT,
    "entry_fees" JSONB,
    "weather" JSONB,
    "connectivity" JSONB,
    "location" JSONB,
    "rating" DOUBLE PRECISION,
    "total_ratings" INTEGER DEFAULT 0,
    "website" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "poi_monuments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hero_slides" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "subtitle" VARCHAR(500),
    "location" VARCHAR(150),
    "duration" VARCHAR(100),
    "imageKey" VARCHAR(500) NOT NULL,
    "imageUrl" VARCHAR(1000) NOT NULL,
    "ctaText" VARCHAR(100) NOT NULL DEFAULT 'Explore Tours',
    "ctaLink" VARCHAR(500) NOT NULL DEFAULT '/india-tour-packages',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" SMALLINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hero_slides_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "travel_guide_states_slug_key" ON "travel_guide_states"("slug");

-- CreateIndex
CREATE INDEX "travel_guide_states_slug_idx" ON "travel_guide_states"("slug");

-- CreateIndex
CREATE INDEX "travel_guide_states_name_idx" ON "travel_guide_states"("name");

-- CreateIndex
CREATE UNIQUE INDEX "travel_guide_cities_slug_key" ON "travel_guide_cities"("slug");

-- CreateIndex
CREATE INDEX "travel_guide_cities_stateId_idx" ON "travel_guide_cities"("stateId");

-- CreateIndex
CREATE INDEX "travel_guide_cities_slug_idx" ON "travel_guide_cities"("slug");

-- CreateIndex
CREATE INDEX "travel_guide_cities_name_idx" ON "travel_guide_cities"("name");

-- CreateIndex
CREATE INDEX "travel_guide_data_cityId_idx" ON "travel_guide_data"("cityId");

-- CreateIndex
CREATE INDEX "travel_guide_data_stateId_idx" ON "travel_guide_data"("stateId");

-- CreateIndex
CREATE INDEX "travel_guide_data_citySlug_idx" ON "travel_guide_data"("citySlug");

-- CreateIndex
CREATE INDEX "travel_guide_data_stateSlug_idx" ON "travel_guide_data"("stateSlug");

-- CreateIndex
CREATE INDEX "travel_guide_data_isActive_idx" ON "travel_guide_data"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "travel_guide_data_cityId_stateId_key" ON "travel_guide_data"("cityId", "stateId");

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE INDEX "admins_email_idx" ON "admins"("email");

-- CreateIndex
CREATE INDEX "admins_isActive_idx" ON "admins"("isActive");

-- CreateIndex
CREATE INDEX "admins_roleId_idx" ON "admins"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_name_idx" ON "roles"("name");

-- CreateIndex
CREATE INDEX "roles_isActive_idx" ON "roles"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "modules_name_key" ON "modules"("name");

-- CreateIndex
CREATE INDEX "modules_name_idx" ON "modules"("name");

-- CreateIndex
CREATE INDEX "modules_isActive_order_idx" ON "modules"("isActive", "order");

-- CreateIndex
CREATE INDEX "permissions_roleId_idx" ON "permissions"("roleId");

-- CreateIndex
CREATE INDEX "permissions_moduleId_idx" ON "permissions"("moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_roleId_moduleId_key" ON "permissions"("roleId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_tags_name_key" ON "lead_tags"("name");

-- CreateIndex
CREATE INDEX "lead_tags_isActive_order_idx" ON "lead_tags"("isActive", "order");

-- CreateIndex
CREATE INDEX "lead_tags_name_idx" ON "lead_tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lead_source_masters_name_key" ON "lead_source_masters"("name");

-- CreateIndex
CREATE INDEX "lead_source_masters_isActive_order_idx" ON "lead_source_masters"("isActive", "order");

-- CreateIndex
CREATE INDEX "lead_source_masters_name_idx" ON "lead_source_masters"("name");

-- CreateIndex
CREATE UNIQUE INDEX "lead_categories_name_key" ON "lead_categories"("name");

-- CreateIndex
CREATE INDEX "lead_categories_isActive_order_idx" ON "lead_categories"("isActive", "order");

-- CreateIndex
CREATE INDEX "lead_categories_name_idx" ON "lead_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "leads_referenceNumber_key" ON "leads"("referenceNumber");

-- CreateIndex
CREATE INDEX "leads_source_status_createdAt_idx" ON "leads"("source", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "leads_status_priority_createdAt_idx" ON "leads"("status", "priority", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "leads_assignedToId_status_priority_idx" ON "leads"("assignedToId", "status", "priority");

-- CreateIndex
CREATE INDEX "leads_priority_leadScore_idx" ON "leads"("priority", "leadScore" DESC);

-- CreateIndex
CREATE INDEX "leads_nextFollowUpAt_idx" ON "leads"("nextFollowUpAt");

-- CreateIndex
CREATE INDEX "leads_isOverdue_assignedToId_idx" ON "leads"("isOverdue", "assignedToId");

-- CreateIndex
CREATE INDEX "leads_email_idx" ON "leads"("email");

-- CreateIndex
CREATE INDEX "leads_referenceNumber_idx" ON "leads"("referenceNumber");

-- CreateIndex
CREATE INDEX "leads_createdAt_idx" ON "leads"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "leads_tagId_idx" ON "leads"("tagId");

-- CreateIndex
CREATE INDEX "leads_categoryId_idx" ON "leads"("categoryId");

-- CreateIndex
CREATE INDEX "lead_activities_leadId_createdAt_idx" ON "lead_activities"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_activities_activityType_idx" ON "lead_activities"("activityType");

-- CreateIndex
CREATE INDEX "lead_status_history_leadId_createdAt_idx" ON "lead_status_history"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_notes_leadId_createdAt_idx" ON "lead_notes"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_quotations_leadId_createdAt_idx" ON "lead_quotations"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_quotations_isAccepted_idx" ON "lead_quotations"("isAccepted");

-- CreateIndex
CREATE UNIQUE INDEX "lead_quotations_leadId_version_key" ON "lead_quotations"("leadId", "version");

-- CreateIndex
CREATE INDEX "lead_communications_leadId_createdAt_idx" ON "lead_communications"("leadId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_communications_type_createdAt_idx" ON "lead_communications"("type", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "lead_reminders_leadId_scheduledFor_idx" ON "lead_reminders"("leadId", "scheduledFor");

-- CreateIndex
CREATE INDEX "lead_reminders_assignedToId_isCompleted_scheduledFor_idx" ON "lead_reminders"("assignedToId", "isCompleted", "scheduledFor");

-- CreateIndex
CREATE INDEX "lead_reminders_scheduledFor_isCompleted_idx" ON "lead_reminders"("scheduledFor", "isCompleted");

-- CreateIndex
CREATE UNIQUE INDEX "poi_categories_slug_key" ON "poi_categories"("slug");

-- CreateIndex
CREATE INDEX "poi_categories_slug_idx" ON "poi_categories"("slug");

-- CreateIndex
CREATE INDEX "poi_categories_monument_count_idx" ON "poi_categories"("monument_count");

-- CreateIndex
CREATE UNIQUE INDEX "poi_metadata_key_key" ON "poi_metadata"("key");

-- CreateIndex
CREATE INDEX "poi_metadata_key_idx" ON "poi_metadata"("key");

-- CreateIndex
CREATE UNIQUE INDEX "poi_states_slug_key" ON "poi_states"("slug");

-- CreateIndex
CREATE INDEX "poi_states_slug_idx" ON "poi_states"("slug");

-- CreateIndex
CREATE INDEX "poi_states_name_idx" ON "poi_states"("name");

-- CreateIndex
CREATE INDEX "poi_cities_slug_idx" ON "poi_cities"("slug");

-- CreateIndex
CREATE INDEX "poi_cities_state_id_idx" ON "poi_cities"("state_id");

-- CreateIndex
CREATE UNIQUE INDEX "poi_cities_state_id_slug_key" ON "poi_cities"("state_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "poi_monuments_slug_key" ON "poi_monuments"("slug");

-- CreateIndex
CREATE INDEX "poi_monuments_slug_idx" ON "poi_monuments"("slug");

-- CreateIndex
CREATE INDEX "poi_monuments_city_id_idx" ON "poi_monuments"("city_id");

-- CreateIndex
CREATE INDEX "poi_monuments_monument_name_idx" ON "poi_monuments"("monument_name");

-- CreateIndex
CREATE INDEX "poi_monuments_type_of_place_idx" ON "poi_monuments"("type_of_place");

-- CreateIndex
CREATE INDEX "hero_slides_isActive_order_idx" ON "hero_slides"("isActive", "order");

-- CreateIndex
CREATE INDEX "hero_slides_order_idx" ON "hero_slides"("order");

-- CreateIndex
CREATE UNIQUE INDEX "hero_slides_order_key" ON "hero_slides"("order");

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

-- AddForeignKey
ALTER TABLE "travel_guide_cities" ADD CONSTRAINT "travel_guide_cities_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "travel_guide_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_guide_data" ADD CONSTRAINT "travel_guide_data_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "travel_guide_cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_guide_data" ADD CONSTRAINT "travel_guide_data_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "travel_guide_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admins" ADD CONSTRAINT "admins_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "permissions" ADD CONSTRAINT "permissions_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "lead_tags"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "lead_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_status_history" ADD CONSTRAINT "lead_status_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_quotations" ADD CONSTRAINT "lead_quotations_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_quotations" ADD CONSTRAINT "lead_quotations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_communications" ADD CONSTRAINT "lead_communications_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_communications" ADD CONSTRAINT "lead_communications_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_reminders" ADD CONSTRAINT "lead_reminders_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_reminders" ADD CONSTRAINT "lead_reminders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_reminders" ADD CONSTRAINT "lead_reminders_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poi_cities" ADD CONSTRAINT "poi_cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "poi_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poi_monuments" ADD CONSTRAINT "poi_monuments_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "poi_cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
