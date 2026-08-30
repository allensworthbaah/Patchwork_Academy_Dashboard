-- Seed data — mirrors the figures used in the earlier dashboard mockup so the
-- live version renders the same story. Illustrative, not real program data.

INSERT INTO regions (name) VALUES
  ('Sacramento'), ('Fresno'), ('Bakersfield / Allensworth'), ('Stockton')
ON CONFLICT DO NOTHING;

INSERT INTO sponsors (name, organization, contact_email) VALUES
  ('Maria Chen', 'HCAI', 'mchen@hcai.example.gov'),
  ('James Wu', 'California Health Care Foundation', 'jwu@chcf.example.org')
ON CONFLICT DO NOTHING;

INSERT INTO cohorts (label, starts_on, ends_on, status) VALUES
  ('Fall 2026', '2026-08-10', '2027-01-30', 'active'),
  ('Spring 2027', '2027-03-10', '2027-08-20', 'upcoming')
ON CONFLICT DO NOTHING;

-- 214 enrolled students distributed across 4 regions for Fall 2026 (matches mockup).
DO $$
DECLARE
  fall_cohort_id INT;
  region_ids INT[];
  region_counts INT[] := ARRAY[68, 54, 47, 45]; -- Sacramento, Fresno, Bakersfield, Stockton
  region_attendance NUMERIC[] := ARRAY[90, 86, 91, 84];
  hcai_id INT;
  chcf_id INT;
  r INT;
  i INT;
  p_id INT;
  e_id INT;
  sponsor_choice INT;
  wk INT;
  base_attendance NUMERIC;
  week_series NUMERIC[] := ARRAY[82, 85, 84, 88, 90, 87, 91, 88];
BEGIN
  SELECT id INTO fall_cohort_id FROM cohorts WHERE label = 'Fall 2026';
  SELECT id INTO hcai_id FROM sponsors WHERE organization = 'HCAI';
  SELECT id INTO chcf_id FROM sponsors WHERE organization = 'California Health Care Foundation';
  SELECT array_agg(id ORDER BY id) INTO region_ids FROM regions;

  FOR r IN 1..4 LOOP
    FOR i IN 1..region_counts[r] LOOP
      INSERT INTO people (full_name, email, region_id)
      VALUES (
        'Student ' || region_ids[r] || '-' || i,
        'student.' || region_ids[r] || '.' || i || '@example.org',
        region_ids[r]
      )
      RETURNING id INTO p_id;

      -- Roughly 1 in 3 sponsored, split between the two sample sponsors.
      sponsor_choice := CASE
        WHEN i % 3 = 0 THEN hcai_id
        WHEN i % 5 = 0 THEN chcf_id
        ELSE NULL
      END;

      INSERT INTO enrollments (person_id, cohort_id, sponsor_id, status, enrolled_on)
      VALUES (p_id, fall_cohort_id, sponsor_choice, 'attending', '2026-08-10')
      RETURNING id INTO e_id;

      -- Attendance weeks jittered slightly around the region's average.
      base_attendance := region_attendance[r];
      FOR wk IN 1..8 LOOP
        INSERT INTO attendance_weeks (enrollment_id, week_number, present_pct)
        VALUES (
          e_id,
          wk,
          GREATEST(60, LEAST(100, week_series[wk] + (base_attendance - 87) + ((i % 5) - 2)))
        );
      END LOOP;

      -- A subset have logged supervised hours; mix of verified vs attested.
      IF i % 4 = 0 THEN
        INSERT INTO hour_logs (enrollment_id, supervisor_name, supervisor_org, hours, hour_category, verification_tier)
        VALUES (e_id, 'Supervisor ' || region_ids[r], 'Patchwork Community Outreach', 12.5, 'field_supervised', 'verified');
      END IF;
      IF i % 7 = 0 THEN
        INSERT INTO hour_logs (enrollment_id, supervisor_name, supervisor_org, hours, hour_category, verification_tier)
        VALUES (e_id, 'Field Site Lead', 'Partner CBO (unverified upload)', 8.0, 'field_supervised', 'attested');
      END IF;
    END LOOP;
  END LOOP;
END $$;
