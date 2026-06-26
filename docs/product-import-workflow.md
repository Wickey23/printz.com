# PRINTZ Product Import Workflow

This is the simplified workflow for product intake.

## Recommended flow

1. In Google Sheets, create a new tab named like `2026-06-25 Product Import`.
2. Download the website template from `/admin/products/new` using `Download CSV template`.
3. Paste the template headers into that dated tab.
4. Fill one row per product.
5. Export/download that tab as CSV.
6. Upload the CSV from `/admin/products/new`.
7. Imported products are created or updated by slug.
8. Imported products default to inactive unless the `active` column is `TRUE`.

## Media

- Put one product's images/videos in one Google Drive folder.
- Add that folder URL to `drive_media_folder_url` in the CSV.
- During import, the site attempts to copy that folder's images/videos into Supabase `product_media` for the product carousel.
- This requires Google service-account credentials and the Drive folder shared with that service account.
- You can also paste direct image/video URLs into `gallery_media_urls`, separated by commas or new lines.

## Safety

- Existing products are not deleted.
- Re-importing the same slug updates that product.
- Use the admin `Set all products inactive` button before the first clean import if the current site catalog is not ready.
- Keep products inactive until title, photos, rights, price, and Etsy details are reviewed.
