# Evaluaciones Sarelly (evals-webapp)

Self-service replacement for the `evals-h224` Excel/email peer-evaluation
pipeline. Evaluators log in with Google and fill out an online form instead
of emailing Excel files back and forth; the admin manages assignments and
generates the final `.xlsx` retro files from the database.

Stack: React + Vite + TypeScript + shadcn/ui + Tailwind, Supabase (Postgres +
Auth + Storage + Edge Functions). Live at https://evals-webapp.vercel.app.

**Account-level setup (Supabase project, Google OAuth, admin bootstrap,
Vercel deploy) is already done.** This file is mainly a runbook for running
future cycles — see below. If you ever need to rebuild this from scratch
(new environment, disaster recovery), the one-time setup steps are at the
bottom.

## Running a cycle

There are two cycle types, and the difference matters for exactly one
checkbox when you create the cycle:

- **Mid-year**: self + manager evaluations only (driven by `mandatory.csv`).
- **Year-end**: mandatory pairs *plus* the optimizer assigns optional peer
  evaluations on top, so everyone ends up with 3-4 evaluations minimum
  (driven by `matrix.csv`).

### 1. Update the roster/eligibility data

Edit the CSVs in `data/` (this folder is gitignored — it has real names and
emails, never committed):

- `data/directory.csv` — add/remove people (name, email). This is the
  master roster; anyone not in here can't log in and see assignments.
- `data/mandatory.csv` — the self+manager matrix. Update if the org chart
  changed (new manager, new hire, someone left).
- `data/matrix.csv` — the broader peer-eligibility matrix. **Only matters
  for year-end cycles** — you can leave it stale between mid-year cycles,
  but double-check it's current before running a year-end cycle, since it
  won't have been touched during the mid-year edits above.

### 2. Import

From `hr/evals-webapp` (with `.env` in place, it picks up your Supabase
credentials automatically):

```bash
npm run import-legacy-csv -- data
```

This is idempotent — safe to re-run any time after editing the CSVs, even
mid-cycle. It upserts `people` and `eligible_pairs`; it never touches
`assignments` or evaluation data. Read the printed report for any names
that didn't match between the CSVs (typos) before trusting the import.

### 3. Create and generate the cycle

On `/admin`:

1. "Crear nuevo ciclo" — name, slug, start/end dates.
2. Check **"Ciclo de fin de año"** only for a year-end cycle. Leave it
   unchecked for mid-year.
3. "Generar asignaciones". For a year-end cycle, review any warnings about
   people under the minimum before proceeding.
4. "Abrir ciclo" once you're happy with the assignments.

**Re-running "Generar asignaciones" is safe at any point** (e.g. you just
imported a new hire mid-cycle and want them assigned) — it only
deletes/regenerates assignments nobody has touched yet (`status = pending`).
Anything already in progress or submitted is left alone.

### 4. Notify people

No automated email yet — this is still manual. Share
https://evals-webapp.vercel.app with the team however you normally would
(Slack, email, etc.).

### 5. Monitor progress

The "Estado de finalización" table on `/admin` shows submitted/total per
person, given and received, updated live as people work through their
forms.

### 6. Close and export

1. "Cerrar ciclo" once the deadline's passed (or you're otherwise ready).
2. "Generar archivos retro" — this regenerates the `.xlsx` for every person
   with assignments in the cycle. Download links appear directly under the
   button once it finishes (valid for 7 days — re-run the export to get
   fresh links if they expire).

## Admin access for someone new

If you ever need to make someone else an admin (e.g. delegate to another
manager), after they've logged in once:

```sql
insert into admin_users (person_id)
select id from people where email = 'their-email@sarellysarelly.com';
```

Run via the Supabase SQL editor.

## Local dev

```bash
npm install
npm run dev   # http://localhost:8080, reads .env
```

Deploys to Vercel automatically on push to `main`.

## What's intentionally not migrated

`extracted_data*.json` and the `retro_h1_2025`/`retro_h2_2025` output
directories in the old `evals-h224` repo are left untouched as read-only
historical archive — this system started fresh from the H1 2026 cycle.

---

## One-time setup (already done — reference only, for rebuilding elsewhere)

1. **Create a new Supabase project** (dashboard.supabase.com), separate
   from `vacation-panda-tracker`'s.
2. **Set up Google OAuth** for Supabase Auth: OAuth client in Google Cloud
   Console (Internal user type if under the Workspace org, so login is
   auto-restricted to `@sarellysarelly.com`), redirect URI
   `https://<project-ref>.supabase.co/auth/v1/callback`, paste client
   ID/secret into Supabase Authentication → Providers → Google.
3. **`.env`**: copy `.env.example`, fill in `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` (publishable key), `VITE_SUPABASE_SERVICE_ROLE_KEY`
   (secret key). Never commit this.
4. **Push the schema**:
   ```bash
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
5. **Bootstrap the first admin** — log in once via the running app so a
   `people` row gets `auth_user_id` bound, then run the SQL from "Admin
   access for someone new" above with your own email.
6. **Storage buckets**: create `templates` and `retros` (both private).
   Upload `Retro File Template.xlsx` into `templates/` at the root — the
   export function looks it up by that exact path. If the template is ever
   redesigned, re-verify the row-offset comments at the top of
   `supabase/functions/generate-export/index.ts` against the new file
   before trusting the export.
7. **Import the roster** — see "Running a cycle" step 2 above.
8. **Deploy the edge function**:
   ```bash
   npx supabase functions deploy generate-export
   ```
9. **Deploy to Vercel**: connect the GitHub repo, set `VITE_SUPABASE_URL`
   and `VITE_SUPABASE_ANON_KEY` as env vars (**not** the service role key —
   that must never reach the deployed frontend bundle). Then in Supabase
   dashboard → Authentication → URL Configuration, set the production
   **Site URL** and add `<your-domain>/auth/callback` to **Redirect URLs**.

### Local Supabase dev (optional, needs Docker)

```bash
npx supabase start     # spins up local Postgres/Auth/Storage in Docker
npx supabase db reset  # applies supabase/migrations/ from scratch
```

Wasn't available in the environment this was originally built in (no
Docker) — the `generate_assignments()` function and the export edge
function were instead verified directly against the live project.
