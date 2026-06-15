# Work Log

## 2026-06-15
- Added `chargeNo` uniqueness at the Prisma schema level to guard against duplicate charge entries.
- Normalized date filters in charge and gas-reading queries so date-only inputs include the full day.
- Fixed `getUsageSummary` so charges with `usage = 0` are counted instead of skipped.
- Tightened charge-number parsing and added a regression test for zero-usage aggregation.

## Verification
- `npm.cmd run build` in `backend` passed.
- `npm.cmd test -- --runInBand charge.service.spec.ts` in `backend` passed.
