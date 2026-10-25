/*
  Warnings:

  - The primary key for the `event_items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `asset_id` on the `event_items` table. All the data in the column will be lost.
  - Added the required column `kind` to the `event_items` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "event_item_kind" AS ENUM ('set_fixed', 'set_pick', 'extra');

-- DropForeignKey
ALTER TABLE "event_items" DROP CONSTRAINT "event_items_event_no_asset_id_fkey";

-- AlterTable
ALTER TABLE "event_items" DROP CONSTRAINT "event_items_pkey",
DROP COLUMN "asset_id",
ADD COLUMN     "kind" "event_item_kind" NOT NULL,
ADD COLUMN     "unit_price" DECIMAL(10,2),
ADD CONSTRAINT "event_items_pkey" PRIMARY KEY ("event_no", "purchase_id", "kind");

-- AlterTable
ALTER TABLE "events" ADD COLUMN     "google_event_id" TEXT;

-- AddForeignKey
ALTER TABLE "event_items" ADD CONSTRAINT "event_items_event_no_fkey" FOREIGN KEY ("event_no") REFERENCES "events"("event_no") ON DELETE CASCADE ON UPDATE CASCADE;
