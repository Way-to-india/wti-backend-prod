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

-- AddForeignKey
ALTER TABLE "poi_cities" ADD CONSTRAINT "poi_cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "poi_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poi_monuments" ADD CONSTRAINT "poi_monuments_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "poi_cities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
