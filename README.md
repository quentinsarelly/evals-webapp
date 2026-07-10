# Evaluaciones Sarelly (evals-webapp)

Self-service replacement for the `evals-h224` Excel/email peer-evaluation
pipeline. Evaluators log in with Google and fill out an online form instead
of emailing Excel files back and forth; the admin manages assignments and
generates the final `.xlsx` retro files from the database.

Stack: React + Vite + TypeScript + shadcn/ui + Tailwind, Supabase (Postgres +
Auth + Storage + Edge Functions), same pattern as the sibling
`sitio-web/vacation-panda-tracker` app.

## One-time setup (requires your own Supabase + Google Cloud accounts)

This repo has all the application code, SQL migrations, and the export
function already written. What's left is account-level setup that needs
your own credentials — nothing here can be done from a sandboxed dev
environment without them.

1. **Create a new Supabase project** (dashboard.supabase.com). Use a new
   project, not the one behind `vacation-panda-tracker` — evaluation data is
   more sensitive than vacation requests and should live in its own database.
2. **Set up Google OAuth** for Supabase Auth: create an OAuth client in
   Google Cloud Console restricted to your Workspace domain, then paste the
   client ID/secret into Supabase Auth providers (or into
   `supabase/config.toml`'s `env(GOOGLE_OAUTH_CLIENT_ID)` /
   `env(GOOGLE_OAUTH_CLIENT_SECRET)` if running the Supabase CLI locally).
3. **Copy `.env.example` to `.env`** and fill in `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, `VITE_SUPABASE_SERVICE_ROLE_KEY` from the new
   project's API settings. Never commit `.env`.
4. **Run the migrations** against the new project:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   This creates all tables, RLS policies, the `generate_assignments()`
   function, and the `cycle_completion` view, and seeds the 4 evaluation
   categories.
5. **Bootstrap yourself as admin.** After your first Google login (so a row
   exists in `people` with your `auth_user_id` bound — see step 7), insert
   yourself into `admin_users` via the Supabase SQL editor:
   ```sql
   insert into admin_users (person_id)
   select id from people where email = 'you@sarellysarelly.com';
   ```
6. **Create two Storage buckets**: `templates` and `retros` (private, not
   public). Upload the existing `Retro File Template.xlsx` from the old
   `evals-h224` repo into the `templates` bucket at the root — the export
   function downloads it from there on every run, so re-verify its row
   layout (see the comment at the top of
   `supabase/functions/generate-export/index.ts`) if the template is ever
   redesigned.
7. **Import the legacy roster and eligibility rules** so you don't have to
   re-key 35 people and ~150 eligibility pairs by hand:
   ```bash
   npm install
   VITE_SUPABASE_URL=... VITE_SUPABASE_SERVICE_ROLE_KEY=... \
     npm run import-legacy-csv -- /path/to/evals-h224
   ```
   Review the printed validation report for any names that didn't match —
   the old CSVs rely on exact string matches.
8. **Deploy the export edge function**:
   ```bash
   npx supabase functions deploy generate-export
   ```
9. **Run locally**: `npm run dev` (http://localhost:8080). **Deploy**:
   connect the repo to Vercel (same pattern as `vacation-panda-tracker`,
   `vercel.json` is already present) and set the three `VITE_*` env vars
   there too (the service role key only needs to be available to the CSV
   import script, run locally — do not expose it to the deployed frontend
   build).

## Local Supabase dev (optional, needs Docker)

```bash
npx supabase start   # spins up local Postgres/Auth/Storage in Docker
npx supabase db reset  # applies supabase/migrations/ from scratch
```

Useful for testing `generate_assignments()` and the export function against
real imported CSV data before touching the production project. This
environment didn't have Docker available, so this step has not been run yet
— do it before the first real cycle to catch anything migration-order
related.

## Verifying the export function

Since `Retro File Template.xlsx`'s row layout was only verified once (see
the plan's grounding notes), after deploying: run a self-eval + 3 peer evals
through the form with distinctive test strings, trigger an export from the
admin dashboard, and open the resulting file side-by-side with a real file
from `evals-h224/retro_h2_2025/` to confirm wrap-text, merged cells, bullet
formatting, and the 1-decimal rating average all match.

## What's intentionally not migrated

`extracted_data*.json` and the `retro_h1_2025`/`retro_h2_2025` output
directories in the old `evals-h224` repo are left untouched as read-only
historical archive — this system starts fresh from the next cycle.
