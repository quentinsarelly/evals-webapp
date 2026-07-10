-- Powers the admin CompletionDashboard without recomputing aggregates
-- client-side. Self-evaluations count toward both "given" and "received"
-- for that person, since the person is both evaluator and evaluatee.
--
-- Given/received are aggregated in separate subqueries before joining --
-- joining two one-to-many assignment sets directly in one query would fan
-- out (cartesian-multiply) the row counts.
create view cycle_completion as
with given as (
  select cycle_id, evaluator_id as person_id,
    count(*) as assignments_given,
    count(*) filter (where status = 'submitted') as assignments_given_submitted
  from assignments
  group by cycle_id, evaluator_id
),
received as (
  select cycle_id, evaluatee_id as person_id,
    count(*) as assignments_received,
    count(*) filter (where status = 'submitted') as assignments_received_submitted
  from assignments
  group by cycle_id, evaluatee_id
)
select
  c.id as cycle_id,
  p.id as person_id,
  p.full_name,
  coalesce(g.assignments_given, 0) as assignments_given,
  coalesce(g.assignments_given_submitted, 0) as assignments_given_submitted,
  coalesce(r.assignments_received, 0) as assignments_received,
  coalesce(r.assignments_received_submitted, 0) as assignments_received_submitted
from cycles c
cross join people p
left join given g on g.cycle_id = c.id and g.person_id = p.id
left join received r on r.cycle_id = c.id and r.person_id = p.id
where p.active;
