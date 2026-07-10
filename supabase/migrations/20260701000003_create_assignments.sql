-- Self-evaluations are ordinary assignment rows where evaluator_id = evaluatee_id
-- (confirmed against final_assignments.csv: 35 of 134 rows are self-pairs),
-- so no separate self_evaluations table is needed.
create table assignments (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references cycles(id) on delete cascade,
  evaluator_id uuid not null references people(id),
  evaluatee_id uuid not null references people(id),
  is_self_eval boolean generated always as (evaluator_id = evaluatee_id) stored,
  is_mandatory boolean not null default false,
  source text not null default 'generated'
    check (source in ('generated', 'mandatory', 'manual')),
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (cycle_id, evaluator_id, evaluatee_id)
);

create index assignments_cycle_evaluator_idx on assignments (cycle_id, evaluator_id);
create index assignments_cycle_evaluatee_idx on assignments (cycle_id, evaluatee_id);

-- Category catalog: the 4 rated categories are fully data-driven (key, label,
-- display order) so the Excel exporter never hardcodes magic row numbers the
-- way the old processFiles.py/outputFiles.py pair did.
--
-- NOTE: "growth_plan" (row 42 in Retro File Template.xlsx, "Plan de
-- desarrollo") is a single free-text field with NO rating/wins/areas — it is
-- intentionally not a row in this table, and is instead a plain column on
-- evaluation_extras. Likewise "other_comments" (rows 48-53) is a column on
-- evaluation_extras, not a category row.
create table categories (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label_es text not null,
  display_order int not null,
  max_wins int not null default 3,
  max_areas int not null default 3
);

insert into categories (key, label_es, display_order, max_wins, max_areas) values
  ('work_understanding', 'Comprensión del trabajo', 1, 3, 3),
  -- NOTE: this key is "business_impact" in the new schema even though the old
  -- Python code called it "work_skills" -- the on-sheet label ("Resultados /
  -- Impacto en el negocio") never matched that variable name. Confirm the
  -- rename doesn't need reverting before the first real cycle goes live.
  ('business_impact', 'Resultados / Impacto en el negocio', 2, 3, 3),
  ('personal_skills', 'Habilidades personales', 3, 3, 3),
  ('dedication', 'Compromiso', 4, 3, 3);

create table evaluation_responses (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references assignments(id) on delete cascade,
  category_id uuid not null references categories(id),
  rating smallint check (rating between 1 and 6),
  wins text[] not null default '{}',
  areas_of_opportunity text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, category_id)
);

create trigger evaluation_responses_set_updated_at
  before update on evaluation_responses
  for each row execute function set_updated_at();

create table evaluation_extras (
  assignment_id uuid primary key references assignments(id) on delete cascade,
  growth_plan text,
  other_comments text,
  is_draft boolean not null default true,
  updated_at timestamptz not null default now()
);

create trigger evaluation_extras_set_updated_at
  before update on evaluation_extras
  for each row execute function set_updated_at();

create table admin_users (
  person_id uuid primary key references people(id) on delete cascade,
  created_at timestamptz not null default now()
);
