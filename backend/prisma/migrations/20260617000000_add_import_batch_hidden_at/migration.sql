ALTER TABLE "taewoong_furnace"."ImportBatch"
ADD COLUMN "hiddenAt" TIMESTAMP(3);

CREATE INDEX "ImportBatch_hiddenAt_createdAt_idx"
ON "taewoong_furnace"."ImportBatch"("hiddenAt", "createdAt");
