create extension if not exists "pgcrypto";

create table people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  email text not null unique,
  manager_id uuid references people(id),
  team text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Legacy CSVs (matrix.csv, mandatory.csv, directory.csv) key people off exact
-- full-name string match; keep this unique during the CSV-import transition
-- period so import-legacy-csv.ts can upsert reliably.
create unique index people_full_name_idx on people (full_name);
create index people_manager_id_idx on people (manager_id);
create index people_auth_user_id_idx on people (auth_user_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger people_set_updated_at
  before update on people
  for each row execute function set_updated_at();
