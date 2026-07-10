-- The company runs two cycle types: mid-year (self + manager evaluations
-- only, driven entirely by mandatory.csv/eligible_pairs.is_mandatory=true)
-- and year-end (mandatory pairs PLUS the greedy optimizer over optional
-- peer pairs from matrix.csv, so everyone gets 3-4 evaluations minimum).
--
-- eligible_pairs is a standing table, not scoped per cycle, so once
-- matrix.csv-derived (is_mandatory = false) rows exist for a year-end
-- cycle, they would otherwise still be picked up by the optimizer pass the
-- next time a mid-year cycle runs generate_assignments(). This flag makes
-- that explicit per cycle instead of relying on eligible_pairs happening to
-- be empty of optional pairs at the right time.
alter table cycles
  add column include_optional_peers boolean not null default false;

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

  delete from assignments where cycle_id = p_cycle_id and source <> 'manual';

  -- Pass 1: mandatory -- always runs, every cycle type includes this.
  insert into assignments (cycle_id, evaluator_id, evaluatee_id, is_mandatory, source, status)
  select p_cycle_id, evaluator_id, evaluatee_id, true, 'mandatory', 'pending'
  from eligible_pairs
  where is_mandatory = true
  on conflict (cycle_id, evaluator_id, evaluatee_id) do nothing;

  -- Pass 2: greedy optimizer over optional peer pairs -- only for cycles
  -- that opt in (year-end). Mid-year cycles skip this entirely, regardless
  -- of what optional (is_mandatory = false) rows happen to already be
  -- sitting in eligible_pairs from a previous year-end import.
  if v_include_optional then
    create temporary table tmp_received (person_id uuid primary key, cnt int not null default 0)
      on commit drop;
    create temporary table tmp_given (person_id uuid primary key, cnt int not null default 0)
      on commit drop;

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
  end if;

  update cycles set status = 'assignments_generated' where id = p_cycle_id and status = 'draft';

  -- min_evaluations_received is a year-end concept (the optimizer's target).
  -- A mandatory-only mid-year cycle intentionally gives everyone just
  -- self + manager, so skip this warning entirely rather than flagging
  -- every single person as "under the minimum".
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
