-- Ports main.py's three functions into one in-database, admin-triggered,
-- re-runnable operation:
--   optimize_evaluations()        -> the greedy pass below
--   process_mandatory_evaluations() -> the mandatory pass below
--   combine_assignments()         -> the ON CONFLICT DO NOTHING unique index
--
-- IMPORTANT fidelity note verified against the real matrix.csv/mandatory.csv:
-- of 70 mandatory pairs, only 1 was also marked eligible ("X") in matrix.csv.
-- The two source files are effectively disjoint pools, and the original
-- Python passes run fully independently (the optimizer's evaluations_received
-- counter does NOT know about evaluations a person already got from the
-- mandatory pass). This function replicates that independence deliberately:
-- the greedy pass only ever considers eligible_pairs where is_mandatory =
-- false, and its received/given counters start at zero regardless of what
-- the mandatory pass already inserted.
create or replace function generate_assignments(p_cycle_id uuid)
returns table(warning_person_id uuid, warning_full_name text, warning_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min int;
  v_max int;
  v_evaluatee uuid;
  v_evaluator uuid;
  v_received int;
  v_given int;
begin
  -- This function is security definer (it needs to write across every
  -- person's assignments, which RLS otherwise forbids for non-admins) --
  -- so it MUST enforce the admin check itself; without this, any
  -- authenticated caller invoking supabase.rpc('generate_assignments', ...)
  -- would run with elevated privileges regardless of their own role.
  if not is_admin() then
    raise exception 'only admins may generate assignments';
  end if;

  select min_evaluations_received, max_evaluations_given
    into v_min, v_max
    from cycles where id = p_cycle_id;

  if v_min is null then
    raise exception 'cycle % not found', p_cycle_id;
  end if;

  -- Re-runnable: wipe any previously generated/mandatory assignments for this
  -- cycle but preserve admin-added manual ones (source = 'manual').
  delete from assignments where cycle_id = p_cycle_id and source <> 'manual';

  -- Pass 1: mandatory (process_mandatory_evaluations equivalent) -- no cap,
  -- every mandatory pair becomes an assignment.
  insert into assignments (cycle_id, evaluator_id, evaluatee_id, is_mandatory, source, status)
  select p_cycle_id, evaluator_id, evaluatee_id, true, 'mandatory', 'pending'
  from eligible_pairs
  where is_mandatory = true
  on conflict (cycle_id, evaluator_id, evaluatee_id) do nothing;

  -- Pass 2: greedy optimizer (optimize_evaluations equivalent), independent
  -- running counters, evaluating only non-mandatory eligible pairs.
  create temporary table tmp_received (person_id uuid primary key, cnt int not null default 0)
    on commit drop;
  create temporary table tmp_given (person_id uuid primary key, cnt int not null default 0)
    on commit drop;

  for v_evaluatee in
    select distinct evaluatee_id from eligible_pairs where is_mandatory = false
  loop
    for v_evaluator in
      -- sort ascending by how many people this evaluator is eligible to
      -- evaluate overall (matrix.loc[x].sum() in main.py) -- prioritizes
      -- assigning evaluators with fewer options first.
      select ep.evaluator_id
      from eligible_pairs ep
      where ep.evaluatee_id = v_evaluatee and ep.is_mandatory = false
      order by (
        select count(*) from eligible_pairs ep2
        where ep2.evaluator_id = ep.evaluator_id and ep2.is_mandatory = false
      ) asc
    loop
      select coalesce(cnt, 0) into v_received from tmp_received where person_id = v_evaluatee;
      select coalesce(cnt, 0) into v_given from tmp_given where person_id = v_evaluator;

      exit when coalesce(v_received, 0) >= v_min;

      if coalesce(v_given, 0) < v_max then
        insert into assignments (cycle_id, evaluator_id, evaluatee_id, is_mandatory, source, status)
        values (p_cycle_id, v_evaluator, v_evaluatee, false, 'generated', 'pending')
        on conflict (cycle_id, evaluator_id, evaluatee_id) do nothing;

        insert into tmp_received (person_id, cnt) values (v_evaluatee, 1)
          on conflict (person_id) do update set cnt = tmp_received.cnt + 1;
        insert into tmp_given (person_id, cnt) values (v_evaluator, 1)
          on conflict (person_id) do update set cnt = tmp_given.cnt + 1;
      end if;
    end loop;
  end loop;

  update cycles set status = 'assignments_generated' where id = p_cycle_id and status = 'draft';

  -- Warnings: people (in the eligible_pairs universe) who still ended up
  -- below the minimum, counting mandatory + generated together, mirroring
  -- main.py's printed "Warning - People who will receive fewer than N" report.
  return query
    select p.id, p.full_name, count(a.id)::int
    from people p
    left join assignments a
      on a.evaluatee_id = p.id and a.cycle_id = p_cycle_id
    where p.active
    group by p.id, p.full_name
    having count(a.id) < v_min
    order by count(a.id) asc, p.full_name;
end;
$$;
