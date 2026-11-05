# Mr SA Properties

Premium buy-and-sell property marketplace for Tamil Nadu.

**Tagline:** BUILD ASSETS • GROW WEALTH • CREATE YOUR FUTURE

**Contact:** +91 88380 37689 · mrsasolutions2@gmail.com

## Features
- Responsive light MrSa Properties branding with a clean white layout and soft green accents
- Public property discovery and detailed image galleries
- Advanced search by keyword, district, property type, price, bedrooms and area range
- Sorting by price (low/high) and date (new/old)
- Browser-based saved properties, social sharing and recently posted badges
- Admin listing search and status filters
- Buyer, owner and agent registration/login with Supabase Auth
- Property submission with up to 8 photos
- New listings start as **pending** and remain hidden from public search until admin approval
- Owner / agent dashboard to track submitted listings
- Admin dashboard to approve, reject or delete submissions
- WhatsApp enquiry links
- Supabase PostgreSQL Row Level Security and property-image storage

## Technology
- React + Vite
- Cloudflare Pages hosting
- Supabase Auth, PostgreSQL and Storage

Free tiers have quotas, fair-use terms and possible inactivity pauses. This is an MVP starter, not a legally verified property portal. Add verification, privacy policy, terms, moderation, spam controls and backups before commercial launch.

## 1. Supabase setup

1. Create or open your Supabase project.
2. Open **SQL Editor** and run the complete `supabase/schema.sql` file.
3. In **Project Settings → API**, copy the Project URL and anon / publishable key.
4. Configure your site URL and allowed redirect URLs in **Authentication → URL Configuration**.

The SQL creates the tables, signup profile trigger, RLS policies and public property image bucket. It also blocks users from changing their own account role through the normal profile update API.

After the base schema has been created, review and run `supabase/migrations/20261105_mrsa_properties_2_0.sql` in Supabase SQL Editor. This separate migration expands supported property categories and adds listing-query indexes. GitHub merging and Cloudflare deployment do not execute SQL migrations automatically.

## 2. Configure and run locally
Install Node.js LTS, then:

```bash
npm install
cp .env.example .env
```

Set these values in `.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_or_publishable_key
VITE_WHATSAPP_DEFAULT=918838037689
```

Only use the anon / publishable key in this frontend app. Never expose the Supabase `service_role` secret.

Run:

```bash
npm run dev
```

## 3. Make your account an administrator
1. Register on the website using the email you want to use as the administrator.
2. In Supabase → SQL Editor, run this query after replacing the email:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

3. Sign out and sign in again. The Admin dashboard will appear.

Do not make an ordinary user an admin from the public website.

## 4. Deploy on Cloudflare Pages
1. Connect this GitHub repository to Cloudflare Pages.
2. Build command: `npm run build`
3. Build output directory: `dist`
4. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_WHATSAPP_DEFAULT` as Pages environment variables.
5. Deploy, then add your deployed `*.pages.dev` URL to Supabase Auth's allowed redirect URLs and Site URL.
6. Test signup, login, image upload, property submission, admin approval, public search and WhatsApp enquiries.

## Production checklist
- Add CAPTCHA / rate limits and email verification to reduce spam.
- Enforce image type and size restrictions; the SQL bucket limit is 5 MB per image.
- Add report listing, block user, audit log and moderation queue.
- Add privacy policy, terms, consent and grievance/contact process.
- Verify owner / agent claims and property documents before promoting listings.
- Configure backups, monitoring and pagination as inventory grows.
- Public listing photos are public by design. Never upload identity documents, deeds or confidential records to the property photo bucket.

## Current MVP limitations
- Agent dashboard currently manages the signed-in agent's own listings; no multi-agent brokerage/team management.
- No online payments, subscriptions, maps/geocoding, saved searches or chat inbox.
- User-submitted listings and property details must be independently verified before a transaction.