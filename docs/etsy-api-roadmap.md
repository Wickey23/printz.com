# Etsy API Roadmap

This is the practical integration path for PRINTZ. Keep Etsy as the checkout and buyer-trust layer, while this site becomes the product operations layer.

## Current

- OAuth connection with PKCE.
- Etsy ID auto-detect for shop, taxonomy, shipping profile, and readiness state.
- Active listing sync from Etsy into `products`.
- Basic Etsy draft creation from a site product.
- Custom print requests can store quoted price and custom Etsy checkout URL.

## Next Build Order

1. Token refresh
   - Store refresh tokens server-side instead of relying only on browser cookies.
   - Refresh access tokens automatically before sync, draft creation, uploads, and order reads.

2. Complete listing publishing
   - Create draft listing.
   - Upload listing images from product media.
   - Upload digital files for digital download products.
   - Update inventory, quantity, SKU, and readiness state.
   - Publish only when required assets and review checks pass.

3. Request-to-Etsy draft
   - Turn an approved custom print request into a private/custom Etsy draft.
   - Use quoted price, color/material/quantity notes, source model URL, and uploaded customer files in the listing description.
   - Save the created Etsy listing ID and URL back to the request.

4. Order and receipt sync
   - Read shop receipts and transactions.
   - Match Etsy orders back to custom print requests and site products.
   - Show paid/unpaid/in-production/shipped status in `/account` and `/admin/print-requests`.

5. Shop management
   - Update shop announcement and sale messages from admin.
   - Create and manage shop sections.
   - Assign listings to sections from product category.

6. Operational reporting
   - Pull listing stats where available.
   - Track synced listing price, state, favorites/views if Etsy exposes them to the app.
   - Flag products with stale Etsy URLs, inactive listings, missing images, or unsafe license notes.

## Required Etsy Scopes

- `listings_r`: read listing data for sync.
- `listings_w`: create/update drafts, upload images/files, inventory, and publish.
- `shops_r`: discover shop and read shop settings/resources.
- `shops_w`: update shop messages and shop sections.
- `transactions_r`: read receipts, orders, and transaction status.

Add `listings_d` only if we intentionally support deleting Etsy listings from this site.

## Environment

- `ETSY_API_KEY`: `keystring:shared_secret`.
- `NEXT_PUBLIC_SITE_URL`: production URL matching the Etsy app redirect URI.
- Optional fallback IDs:
  - `ETSY_SHOP_ID`
  - `ETSY_DEFAULT_TAXONOMY_ID`
  - `ETSY_SHIPPING_PROFILE_ID`
  - `ETSY_READINESS_STATE_ID`

Runtime settings can also be saved from `/admin/etsy` after connecting OAuth.

## Guardrails

- Do not publish request-only source models without commercial rights review.
- Keep checkout on Etsy; do not collect payments directly on this site.
- Never expose Etsy OAuth tokens or API secrets to Client Components.
- Require admin auth inside every Etsy write endpoint or Server Action.
