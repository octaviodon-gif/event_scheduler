-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "event_prefix" VARCHAR(10) NOT NULL,
    "business_name" VARCHAR(100) NOT NULL,
    "timezone" VARCHAR(60) NOT NULL,
    "buffer_minutes" INTEGER NOT NULL,
    "duration_hours" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);
