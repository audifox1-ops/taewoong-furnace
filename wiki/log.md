# Work Log

## 2026-06-15
- Prevented charge scan deletion when linked charge records exist, so uploaded data is no longer lost through the delete flow.
- Added backend tests for scan deletion protection.
- Updated the uploads UI to disable delete actions when linked records are present.
- Fixed gas-reading uploads so full-width furnace numbers like `１７`, `１９` are parsed correctly and the chosen furnace number is sent with the request instead of defaulting to furnace 1.
- Removed the remaining `|| 1` fallback in charge entry creation so missing furnace matches now fail loudly instead of silently landing on furnace 1.
- Added a dry-run-first backend script for correcting already-imported gas-reading batches that were saved under the wrong furnace.
- Added an admin-facing Settings page panel for previewing and applying gas-reading furnace corrections in bulk.

## Verification
- `npm.cmd run build` in `backend` passed.
- `npm.cmd test -- --runInBand upload.service.spec.ts charge.service.spec.ts` in `backend` passed.
- `npm.cmd test -- --runInBand gas-reading.service.spec.ts` in `backend` passed.
- `npm.cmd test -- --runInBand gas-reading.fix.spec.ts gas-reading.service.spec.ts` in `backend` passed.
- `npm.cmd run build` in `frontend` passed.
