# PRINTZ Team Official

Modern Next.js catalog site for an Etsy shop. Products are showcased on this site, while purchases link out to Etsy.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Auth, Postgres, and Storage
- Vercel deployment

Render is not needed for this version because the app uses Vercel server functions and Supabase. Supabase has a free plan for small projects, and Vercel Hobby is free for personal projects, subject to their usage and commercial-use limits.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env.local` and fill in values:

```bash
cp .env.example .env.local
```

3. Create a Supabase project, then run `supabase/schema.sql` in the Supabase SQL editor.

4. Add your admin email:

```sql
insert into public.admin_users (email) values ('you@example.com');
```

Also set `ADMIN_EMAILS=you@example.com` in `.env.local` and in Vercel.

5. Create an auth user in Supabase Auth with the same email and a password.

6. Start the app:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Environment Variables

- `NEXT_PUBLIC_SITE_URL`: production site URL
- `NEXT_PUBLIC_ETSY_URL`: Etsy shop URL
- `NEXT_PUBLIC_CONTACT_EMAIL`: public contact email
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role key for server-only admin mutations
- `ADMIN_EMAILS`: comma-separated approved admin emails

Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code.

## Admin

- Login: `/admin/login`
- Dashboard: `/admin`
- AI listing generator: `/admin/ai`
- Add products: `/admin/products/new`
- Edit products: use the Edit link from `/admin`
- Etsy launch kit: `/admin/etsy`

Admin routes check the logged-in Supabase user on the server and only allow emails in `ADMIN_EMAILS` or active rows in `admin_users`.

See `docs/etsy-launch-kit.md` for shop setup copy, first-listing priorities, photo guidance, and launch checks.

## Deployment

### Vercel

1. Push this repository to GitHub.
2. Import it in Vercel as a Next.js project.
3. Add the same environment variables from `.env.example`.
4. Deploy.

### Supabase

Use the free plan to start if the shop has a small catalog and modest traffic. Upgrade when you need more database/storage capacity, backups, higher limits, or production support.

## Notes

- The public site falls back to sample products when Supabase variables are missing, so previews still work.
- Suggestions and contact messages save to Supabase when the service role key is configured.
- Products without an Etsy URL show a Coming Soon badge and do not create checkout on this site.
