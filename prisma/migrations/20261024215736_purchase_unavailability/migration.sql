-- CreateEnum
CREATE TYPE "unavailable_reason" AS ENUM ('maintenance', 'deprecated');

-- AlterTable
ALTER TABLE "purchases" ADD COLUMN     "unavailable_note" VARCHAR(255),
ADD COLUMN     "unavailable_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "unavailable_reason" "unavailable_reason";
