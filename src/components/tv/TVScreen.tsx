// src/components/tv/TVScreen.tsx
// Fullscreen TV/audience screen — light theme matching main referee page.

import React, { useEffect, useState } from "react";
import Chrono from "../lifting/Chrono";
import { getSocket } from "../../socket/socketClient";

interface AthleteInfo {
  name?: string;
  bodyweightKg?: number;
  category?: string;
  region?: string;
  club?: string;
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

  const { currentAthlete, currentLift, currentAttempt, requestedWeightKg, judgeVotes, finalResult, mode, entries } =
    state;
  const isHandicap = mode === "Handicap";
  const liftName = isHandicap ? "BENCH PRESS" : LIFT_NAMES[currentLift] || currentLift;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f9fa",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        display: "grid",
        gridTemplateRows: "52px auto 1fr",
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

      {/* Current athlete panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          background: "#fff",
          borderBottom: "2px solid #dee2e6",
          boxShadow: "0 2px 4px rgba(0,0,0,0.06)",
        }}
      >
        {/* Left: athlete info */}
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", gap: "20px" }}>
          {currentAthlete?.athletePhotoUrl && (
            <img
              src={currentAthlete.athletePhotoUrl}
              alt="athlete"
              style={{
                width: "72px",
                height: "72px",
                objectFit: "cover",
                borderRadius: "4px",
                border: "1px solid #dee2e6",
              }}
            />
          )}
          {currentAthlete?.clubLogoUrl && (
            <img
              src={currentAthlete.clubLogoUrl}
              alt="club"
              style={{ width: "56px", height: "56px", objectFit: "contain" }}
            />
          )}

          {currentAthlete?.name ? (
            <div>
              <div style={{ fontSize: "36px", fontWeight: 700, lineHeight: 1, marginBottom: "6px", color: "#212529" }}>
                {currentAthlete.name}
              </div>
              <div style={{ display: "flex", gap: "16px", fontSize: "14px", color: "#6c757d" }}>
                {currentAthlete.lot != null && <span>No. {currentAthlete.lot}</span>}
                {currentAthlete.club && <span>{currentAthlete.club}</span>}
                {currentAthlete.category && <span>{currentAthlete.category}</span>}
                {currentAthlete.bodyweightKg != null && <span>{currentAthlete.bodyweightKg} kg</span>}
              </div>
            </div>
          ) : (
            <div style={{ color: "#adb5bd", fontSize: "20px" }}>Waiting for next athlete...</div>
          )}

          <div style={{ borderLeft: "1px solid #dee2e6", height: "60px", margin: "0 8px" }} />

          {/* Requested weight */}
          <div>
            <div
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "1px",
                color: "#6c757d",
                marginBottom: "2px",
              }}
            >
              Weight
            </div>
            <div style={{ fontSize: "42px", fontWeight: 700, color: "#dc3545", lineHeight: 1 }}>
              {requestedWeightKg}
              <span style={{ fontSize: "18px", color: "#adb5bd", marginLeft: "6px" }}>kg</span>
            </div>
          </div>
        </div>

        {/* Right: Timer + Judge lights */}
        <div
          style={{
            padding: "16px 24px",
            display: "flex",
            alignItems: "center",
            gap: "32px",
            borderLeft: "1px solid #dee2e6",
          }}
        >
          <Chrono large={true} />

          {/* Judge lights */}
          <div>
            <div
              style={{
                fontSize: "11px",
                textTransform: "uppercase",
                color: "#6c757d",
                marginBottom: "8px",
                letterSpacing: "1px",
              }}
            >
              Judges
            </div>
            {finalResult ? (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    letterSpacing: "2px",
                    marginBottom: "8px",
                    color: finalResult === "good" ? "#28a745" : "#dc3545",
                  }}
                >
                  {finalResult === "good" ? "GOOD LIFT" : "NO LIFT"}
                </div>
                <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                  {[1, 2, 3].map((j) => (
                    <div
                      key={j}
                      style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "50%",
                        background:
                          judgeVotes[j] === true ? "#ffffff" : judgeVotes[j] === false ? "#dc3545" : "#e9ecef",
                        border:
                          judgeVotes[j] === true
                            ? "2px solid #28a745"
                            : judgeVotes[j] === false
                              ? "2px solid #dc3545"
                              : "2px solid #dee2e6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: judgeVotes[j] === false ? "#fff" : "#6c757d",
                      }}
                    >
                      {j}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px" }}>
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
                      transition: "all 0.25s",
                    }}
                  >
                    {j}
                  </div>
                ))}
              </div>
            )}
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
                <th style={tvTh("#343a40")}>#</th>
                <th style={tvTh("#343a40")}>Place</th>
                <th style={{ ...tvTh("#343a40"), textAlign: "left" }}>Athlete</th>
                <th style={tvTh("#343a40")}>Club</th>
                <th style={tvTh("#343a40")}>BW</th>
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
                      <td
                        key={i}
                        style={{
                          ...tvTd,
                          background: statusBg(entry.squatStatus[i]),
                          color: statusColor(entry.squatStatus[i]),
                        }}
                      >
                        {kg || "—"}
                      </td>
                    ))}
                  {entry.benchKg.slice(0, 3).map((kg, i) => (
                    <td
                      key={i}
                      style={{
                        ...tvTd,
                        background: statusBg(entry.benchStatus[i]),
                        color: statusColor(entry.benchStatus[i]),
                      }}
                    >
                      {kg || "—"}
                    </td>
                  ))}
                  {!isHandicap &&
                    entry.deadliftKg.slice(0, 3).map((kg, i) => (
                      <td
                        key={i}
                        style={{
                          ...tvTd,
                          background: statusBg(entry.deadliftStatus[i]),
                          color: statusColor(entry.deadliftStatus[i]),
                        }}
                      >
                        {kg || "—"}
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

const statusBg = (s: number) => (s === 1 ? "#d4edda" : s === -1 ? "#f8d7da" : "transparent");
const statusColor = (s: number) => (s === 1 ? "#155724" : s === -1 ? "#721c24" : "#495057");

export default TVScreen;
