/*
  Warnings:

  - You are about to drop the `asset_items` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "asset_items" DROP CONSTRAINT "asset_items_asset_id_fkey";

-- DropForeignKey
ALTER TABLE "asset_items" DROP CONSTRAINT "asset_items_purchase_id_fkey";

-- AlterTable
ALTER TABLE "assets" ALTER COLUMN "asset_amount" DROP NOT NULL,
ALTER COLUMN "asset_amount" DROP DEFAULT;

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "category_id" UUID;

-- DropTable
DROP TABLE "asset_items";

-- CreateTable
CREATE TABLE "categories" (
    "category_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "asset_slots" (
    "asset_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "asset_slots_pkey" PRIMARY KEY ("asset_id","category_id")
);

-- CreateTable
CREATE TABLE "event_items" (
    "event_no" INTEGER NOT NULL,
    "asset_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "event_items_pkey" PRIMARY KEY ("event_no","asset_id","purchase_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE INDEX "event_items_purchase_id_idx" ON "event_items"("purchase_id");

-- CreateIndex
CREATE INDEX "purchases_category_id_idx" ON "purchases"("category_id");

-- AddForeignKey
ALTER TABLE "asset_slots" ADD CONSTRAINT "asset_slots_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_slots" ADD CONSTRAINT "asset_slots_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_items" ADD CONSTRAINT "event_items_event_no_asset_id_fkey" FOREIGN KEY ("event_no", "asset_id") REFERENCES "event_assets"("event_no", "asset_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_items" ADD CONSTRAINT "event_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;
