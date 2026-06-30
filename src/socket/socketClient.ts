// src/socket/socketClient.ts — Socket.io client wrapper with reconnection & status

import { io, Socket } from "socket.io-client";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:4000";

let socket: Socket | null = null;
let connectionStatus: "connected" | "disconnected" | "reconnecting" = "disconnected";
let statusListeners: Array<(status: typeof connectionStatus) => void> = [];

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SERVER_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ["websocket", "polling"],
    });

    socket.on("connect", () => {
      console.log("[Socket] connected:", socket?.id);
      setConnectionStatus("connected");
    });

    socket.on("disconnect", () => {
      console.log("[Socket] disconnected");
      setConnectionStatus("disconnected");
    });

    socket.on("connect_error", (err) => {
      console.warn("[Socket] connect error:", err.message);
      setConnectionStatus("disconnected");
    });

    socket.on("reconnect_attempt", () => {
      console.log("[Socket] reconnecting...");
      setConnectionStatus("reconnecting");
    });
  }
  return socket;
}

function setConnectionStatus(status: typeof connectionStatus) {
  connectionStatus = status;
  statusListeners.forEach((listener) => listener(status));
}

export function getConnectionStatus(): typeof connectionStatus {
  return connectionStatus;
}

export function onConnectionStatusChange(listener: (status: typeof connectionStatus) => void) {
  statusListeners.push(listener);
  return () => {
    statusListeners = statusListeners.filter((l) => l !== listener);
  };
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function emitStateUpdate(data: Record<string, unknown>) {
  getSocket().emit("state_update", data);
}

export function requestState() {
  getSocket().emit("request_state");
}

export function emitStartTimer(seconds?: number) {
  getSocket().emit("start_timer", seconds !== undefined ? { seconds } : {});
}

export function emitStopTimer() {
  getSocket().emit("stop_timer");
}

export function emitResetTimer(seconds?: number) {
  getSocket().emit("reset_timer", seconds !== undefined ? { seconds } : {});
}

export function emitJudgeVote(judgeId: 1 | 2 | 3, vote: boolean) {
  getSocket().emit("judge_vote", { judgeId, vote });
}

export function emitResetVotes() {
  getSocket().emit("reset_votes");
}

export function emitSyncReduxState(reduxState: unknown) {
  getSocket().emit("sync_redux_state", reduxState);
}

export function emitLoadCompetition(id: number) {
  getSocket().emit("load_competition", { id });
}

// ── New: Current athlete/lift sync ──────────────────────────────────────────

export function emitUpdateCurrentLift(data: {
  athleteId?: number;
  athleteName?: string;
  liftType?: string;
  attemptNumber?: number;
  weightKg?: number;
  currentAthlete?: {
    id?: number;
    name?: string;
    bodyweightKg?: number;
    category?: string;
    lot?: number;
    team?: string;
    athletePhotoUrl?: string;
    clubLogoUrl?: string;
  };
  nextAthlete?: {
    id?: number;
    name?: string;
    bodyweightKg?: number;
    category?: string;
    lot?: number;
    team?: string;
    athletePhotoUrl?: string;
    clubLogoUrl?: string;
  };
}) {
  getSocket().emit("update_current_lift", data);
}

// ── New: Referee controls ──────────────────────────────────────────────────

export function emitAcceptVote() {
  getSocket().emit("accept_vote");
}

export function emitRejectVote() {
  getSocket().emit("reject_vote");
}

export function emitManualOverride(result: "good" | "no") {
  getSocket().emit("manual_override", { result });
}

export function emitResetSpecificJudge(judgeId: number) {
  getSocket().emit("reset_judge_vote", { judgeId });
}
