-- Fixes a real data-loss bug: `generate_assignments()` previously deleted
-- ALL non-manual assignments for a cycle on every call, regardless of
-- status. Re-running "Generar asignaciones" after evaluators had already
-- started (in_progress) or finished (submitted) their forms would cascade-
-- delete their real evaluation_responses/evaluation_extras rows along with
-- the assignment row. Admins need to be able to re-run generation mid-cycle
-- (e.g. a new hire was just imported and needs assignments too) without
-- destroying work already in progress.
--
-- Fix: only ever delete+regenerate 'pending' (untouched) non-manual
-- assignments. in_progress/submitted/manual rows are left alone. The
-- optimizer pass's running received/given counters are seeded from those
-- surviving rows first, so it doesn't over-assign people who already have
-- enough evaluations counted from before.
create or replace function generate_assignments(p_cycle_id uuid)
returns table(warning_person_id uuid, warning_full_name text, warning_count int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_min int;
  v_max int;
  v_include_optional boolean;
  v_evaluatee uuid;
  v_evaluator uuid;
  v_received int;
  v_given int;
begin
  if not is_admin() then
    raise exception 'only admins may generate assignments';
  end if;

  select min_evaluations_received, max_evaluations_given, include_optional_peers
    into v_min, v_max, v_include_optional
    from cycles where id = p_cycle_id;

  if v_min is null then
    raise exception 'cycle % not found', p_cycle_id;
  end if;

  -- Only untouched assignments are safe to wipe and regenerate.
  delete from assignments
  where cycle_id = p_cycle_id and source <> 'manual' and status = 'pending';

  -- Pass 1: mandatory -- always runs, every cycle type includes this.
  -- ON CONFLICT DO NOTHING means already-existing (preserved) mandatory
  -- pairs are simply left as-is.
  insert into assignments (cycle_id, evaluator_id, evaluatee_id, is_mandatory, source, status)
  select p_cycle_id, evaluator_id, evaluatee_id, true, 'mandatory', 'pending'
  from eligible_pairs
  where is_mandatory = true
  on conflict (cycle_id, evaluator_id, evaluatee_id) do nothing;

  -- Pass 2: greedy optimizer over optional peer pairs -- only for cycles
  -- that opt in (year-end).
  if v_include_optional then
    create temporary table tmp_received (person_id uuid primary key, cnt int not null default 0)
      on commit drop;
    create temporary table tmp_given (person_id uuid primary key, cnt int not null default 0)
      on commit drop;

    -- Seed counters from assignments that survived the delete above (i.e.
    -- anything already in_progress/submitted from a prior run), so the
    -- optimizer doesn't pile on extra evaluators for people who already
    -- have enough.
    insert into tmp_received (person_id, cnt)
    select evaluatee_id, count(*) from assignments
    where cycle_id = p_cycle_id and is_mandatory = false
    group by evaluatee_id;

    insert into tmp_given (person_id, cnt)
    select evaluator_id, count(*) from assignments
    where cycle_id = p_cycle_id and is_mandatory = false
    group by evaluator_id;

    for v_evaluatee in
      select distinct evaluatee_id from eligible_pairs where is_mandatory = false
    loop
      for v_evaluator in
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

        -- Skip pairs that already exist (preserved from before the delete) --
        -- their counts are already reflected in the seeded tmp_received.
        if coalesce(v_given, 0) < v_max
          and not exists (
            select 1 from assignments
            where cycle_id = p_cycle_id and evaluator_id = v_evaluator and evaluatee_id = v_evaluatee
          )
        then
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
  end if;

  update cycles set status = 'assignments_generated' where id = p_cycle_id and status = 'draft';

  if v_include_optional then
    return query
      select p.id, p.full_name, count(a.id)::int
      from people p
      left join assignments a
        on a.evaluatee_id = p.id and a.cycle_id = p_cycle_id
      where p.active
      group by p.id, p.full_name
      having count(a.id) < v_min
      order by count(a.id) asc, p.full_name;
  end if;
end;
$$;
