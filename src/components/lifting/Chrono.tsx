// src/components/lifting/Chrono.tsx
// Freestyle countdown timer — referee sets minutes and seconds manually.
// Synced in real-time to all screens via Socket.io.

import React, { useEffect, useState, useCallback, useRef } from "react";
import { getSocket, requestState, emitStartTimer, emitStopTimer, emitResetTimer } from "../../socket/socketClient";
import { playTimerAlert } from "../chrono/timerAudio";

interface ChronoProps {
  isReferee?: boolean;
  large?: boolean;
  defaultSeconds?: number;
}

const Chrono: React.FC<ChronoProps> = ({ isReferee = false, large = false, defaultSeconds = 60 }) => {
  const [seconds, setSeconds] = useState<number>(defaultSeconds);
  const [running, setRunning] = useState<boolean>(false);
  const [inputMins, setInputMins] = useState<string>("1");
  const [inputSecs, setInputSecs] = useState<string>("00");
  const prevRunningRef = useRef<boolean>(running);
  const prevSecondsRef = useRef<number>(seconds);

  useEffect(() => {
    // Timer just started
    if (!prevRunningRef.current && running) {
      playTimerAlert("start");
    }
    // Warning beep each second of the last 5 seconds
    if (running && seconds <= 5 && seconds > 0 && prevSecondsRef.current !== seconds) {
      playTimerAlert("warning");
    }
    // Time is up — fires once when it transitions to 0
    if (prevSecondsRef.current > 0 && seconds === 0) {
      playTimerAlert("end");
    }
    prevRunningRef.current = running;
    prevSecondsRef.current = seconds;
  }, [running, seconds]);

  useEffect(() => {
    const socket = getSocket();

    const onTick = ({ seconds: s, running: r }: { seconds: number; running: boolean }) => {
      setSeconds(s);
      setRunning(r);
    };

    const onStateUpdate = (state: { timerSeconds?: number; timerRunning?: boolean }) => {
      if (state.timerSeconds !== undefined) setSeconds(state.timerSeconds);
      if (state.timerRunning !== undefined) setRunning(state.timerRunning);
    };

    socket.on("timer_tick", onTick);
    socket.on("state_update", onStateUpdate);
    requestState();

    return () => {
      socket.off("timer_tick", onTick);
      socket.off("state_update", onStateUpdate);
    };
  }, []);

  const handleStart = useCallback(() => emitStartTimer(), []);
  const handleStop = useCallback(() => emitStopTimer(), []);

  const handleSet = useCallback(() => {
    const m = parseInt(inputMins, 10) || 0;
    const s = parseInt(inputSecs, 10) || 0;
    const total = m * 60 + s;
    if (total > 0) emitResetTimer(total);
  }, [inputMins, inputSecs]);

  const getColor = () => {
    if (seconds > 30) return "#28a745";
    if (seconds > 10) return "#ffc107";
    return "#dc3545";
  };

  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const display = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;

  // ── Large version (TV screen) ──────────────────────────────────────────────
  if (large) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 40px",
          background: "#fff",
          borderRadius: "4px",
          border: `3px solid ${getColor()}`,
          boxShadow: `0 2px 8px rgba(0,0,0,0.15)`,
        }}
      >
        <div
          style={{
            fontSize: "120px",
            fontWeight: 700,
            fontFamily: "monospace",
            color: getColor(),
            lineHeight: 1,
          }}
        >
          {display}
        </div>
        <div
          style={{
            color: "#6c757d",
            fontSize: "14px",
            marginTop: "4px",
            textTransform: "uppercase",
            letterSpacing: "1px",
          }}
        >
          {running ? "Running" : "Stopped"}
        </div>
      </div>
    );
  }

  // ── Referee version ────────────────────────────────────────────────────────
  return (
    <div>
      {/* Display */}
      <div
        style={{
          display: "inline-block",
          padding: "6px 18px",
          background: "#fff",
          border: `2px solid ${getColor()}`,
          borderRadius: "4px",
          marginBottom: "8px",
        }}
      >
        <span
          style={{
            fontSize: "36px",
            fontWeight: 700,
            fontFamily: "monospace",
            color: getColor(),
          }}
        >
          {display}
        </span>
      </div>

      {isReferee && (
        <div>
          {/* Set custom time */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <input
              type="number"
              min="0"
              max="99"
              value={inputMins}
              onChange={(e) => setInputMins(e.target.value)}
              className="form-control form-control-sm"
              style={{ width: "60px", textAlign: "center" }}
              placeholder="min"
              disabled={running}
            />
            <span style={{ fontWeight: 700, color: "#495057" }}>:</span>
            <input
              type="number"
              min="0"
              max="59"
              value={inputSecs}
              onChange={(e) => setInputSecs(e.target.value)}
              className="form-control form-control-sm"
              style={{ width: "60px", textAlign: "center" }}
              placeholder="sec"
              disabled={running}
            />
            <button onClick={handleSet} className="btn btn-sm btn-secondary" disabled={running}>
              Set
            </button>
          </div>

          {/* Controls */}
          <div style={{ display: "flex", gap: "6px" }}>
            {!running ? (
              <button onClick={handleStart} className="btn btn-sm btn-success">
                Start
              </button>
            ) : (
              <button onClick={handleStop} className="btn btn-sm btn-warning">
                Pause
              </button>
            )}
            <button
              onClick={() => {
                const m = parseInt(inputMins, 10) || 0;
                const s = parseInt(inputSecs, 10) || 0;
                emitResetTimer(m * 60 + s || defaultSeconds);
              }}
              className="btn btn-sm btn-secondary"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Chrono;
