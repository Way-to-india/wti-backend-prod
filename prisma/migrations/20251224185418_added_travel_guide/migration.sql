-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false;

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

-- AddForeignKey
ALTER TABLE "travel_guide_cities" ADD CONSTRAINT "travel_guide_cities_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "travel_guide_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_guide_data" ADD CONSTRAINT "travel_guide_data_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "travel_guide_cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_guide_data" ADD CONSTRAINT "travel_guide_data_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "travel_guide_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
