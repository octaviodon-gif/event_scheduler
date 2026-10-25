-- CreateTable
CREATE TABLE "asset_fixed_items" (
    "asset_id" UUID NOT NULL,
    "purchase_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "asset_fixed_items_pkey" PRIMARY KEY ("asset_id","purchase_id")
);

-- CreateIndex
CREATE INDEX "asset_fixed_items_purchase_id_idx" ON "asset_fixed_items"("purchase_id");

-- AddForeignKey
ALTER TABLE "asset_fixed_items" ADD CONSTRAINT "asset_fixed_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("asset_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_fixed_items" ADD CONSTRAINT "asset_fixed_items_purchase_id_fkey" FOREIGN KEY ("purchase_id") REFERENCES "purchases"("purchase_id") ON DELETE RESTRICT ON UPDATE CASCADE;
