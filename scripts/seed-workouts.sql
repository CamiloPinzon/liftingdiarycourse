-- Sample workout history for local development.
-- Insert-only: adds a few exercises (skipped if they exist) and ~10 workouts with sets.
-- Change the Clerk user id in the `u` CTE to seed a different account.
-- Dates are spread so every dashboard preset (7d / 30d / 90d / year / all) shows different results.
with u as (select 'user_3M7Eh5st1B7kKKrvWCHMEnd2xCa'::text as uid),
new_ex as (
  insert into exercises (user_id, name, muscle_group)
  select uid, n, m from u, (values
    ('Incline Dumbbell Press', 'Chest'),
    ('Dip', 'Chest'),
    ('Romanian Deadlift', 'Legs'),
    ('Lateral Raise', 'Shoulders'),
    ('Barbell Curl', 'Arms')
  ) v(n, m)
  on conflict do nothing
  returning id, name
),
ex as (
  select id, name from new_ex
  union all
  select id, name from exercises where user_id = (select uid from u)
),
wk(wname, day, notes) as (values
  ('Push Day',       '2026-11-03 17:00+00', 'Bench felt smooth'),
  ('Pull Day',       '2026-11-05 17:00+00', null),
  ('Leg Day',        '2026-11-07 16:30+00', 'Short on time'),
  ('Upper Body',     '2026-10-20 18:00+00', 'Back after a week off'),
  ('Push Day',       '2026-10-01 17:00+00', null),
  ('Leg Day',        '2026-09-10 16:30+00', 'New squat PR'),
  ('Pull Day',       '2026-08-25 17:00+00', null),
  ('Push Day',       '2026-07-15 17:00+00', 'Shoulder a bit tight'),
  ('Full Body',      '2026-03-03 07:00+00', 'Early morning session'),
  ('Push Day',       '2025-12-10 17:00+00', 'First logged workout')
),
plan(wname, day, pos, ename, nsets, reps, kg) as (values
  ('Push Day',   '2026-11-03 17:00+00', 1, 'Barbell Bench Press',    4, 6,  90),
  ('Push Day',   '2026-11-03 17:00+00', 2, 'Incline Dumbbell Press', 3, 10, 30),
  ('Push Day',   '2026-11-03 17:00+00', 3, 'Lateral Raise',          3, 15, 10),
  ('Pull Day',   '2026-11-05 17:00+00', 1, 'Deadlift',               3, 5,  150),
  ('Pull Day',   '2026-11-05 17:00+00', 2, 'Pull-Up',                3, 8,  0),
  ('Pull Day',   '2026-11-05 17:00+00', 3, 'Barbell Curl',           3, 12, 30),
  ('Leg Day',    '2026-11-07 16:30+00', 1, 'Barbell Back Squat',     4, 6,  120),
  ('Leg Day',    '2026-11-07 16:30+00', 2, 'Romanian Deadlift',      3, 10, 90),
  ('Upper Body', '2026-10-20 18:00+00', 1, 'Overhead Press',         3, 8,  50),
  ('Upper Body', '2026-10-20 18:00+00', 2, 'Barbell Row',            3, 10, 70),
  ('Upper Body', '2026-10-20 18:00+00', 3, 'Dip',                    3, 12, 0),
  ('Push Day',   '2026-10-01 17:00+00', 1, 'Barbell Bench Press',    4, 6,  85),
  ('Push Day',   '2026-10-01 17:00+00', 2, 'Overhead Press',         3, 8,  47.5),
  ('Leg Day',    '2026-09-10 16:30+00', 1, 'Barbell Back Squat',     5, 5,  125),
  ('Leg Day',    '2026-09-10 16:30+00', 2, 'Romanian Deadlift',      3, 10, 85),
  ('Pull Day',   '2026-08-25 17:00+00', 1, 'Barbell Row',            4, 8,  65),
  ('Pull Day',   '2026-08-25 17:00+00', 2, 'Pull-Up',                3, 6,  0),
  ('Push Day',   '2026-07-15 17:00+00', 1, 'Barbell Bench Press',    4, 6,  80),
  ('Push Day',   '2026-07-15 17:00+00', 2, 'Dip',                    3, 10, 0),
  ('Full Body',  '2026-03-03 07:00+00', 1, 'Barbell Back Squat',     3, 8,  100),
  ('Full Body',  '2026-03-03 07:00+00', 2, 'Barbell Bench Press',    3, 8,  70),
  ('Full Body',  '2026-03-03 07:00+00', 3, 'Barbell Row',            3, 8,  60),
  ('Push Day',   '2025-12-10 17:00+00', 1, 'Barbell Bench Press',    3, 8,  60),
  ('Push Day',   '2025-12-10 17:00+00', 2, 'Overhead Press',         3, 8,  35)
),
w as (
  insert into workouts (user_id, name, started_at, ended_at, notes)
  select (select uid from u), wname, day::timestamptz, day::timestamptz + interval '75 minutes', notes
  from wk
  returning id, name, started_at
),
we as (
  insert into workout_exercises (workout_id, exercise_id, position)
  select w.id, ex.id, p.pos
  from plan p
  join w on w.name = p.wname and w.started_at = p.day::timestamptz
  join ex on ex.name = p.ename
  returning id, workout_id, position
),
s as (
  insert into sets (workout_exercise_id, set_number, reps, weight, weight_unit)
  select we.id, g, p.reps, p.kg, 'kg'
  from we
  join w on w.id = we.workout_id
  join plan p on p.wname = w.name and p.day::timestamptz = w.started_at and p.pos = we.position
  cross join generate_series(1, p.nsets) g
  returning 1
)
select (select count(*) from w) as workouts,
       (select count(*) from we) as workout_exercises,
       (select count(*) from s) as sets;
