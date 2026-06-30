// server/index.js — Express + Socket.io + SQLite (sql.js — pure JS, no compilation)

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const competitionsRouter = require("./routes/competitions");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] },
});

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ── REST API ──────────────────────────────────────────────────────────────────
app.use("/api/competitions", competitionsRouter);
app.get("/api/health", (req, res) => res.json({ ok: true, ts: Date.now() }));

// ── Live competition state (in-memory) ────────────────────────────────────────
let liveState = {
  competitionId: null,
  currentAthlete: null,
  nextAthlete: null,
  currentLift: "S",
  currentAttempt: 1,
  requestedWeightKg: 0,
  timerSeconds: 60,
  timerRunning: false,
  timerMax: 60,
  judgeVotes: { 1: null, 2: null, 3: null },
  finalResult: null,
  mode: "Standard",
  reduxState: null,
  entries: [],
};

// ── Timer tick loop ───────────────────────────────────────────────────────────
let timerInterval = null;

function startTimerLoop() {
  if (timerInterval) return;
  timerInterval = setInterval(() => {
    if (!liveState.timerRunning) return;
    if (liveState.timerSeconds <= 0) {
      liveState.timerRunning = false;
      io.emit("timer_tick", { seconds: 0, running: false });
      clearInterval(timerInterval);
      timerInterval = null;
      return;
    }
    liveState.timerSeconds -= 1;
    io.emit("timer_tick", { seconds: liveState.timerSeconds, running: true });
  }, 1000);
}

// ── Socket.io events ──────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[Socket] connected: ${socket.id}`);
  socket.emit("state_update", liveState);

  socket.on("state_update", (data) => {
    liveState = { ...liveState, ...data };
    socket.broadcast.emit("state_update", liveState);
  });

  socket.on("request_state", () => {
    socket.emit("state_update", liveState);
  });

  socket.on("start_timer", ({ seconds } = {}) => {
    if (seconds !== undefined) liveState.timerSeconds = seconds;
    liveState.timerRunning = true;
    io.emit("timer_tick", { seconds: liveState.timerSeconds, running: true });
    startTimerLoop();
  });

  socket.on("stop_timer", () => {
    liveState.timerRunning = false;
    io.emit("timer_tick", { seconds: liveState.timerSeconds, running: false });
  });

  socket.on("reset_timer", ({ seconds } = {}) => {
    liveState.timerRunning = false;
    liveState.timerSeconds = seconds !== undefined ? seconds : liveState.timerMax;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    io.emit("timer_tick", { seconds: liveState.timerSeconds, running: false });
  });

  socket.on("judge_vote", async ({ judgeId, vote }) => {
    const voteStartTime = Date.now();
    liveState.judgeVotes[judgeId] = vote;

    // Persist vote to database
    try {
      const db = require("./db");
      await db.recordJudgeVote({
        competitionId: liveState.competitionId,
        athleteId: liveState.currentAthlete?.id,
        liftType: liveState.currentLift,
        attemptNumber: liveState.currentAttempt,
        weightKg: liveState.requestedWeightKg,
        judgeId,
        vote,
        decisionTimeMs: Date.now() - voteStartTime,
      });
    } catch (err) {
      console.error("[DB] Failed to record vote:", err.message);
    }

    io.emit("judge_vote_received", {
      judgeId,
      vote,
      judgeVotes: { ...liveState.judgeVotes },
      votesIn: Object.values(liveState.judgeVotes).filter((v) => v !== null).length,
    });
    const votes = Object.values(liveState.judgeVotes);
    if (votes.every((v) => v !== null)) {
      const goodCount = votes.filter(Boolean).length;
      const result = goodCount >= 2 ? "good" : "no";
      liveState.finalResult = result;

      // Persist final decision
      try {
        const db = require("./db");
        await db.recordVoteDecision({
          competitionId: liveState.competitionId,
          athleteId: liveState.currentAthlete?.id,
          liftType: liveState.currentLift,
          attemptNumber: liveState.currentAttempt,
          weightKg: liveState.requestedWeightKg,
          judge1Vote: liveState.judgeVotes[1],
          judge2Vote: liveState.judgeVotes[2],
          judge3Vote: liveState.judgeVotes[3],
          finalResult: result,
        });
        await db.updateVoteAnalytics(liveState.competitionId);
      } catch (err) {
        console.error("[DB] Failed to record decision:", err.message);
      }

      io.emit("final_result", { result, votes: liveState.judgeVotes });
    }
  });

  socket.on("reset_votes", () => {
    liveState.judgeVotes = { 1: null, 2: null, 3: null };
    liveState.finalResult = null;
    io.emit("votes_reset", {});
  });

  socket.on("update_current_lift", (data) => {
    liveState.currentAthlete =
      data.currentAthlete ||
      (data.athleteName ? { id: data.athleteId, name: data.athleteName } : null);
    liveState.nextAthlete = data.nextAthlete || null;
    if (data.liftType) liveState.currentLift = data.liftType;
    if (data.attemptNumber) liveState.currentAttempt = data.attemptNumber;
    if (data.weightKg !== undefined) liveState.requestedWeightKg = data.weightKg;
    io.emit("state_update", liveState);
  });

  socket.on("accept_vote", () => {
    // Persist and lock current vote
    if (liveState.finalResult) {
      io.emit("vote_accepted", { result: liveState.finalResult });
    }
  });

  socket.on("reject_vote", () => {
    liveState.judgeVotes = { 1: null, 2: null, 3: null };
    liveState.finalResult = null;
    io.emit("vote_rejected", {});
  });

  socket.on("manual_override", ({ result }) => {
    liveState.finalResult = result;
    liveState.judgeVotes = { 1: result === "good", 2: result === "good", 3: result === "good" };
    io.emit("final_result", { result, votes: liveState.judgeVotes, overridden: true });
  });

  socket.on("reset_judge_vote", ({ judgeId }) => {
    liveState.judgeVotes[judgeId] = null;
    liveState.finalResult = null;
    io.emit("judge_reset", { judgeId, votesIn: Object.values(liveState.judgeVotes).filter((v) => v !== null).length });
  });

  socket.on("load_competition", async ({ id }) => {
    try {
      const db = require("./db");
      const comp = await db.getCompetitionById(id);
      if (!comp) {
        socket.emit("error", { msg: "Competition not found" });
        return;
      }
      liveState.competitionId = comp.id;
      liveState.mode = comp.mode || "Standard";
      if (comp.state_json) {
        try {
          liveState.reduxState = JSON.parse(comp.state_json);
        } catch {}
      }
      io.emit("state_update", liveState);
    } catch (err) {
      socket.emit("error", { msg: err.message });
    }
  });

  socket.on("sync_redux_state", (reduxState) => {
    liveState.reduxState = reduxState;
    // Extract entries from Redux state and broadcast to all screens (TV, Marshall)
    if (reduxState?.registration?.entries) {
      liveState.entries = reduxState.registration.entries;
      io.emit("state_update", { entries: liveState.entries });
    }
    socket.broadcast.emit("redux_state_update", reduxState);
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] disconnected: ${socket.id}`);
  });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`✅ Powerlifting server running on http://localhost:${PORT}`);
});
