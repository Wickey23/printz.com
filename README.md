# Sameer Made

A modern Next.js, TypeScript, Tailwind CSS, and Supabase website for an Etsy-based custom 3D printed / handmade product catalog. The site showcases active products and sends purchases to Etsy instead of implementing checkout.

## Features

- Premium responsive marketing pages: Home, Products, Product Detail, Suggest an Item, About, and Contact.
- Product search, category filtering, featured/newest/price sorting, badges for Coming Soon and Custom Order Available.
- Supabase-backed forms for product suggestions and contact messages.
- Supabase Auth admin area at `/admin` with server-side checks against `ADMIN_EMAILS`.
- Admin product management for create, edit, delete, active, and featured fields.
- Suggestions dashboard with status updates.
- SEO metadata for product detail pages and clean `/products/[slug]` URLs.
- Vercel-ready environment variable configuration.

## Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
ADMIN_EMAILS=owner@example.com,helper@example.com
```

## Supabase

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Create Auth users for approved admins.
4. Add the same admin emails to `ADMIN_EMAILS` in Vercel and local env.
5. Use the `product-media` public bucket for uploaded images/videos. Paste uploaded media URLs into products from the admin dashboard.

## Deployment on Vercel

1. Push this repository to GitHub.
2. Import it in Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ADMIN_EMAILS` environment variables.
4. Deploy. Purchases link to `https://www.etsy.com/shop/YOURSHOPNAME`; update `src/lib/config.ts` when your Etsy URL is ready.


## Deployment on Render

You can host this app on Render as a Node web service. You do not need a separate backend service because the Next.js server actions run inside the deployed web service and Supabase provides the database, authentication, and media storage.

1. Push this repository to GitHub/GitLab/Bitbucket.
2. In Render, create a new **Web Service** from the repo.
3. Use these commands if Render does not auto-detect `render.yaml`:
   - Build command: `npm install && npm run build`
   - Start command: `npm run start`
4. Add the same environment variables as Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `ADMIN_EMAILS`
5. Keep Supabase as your backend for tables, auth, and storage.

The included `render.yaml` describes the Render web service and required environment variables.

## Notes

This app intentionally does not include checkout. Product CTAs link to Etsy listings when available, and otherwise display a Coming Soon state.
