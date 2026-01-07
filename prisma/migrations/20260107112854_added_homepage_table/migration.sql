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
CREATE INDEX "hero_slides_isActive_order_idx" ON "hero_slides"("isActive", "order");

-- CreateIndex
CREATE INDEX "hero_slides_order_idx" ON "hero_slides"("order");

-- CreateIndex
CREATE UNIQUE INDEX "hero_slides_order_key" ON "hero_slides"("order");
