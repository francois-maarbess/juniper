-- Migration: Add university courses taxonomy & tutor availability slots
DO $$ BEGIN
  CREATE TYPE day_of_week AS ENUM ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS university_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  university text NOT NULL,
  code text NOT NULL,
  name text NOT NULL,
  department text,
  credits integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS university_courses_uni_code_unique ON university_courses (university, code);
CREATE INDEX IF NOT EXISTS university_courses_code_idx ON university_courses (code);
CREATE INDEX IF NOT EXISTS university_courses_uni_idx ON university_courses (university);

CREATE TABLE IF NOT EXISTS tutor_courses (
  tutor_id uuid NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES university_courses(id) ON DELETE CASCADE,
  PRIMARY KEY (tutor_id, course_id)
);

CREATE TABLE IF NOT EXISTS availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_id uuid NOT NULL REFERENCES tutor_profiles(user_id) ON DELETE CASCADE,
  day_of_week day_of_week NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS availability_slots_tutor_day_idx ON availability_slots (tutor_id, day_of_week);

-- Seed iconic Lebanese university courses
INSERT INTO university_courses (university, code, name, department, credits) VALUES
  ('AUB', 'MATH201', 'Calculus and Analytic Geometry III', 'Mathematics', 3),
  ('AUB', 'CMPS200', 'Introduction to Programming', 'Computer Science', 3),
  ('AUB', 'CMPS212', 'Intermediate Programming with Data Structures', 'Computer Science', 3),
  ('AUB', 'EECE210', 'Electric Circuits', 'Electrical and Computer Engineering', 3),
  ('AUB', 'PHYS210', 'Introductory Physics II', 'Physics', 3),
  ('AUB', 'STAT230', 'Introduction to Probability and Statistics', 'Mathematics', 3),
  ('AUB', 'CHEM201', 'Chemical Principles', 'Chemistry', 3),
  ('AUB', 'ECON211', 'Economic Principles: Microeconomics', 'Economics', 3),

  ('LAU', 'MTH201', 'Calculus III', 'Mathematics', 3),
  ('LAU', 'CSC245', 'Objects and Data Abstraction', 'Computer Science', 3),
  ('LAU', 'COE212', 'Engineering Electromagnetics', 'Electrical & Computer Engineering', 3),
  ('LAU', 'CHM201', 'Chemical Principles', 'Natural Sciences', 3),
  ('LAU', 'BIO201', 'General Biology I', 'Natural Sciences', 4),
  ('LAU', 'ACC203', 'Financial Accounting', 'Business', 3),

  ('CNAM', 'NFA031', 'Architecture et langages des ordinateurs', 'Informatique', 4),
  ('CNAM', 'NFA032', 'Développement Java et Programmation Objet', 'Informatique', 4),
  ('CNAM', 'SEC101', 'Cybersécurité et Réseaux', 'Informatique', 3),
  ('CNAM', 'MVA005', 'Calcul différentiel et intégral', 'Mathématiques', 6),
  ('CNAM', 'RSX101', 'Réseaux et Protocoles Internet', 'Télécoms & Réseaux', 4),

  ('LU', 'I1100', 'Introduction aux Algorithmes et Programmation', 'Computer Science', 5),
  ('LU', 'M1100', 'Analyse Mathématique I', 'Mathematics', 6),
  ('LU', 'M2100', 'Algèbre Linéaire et Géométrie', 'Mathematics', 5),
  ('LU', 'P1100', 'Mécanique Générale et Physique', 'Physics', 6),
  ('LU', 'I2200', 'Structures de Données et Algorithmique Avancée', 'Computer Science', 5),

  ('USJ', 'INFO101', 'Bases de la Programmation C/Python', 'Informatique', 3),
  ('USJ', 'MATH101', 'Algèbre et Analyse Fondamentale', 'Mathématiques', 4),
  ('USJ', 'GINF201', 'Algorithmique et Programmation Orientée Objet', 'Génie Informatique', 4),
  ('USJ', 'ELEC201', 'Théorie des Circuits et Électronique', 'Génie Électrique', 3)
ON CONFLICT (university, code) DO UPDATE SET
  name = EXCLUDED.name,
  department = EXCLUDED.department,
  credits = EXCLUDED.credits;
