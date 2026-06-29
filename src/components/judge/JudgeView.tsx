// src/components/judge/JudgeView.tsx
// Judge screen for phones/tablets.
// Vibrates and plays a sound when 2 votes are in and this judge hasn't voted yet.

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  getSocket,
  emitJudgeVote,
  getConnectionStatus,
  onConnectionStatusChange,
  requestState,
} from "../../socket/socketClient";

type VoteState = null | "good" | "no";

// Generates a short beep sound using the Web Audio API
function playAlert() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.8);
  } catch {}
}

function vibrateDevice() {
  try {
    if (navigator.vibrate) {
      // Pattern: vibrate 200ms, pause 100ms, vibrate 200ms, pause 100ms, vibrate 400ms
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  } catch {}
}

const JudgeView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const judgeId = parseInt(id || "1", 10) as 1 | 2 | 3;

  const [locked, setLocked] = useState<boolean>(true);
  const [voted, setVoted] = useState<VoteState>(null);
  const [waiting, setWaiting] = useState<boolean>(false);
  const [finalResult, setFinalResult] = useState<{ result: string; votes: Record<number, boolean | null> } | null>(
    null,
  );
  const [currentAthlete, setCurrentAthlete] = useState<{ name?: string } | null>(null);
  const [currentLift, setCurrentLift] = useState<{ type?: string; weight?: number; attempt?: number } | null>(null);
  const [votesIn, setVotesIn] = useState<number>(0);
  const [connectionStatus, setConnectionStatusLocal] = useState<"connected" | "disconnected" | "reconnecting">(
    getConnectionStatus(),
  );
  const alertedRef = useRef<boolean>(false);

  useEffect(() => {
    const socket = getSocket();
    const unsubscribe = onConnectionStatusChange(setConnectionStatusLocal);

    socket.on("state_update", (state: any) => {
      if (state.currentAthlete) setCurrentAthlete(state.currentAthlete);
      if (state.currentLift || state.currentAttempt || state.requestedWeightKg) {
        setCurrentLift({
          type: state.currentLift,
          weight: state.requestedWeightKg,
          attempt: state.currentAttempt,
        });
      }
      if (state.finalResult === null) {
        setLocked(false);
        setVoted(null);
        setWaiting(false);
        setFinalResult(null);
        setVotesIn(0);
        alertedRef.current = false;
      }
    });

    socket.on("judge_vote_received", ({ votesIn: n }: { judgeId: number; vote: boolean; votesIn: number }) => {
      setVotesIn(n);
    });

    socket.on("final_result", (data: any) => {
      setFinalResult(data);
      setWaiting(false);
    });

    socket.on("votes_reset", () => {
      setVoted(null);
      setWaiting(false);
      setFinalResult(null);
      setLocked(false);
      setVotesIn(0);
      alertedRef.current = false;
    });

    socket.on("judge_reset", ({ judgeId: resetJudgeId }: { judgeId: number }) => {
      if (resetJudgeId === judgeId) {
        setVoted(null);
        setWaiting(false);
        alertedRef.current = false;
      }
    });

    requestState();

    return () => {
      socket.off("state_update");
      socket.off("judge_vote_received");
      socket.off("final_result");
      socket.off("votes_reset");
      socket.off("judge_reset");
      unsubscribe();
    };
  }, []);

  // Alert when 2 votes are in and this judge hasn't voted yet
  useEffect(() => {
    if (votesIn === 2 && voted === null && !locked && !alertedRef.current) {
      alertedRef.current = true;
      playAlert();
      vibrateDevice();
    }
  }, [votesIn, voted, locked]);

  const handleVote = useCallback(
    (vote: boolean) => {
      if (voted !== null || locked) return;
      emitJudgeVote(judgeId, vote);
      setVoted(vote ? "good" : "no");
      setWaiting(true);
    },
    [judgeId, voted, locked],
  );

  const base: React.CSSProperties = {
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    background: "#1a1a2e",
    color: "#fff",
    fontFamily: "'Segoe UI', Arial, sans-serif",
    userSelect: "none",
    padding: "24px",
    position: "relative",
  };

  const connectionBadge: React.CSSProperties = {
    position: "absolute",
    top: "12px",
    right: "12px",
    padding: "6px 12px",
    borderRadius: "4px",
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1px",
    background:
      connectionStatus === "connected" ? "#28a745" : connectionStatus === "reconnecting" ? "#ffc107" : "#dc3545",
    color: connectionStatus === "reconnecting" ? "#000" : "#fff",
  };

  const alerting = votesIn === 2 && voted === null && !locked;

  // Locked
  if (locked) {
    return (
      <div style={base}>
        <div style={connectionBadge}>{connectionStatus}</div>
        <div
          style={{
            fontSize: "13px",
            textTransform: "uppercase",
            letterSpacing: "2px",
            color: "#6c757d",
            marginBottom: "12px",
          }}
        >
          Judge {judgeId}
        </div>
        <div style={{ fontSize: "24px", fontWeight: 600, color: "#adb5bd" }}>Waiting for lift...</div>
      </div>
    );
  }

  // Final result
  if (finalResult) {
    const isGood = finalResult.result === "good";
    return (
      <div style={{ ...base, background: isGood ? "#0d1f0d" : "#1f0d0d" }}>
        <div style={connectionBadge}>{connectionStatus}</div>
        <div
          style={{
            fontSize: "46px",
            fontWeight: 700,
            color: isGood ? "#28a745" : "#dc3545",
            letterSpacing: "4px",
            marginBottom: "24px",
          }}
        >
          {isGood ? "GOOD LIFT" : "NO LIFT"}
        </div>
        <div style={{ display: "flex", gap: "20px", marginBottom: "24px" }}>
          {[1, 2, 3].map((j) => (
            <div
              key={j}
              style={{
                width: "52px",
                height: "52px",
                borderRadius: "50%",
                background:
                  finalResult.votes[j] === true ? "#ffffff" : finalResult.votes[j] === false ? "#dc3545" : "#333",
                border: "2px solid #555",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "15px",
                fontWeight: 700,
                color: "#000",
              }}
            >
              {j}
            </div>
          ))}
        </div>
        <div style={{ color: "#6c757d", fontSize: "13px", textTransform: "uppercase", letterSpacing: "1px" }}>
          Waiting for next lift
        </div>
      </div>
    );
  }

  // Waiting after vote
  if (waiting) {
    return (
      <div style={base}>
        <div style={connectionBadge}>{connectionStatus}</div>
        <div
          style={{
            fontSize: "13px",
            textTransform: "uppercase",
            letterSpacing: "2px",
            color: "#6c757d",
            marginBottom: "12px",
          }}
        >
          Judge {judgeId}
        </div>
        <div
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color: voted === "good" ? "#28a745" : "#dc3545",
            marginBottom: "20px",
          }}
        >
          {voted === "good" ? "GOOD LIFT" : "NO LIFT"}
        </div>
        <div style={{ color: "#adb5bd", fontSize: "15px", marginBottom: "16px" }}>
          Waiting for other judges ({votesIn}/3)
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {[1, 2, 3].map((j) => (
            <div
              key={j}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                background: j <= votesIn ? "#495057" : "#212529",
                border: j <= votesIn ? "2px solid #6c757d" : "2px solid #343a40",
                transition: "all 0.3s",
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Voting state
  return (
    <div style={{ ...base, background: alerting ? "#1a1a0a" : "#1a1a2e" }}>
      <div style={connectionBadge}>{connectionStatus}</div>

      {/* Alert banner */}
      {alerting && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            background: "#ffc107",
            color: "#000",
            padding: "10px",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "15px",
            letterSpacing: "1px",
            animation: "pulse 0.5s infinite alternate",
          }}
        >
          TWO VOTES IN — PLEASE VOTE NOW
        </div>
      )}

      <style>{`
        @keyframes pulse {
          from { opacity: 1; }
          to { opacity: 0.6; }
        }
      `}</style>

      <div
        style={{
          fontSize: "13px",
          textTransform: "uppercase",
          letterSpacing: "2px",
          color: "#6c757d",
          marginBottom: "4px",
        }}
      >
        Judge {judgeId}
      </div>
      {currentAthlete?.name && (
        <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "8px", color: "#adb5bd" }}>
          {currentAthlete.name}
        </div>
      )}
      {currentLift && (
        <div style={{ fontSize: "14px", color: "#999", marginBottom: "24px", textAlign: "center" }}>
          {currentLift.type} • {currentLift.weight}kg • Attempt {currentLift.attempt}
        </div>
      )}

      <div style={{ display: "flex", gap: "20px", width: "100%", maxWidth: "500px" }}>
        {/* Good Lift — WHITE */}
        <button
          onClick={() => handleVote(true)}
          style={{
            flex: 1,
            height: "190px",
            background: "#ffffff",
            border: "2px solid #dee2e6",
            borderRadius: "6px",
            color: "#212529",
            fontSize: "20px",
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "2px",
            textTransform: "uppercase",
            transition: "background 0.15s",
            boxShadow: "0 4px 16px rgba(255,255,255,0.15)",
          }}
          onMouseDown={(e) => (e.currentTarget.style.background = "#f8f9fa")}
          onMouseUp={(e) => (e.currentTarget.style.background = "#ffffff")}
        >
          Good Lift
        </button>

        {/* No Lift — RED */}
        <button
          onClick={() => handleVote(false)}
          style={{
            flex: 1,
            height: "190px",
            background: "#491217",
            border: "2px solid #dc3545",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "20px",
            fontWeight: 700,
            cursor: "pointer",
            letterSpacing: "2px",
            textTransform: "uppercase",
            transition: "background 0.15s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.background = "#2c0a0e")}
          onMouseUp={(e) => (e.currentTarget.style.background = "#491217")}
        >
          No Lift
        </button>
      </div>
    </div>
  );
};

export default JudgeView;
