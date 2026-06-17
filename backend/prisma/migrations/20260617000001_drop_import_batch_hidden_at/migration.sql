DROP INDEX IF EXISTS "taewoong_furnace"."ImportBatch_hiddenAt_createdAt_idx";

ALTER TABLE "taewoong_furnace"."ImportBatch"
DROP COLUMN IF EXISTS "hiddenAt";
