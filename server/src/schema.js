import { createSchema } from "graphql-yoga";
import { pool } from "./db.js";

// Every resolver below accepts an optional sponsorId. When present, results
// are scoped to that sponsor's own referred/sponsored students only — this is
// the PRD Section 7 requirement for Phase 2 (cohort-level live portal): a
// sponsor's dashboard must never leak another sponsor's or the general
// population's data, and no individual-level rows are ever returned here.

const typeDefs = /* GraphQL */ `
  type Cohort {
    id: Int!
    label: String!
    startsOn: String!
    endsOn: String
    status: String!
  }

  type Sponsor {
    id: Int!
    name: String!
    organization: String!
  }

  type PipelineStage {
    key: String!
    label: String!
    value: Int
    sub: String!
    future: Boolean!
  }

  type AttendanceWeek {
    week: Int!
    avgPresentPct: Float!
  }

  type RegionBreakdown {
    name: String!
    enrolled: Int!
    avgAttendance: Float!
  }

  type SponsorshipSlice {
    label: String!
    count: Int!
  }

  type HourVerification {
    tier: String!
    entries: Int!
    totalHours: Float!
  }

  type CohortSummary {
    cohort: Cohort!
    scopedToSponsor: Sponsor
    pipeline: [PipelineStage!]!
    attendanceTrend: [AttendanceWeek!]!
    regions: [RegionBreakdown!]!
    sponsorshipMix: [SponsorshipSlice!]!
    hourVerification: [HourVerification!]!
  }

  type Query {
    cohorts: [Cohort!]!
    sponsors: [Sponsor!]!
    cohortSummary(cohortId: Int!, sponsorId: Int): CohortSummary!
  }
`;

function sponsorFilterClause(sponsorId, paramIndex) {
  return sponsorId ? `AND e.sponsor_id = $${paramIndex}` : "";
}

