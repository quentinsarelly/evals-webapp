create table cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- e.g. 'H1 2026', 'H2 2026', 'FY 2026'
  slug text not null unique,          -- e.g. 'h1-2026' (replaces ad hoc h1_25/h2_25 naming)
  period_start date not null,
  period_end date not null,
  min_evaluations_received int not null default 3,
  max_evaluations_given int not null default 2,
  status text not null default 'draft'
    check (status in ('draft', 'assignments_generated', 'open', 'closed', 'exported')),
  response_deadline date,
  created_at timestamptz not null default now()
);
