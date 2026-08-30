export const GET_COHORTS_AND_SPONSORS = /* GraphQL */ `
  query GetCohortsAndSponsors {
    cohorts {
      id
      label
      status
    }
    sponsors {
      id
      name
      organization
    }
  }
`;

export const GET_COHORT_SUMMARY = /* GraphQL */ `
  query GetCohortSummary($cohortId: Int!, $sponsorId: Int) {
    cohortSummary(cohortId: $cohortId, sponsorId: $sponsorId) {
      cohort {
        label
        status
      }
      scopedToSponsor {
        name
        organization
      }
      pipeline {
        key
        label
        value
        sub
        future
      }
      attendanceTrend {
        week
        avgPresentPct
      }
      regions {
        name
        enrolled
        avgAttendance
      }
      sponsorshipMix {
        label
        count
      }
      hourVerification {
        tier
        entries
        totalHours
      }
    }
  }
`;
