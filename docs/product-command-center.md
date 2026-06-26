# PRINTZ Product Command Center

## Source of truth

- Supabase `products` is the canonical product database.
- The Google Sheet is the editable product command center.
- `Sheet1` remains as the compatibility/master table so existing data is not lost.
- `Research Queue`, `Listing Builder`, `Rights & Attribution`, and `Pricing & Production` are focused working tabs for easier editing.
- `Site Products` is rebuilt from Supabase and must not be edited.
- AI source enrichment can suggest or fill blank research fields, but only the deterministic sync service can mutate Supabase.

## Split-tab workflow

Use the focused tabs instead of editing all columns in `Sheet1` at once:

1. `Research Queue`: keyword/EverBee data, MakerWorld/source links, and source enrichment status.
2. `Rights & Attribution`: creator, license, attribution, commercial sale, modification, and rights review fields.
3. `Pricing & Production`: grams, print time, costs, target margin, estimated cost, and suggested price.
4. `Listing Builder`: buyer-facing title, description, category, tags, media folder, variants, and active/featured controls.

Rows are joined by `Product ID`, then `Canonical Row ID`, then normalized source URL, then slug/name. This means the same product can be edited across several tabs and the sync service will merge the fields before creating or updating Supabase.

Run `npm run setup:product-tabs` after Google service-account credentials are configured. The script creates/repairs the focused tabs, adds filters/dropdowns, and seeds rows from `Sheet1` with editable formulas. You can overwrite any formula cell in a focused tab; the sync reads the focused-tab value.

## Processing flow

1. Complete the product across the focused tabs and review rights, media, and pricing inputs.
2. Set `Workflow Status` to `Ready` and check `Send to Final Stage / Site` in any command-center tab.
3. The sync service merges matching rows and then matches existing site products by Product ID, normalized source URL, slug, then unique name.
4. It rejects duplicate creation, unsafe activation, invalid rights, and stale sync versions.
5. It creates or updates Supabase, imports media from the Drive folder, records audit history, writes Product ID/version/status back to every matching command-center tab, and rebuilds `Site Products`.
6. Failed rows remain checked with `Blocked`, `Conflict`, or `Error` details.

## Drive media workflow

- Use one Google Drive folder per product.
- The folder name can simply be the product name.
- Put product images and videos in that folder; supported Drive MIME types are `image/*` and `video/*`.
- No filename convention is required.
- Media is read by Drive creation time, then name. The first image becomes the main product image only when the Sheet/site product has no main image already.
- If the site admin later changes the main image URL, the sync preserves that admin choice unless `Main Image` is filled in the Sheet.
- If the product has no `Video URL`, the first video from the Drive folder is written to `video_url`.
- The sync copies Drive media into Supabase Storage, so the public site does not depend on Drive links staying public.
- Preferred input is still the exact `Drive Media Folder URL` per product. If `PRINTZ_PRODUCT_MEDIA_PARENT_FOLDER_URL` is configured, the sync can also look inside that parent folder for a child folder matching the product name or slug when the row folder URL is blank.

## Required deployment steps

1. Apply `supabase/product_command_center.sql` in the Supabase SQL editor.
2. Create a Google Cloud service account with Sheets and Drive read access.
3. Share the product spreadsheet and every product media folder with the service-account email.
4. Configure `GOOGLE_SERVICE_ACCOUNT_EMAIL` and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`, or `GOOGLE_SERVICE_ACCOUNT_JSON`.
5. Configure `PRODUCT_SYNC_SECRET` and `PRINTZ_PRODUCT_SHEET_ID` in local/deployment environment variables.
6. Run `npm run setup:product-tabs` to create/repair the split command-center tabs.
7. Run `npm run sync:products:dry`, then `npm run sync:products`.

## Safety properties

- Idempotent duplicate matching across all command-center tabs.
- Optimistic locking through `sync_version`.
- Soft archive instead of product deletion.
- Structured license and rights gates.
- Cost-based price floor and suggestion.
- Per-row audit history and dead-letter records.
- Drive media copied into permanent Supabase Storage URLs.
- Etsy publishing is handled separately from the Sheet sync. Website product edits can be pushed to the attached Etsy listing from the product admin page, with explicit publish controls.
