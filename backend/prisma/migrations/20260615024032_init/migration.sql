-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'user');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('day', 'night');

-- CreateEnum
CREATE TYPE "ChargeSource" AS ENUM ('auto', 'manual', 'paste', 'upload');

-- CreateEnum
CREATE TYPE "ChargeScanStatus" AS ENUM ('uploaded', 'processed', 'error');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Furnace" (
    "id" SERIAL NOT NULL,
    "no" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Furnace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasReading" (
    "id" SERIAL NOT NULL,
    "furnaceId" INTEGER NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "temp" DOUBLE PRECISION,
    "gas" DOUBLE PRECISION,
    "gasCumulative" DOUBLE PRECISION NOT NULL,
    "power" DOUBLE PRECISION,
    "powerCumulative" DOUBLE PRECISION,
    "temp2" DOUBLE PRECISION,
    "temp3" DOUBLE PRECISION,
    "importBatchId" INTEGER,

    CONSTRAINT "GasReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeEntry" (
    "id" SERIAL NOT NULL,
    "chargeNo" TEXT NOT NULL,
    "furnaceId" INTEGER NOT NULL,
    "gasBefore" DOUBLE PRECISION,
    "gasAfter" DOUBLE PRECISION,
    "usage" DOUBLE PRECISION,
    "workDate" TIMESTAMP(3) NOT NULL,
    "shift" "Shift" NOT NULL,
    "source" "ChargeSource" NOT NULL DEFAULT 'manual',
    "chargeRecordId" INTEGER,
    "note" TEXT,

    CONSTRAINT "ChargeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeScan" (
    "id" SERIAL NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageCount" INTEGER,
    "status" "ChargeScanStatus" NOT NULL DEFAULT 'uploaded',

    CONSTRAINT "ChargeScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChargeRecord" (
    "id" SERIAL NOT NULL,
    "chargeScanId" INTEGER NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "furnaceId" INTEGER NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "shift" "Shift" NOT NULL,
    "workEnd" TIMESTAMP(3) NOT NULL,
    "workStart" TIMESTAMP(3),
    "material" TEXT,
    "weightKg" DOUBLE PRECISION,
    "note" TEXT,

    CONSTRAINT "ChargeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" SERIAL NOT NULL,
    "fileName" TEXT NOT NULL,
    "furnaceId" INTEGER,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Furnace_no_key" ON "Furnace"("no");

-- CreateIndex
CREATE INDEX "GasReading_furnaceId_ts_idx" ON "GasReading"("furnaceId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "GasReading_furnaceId_ts_key" ON "GasReading"("furnaceId", "ts");

-- CreateIndex
CREATE INDEX "ChargeEntry_furnaceId_idx" ON "ChargeEntry"("furnaceId");

-- CreateIndex
CREATE INDEX "ChargeEntry_workDate_idx" ON "ChargeEntry"("workDate");

-- CreateIndex
CREATE INDEX "ChargeEntry_furnaceId_workDate_idx" ON "ChargeEntry"("furnaceId", "workDate");

-- CreateIndex
CREATE INDEX "ChargeEntry_chargeRecordId_idx" ON "ChargeEntry"("chargeRecordId");

-- CreateIndex
CREATE INDEX "ChargeScan_uploadedAt_idx" ON "ChargeScan"("uploadedAt");

-- CreateIndex
CREATE INDEX "ChargeRecord_chargeScanId_idx" ON "ChargeRecord"("chargeScanId");

-- CreateIndex
CREATE INDEX "ChargeRecord_furnaceId_idx" ON "ChargeRecord"("furnaceId");

-- CreateIndex
CREATE INDEX "ChargeRecord_workDate_idx" ON "ChargeRecord"("workDate");

-- CreateIndex
CREATE INDEX "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");

-- AddForeignKey
ALTER TABLE "GasReading" ADD CONSTRAINT "GasReading_furnaceId_fkey" FOREIGN KEY ("furnaceId") REFERENCES "Furnace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GasReading" ADD CONSTRAINT "GasReading_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeEntry" ADD CONSTRAINT "ChargeEntry_furnaceId_fkey" FOREIGN KEY ("furnaceId") REFERENCES "Furnace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeEntry" ADD CONSTRAINT "ChargeEntry_chargeRecordId_fkey" FOREIGN KEY ("chargeRecordId") REFERENCES "ChargeRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeRecord" ADD CONSTRAINT "ChargeRecord_chargeScanId_fkey" FOREIGN KEY ("chargeScanId") REFERENCES "ChargeScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChargeRecord" ADD CONSTRAINT "ChargeRecord_furnaceId_fkey" FOREIGN KEY ("furnaceId") REFERENCES "Furnace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_furnaceId_fkey" FOREIGN KEY ("furnaceId") REFERENCES "Furnace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
