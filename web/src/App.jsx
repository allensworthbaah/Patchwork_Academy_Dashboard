import { useEffect, useState } from "react";
import { ArrowUpRight, ShieldCheck, ShieldQuestion, Users, CalendarCheck, GraduationCap, Briefcase } from "lucide-react";
import { gqlRequest } from "./graphqlClient";
import { GET_COHORTS_AND_SPONSORS, GET_COHORT_SUMMARY } from "./queries";

const STAGE_NUMBER = { enrolled: "01", attending: "02", onTrack: "03", placed: "04" };
const STAGE_ICONS = { enrolled: Users, attending: CalendarCheck, onTrack: GraduationCap, placed: Briefcase };

export default function App() {
  const [cohorts, setCohorts] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [cohortId, setCohortId] = useState(null);
  const [sponsorId, setSponsorId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    gqlRequest(GET_COHORTS_AND_SPONSORS)
      .then((data) => {
        setCohorts(data.cohorts);
        setSponsors(data.sponsors);
        const active = data.cohorts.find((c) => c.status === "active") || data.cohorts[0];
        if (active) setCohortId(active.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!cohortId) return;
    setLoading(true);
    gqlRequest(GET_COHORT_SUMMARY, { cohortId, sponsorId: sponsorId || null })
      .then((data) => {
        setSummary(data.cohortSummary);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [cohortId, sponsorId]);

  return (
    <div style={{ background: "#F5F3EE", minHeight: "100vh", fontFamily: "'Inter', -apple-system, sans-serif", color: "#14171A" }}>
      <style>{`
        * { box-sizing: border-box; }
        .mono { font-family: 'IBM Plex Mono', monospace; }
        .feed-row { transition: background 0.12s ease; }
        .feed-row:hover { background: #EEEBE2; }
        select { font-family: 'IBM Plex Mono', monospace; }
        select:focus, button:focus { outline: 2px solid #1F5C4C; outline-offset: 1px; }
        @media (max-width: 780px) {
          .split { grid-template-columns: 1fr !important; }
        }
        .pipeline-desktop { display: grid; }
        .pipeline-mobile { display: none; }
        @media (max-width: 640px) {
          .pipeline-desktop { display: none; }
          .pipeline-mobile { display: block; }
        }
      `}</style>

      {/* Slim top nav, matching the marketing site's wordmark bar */}
      <div style={{ borderBottom: "1px solid #E4E1D8", padding: "18px 32px" }}>
        <div style={{ maxWidth: 1080, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="mono" style={{ fontSize: 13, fontWeight: 600, letterSpacing: "-0.01em" }}>
            <span style={{ color: "#1F5C4C" }}>▲</span> AllensworthOS
          </div>
          <div className="mono" style={{ fontSize: 11, color: "#8A8778", letterSpacing: "0.04em" }}>
            ACADEMY PARTNER RECORD
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "56px 32px 40px" }}>
        {/* Headline, mirroring the marketing site's editorial headline + italic accent */}
        <h1 style={{ fontSize: 40, fontWeight: 700, lineHeight: 1.12, letterSpacing: "-0.02em", margin: "0 0 14px", maxWidth: 640 }}>
          Every student, every hour, <em style={{ fontStyle: "italic", fontWeight: 600, color: "#1F5C4C" }}>accounted for.</em>
        </h1>
        <p style={{ fontSize: 16, color: "#55534A", maxWidth: 560, lineHeight: 1.55, margin: "0 0 32px" }}>
          The same record Patchwork Academy staff use to track a cohort, shared with the
          referrers and sponsors who need to see it — scoped to exactly what they're allowed to.
        </p>

        {/* Scope controls */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
          <select value={cohortId || ""} onChange={(e) => setCohortId(Number(e.target.value))} style={selectStyle}>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>{c.label}{c.status === "upcoming" ? " · upcoming" : ""}</option>
            ))}
          </select>
          <select value={sponsorId || ""} onChange={(e) => setSponsorId(e.target.value ? Number(e.target.value) : null)} style={selectStyle}>
            <option value="">Viewing as: Patchwork staff</option>
            {sponsors.map((s) => (
              <option key={s.id} value={s.id}>Viewing as: {s.organization}</option>
            ))}
          </select>
        </div>

        {error && (
          <div style={{ padding: 24, border: "1px solid #D9A48A", background: "#FBF1EC", borderRadius: 4, color: "#A8432A", fontSize: 14 }}>
            Couldn't load the record: {error}. Is the API running on localhost:4000?
          </div>
        )}
        {!error && (loading || !summary) && (
          <div className="mono" style={{ padding: 48, textAlign: "center", color: "#8A8778", fontSize: 13 }}>
            loading cohort record…
          </div>
        )}
        {!error && summary && <Record summary={summary} />}
      </div>
    </div>
  );
}

const selectStyle = {
  padding: "9px 14px",
  borderRadius: 4,
  border: "1px solid #D8D5C9",
  background: "#FFFFFF",
  fontSize: 12,
  color: "#14171A",
};

function Record({ summary }) {
  const { cohort, scopedToSponsor, pipeline, attendanceTrend, regions, sponsorshipMix, hourVerification } = summary;
  const isScoped = !!scopedToSponsor;
  const maxAttendance = Math.max(...attendanceTrend.map((w) => w.avgPresentPct), 1);
  const overallAttendance = attendanceTrend.length
    ? Math.round(attendanceTrend.reduce((s, w) => s + w.avgPresentPct, 0) / attendanceTrend.length)
    : 0;
  const attendanceDelta = attendanceTrend.length > 1
    ? Math.round(attendanceTrend[attendanceTrend.length - 1].avgPresentPct - attendanceTrend[0].avgPresentPct)
    : 0;
  const enrolledCount = pipeline.find((p) => p.key === "enrolled")?.value ?? 0;

  return (
    <div style={{ background: "#FFFFFF", border: "1px solid #E4E1D8", borderRadius: 6 }}>
      {/* Feed-style header, mirroring "Caseload — Sacramento Today" */}
      <div style={{ padding: "22px 28px", borderBottom: "1px solid #E4E1D8", display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>
            Cohort — {cohort.label}
            {isScoped && <span style={{ fontWeight: 400, color: "#55534A" }}> · {scopedToSponsor.organization} view</span>}
          </div>
        </div>
        <div className="mono" style={{ fontSize: 12, color: "#8A8778" }}>
          {enrolledCount} enrolled · {overallAttendance}% attendance · {cohort.status}
        </div>
      </div>

      {/* Pipeline — desktop/tablet: four horizontal blocks, icon + prominent header per stage */}
      <div className="pipeline-desktop" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        {pipeline.map((stage, i) => {
          const Icon = STAGE_ICONS[stage.key];
          return (
            <div key={stage.key} className="feed-row" style={{
              padding: "22px 24px",
              borderRight: i < pipeline.length - 1 ? "1px solid #EFEDE5" : "none",
              opacity: stage.future ? 0.5 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Icon size={18} color="#1F5C4C" />
                <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}>{stage.label}</span>
              </div>
              <div className="mono" style={{ fontSize: 32, fontWeight: 600, color: "#1F5C4C", lineHeight: 1, marginBottom: 6 }}>
                {stage.value !== null && stage.value !== undefined ? stage.value : "—"}
              </div>
              <div style={{ fontSize: 12.5, color: "#8A8778" }}>{stage.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Pipeline — phone: original vertical row list */}
      <div className="pipeline-mobile">
        {pipeline.map((stage, i) => (
          <div key={stage.key} className="feed-row" style={{
            display: "flex", alignItems: "center", gap: 20, padding: "18px 28px",
            borderBottom: i < pipeline.length - 1 ? "1px solid #EFEDE5" : "none",
            opacity: stage.future ? 0.5 : 1,
          }}>
            <span className="mono" style={{ fontSize: 12, color: "#B7B4A6", width: 20, flexShrink: 0 }}>
              {STAGE_NUMBER[stage.key]}
            </span>
            <span style={{ fontSize: 15, fontWeight: 600, width: 110, flexShrink: 0 }}>{stage.label}</span>
            <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: "#1F5C4C", width: 60, flexShrink: 0 }}>
              {stage.value !== null && stage.value !== undefined ? stage.value : "—"}
            </span>
            <span style={{ fontSize: 13, color: "#8A8778" }}>{stage.sub}</span>
          </div>
        ))}
      </div>

      {/* Attendance + Region split */}
      <div className="split" style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", borderTop: "1px solid #E4E1D8" }}>
        <div style={{ padding: "24px 28px", borderRight: "1px solid #E4E1D8" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Weekly attendance</span>
            {attendanceDelta !== 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: "#1F5C4C", fontWeight: 600 }}>
                <ArrowUpRight size={12} style={{ transform: attendanceDelta < 0 ? "rotate(90deg)" : "none" }} />
                {attendanceDelta > 0 ? "+" : ""}{attendanceDelta} pts
              </span>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 88 }}>
            {attendanceTrend.map((w, i) => (
              <div key={w.week} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <div style={{
                  width: "100%", maxWidth: 18,
                  height: `${(w.avgPresentPct / maxAttendance) * 70}px`,
                  background: i === attendanceTrend.length - 1 ? "#1F5C4C" : "#DEDACC",
                  borderRadius: 2,
                }} />
                <span className="mono" style={{ fontSize: 9, color: "#B7B4A6" }}>{w.week}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding: "24px 28px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>By region</div>
          {regions.map((r, i) => (
            <div key={r.name} className="feed-row" style={{
              display: "flex", justifyContent: "space-between", padding: "8px 0",
              borderBottom: i < regions.length - 1 ? "1px dashed #EFEDE5" : "none", fontSize: 13,
            }}>
              <span>{r.name}</span>
              <span className="mono" style={{ color: "#8A8778" }}>{r.enrolled} · {Math.round(r.avgAttendance)}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Sponsorship mix — admin only */}
      {!isScoped && sponsorshipMix.length > 0 && (
        <div style={{ padding: "22px 28px", borderTop: "1px solid #E4E1D8" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Sponsorship mix</div>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {sponsorshipMix.map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="mono" style={{ fontSize: 20, fontWeight: 600, color: "#1F5C4C" }}>{s.count}</span>
                <span style={{ fontSize: 13, color: "#55534A" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hour verification */}
      {hourVerification.length > 0 && (
        <div style={{ padding: "22px 28px", borderTop: "1px solid #E4E1D8" }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Supervised hours — 40-hour requirement</div>
          <p style={{ fontSize: 12, color: "#8A8778", margin: "0 0 14px", maxWidth: 520 }}>
            Verified hours are tied to a named supervisor and timestamp. Attested hours are self-reported and never blended into the same total.
          </p>
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {hourVerification.map((h) => {
              const isVerified = h.tier === "verified";
              return (
                <div key={h.tier} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isVerified ? <ShieldCheck size={16} color="#1F5C4C" /> : <ShieldQuestion size={16} color="#B0764F" />}
                  <span style={{ fontSize: 13, fontWeight: 600, textTransform: "capitalize" }}>{h.tier}</span>
                  <span className="mono" style={{ fontSize: 12, color: "#8A8778" }}>{h.entries} · {h.totalHours}h</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ padding: "18px 28px", borderTop: "1px solid #E4E1D8", background: "#FAF9F5" }}>
        <p className="mono" style={{ fontSize: 11, color: "#8A8778", margin: 0 }}>
          placement outcomes tracked beginning with the first graduating class
        </p>
      </div>
    </div>
  );
}
