ALTER TABLE tutor_profiles ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC';

-- Convert the original weekday selections into the shared study windows learners can request.
UPDATE tutor_profiles
SET availability = array_remove(ARRAY[
  CASE WHEN availability && ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri']::text[] THEN 'Weekday mornings' END,
  CASE WHEN availability && ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri']::text[] THEN 'Weekday evenings' END,
  CASE WHEN availability && ARRAY['Sat', 'Sun']::text[] THEN 'Weekend' END
]::text[], NULL)
WHERE availability && ARRAY['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']::text[];
