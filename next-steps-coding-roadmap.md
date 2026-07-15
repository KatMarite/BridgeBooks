# EasyBooks — Coding Roadmap (as of 2026-07-15)

This roadmap compares the vision in `dev brief.md` and `6-Month Project Map.md` against the actual, verified state of the code in this repo. Items are ordered by priority.

## What's working today

- **Booksite ingestion** — tested against real data. 130,634 books upserted.
- **Jonathan Ball ingestion** — tested against real data. 237,365 books upserted.
- **Small-publisher ingestion** (`import_small_publishers.py`) — tested. 9,983 books upserted across 9 suppliers.
- **Combined catalogue** — 377,314 books now live in Supabase.
- **ONIX 3.0 export** (`backend/export_onix.py`) — tested, produces a valid export of all 377,314 records.
- **Enrichment API clients** — `google_books.py` and `open_library.py` are both well-built (proper rate limiting, retries, dotenv config).
- **Merge logic** (`merge_records.py`) — supplier-priority merge rules are implemented correctly.
- **Node backend API** (`server.js`) — much more built than expected: book search, dashboard, price overrides, an indie-submissions review queue, and Shopify order webhooks all exist as working endpoints (pending the fixes below).

## Priority order for remaining work

1. **Fix schema mismatches in the Node backend.** `server.js`'s dashboard endpoints and `seed.js` reference columns that don't exist in the real Supabase schema (`completed_at`, `records_updated`, `errors_count` — the real columns are `finished_at`, no `records_updated`, and `error_count`). This is the same bug already fixed in `ingestion_logger.py`, just not caught here yet. Right now the dashboard, activity, and error views will throw SQL errors against real data. Also recommend disabling `seed.js`'s auto-run-on-startup — it inserts 20 mock books and fake events on every boot, which no longer makes sense with 377k real books loaded.

2. **Two competing ONIX exporters exist.** The tested Python version (`backend/export_onix.py`) and a second, simpler, untested one inline in `server.js` (`/api/export/onix`) that skips per-supplier pricing detail. Pick one — recommend retiring the JS version or having it shell out to the Python script.

3. **Hardcoded Windows paths.** Several `server.js` endpoints (pricing engine trigger, Shopify sync trigger) call a Windows-only venv path (`.\Master Catalogue Schema\venv\Scripts\python.exe`) with no Mac/Linux fallback. These will fail as-is on non-Windows hosts.

4. **Shopify credentials are entirely unprovisioned.** No `SHOPIFY_STORE_URL` / `SHOPIFY_ACCESS_TOKEN` anywhere. `shopify_client.py` is well-built and just needs these. `sync_to_shopify.py` also needs the same `load_dotenv()` + `sslmode="require"` fixes already applied elsewhere in the codebase.

5. **`enrich_books.py` queries a `page_count` column that doesn't exist** on the live `books` table. (It exists in the old Alembic migration files, which describe a different, apparently abandoned schema than what's actually deployed.) Same missing dotenv/sslmode bugs apply here too. Fix options: add the column for real, or strip page_count handling from `enrich_books.py`, `merge_records.py`, and `open_library.py`.

6. **`pricing_engine.py`** (implements the 30% import-markup rule from the brief) looks functionally complete but has the same missing `load_dotenv()` / `sslmode` bug — won't connect to the real database until fixed.

7. **Protea email ingestion** — the IMAP scripts exist and look reasonably solid, but no mailbox credentials are configured anywhere, and it's never been tested against a real inbox.

8. **Gardners/Ingram currency ingestion** — no pipeline exists yet for foreign suppliers. `pricing_engine.py` only handles the currency conversion math once cost data already exists in the database.

9. **No React frontend exists yet.** Only backend API endpoints are built. All six staff-facing screens from the brief (Dashboard, Book Search, Supplier Status, Review Queue, Price Override, Currency Settings) have no UI to consume them.

10. **WhatsApp wholesale lookup** — Phase 3 per the project map, correctly untouched for now.
