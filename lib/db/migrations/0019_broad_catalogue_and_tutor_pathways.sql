ALTER TYPE tutor_document_category ADD VALUE IF NOT EXISTS 'enrollment_proof';

ALTER TABLE tutor_applications
  ADD COLUMN IF NOT EXISTS applicant_type text NOT NULL DEFAULT 'graduate';

ALTER TABLE tutor_profiles
  ADD COLUMN IF NOT EXISTS custom_subjects text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_courses text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_universities text[] NOT NULL DEFAULT '{}';

ALTER TABLE study_requests
  ADD COLUMN IF NOT EXISTS custom_subject text,
  ADD COLUMN IF NOT EXISTS custom_course text,
  ADD COLUMN IF NOT EXISTS university text;

CREATE INDEX IF NOT EXISTS tutor_profiles_custom_subjects_gin_idx
  ON tutor_profiles USING gin (custom_subjects);

INSERT INTO subjects (name, slug, category) VALUES
  ('Spanish', 'spanish', 'Languages'),
  ('German', 'german', 'Languages'),
  ('Mandarin Chinese', 'mandarin-chinese', 'Languages'),
  ('Japanese', 'japanese', 'Languages'),
  ('Korean', 'korean', 'Languages'),
  ('Italian', 'italian', 'Languages'),
  ('Portuguese', 'portuguese', 'Languages'),
  ('Turkish', 'turkish', 'Languages'),
  ('Russian', 'russian', 'Languages'),
  ('Persian', 'persian', 'Languages'),
  ('Hindi', 'hindi', 'Languages'),
  ('Urdu', 'urdu', 'Languages'),
  ('Greek', 'greek', 'Languages'),
  ('Swahili', 'swahili', 'Languages'),
  ('English as a second language', 'english-second-language', 'Languages'),
  ('Sign languages', 'sign-languages', 'Languages'),
  ('Public health', 'public-health', 'Health sciences'),
  ('Dentistry', 'dentistry', 'Health sciences'),
  ('Veterinary medicine', 'veterinary-medicine', 'Health sciences'),
  ('Nutrition', 'nutrition', 'Health sciences'),
  ('Environmental science', 'environmental-science', 'STEM'),
  ('Agriculture', 'agriculture', 'STEM'),
  ('Information technology', 'information-technology', 'STEM'),
  ('Philosophy', 'philosophy', 'Humanities'),
  ('Geography', 'geography', 'Social sciences'),
  ('Anthropology', 'anthropology', 'Social sciences'),
  ('Media and communications', 'media-communications', 'Humanities')
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name, category = EXCLUDED.category, active = true;
