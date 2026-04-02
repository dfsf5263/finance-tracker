-- AlterTable
ALTER TABLE "account" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "twoFactor" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "verification" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "apikey" (
    "id" UUID NOT NULL,
    "config_id" TEXT NOT NULL DEFAULT 'default',
    "name" TEXT,
    "start" TEXT,
    "reference_id" UUID NOT NULL,
    "prefix" TEXT,
    "key" TEXT NOT NULL,
    "refill_interval" INTEGER,
    "refill_amount" INTEGER,
    "last_refill_at" TIMESTAMP(3),
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "rate_limit_enabled" BOOLEAN NOT NULL DEFAULT true,
    "rate_limit_time_window" INTEGER,
    "rate_limit_max" INTEGER,
    "request_count" INTEGER NOT NULL DEFAULT 0,
    "remaining" INTEGER,
    "last_request" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "permissions" TEXT,
    "metadata" TEXT,

    CONSTRAINT "apikey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "apikey_config_id_idx" ON "apikey"("config_id");

-- CreateIndex
CREATE INDEX "apikey_reference_id_idx" ON "apikey"("reference_id");

-- CreateIndex
CREATE INDEX "apikey_key_idx" ON "apikey"("key");

-- AddForeignKey
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_reference_id_fkey" FOREIGN KEY ("reference_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
