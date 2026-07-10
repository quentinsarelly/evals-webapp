alter table people enable row level security;
alter table eligible_pairs enable row level security;
alter table cycles enable row level security;
alter table assignments enable row level security;
alter table categories enable row level security;
alter table evaluation_responses enable row level security;
alter table evaluation_extras enable row level security;
alter table admin_users enable row level security;

create or replace function is_admin() returns boolean as $$
  select exists (
    select 1 from admin_users au
    join people p on p.id = au.person_id
    where p.auth_user_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create or replace function current_person_id() returns uuid as $$
  select id from people where auth_user_id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- categories / cycles: readable by all authenticated, writable only by admin
create policy "categories readable" on categories
  for select to authenticated using (true);
create policy "categories admin write" on categories
  for all to authenticated using (is_admin()) with check (is_admin());

create policy "cycles readable" on cycles
  for select to authenticated using (true);
create policy "cycles admin write" on cycles
  for all to authenticated using (is_admin()) with check (is_admin());

-- people: everyone can read (needed to show evaluatee names in the form and
-- lists); only admin can create/update/delete
create policy "people readable" on people
  for select to authenticated using (true);
create policy "people admin write" on people
  for insert to authenticated with check (is_admin());
create policy "people admin update" on people
  for update to authenticated using (is_admin()) with check (is_admin());
create policy "people admin delete" on people
  for delete to authenticated using (is_admin());
-- exception: the binding-on-first-login step in person-service.ts needs to
-- set auth_user_id on the caller's own row before is_admin() can resolve
create policy "people self bind auth_user_id" on people
  for update to authenticated
  using (auth_user_id is null and email = auth.jwt() ->> 'email')
  with check (auth_user_id = auth.uid());

-- eligible_pairs, admin_users: admin-only
create policy "eligible_pairs admin only" on eligible_pairs
  for all to authenticated using (is_admin()) with check (is_admin());
create policy "admin_users admin only" on admin_users
  for all to authenticated using (is_admin()) with check (is_admin());

-- assignments: an evaluator sees/updates only their own rows; admin sees/edits all
create policy "assignments own or admin select" on assignments
  for select to authenticated
  using (evaluator_id = current_person_id() or is_admin());
create policy "assignments admin insert" on assignments
  for insert to authenticated with check (is_admin());
create policy "assignments admin delete" on assignments
  for delete to authenticated using (is_admin());
-- evaluators may only flip status pending->in_progress->submitted on their
-- own rows (enforced in the app layer); admin can do anything, including
-- "unsubmit" to reopen a mistaken submission
create policy "assignments own update or admin" on assignments
  for update to authenticated
  using (evaluator_id = current_person_id() or is_admin())
  with check (evaluator_id = current_person_id() or is_admin());

-- evaluation_responses / evaluation_extras: writable by the assignment's
-- evaluator only while not yet submitted; readable by that evaluator or
-- admin -- NEVER by the evaluatee being evaluated, so peer feedback stays
-- confidential until the admin generates the combined export.
create policy "responses own select" on evaluation_responses
  for select to authenticated
  using (
    is_admin() or exists (
      select 1 from assignments a
      where a.id = evaluation_responses.assignment_id
        and a.evaluator_id = current_person_id()
    )
  );
create policy "responses own write while not submitted" on evaluation_responses
  for insert to authenticated
  with check (
    is_admin() or exists (
      select 1 from assignments a
      where a.id = evaluation_responses.assignment_id
        and a.evaluator_id = current_person_id()
        and a.status <> 'submitted'
    )
  );
create policy "responses own update while not submitted" on evaluation_responses
  for update to authenticated
  using (
    is_admin() or exists (
      select 1 from assignments a
      where a.id = evaluation_responses.assignment_id
        and a.evaluator_id = current_person_id()
        and a.status <> 'submitted'
    )
  )
  with check (
    is_admin() or exists (
      select 1 from assignments a
      where a.id = evaluation_responses.assignment_id
        and a.evaluator_id = current_person_id()
    )
  );
create policy "responses admin delete" on evaluation_responses
  for delete to authenticated using (is_admin());

create policy "extras own select" on evaluation_extras
  for select to authenticated
  using (
    is_admin() or exists (
      select 1 from assignments a
      where a.id = evaluation_extras.assignment_id
        and a.evaluator_id = current_person_id()
    )
  );
create policy "extras own write while not submitted" on evaluation_extras
  for insert to authenticated
  with check (
    is_admin() or exists (
      select 1 from assignments a
      where a.id = evaluation_extras.assignment_id
        and a.evaluator_id = current_person_id()
        and a.status <> 'submitted'
    )
  );
create policy "extras own update while not submitted" on evaluation_extras
  for update to authenticated
  using (
    is_admin() or exists (
      select 1 from assignments a
      where a.id = evaluation_extras.assignment_id
        and a.evaluator_id = current_person_id()
        and a.status <> 'submitted'
    )
  )
  with check (
    is_admin() or exists (
      select 1 from assignments a
      where a.id = evaluation_extras.assignment_id
        and a.evaluator_id = current_person_id()
    )
  );
