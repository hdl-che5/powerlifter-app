// src/components/lifting/RefereeDashboard.tsx

import React, { useEffect, useState, useCallback } from "react";
import Chrono from "./Chrono";
import {
  getSocket,
  emitResetVotes,
  emitStateUpdate,
  emitJudgeVote,
  emitManualOverride,
  emitResetSpecificJudge,
} from "../../socket/socketClient";

interface AthleteInfo {
  name?: string;
  bodyweightKg?: number;
  category?: string;
  lot?: number;
  team?: string;
  athletePhotoUrl?: string;
  clubLogoUrl?: string;
}

interface DashboardProps {
  mode?: "Standard" | "Handicap";
  currentAthlete?: AthleteInfo | null;
  requestedWeightKg?: number;
  currentLift?: string;
  currentAttempt?: number;
}

const LIFT_LABELS: Record<string, string> = { S: "Squat", B: "Bench", D: "Deadlift" };

const RefereeDashboard: React.FC<DashboardProps> = ({
  mode = "Standard",
  currentAthlete = null,
  requestedWeightKg = 0,
  currentLift = "S",
  currentAttempt = 1,
}) => {
  const [judgeVotes, setJudgeVotes] = useState<Record<number, boolean | null>>({ 1: null, 2: null, 3: null });
  const [finalResult, setFinalResult] = useState<{ result: string; votes: Record<number, boolean | null> } | null>(
    null,
  );
  const [votesIn, setVotesIn] = useState<number>(0);
  const [pushConfirm, setPushConfirm] = useState<boolean>(false);
  const [showRefControls, setShowRefControls] = useState<boolean>(false);

  useEffect(() => {
    const socket = getSocket();
    socket.on(
      "judge_vote_received",
      ({
        judgeId,
        vote,
        judgeVotes,
        votesIn: n,
      }: {
        judgeId: number;
        vote: boolean;
        judgeVotes?: Record<number, boolean | null>;
        votesIn: number;
      }) => {
        if (judgeVotes) {
          setJudgeVotes(judgeVotes);
        } else if (judgeId !== undefined) {
          setJudgeVotes((prev) => ({ ...prev, [judgeId]: vote }));
        }
        setVotesIn(n);
      },
    );
    socket.on("final_result", (data: { result: string; votes: Record<number, boolean | null> }) => {
      setFinalResult(data);
      setJudgeVotes(data.votes);
    });
    socket.on("votes_reset", () => {
      setJudgeVotes({ 1: null, 2: null, 3: null });
      setFinalResult(null);
      setVotesIn(0);
    });
    socket.on("judge_reset", ({ judgeId }: { judgeId: number }) => {
      setJudgeVotes((prev) => ({ ...prev, [judgeId]: null }));
      setFinalResult(null);
    });
    return () => {
      socket.off("judge_vote_received");
      socket.off("final_result");
      socket.off("votes_reset");
      socket.off("judge_reset");
    };
  }, []);

  const handlePushToTV = useCallback(() => {
    emitStateUpdate({
      currentAthlete,
      currentLift,
      currentAttempt,
      requestedWeightKg,
      mode,
      finalResult: null,
    });
    setPushConfirm(true);
    setTimeout(() => setPushConfirm(false), 2000);
  }, [currentAthlete, currentLift, currentAttempt, requestedWeightKg, mode]);

  const handleResetVotes = useCallback(() => {
    emitResetVotes();
  }, []);
  const handleRejectVote = useCallback(() => {
    emitResetVotes();
    setShowRefControls(false);
  }, []);
  const handleManualOverride = useCallback((result: "good" | "no") => {
    const { emitManualOverride } = require("../../socket/socketClient");
    emitManualOverride(result);
    setShowRefControls(false);
  }, []);

  const handleResetJudge = useCallback((judgeId: number) => {
    const { emitResetSpecificJudge } = require("../../socket/socketClient");
    emitResetSpecificJudge(judgeId);
  }, []);

  return (
    <div className="card" style={{ marginBottom: "8px", borderRadius: "6px" }}>
      {/* Header */}
      <div className="card-header d-flex justify-content-between align-items-center py-2">
        <span style={{ fontWeight: 600, fontSize: "13px" }}>Live Control</span>
        <div className="d-flex align-items-center" style={{ gap: "8px" }}>
          <span className={`badge badge-${mode === "Handicap" ? "warning" : "primary"}`}>
            {mode === "Handicap" ? "HANDICAP" : "STANDARD"}
          </span>
          <button onClick={handlePushToTV} className={`btn btn-sm ${pushConfirm ? "btn-success" : "btn-dark"}`}>
            {pushConfirm ? "Sent" : "Push to TV"}
          </button>
          <button onClick={() => setShowRefControls(!showRefControls)} className="btn btn-sm btn-warning">
            {showRefControls ? "Close Controls" : "Ref Controls"}
          </button>
          <button onClick={handleResetVotes} className="btn btn-sm btn-secondary">
            Reset Votes
          </button>
        </div>
      </div>

      {/* Referee Controls Panel */}
      {showRefControls && (
        <div className="card-footer py-2" style={{ background: "#f8f9fa", borderTop: "1px solid #dee2e6" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <small style={{ color: "#6c757d", fontWeight: 600 }}>Actions:</small>
            <button onClick={handleRejectVote} className="btn btn-sm btn-warning">
              ↺ Reject & Reset
            </button>
            <button onClick={() => handleManualOverride("good")} className="btn btn-sm btn-success">
              ✓ Override Good
            </button>
            <button onClick={() => handleManualOverride("no")} className="btn btn-sm btn-danger">
              ✗ Override No
            </button>
            {[1, 2, 3].map((j) => (
              <button key={j} onClick={() => handleResetJudge(j)} className="btn btn-sm btn-outline-secondary">
                Reset Judge {j}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="card-body py-2">
        <div className="row align-items-center" style={{ flexWrap: "nowrap", gap: "0" }}>
          {/* Photo (top) + Club logo (bottom) stacked vertically */}
          <div
            className="col-auto pr-3"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}
          >
            {currentAthlete?.athletePhotoUrl ? (
              <img
                src={currentAthlete.athletePhotoUrl}
                alt="athlete"
                style={{
                  width: "52px",
                  height: "52px",
                  objectFit: "cover",
                  borderRadius: "4px",
                  border: "1px solid #dee2e6",
                }}
              />
            ) : (
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "4px",
                  background: "#e9ecef",
                  border: "1px solid #dee2e6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                  color: "#adb5bd",
                }}
              >
                ?
              </div>
            )}
            {currentAthlete?.clubLogoUrl ? (
              <img
                src={currentAthlete.clubLogoUrl}
                alt="club"
                style={{ width: "36px", height: "36px", objectFit: "contain" }}
              />
            ) : (
              <div style={{ width: "36px", height: "36px" }} />
            )}
          </div>

          {/* Athlete info — bold and prominent */}
          <div className="col-auto pr-4" style={{ minWidth: "220px" }}>
            <div
              style={{
                fontSize: "10px",
                textTransform: "uppercase",
                color: "#6c757d",
                letterSpacing: "1px",
                marginBottom: "2px",
              }}
            >
              Current Athlete
            </div>
            {currentAthlete?.name ? (
              <>
                <div
                  style={{ fontWeight: 700, fontSize: "22px", lineHeight: 1.1, color: "#212529", marginBottom: "3px" }}
                >
                  {currentAthlete.name}
                </div>
                <div style={{ color: "#6c757d", fontSize: "12px", marginBottom: "5px" }}>
                  {currentAthlete.lot ? (
                    <span
                      style={{
                        background: "#e9ecef",
                        borderRadius: "3px",
                        padding: "1px 6px",
                        marginRight: "6px",
                        fontWeight: 600,
                      }}
                    >
                      #{currentAthlete.lot}
                    </span>
                  ) : null}
                  {currentAthlete.team ? <span style={{ marginRight: "6px" }}>{currentAthlete.team}</span> : null}
                  {currentAthlete.bodyweightKg ? <span>{currentAthlete.bodyweightKg} kg</span> : null}
                </div>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "#212529",
                    borderRadius: "4px",
                    padding: "3px 10px",
                  }}
                >
                  <span
                    style={{
                      color: "#adb5bd",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {LIFT_LABELS[currentLift] || currentLift}
                  </span>
                  <span style={{ color: "#6c757d", fontSize: "11px" }}>Attempt {currentAttempt}</span>
                  <span style={{ color: "#fff", fontSize: "16px", fontWeight: 700 }}>{requestedWeightKg} kg</span>
                </div>
              </>
            ) : (
              <div style={{ color: "#adb5bd", fontSize: "13px", fontStyle: "italic", marginTop: "4px" }}>
                No athlete loaded
              </div>
            )}
          </div>

          <div style={{ borderLeft: "1px solid #dee2e6", height: "90px", margin: "0 16px" }} />

          {/* Timer */}
          <div className="col-auto">
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#6c757d", marginBottom: "4px" }}>
              Timer
            </div>
            <Chrono isReferee={true} />
          </div>

          <div style={{ borderLeft: "1px solid #dee2e6", height: "70px", margin: "0 16px" }} />

          {/* Judge indicators */}
          <div className="col-auto">
            <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#6c757d", marginBottom: "6px" }}>
              Judge Votes ({votesIn}/3)
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              {[1, 2, 3].map((j) => {
                const vote = judgeVotes[j];
                const voted = vote !== null;
                let bg = "#f8f9fa",
                  border = "#dee2e6",
                  color = "#adb5bd",
                  label = String(j);
                if (voted && vote === true) {
                  bg = "#fff";
                  border = "#28a745";
                  color = "#155724";
                  label = "G";
                }
                if (voted && vote === false) {
                  bg = "#dc3545";
                  border = "#dc3545";
                  color = "#fff";
                  label = "X";
                }

                const handleRefereeClick = () => {
                  if (vote === null) {
                    emitJudgeVote(j as 1 | 2 | 3, true);
                  } else if (vote === true) {
                    emitJudgeVote(j as 1 | 2 | 3, false);
                  } else {
                    emitJudgeVote(j as 1 | 2 | 3, true);
                  }
                };

                return (
                  <div
                    key={j}
                    onClick={handleRefereeClick}
                    role="button"
                    tabIndex={0}
                    style={{
                      width: "52px",
                      height: "52px",
                      borderRadius: "50%",
                      background: bg,
                      border: `2px solid ${border}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      fontWeight: 700,
                      color,
                      transition: "all 0.25s",
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Final result */}
          {finalResult && (
            <>
              <div style={{ borderLeft: "1px solid #dee2e6", height: "70px", margin: "0 16px" }} />
              <div className="col-auto">
                <div style={{ fontSize: "11px", textTransform: "uppercase", color: "#6c757d", marginBottom: "6px" }}>
                  Result
                </div>
                <div
                  className={`alert alert-${finalResult.result === "good" ? "secondary" : "danger"} mb-0 py-2 px-3`}
                  style={{
                    fontWeight: 700,
                    fontSize: "16px",
                    background: finalResult.result === "good" ? "#fff" : undefined,
                    border: finalResult.result === "good" ? "2px solid #333" : undefined,
                  }}
                >
                  {finalResult.result === "good" ? "GOOD LIFT" : "NO LIFT"}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RefereeDashboard;
