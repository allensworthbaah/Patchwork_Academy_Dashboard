-- AllensworthOS · Academy Module Schema
-- Implements PRD Section 6 (Core Data Model Requirements), Phase 1 scope.
-- Separate from the clinical/ECM pipeline schema by design (PRD Section 3, row 1).

CREATE TABLE IF NOT EXISTS regions (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS sponsors (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  organization  TEXT NOT NULL,               -- e.g. "HCAI", "California Health Care Foundation"
  contact_email TEXT
);

CREATE TABLE IF NOT EXISTS cohorts (
  id            SERIAL PRIMARY KEY,
  label         TEXT NOT NULL,               -- "Fall 2026"
  starts_on     DATE NOT NULL,
  ends_on       DATE,
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('upcoming','active','completed'))
);

-- 6.1 Shared identity: one canonical record per trainee/CHW.
CREATE TABLE IF NOT EXISTS people (
  id            SERIAL PRIMARY KEY,
  full_name     TEXT NOT NULL,
  email         TEXT UNIQUE,
  region_id     INTEGER REFERENCES regions(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6.2 Academy module — separate workflow from the clinical/ECM pipeline.
-- States: Applicant -> Enrolled -> Attending -> Completing -> Certified -> Placed
CREATE TABLE IF NOT EXISTS enrollments (
  id                SERIAL PRIMARY KEY,
  person_id         INTEGER NOT NULL REFERENCES people(id),
  cohort_id         INTEGER NOT NULL REFERENCES cohorts(id),
  sponsor_id        INTEGER REFERENCES sponsors(id),   -- null = self-funded / no sponsorship
  status            TEXT NOT NULL DEFAULT 'enrolled'
                      CHECK (status IN ('applicant','enrolled','attending','completing','certified','placed','withdrawn')),
  enrolled_on       DATE NOT NULL DEFAULT CURRENT_DATE,
  certified_on      DATE,
  placed_on         DATE,
  placement_org     TEXT,                              -- receiving CBO/ED name, once placed
  UNIQUE (person_id, cohort_id)
);

-- Weekly attendance roll-up per enrollment (Section 7, attendance trend).
CREATE TABLE IF NOT EXISTS attendance_weeks (
  id              SERIAL PRIMARY KEY,
  enrollment_id   INTEGER NOT NULL REFERENCES enrollments(id),
  week_number     INTEGER NOT NULL,
  present_pct     NUMERIC(5,2) NOT NULL CHECK (present_pct >= 0 AND present_pct <= 100),
  UNIQUE (enrollment_id, week_number)
);

-- 6.3 Supervised-hours & verification tiers.
-- Verified = logged via Allensworth or the no-login attestation flow, tied to a named supervisor + timestamp.
-- Attested = self-reported upload, no independent confirmation. Never treated as equivalent in reporting.
CREATE TABLE IF NOT EXISTS hour_logs (
  id                 SERIAL PRIMARY KEY,
  enrollment_id      INTEGER NOT NULL REFERENCES enrollments(id),
  supervisor_name    TEXT NOT NULL,
  supervisor_org     TEXT NOT NULL,
  hours              NUMERIC(5,2) NOT NULL CHECK (hours > 0),
  hour_category      TEXT NOT NULL DEFAULT 'field_supervised'
                       CHECK (hour_category IN ('field_supervised','direct_contact','administrative')),
  verification_tier  TEXT NOT NULL CHECK (verification_tier IN ('verified','attested')),
  logged_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Reserved for the compliance-gated MSW/LCSW pathway (Section 6.3 / Phase 4). Not exposed or marketed yet.
  supervisor_license_type    TEXT,
  supervisor_license_number  TEXT
);

CREATE INDEX IF NOT EXISTS idx_enrollments_cohort ON enrollments(cohort_id);
CREATE INDEX IF NOT EXISTS idx_hour_logs_enrollment ON hour_logs(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_enrollment ON attendance_weeks(enrollment_id);
