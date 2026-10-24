-- CreateEnum
CREATE TYPE "purchase_status" AS ENUM ('pending purchase', 'paid', 'in delivery', 'received', 'completed');

-- CreateTable
CREATE TABLE "assets" (
    "asset_id" UUID NOT NULL,
    "asset_name" VARCHAR(100) NOT NULL,
    "asset_amount" INTEGER NOT NULL DEFAULT 0,
    "asset_color" VARCHAR(50),
    "asset_measures" VARCHAR(100),
    "asset_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("asset_id")
);

-- CreateTable
CREATE TABLE "events" (
    "event_no" SERIAL NOT NULL,
    "customer_name" VARCHAR(150) NOT NULL,
    "customer_phone" VARCHAR(20) NOT NULL,
    "customer_email" VARCHAR(255),
    "event_address" TEXT NOT NULL,
    "notes" TEXT,
    "date" DATE NOT NULL,
    "start_time" TIME(0) NOT NULL,
    "end_time" TIME(0) NOT NULL,
    "down_payment_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "payment_complete" BOOLEAN NOT NULL DEFAULT false,
    "pending_payment" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rent_total_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("event_no")
);

-- CreateTable
CREATE TABLE "purchases" (
    "purchase_id" UUID NOT NULL,
    "asset_name" VARCHAR(100) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "provider" VARCHAR(150) NOT NULL,
    "asset_color" VARCHAR(50),
    "asset_measures" VARCHAR(100),
    "purchase_status" "purchase_status" NOT NULL DEFAULT 'pending purchase',
    "price" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("purchase_id")
);

-- CreateTable
CREATE TABLE "asset_items" (
    "asset_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "asset_items_pkey" PRIMARY KEY ("asset_id","purchase_id")
);

-- CreateTable
CREATE TABLE "event_assets" (
    "event_no" INTEGER NOT NULL,
    "asset_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "event_assets_pkey" PRIMARY KEY ("event_no","asset_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_name_key" ON "assets"("asset_name");

-- CreateIndex
CREATE INDEX "events_date_idx" ON "events"("date");

-- CreateIndex
CREATE INDEX "event_assets_asset_id_idx" ON "event_assets"("asset_id");

-- AddForeignKey
ALTER TABLE "asset_items" ADD CONSTRAINT "asset_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_items" ADD CONSTRAINT "asset_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assets" ADD CONSTRAINT "event_assets_event_no_fkey" FOREIGN KEY ("event_no") REFERENCES "events"("event_no") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_assets" ADD CONSTRAINT "event_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE RESTRICT ON UPDATE CASCADE;
