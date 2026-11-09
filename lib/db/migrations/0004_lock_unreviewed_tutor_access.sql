-- Older tutor accounts may have retained active_role='tutor' even though
-- migration 0003 moved their profiles back into document review.
UPDATE users u
SET active_role = 'student', updated_at = now()
FROM tutor_applications a
WHERE a.user_id = u.id
  AND a.status <> 'approved'
  AND u.signup_role = 'tutor'
  AND u.active_role <> 'student';
