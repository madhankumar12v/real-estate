# Tamil Nadu Property Hub

A React + Vite real-estate marketplace starter for **property sales only** across Tamil Nadu.

## Included
- Responsive home page and approved property listings
- Search by keyword, district, property type, price range and bedrooms
- Supabase email/password registration and login
- Buyer / owner / agent account roles
- Property submission with up to 8 photos; new listings start as `pending`
- Owner dashboard and agent dashboard (same listing-management workflow)
- Admin dashboard to approve, reject or delete listings
- WhatsApp enquiry links
- Supabase PostgreSQL Row Level Security policies and public property-image bucket

## Stack and free-tier note
- Frontend: React + Vite
- Hosting: Cloudflare Pages
- Auth, database and image storage: Supabase
- Free tiers have quotas, fair-use terms and possible inactivity pauses. No provider promises unlimited lifetime free hosting. Check current plan terms before launch.
- This is an MVP starter, not a legally verified property portal. Add verification, privacy policy, terms, moderation, spam controls and backups before public commercial launch.

## 1. Create Supabase project
1. Create a project at https://supabase.com/
2. Open **SQL Editor**.
3. Run all SQL in `supabase/schema.sql`.
4. Go to **Project Settings → API** and copy Project URL and `anon` / publishable key.
5. In Authentication settings, configure your site URL and redirect URLs for local development and your deployed `*.pages.dev` URL.
6. Email confirmation may be enabled. Users need to confirm their email before signing in if enabled.

## 2. Run locally
Install Node.js LTS, then:

```bash
npm install
cp .env.example .env
```

Edit `.env` with your Supabase project URL and anon/publishable key. Set `VITE_WHATSAPP_DEFAULT` to your business WhatsApp number in international format without `+` (example: `919876543210`).

```bash
npm run dev
```

Open the local URL printed by Vite.

## 3. Make yourself admin
1. Register using the website with your intended administrator email.
2. In Supabase → SQL Editor, run (replace the email):

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL');
```

3. Sign out and sign in again. The Admin dashboard link will appear.

Never put the Supabase `service_role` secret in `.env` or frontend code. Only use the anon/publishable key in this Vite app.

## 4. Deploy free on Cloudflare Pages
1. Push this project to a GitHub repository.
2. In Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git.
3. Select the repository.
4. Build command: `npm run build`
5. Build output directory: `dist`
6. Add environment variables in Pages settings:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_WHATSAPP_DEFAULT`
7. Deploy. Your site receives a `your-project.pages.dev` address.
8. Add the deployed URL to Supabase Auth's allowed redirect URLs / Site URL.
9. Test registration, posting, approval, search, image upload and WhatsApp on the deployed URL.

## 5. Important production improvements
Before accepting real customers:
- Add CAPTCHA / rate limits and email verification to reduce spam.
- Validate and sanitize uploads; enforce size/type restrictions (SQL bucket limit is 5 MB per image).
- Add report listing, block user, audit log and moderation queue.
- Add privacy policy, terms, consent and grievance/contact process.
- Add verified-owner/agent checks and property-document review workflow.
- Consider image resizing, backups, monitoring and paid plans as traffic grows.
- Add pagination to property search for large inventories.
- WhatsApp number should be entered by the listing owner in international format, e.g. `919876543210`.

## Current MVP limitations
- Agent dashboard is a role-specific view of the user's own listings; no multi-agent brokerage/team management yet.
- No online payments, subscriptions, maps/geocoding, saved searches or chat inbox.
- Public listing photos are public by design. Do not upload identity documents, deeds or other confidential records.
- Admin approval is required before public display.
- Users can self-select buyer, owner or agent at signup; admin should verify agent claims before relying on them.
