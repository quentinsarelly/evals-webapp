-- Replaces matrix.csv (X = eligible pair) and mandatory.csv (1 = required pair)
-- as relational rows instead of a hand-edited NxN matrix.
create table eligible_pairs (
  id uuid primary key default gen_random_uuid(),
  evaluator_id uuid not null references people(id) on delete cascade,
  evaluatee_id uuid not null references people(id) on delete cascade,
  is_mandatory boolean not null default false,
  created_at timestamptz not null default now(),
  unique (evaluator_id, evaluatee_id)
);

create index eligible_pairs_evaluator_idx on eligible_pairs (evaluator_id);
create index eligible_pairs_evaluatee_idx on eligible_pairs (evaluatee_id);