const resolvers = {
  Query: {
    cohorts: async () => {
      const { rows } = await pool.query(
        `SELECT id, label, starts_on, ends_on, status FROM cohorts ORDER BY starts_on`
      );
      return rows.map((r) => ({
        id: r.id,
        label: r.label,
        startsOn: r.starts_on,
        endsOn: r.ends_on,
        status: r.status,
      }));
    },

    sponsors: async () => {
      const { rows } = await pool.query(
        `SELECT id, name, organization FROM sponsors ORDER BY organization`
      );
      return rows;
    },

    cohortSummary: async (_parent, { cohortId, sponsorId }) => {
      const params = sponsorId ? [cohortId, sponsorId] : [cohortId];
      const sponsorClause = sponsorFilterClause(sponsorId, 2);

      const cohortRes = await pool.query(
        `SELECT id, label, starts_on, ends_on, status FROM cohorts WHERE id = $1`,
        [cohortId]
      );
      if (cohortRes.rowCount === 0) {
        throw new Error(`Cohort ${cohortId} not found`);
      }
      const cohortRow = cohortRes.rows[0];

      let scopedToSponsor = null;
      if (sponsorId) {
        const s = await pool.query(
          `SELECT id, name, organization FROM sponsors WHERE id = $1`,
          [sponsorId]
        );
        scopedToSponsor = s.rows[0] || null;
      }

      // --- Pipeline stages ---
      const pipelineRes = await pool.query(
        `SELECT
           count(*) FILTER (WHERE e.status IN ('enrolled','attending','completing','certified','placed')) AS enrolled,
           count(*) FILTER (WHERE e.status IN ('attending','completing','certified','placed')) AS attending,
           count(*) FILTER (WHERE e.status IN ('completing','certified','placed')) AS on_track,
           count(*) FILTER (WHERE e.status = 'placed') AS placed
         FROM enrollments e
         WHERE e.cohort_id = $1 ${sponsorClause}`,
        params
      );
      const p = pipelineRes.rows[0];

      // Weekly attendance average, used both for "attending" sub-label and trend.
      const attendanceAvgRes = await pool.query(
        `SELECT round(avg(aw.present_pct))::int AS avg_pct
         FROM attendance_weeks aw
         JOIN enrollments e ON e.id = aw.enrollment_id
         WHERE e.cohort_id = $1 ${sponsorClause}`,
        params
      );
      const overallAttendance = attendanceAvgRes.rows[0].avg_pct ?? 0;

      const pipeline = [
        {
          key: "enrolled",
          label: "Enrolled",
          value: Number(p.enrolled),
          sub: "students registered",
          future: false,
        },
        {
          key: "attending",
          label: "Attending",
          value: Number(p.attending),
          sub: `${overallAttendance}% weekly attendance`,
          future: false,
        },
        {
          key: "onTrack",
          label: "On Track",
          value: Number(p.on_track),
          sub: "completion pace",
          future: false,
        },
        {
          key: "placed",
          label: "Placed",
          value: Number(p.placed) || null,
          sub: "tracked from first graduation",
          future: true,
        },
      ];

      // --- Attendance trend by week ---
      const trendRes = await pool.query(
        `SELECT aw.week_number AS week, round(avg(aw.present_pct), 1) AS avg_pct
         FROM attendance_weeks aw
         JOIN enrollments e ON e.id = aw.enrollment_id
         WHERE e.cohort_id = $1 ${sponsorClause}
         GROUP BY aw.week_number
         ORDER BY aw.week_number`,
        params
      );
      const attendanceTrend = trendRes.rows.map((r) => ({
        week: r.week,
        avgPresentPct: Number(r.avg_pct),
      }));

      // --- Regional breakdown ---
      const regionRes = await pool.query(
        `SELECT r.name,
                count(DISTINCT e.id) AS enrolled,
                round(avg(aw.present_pct), 1) AS avg_attendance
         FROM enrollments e
         JOIN people p ON p.id = e.person_id
         JOIN regions r ON r.id = p.region_id
         LEFT JOIN attendance_weeks aw ON aw.enrollment_id = e.id
         WHERE e.cohort_id = $1 ${sponsorClause}
         GROUP BY r.name
         ORDER BY enrolled DESC`,
        params
      );
      const regions = regionRes.rows.map((r) => ({
        name: r.name,
        enrolled: Number(r.enrolled),
        avgAttendance: Number(r.avg_attendance) || 0,
      }));

      // --- Sponsorship mix (only meaningful on the unscoped/admin view) ---
      let sponsorshipMix = [];
      if (!sponsorId) {
        const mixRes = await pool.query(
          `SELECT COALESCE(s.organization, 'Unsponsored') AS label, count(*) AS count
           FROM enrollments e
           LEFT JOIN sponsors s ON s.id = e.sponsor_id
           WHERE e.cohort_id = $1
           GROUP BY label
           ORDER BY count DESC`,
          [cohortId]
        );
        sponsorshipMix = mixRes.rows.map((r) => ({
          label: r.label,
          count: Number(r.count),
        }));
      }

      // --- Hour verification tiers ---
      const hourRes = await pool.query(
        `SELECT h.verification_tier AS tier, count(*) AS entries, sum(h.hours) AS total_hours
         FROM hour_logs h
         JOIN enrollments e ON e.id = h.enrollment_id
         WHERE e.cohort_id = $1 ${sponsorClause}
         GROUP BY h.verification_tier
         ORDER BY h.verification_tier`,
        params
      );
      const hourVerification = hourRes.rows.map((r) => ({
        tier: r.tier,
        entries: Number(r.entries),
        totalHours: Number(r.total_hours),
      }));

      return {
        cohort: {
          id: cohortRow.id,
          label: cohortRow.label,
          startsOn: cohortRow.starts_on,
          endsOn: cohortRow.ends_on,
          status: cohortRow.status,
        },
        scopedToSponsor,
        pipeline,
        attendanceTrend,
        regions,
        sponsorshipMix,
        hourVerification,
      };
    },
  },
};

export const schema = createSchema({ typeDefs, resolvers });
