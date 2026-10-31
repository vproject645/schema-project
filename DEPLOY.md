# Deploy Schema on Cloudflare + Supabase + GitHub

Storage stays on Cloudflare (D1 + R2). Supabase handles sign-in.

## 1. Cloudflare resources (dashboard)
1. **Storage & Databases → D1 → Create** `schema-db`. Copy its **Database ID**.
2. Open it → **Console** → paste all of `deploy/schema.sql` → Execute.
3. **R2 → Create bucket** `schema-files`. (R2 needs a payment method on file; free tier is generous.)

## 2. Supabase (dashboard)
1. New project. **Settings → API**: copy **Project URL** and **anon public key**.
2. **Authentication → URL Configuration**: Site URL = your Worker URL (step 3), and add `https://YOUR-WORKER-URL/auth/callback` to Redirect URLs.
3. **Authentication → Sessions**: set JWT expiry to 604800 (7 days).

## 3. Connect GitHub to Cloudflare
**Workers & Pages → Create → Import a repository** → pick your repo.
- Build command: `npm ci && npm run build`
- Deploy command: `npx wrangler deploy`
- Build variables:
  `NODE_VERSION=22`, `WORKER_NAME=schema`, `D1_DATABASE_ID=<id from 1.1>`,
  `D1_DATABASE_NAME=schema-db`, `R2_BUCKET_NAME=schema-files`

## 4. Secrets (Worker → Settings → Variables and Secrets, type **Secret**)
| Name | Value |
| --- | --- |
| `MODEL_API_KEY` | your Meta key |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | anon public key |
| `ALLOWED_EMAILS` | your email(s), comma-separated (stops strangers spending your Meta credits) |

Use type Secret for all four so redeploys don't wipe them. Then redeploy.

## 5. Test
Open the Worker URL → "Sign in" → enter email → tap the emailed link.
