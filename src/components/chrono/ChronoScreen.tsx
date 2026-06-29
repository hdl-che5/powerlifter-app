// src/components/chrono/ChronoScreen.tsx
// Standalone fullscreen chronometer for the referee.

import React, { useEffect, useState, useCallback, useRef } from "react";
import { getSocket, requestState, emitStartTimer, emitStopTimer, emitResetTimer } from "../../socket/socketClient";
import { playTimerAlert } from "./timerAudio";

const ChronoScreen: React.FC = () => {
  const [seconds, setSeconds] = useState<number>(60);
  const [running, setRunning] = useState<boolean>(false);
  const [inputMins, setInputMins] = useState<string>("1");
  const [inputSecs, setInputSecs] = useState<string>("00");
  const prevRunningRef = useRef<boolean>(running);
  const prevSecondsRef = useRef<number>(seconds);

  useEffect(() => {
    if (!prevRunningRef.current && running) playTimerAlert("start");
    if (running && seconds <= 5 && seconds > 0 && prevSecondsRef.current !== seconds) playTimerAlert("warning");
    if (prevSecondsRef.current > 0 && seconds === 0) playTimerAlert("end");
    prevRunningRef.current = running;
    prevSecondsRef.current = seconds;
  }, [running, seconds]);

  useEffect(() => {
    const socket = getSocket();
    const onTick = ({ seconds: s, running: r }: { seconds: number; running: boolean }) => {
      setSeconds(s);
      setRunning(r);
    };
    const onState = (state: { timerSeconds?: number; timerRunning?: boolean }) => {
      if (state.timerSeconds !== undefined) setSeconds(state.timerSeconds);
      if (state.timerRunning !== undefined) setRunning(state.timerRunning);
    };
    socket.on("timer_tick", onTick);
    socket.on("state_update", onState);
    requestState();
    return () => {
      socket.off("timer_tick", onTick);
      socket.off("state_update", onState);
    };
  }, []);

  const setTimer = useCallback((totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    setInputMins(String(m));
    setInputSecs(String(s).padStart(2, "0"));
    emitResetTimer(totalSeconds);
  }, []);

  const handleCustomSet = useCallback(() => {
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8f9fa",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Segoe UI', Arial, sans-serif",
        padding: "32px",
      }}
    >
      {/* Title */}
      <div
        style={{
          fontSize: "11px",
          textTransform: "uppercase",
          letterSpacing: "3px",
          color: "#6c757d",
          marginBottom: "32px",
          fontWeight: 600,
        }}
      >
        Chronometer
      </div>

      {/* Big display */}
      <div
        style={{
          fontSize: "160px",
          fontWeight: 700,
          fontFamily: "monospace",
          color: getColor(),
          lineHeight: 1,
          marginBottom: "8px",
          transition: "color 0.5s",
          border: `3px solid ${getColor()}`,
          borderRadius: "8px",
          padding: "8px 32px",
          background: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        {display}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#6c757d",
          letterSpacing: "2px",
          marginBottom: "48px",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {running ? "Running" : "Stopped"}
      </div>

      {/* Preset buttons */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "24px" }}>
        {[
          { label: "1 min", val: 60 },
          { label: "3 min", val: 180 },
          { label: "5 min", val: 300 },
        ].map((preset) => (
          <button
            key={preset.val}
            onClick={() => setTimer(preset.val)}
            disabled={running}
            className="btn btn-outline-secondary"
            style={{ fontSize: "14px", fontWeight: 600, letterSpacing: "1px", minWidth: "80px" }}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom time input */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "32px" }}>
        <input
          type="number"
          min="0"
          max="99"
          value={inputMins}
          onChange={(e) => setInputMins(e.target.value)}
          disabled={running}
          className="form-control"
          style={{ width: "80px", textAlign: "center", fontSize: "20px", fontWeight: 700 }}
          placeholder="mm"
        />
        <span style={{ fontSize: "24px", fontWeight: 700, color: "#495057" }}>:</span>
        <input
          type="number"
          min="0"
          max="59"
          value={inputSecs}
          onChange={(e) => setInputSecs(e.target.value)}
          disabled={running}
          className="form-control"
          style={{ width: "80px", textAlign: "center", fontSize: "20px", fontWeight: 700 }}
          placeholder="ss"
        />
        <button onClick={handleCustomSet} disabled={running} className="btn btn-secondary">
          Set
        </button>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: "12px" }}>
        {!running ? (
          <button
            onClick={() => emitStartTimer()}
            className="btn btn-success"
            style={{ padding: "12px 40px", fontSize: "15px", fontWeight: 700, letterSpacing: "2px" }}
          >
            Start
          </button>
        ) : (
          <button
            onClick={() => emitStopTimer()}
            className="btn btn-warning"
            style={{ padding: "12px 40px", fontSize: "15px", fontWeight: 700, letterSpacing: "2px" }}
          >
            Pause
          </button>
        )}
        <button
          onClick={() => {
            const m = parseInt(inputMins, 10) || 0;
            const s = parseInt(inputSecs, 10) || 0;
            emitResetTimer(m * 60 + s || 60);
          }}
          className="btn btn-outline-secondary"
          style={{ padding: "12px 40px", fontSize: "15px", fontWeight: 700, letterSpacing: "2px" }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default ChronoScreen;
