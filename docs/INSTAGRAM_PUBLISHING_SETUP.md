# Instagram publishing setup – MrSa Properties

This integration is intentionally admin-only and manual: create a draft from an approved listing, review it, approve it, then click Publish. It does not auto-publish or spend on advertising.

## 1. Apply the database migration

In Supabase Dashboard → SQL Editor, run:
`supabase/migrations/202611110001_instagram_publishing.sql`

The queue table is protected by RLS and the existing `public.is_admin()` function.

## 2. Configure Cloudflare Worker variables

Worker: `mrsa` → Settings → Variables and Secrets.

Required Worker bindings:
- Secret `INSTAGRAM_ACCESS_TOKEN`: the fresh token already stored by the owner.
- Variable `INSTAGRAM_ACCOUNT_ID`: `17841423033091291`.
- Variable `SUPABASE_URL`: the existing Supabase project URL (base URL only, no `/rest/v1`).
- Variable `SUPABASE_ANON_KEY`: the Supabase anon/public key (not service_role).
- Optional variable `INSTAGRAM_GRAPH_API_VERSION`: `v25.0` (default).

The browser's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are build-time variables; they are not automatically available to the Worker. Add the two Worker variables separately. Never add the Instagram token or Supabase service_role key to Vite variables or GitHub.

## 3. Image requirements

This first version publishes single-photo feed posts. Instagram fetches the image from its public HTTPS URL and this implementation checks that the response is JPEG. PNG/WebP images are rejected with an actionable error; upload a JPG/JPEG property photo and create a new draft.

## 4. Meta requirements and testing

The Instagram account must be a professional account, the app must retain the required publishing permission, and the token must remain valid and have access to the selected Instagram asset. Standard access is suitable for app-role/tester accounts; broader access may require Meta App Review. Check the Meta dashboard for any review/access requirements before production use.

## 5. Deploy and test

After the migration and Worker variables are set, merge this branch and deploy the Worker. Open `/admin/instagram` while signed in as an admin. Create a draft using an approved listing, approve it, and publish one test post. Verify the resulting Instagram post and permalink before using the feature regularly.

## API routes

- `GET /api/instagram/listings`
- `GET /api/instagram/posts`
- `POST /api/instagram/posts`
- `POST /api/instagram/posts/:id/approve`
- `POST /api/instagram/posts/:id/publish`

Every API route validates the Supabase user session and admin role server-side. The Instagram token is read only from the Cloudflare Worker secret binding.
