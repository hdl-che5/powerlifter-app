// src/components/tv/TVScreen.tsx
// Fullscreen TV/audience screen — light theme matching main referee page.

import React, { useEffect, useState } from "react";
import Chrono from "../lifting/Chrono";
import { getSocket } from "../../socket/socketClient";

interface AthleteInfo {
  id?: number;
  name?: string;
  bodyweightKg?: number;
  category?: string;
  region?: string;
  club?: string;
  team?: string;
  lot?: number;
  athletePhotoUrl?: string;
  clubLogoUrl?: string;
}

interface EntryRow {
  id: number;
  lot: number;
  name: string;
  team: string;
  bodyweightKg: number;
  squatKg: number[];
  benchKg: number[];
  deadliftKg: number[];
  squatStatus: number[];
  benchStatus: number[];
  deadliftStatus: number[];
}

interface TVState {
  currentAthlete: AthleteInfo | null;
  nextAthlete: AthleteInfo | null;
  currentLift: string;
  currentAttempt: number;
  requestedWeightKg: number;
  judgeVotes: Record<number, boolean | null>;
  finalResult: string | null;
  mode: string;
  entries: EntryRow[];
}

const LIFT_NAMES: Record<string, string> = { S: "SQUAT", B: "BENCH PRESS", D: "DEADLIFT" };

