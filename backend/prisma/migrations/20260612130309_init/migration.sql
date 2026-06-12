-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Furnace" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "no" INTEGER NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "GasReading" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "furnaceId" INTEGER NOT NULL,
    "ts" DATETIME NOT NULL,
    "temp" REAL,
    "gas" REAL,
    "gasCumulative" REAL NOT NULL,
    "power" REAL,
    "powerCumulative" REAL,
    "temp2" REAL,
    "temp3" REAL,
    "importBatchId" INTEGER,
    CONSTRAINT "GasReading_furnaceId_fkey" FOREIGN KEY ("furnaceId") REFERENCES "Furnace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GasReading_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChargeEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chargeNo" TEXT NOT NULL,
    "furnaceId" INTEGER NOT NULL,
    "gasBefore" REAL,
    "gasAfter" REAL,
    "usage" REAL,
    "workDate" DATETIME NOT NULL,
    "shift" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "chargeRecordId" INTEGER,
    "note" TEXT,
    CONSTRAINT "ChargeEntry_furnaceId_fkey" FOREIGN KEY ("furnaceId") REFERENCES "Furnace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChargeEntry_chargeRecordId_fkey" FOREIGN KEY ("chargeRecordId") REFERENCES "ChargeRecord" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ChargeScan" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileUrl" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pageCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'uploaded'
);

-- CreateTable
CREATE TABLE "ChargeRecord" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chargeScanId" INTEGER NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "furnaceId" INTEGER NOT NULL,
    "workDate" DATETIME NOT NULL,
    "shift" TEXT NOT NULL,
    "workEnd" DATETIME NOT NULL,
    "workStart" DATETIME,
    "material" TEXT,
    "weightKg" REAL,
    "note" TEXT,
    CONSTRAINT "ChargeRecord_chargeScanId_fkey" FOREIGN KEY ("chargeScanId") REFERENCES "ChargeScan" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ChargeRecord_furnaceId_fkey" FOREIGN KEY ("furnaceId") REFERENCES "Furnace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GasUsage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "furnaceId" INTEGER NOT NULL,
    "workDate" DATETIME NOT NULL,
    "shift" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "cumStart" REAL NOT NULL,
    "cumEnd" REAL NOT NULL,
    "usage" REAL NOT NULL,
    "weightKg" REAL,
    "unitRate" REAL,
    "chargeEntryId" INTEGER,
    CONSTRAINT "GasUsage_furnaceId_fkey" FOREIGN KEY ("furnaceId") REFERENCES "Furnace" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GasUsage_chargeEntryId_fkey" FOREIGN KEY ("chargeEntryId") REFERENCES "ChargeEntry" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "fileName" TEXT NOT NULL,
    "furnaceId" INTEGER,
    "periodStart" DATETIME,
    "periodEnd" DATETIME,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Furnace_no_key" ON "Furnace"("no");

-- CreateIndex
CREATE INDEX "GasReading_furnaceId_ts_idx" ON "GasReading"("furnaceId", "ts");

-- CreateIndex
CREATE UNIQUE INDEX "GasUsage_chargeEntryId_key" ON "GasUsage"("chargeEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "GasUsage_furnaceId_workDate_shift_key" ON "GasUsage"("furnaceId", "workDate", "shift");