const TVScreen: React.FC = () => {
  const [state, setState] = useState<TVState>({
    currentAthlete: null,
    nextAthlete: null,
    currentLift: "S",
    currentAttempt: 1,
    requestedWeightKg: 0,
    judgeVotes: { 1: null, 2: null, 3: null },
    finalResult: null,
    mode: "Standard",
    entries: [],
  });

  useEffect(() => {
    const socket = getSocket();
    socket.on("state_update", (data: Partial<TVState>) => {
      setState((prev) => ({ ...prev, ...data }));
    });
    socket.on(
      "judge_vote_received",
      ({
        judgeId,
        vote,
        judgeVotes,
      }: {
        judgeId: number;
        vote: boolean;
        judgeVotes: Record<number, boolean | null>;
        votesIn: number;
      }) => {
        if (judgeVotes) setState((prev) => ({ ...prev, judgeVotes }));
        else setState((prev) => ({ ...prev, judgeVotes: { ...prev.judgeVotes, [judgeId]: vote } }));
      },
    );
    socket.on("final_result", (data: { result: string; votes: Record<number, boolean | null> }) => {
      setState((prev) => ({ ...prev, finalResult: data.result, judgeVotes: data.votes }));
    });
    socket.on("votes_reset", () => {
      setState((prev) => ({ ...prev, finalResult: null, judgeVotes: { 1: null, 2: null, 3: null } }));
    });
    return () => {
      socket.off("state_update");
      socket.off("judge_vote_received");
      socket.off("final_result");
      socket.off("votes_reset");
    };
  }, []);

  const {
    currentAthlete,
    nextAthlete,
    currentLift,
    currentAttempt,
    requestedWeightKg,
    judgeVotes,
    finalResult,
    mode,
    entries,
  } = state;
  const isHandicap = mode === "Handicap";
  const liftName = isHandicap ? "BENCH PRESS" : LIFT_NAMES[currentLift] || currentLift;

  const athletePanel = (athlete: AthleteInfo | null, label: string) => (
    <div
      style={{
        flex: 1,
        minWidth: "280px",
        background: "#fff",
        borderRadius: "12px",
        border: "1px solid #dee2e6",
        padding: "18px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.06)",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          textTransform: "uppercase",
          letterSpacing: "1px",
          color: "#6c757d",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      {athlete?.name ? (
        <>
          <div style={{ display: "flex", gap: "14px", alignItems: "center", marginBottom: "14px" }}>
            <div
              style={{ width: "72px", height: "72px", borderRadius: "8px", overflow: "hidden", background: "#e9ecef" }}
            >
              {athlete.athletePhotoUrl ? (
                <img
                  src={athlete.athletePhotoUrl}
                  alt="athlete"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#adb5bd",
                    fontSize: "24px",
                  }}
                >
                  ?
                </div>
              )}
            </div>
            <div>
              <div style={{ fontSize: "24px", fontWeight: 700, lineHeight: 1.1, color: "#212529" }}>{athlete.name}</div>
              <div style={{ marginTop: "4px", color: "#6c757d", fontSize: "13px" }}>{athlete.team || "—"}</div>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "8px",
              fontSize: "13px",
              color: "#495057",
            }}
          >
            <div>
              <div style={{ fontSize: "10px", color: "#6c757d", marginBottom: "3px" }}>Bodyweight</div>
              <div>{athlete.bodyweightKg != null ? `${athlete.bodyweightKg} kg` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "#6c757d", marginBottom: "3px" }}>Category</div>
              <div>{athlete.category || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "#6c757d", marginBottom: "3px" }}>Lot</div>
              <div>{athlete.lot != null ? `#${athlete.lot}` : "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "#6c757d", marginBottom: "3px" }}>Club</div>
              <div>{athlete.team || "—"}</div>
            </div>
          </div>
        </>
      ) : (
        <div style={{ color: "#adb5bd", fontSize: "16px", minHeight: "106px", display: "flex", alignItems: "center" }}>
          Waiting for athlete
        </div>
      )}
    </div>
  );

  const currentAthleteId = currentAthlete?.id;
  const isCurrentEntry = (entry: EntryRow) => currentAthleteId != null && entry.id === currentAthleteId;
  const isCurrentCell = (entry: EntryRow, lift: string, attemptIndex: number) =>
    isCurrentEntry(entry) && lift === currentLift && attemptIndex + 1 === currentAttempt;

  const formatLiftValue = (kg?: number) => (kg != null && kg > 0 ? `${kg}` : "—");

  const getLiftCellStyle = (
    entry: EntryRow,
    status: number | undefined,
    lift: string,
    attemptIndex: number,
  ): React.CSSProperties => {
    const style: React.CSSProperties = {
      ...tvTd,
      background: statusBg(status),
      color: statusColor(status),
    };
    if (status == null || status === 0) {
      style.background = "transparent";
      style.color = "#495057";
    }
    if (isCurrentCell(entry, lift, attemptIndex)) {
      style.boxShadow = "inset 0 0 0 2px rgba(13, 110, 253, 0.18)";
      style.fontWeight = 700;
    }
    return style;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f9fa",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        display: "grid",
        gridTemplateRows: "76px auto 1fr",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0 24px",
          background: "#343a40",
          borderBottom: "2px solid #23272b",
        }}
      >
        <span
          style={{ fontSize: "14px", fontWeight: 700, letterSpacing: "3px", textTransform: "uppercase", color: "#fff" }}
        >
          Powerlifting Competition
        </span>
        <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
          {isHandicap && (
            <span className="badge badge-warning" style={{ fontSize: "12px", padding: "4px 10px" }}>
              HANDICAP
            </span>
          )}
          <span style={{ color: "#adb5bd", fontSize: "13px", letterSpacing: "1px" }}>
            {liftName} — ATTEMPT {currentAttempt}
          </span>
        </div>
      </div>

      {/* Current + next athlete panels */}
      <div style={{ padding: "24px", background: "#fff", borderBottom: "2px solid #dee2e6" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "20px" }}>
          <div style={{ display: "grid", gap: "20px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "24px",
                padding: "24px",
                background: "#f8f9fa",
                borderRadius: "16px",
                border: "1px solid #dee2e6",
              }}
            >
              <div style={{ display: "flex", gap: "24px", alignItems: "center" }}>
                <div
                  style={{
                    width: "96px",
                    height: "96px",
                    borderRadius: "16px",
                    overflow: "hidden",
                    background: "#e9ecef",
                    flexShrink: 0,
                  }}
                >
                  {currentAthlete?.athletePhotoUrl ? (
                    <img
                      src={currentAthlete.athletePhotoUrl}
                      alt="athlete"
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#adb5bd",
                        fontSize: "32px",
                      }}
                    >
                      ?
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: "32px", fontWeight: 700, lineHeight: 1.05, color: "#212529" }}>
                    {currentAthlete?.name || "Waiting for athlete"}
                  </div>
                  <div
                    style={{
                      marginTop: "8px",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "14px",
                      color: "#6c757d",
                      fontSize: "14px",
                    }}
                  >
                    {currentAthlete?.lot != null && <span>No. {currentAthlete.lot}</span>}
                    {(currentAthlete?.team || currentAthlete?.club) && (
                      <span>{currentAthlete.team || currentAthlete.club}</span>
                    )}
                    {currentAthlete?.category && <span>{currentAthlete.category}</span>}
                    {currentAthlete?.bodyweightKg != null && <span>{currentAthlete.bodyweightKg} kg</span>}
                  </div>
                </div>
              </div>
              {currentAthlete?.clubLogoUrl ? (
                <img
                  src={currentAthlete.clubLogoUrl}
                  alt="club logo"
                  style={{ width: "96px", height: "96px", objectFit: "contain", alignSelf: "center" }}
                />
              ) : (
                <div style={{ width: "96px", height: "96px" }} />
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "16px" }}>
              <div style={{ padding: "18px", background: "#fff", borderRadius: "14px", border: "1px solid #dee2e6" }}>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "#6c757d",
                    marginBottom: "8px",
                  }}
                >
                  Current Lift
                </div>
                <div style={{ fontSize: "18px", fontWeight: 700, color: "#212529" }}>{liftName}</div>
                <div style={{ marginTop: "6px", fontSize: "13px", color: "#495057" }}>Attempt {currentAttempt}</div>
              </div>
              <div style={{ padding: "18px", background: "#fff", borderRadius: "14px", border: "1px solid #dee2e6" }}>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "#6c757d",
                    marginBottom: "8px",
                  }}
                >
                  Requested Weight
                </div>
                <div style={{ fontSize: "30px", fontWeight: 700, color: "#dc3545" }}>
                  {requestedWeightKg}
                  <span style={{ fontSize: "16px", color: "#adb5bd", marginLeft: "6px" }}>kg</span>
                </div>
              </div>
              <div style={{ padding: "18px", background: "#fff", borderRadius: "14px", border: "1px solid #dee2e6" }}>
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "1px",
                    color: "#6c757d",
                    marginBottom: "8px",
                  }}
                >
                  Status
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", justifyContent: "center" }}>
                  {[1, 2, 3].map((j) => (
                    <div
                      key={j}
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background: judgeVotes[j] === true ? "#fff" : judgeVotes[j] === false ? "#dc3545" : "#e9ecef",
                        border:
                          judgeVotes[j] === true
                            ? "2px solid #28a745"
                            : judgeVotes[j] === false
                              ? "2px solid #dc3545"
                              : "2px solid #dee2e6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "14px",
                        fontWeight: 700,
                        color: judgeVotes[j] === false ? "#fff" : "#6c757d",
                      }}
                    >
                      {j}
                    </div>
                  ))}
                </div>
                {finalResult ? (
                  <div
                    style={{
                      marginTop: "14px",
                      textAlign: "center",
                      fontSize: "14px",
                      fontWeight: 700,
                      color: finalResult === "good" ? "#28a745" : "#dc3545",
                    }}
                  >
                    {finalResult === "good" ? "GOOD LIFT" : "NO LIFT"}
                  </div>
                ) : (
                  <div style={{ marginTop: "14px", textAlign: "center", color: "#6c757d", fontSize: "13px" }}>
                    Waiting for decision
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "20px" }}>
            {athletePanel(nextAthlete, "Up Next")}
            <div
              style={{
                padding: "22px",
                background: "#fff",
                borderRadius: "16px",
                border: "1px solid #dee2e6",
                boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  fontSize: "11px",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                  color: "#6c757d",
                  marginBottom: "14px",
                }}
              >
                Competition Timer
              </div>
              <Chrono large={true} />
            </div>
          </div>
        </div>
      </div>

      {/* Competition table */}
      <div style={{ overflowY: "auto" }}>
        {entries.length === 0 ? (
          <div style={{ padding: "32px", textAlign: "center", color: "#6c757d", fontSize: "14px" }}>
            Competition table will appear here once athletes are registered.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
              <tr>
                <th style={tvTh("#343a40")} rowSpan={2}>
                  #
                </th>
                <th style={tvTh("#343a40")} rowSpan={2}>
                  Place
                </th>
                <th style={{ ...tvTh("#343a40"), textAlign: "left" }} rowSpan={2}>
                  Athlete
                </th>
                <th style={tvTh("#343a40")} rowSpan={2}>
                  Club
                </th>
                <th style={tvTh("#343a40")} rowSpan={2}>
                  BW
                </th>
                {!isHandicap && (
                  <th style={tvTh("#2d5016")} colSpan={3}>
                    Squat
                  </th>
                )}
                <th style={tvTh("#0c3547")} colSpan={3}>
                  Bench
                </th>
                {!isHandicap && (
                  <th style={tvTh("#1a3a1a")} colSpan={3}>
                    Deadlift
                  </th>
                )}
              </tr>
              <tr>
                {!isHandicap &&
                  [1, 2, 3].map((attempt) => (
                    <th key={`sq-${attempt}`} style={tvTh("#6c757d")}>
                      {attempt}
                    </th>
                  ))}
                {[1, 2, 3].map((attempt) => (
                  <th key={`be-${attempt}`} style={tvTh("#6c757d")}>
                    {attempt}
                  </th>
                ))}
                {!isHandicap &&
                  [1, 2, 3].map((attempt) => (
                    <th key={`dl-${attempt}`} style={tvTh("#6c757d")}>
                      {attempt}
                    </th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, idx) => (
                <tr key={entry.id} style={{ background: idx % 2 === 0 ? "#fff" : "#f8f9fa" }}>
                  <td style={tvTd}>{entry.lot || entry.id}</td>
                  <td style={tvTd}>{idx + 1}</td>
                  <td style={{ ...tvTd, textAlign: "left", fontWeight: 600, color: "#212529" }}>{entry.name}</td>
                  <td style={{ ...tvTd, color: "#6c757d" }}>{entry.team || "—"}</td>
                  <td style={tvTd}>{entry.bodyweightKg || "—"}</td>
                  {!isHandicap &&
                    entry.squatKg.slice(0, 3).map((kg, i) => (
                      <td key={i} style={getLiftCellStyle(entry, entry.squatStatus[i], "S", i)}>
                        {formatLiftValue(kg)}
                      </td>
                    ))}
                  {entry.benchKg.slice(0, 3).map((kg, i) => (
                    <td key={i} style={getLiftCellStyle(entry, entry.benchStatus[i], "B", i)}>
                      {formatLiftValue(kg)}
                    </td>
                  ))}
                  {!isHandicap &&
                    entry.deadliftKg.slice(0, 3).map((kg, i) => (
                      <td key={i} style={getLiftCellStyle(entry, entry.deadliftStatus[i], "D", i)}>
                        {formatLiftValue(kg)}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

const tvTh = (bg: string): React.CSSProperties => ({
  padding: "8px 12px",
  background: bg,
  color: "#fff",
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  textAlign: "center",
  borderBottom: "2px solid #dee2e6",
});

const tvTd: React.CSSProperties = {
  padding: "7px 12px",
  textAlign: "center",
  borderBottom: "1px solid #dee2e6",
  color: "#495057",
};

const statusBg = (s?: number) => (s === 1 ? "#d4edda" : s === -1 ? "#f8d7da" : "transparent");
const statusColor = (s?: number) => (s === 1 ? "#155724" : s === -1 ? "#721c24" : "#495057");

export default TVScreen;
