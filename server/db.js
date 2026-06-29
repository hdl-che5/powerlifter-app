// server/db.js — SQLite via sql.js (pure JavaScript, no native compilation needed)

const path = require("path");
const fs = require("fs");
const initSqlJs = require("sql.js");

const DB_PATH = path.join(__dirname, "competitions.db");

let db = null;
let SQL = null;

// ── Init (async) ──────────────────────────────────────────────────────────────

async function getDb() {
  if (db) return db;

  SQL = await initSqlJs();

  // Load existing DB from disk if it exists
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  initSchema();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function initSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS competitions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      date        TEXT,
      location    TEXT,
      mode        TEXT    NOT NULL DEFAULT 'Standard',
      state_json  TEXT,
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS athletes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      name           TEXT    NOT NULL,
      birthdate      TEXT,
      bodyweight     REAL,
      category       TEXT,
      region         TEXT,
      club           TEXT,
      lot_number     INTEGER
    );

    CREATE TABLE IF NOT EXISTS attempts (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      athlete_id     INTEGER NOT NULL,
      lift_type      TEXT    NOT NULL,
      attempt_number INTEGER NOT NULL,
      weight_kg      REAL,
      result         INTEGER,
      judge1         INTEGER,
      judge2         INTEGER,
      judge3         INTEGER
    );

    CREATE TABLE IF NOT EXISTS judge_votes (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      athlete_id     INTEGER,
      lift_type      TEXT,
      attempt_number INTEGER,
      weight_kg      REAL,
      judge_id       INTEGER NOT NULL,
      vote           INTEGER,
      decision_time_ms INTEGER,
      recorded_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vote_decisions (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      athlete_id     INTEGER,
      lift_type      TEXT,
      attempt_number INTEGER,
      weight_kg      REAL,
      judge1_vote    INTEGER,
      judge2_vote    INTEGER,
      judge3_vote    INTEGER,
      final_result   TEXT,
      recorded_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS vote_analytics (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      competition_id INTEGER NOT NULL,
      good_count     INTEGER DEFAULT 0,
      no_count       INTEGER DEFAULT 0,
      agreement_rate REAL DEFAULT 100,
      avg_decision_time_ms REAL,
      updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  saveDb();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function rowsFromResult(res) {
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map(row => {
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
  });
}

function firstRow(res) {
  const rows = rowsFromResult(res);
  return rows[0] || null;
}

// ── Competition CRUD ──────────────────────────────────────────────────────────

async function listCompetitions() {
  await getDb();
  const res = db.exec(
    "SELECT id, name, date, location, mode, created_at, updated_at FROM competitions ORDER BY created_at DESC"
  );
  return rowsFromResult(res);
}

async function createCompetition({ name, date, location, mode, state_json }) {
  await getDb();
  db.run(
    "INSERT INTO competitions (name, date, location, mode, state_json) VALUES (?, ?, ?, ?, ?)",
    [name, date || null, location || null, mode || "Standard", state_json || null]
  );
  const res = db.exec("SELECT last_insert_rowid() as id");
  const id = firstRow(res)?.id;
  saveDb();
  return getCompetitionById(id);
}

async function getCompetitionById(id) {
  await getDb();
  const res = db.exec("SELECT * FROM competitions WHERE id = ?", [id]);
  return firstRow(res);
}

async function updateCompetition(id, { name, date, location, mode, state_json }) {
  await getDb();
  db.run(
    `UPDATE competitions SET name=?, date=?, location=?, mode=?, state_json=?, updated_at=datetime('now') WHERE id=?`,
    [name, date || null, location || null, mode || "Standard", state_json || null, id]
  );
  saveDb();
  return getCompetitionById(id);
}

async function deleteCompetition(id) {
  await getDb();
  db.run("DELETE FROM competitions WHERE id=?", [id]);
  saveDb();
}

async function importFromJson(jsonData) {
  const meet = jsonData.meet || {};
  return createCompetition({
    name: meet.name || "Imported Competition",
    date: meet.date || null,
    location: meet.city || null,
    mode: "Standard",
    state_json: JSON.stringify(jsonData),
  });
}

// ── Vote persistence ──────────────────────────────────────────────────────────

async function recordJudgeVote({ competitionId, athleteId, liftType, attemptNumber, weightKg, judgeId, vote, decisionTimeMs }) {
  await getDb();
  db.run(
    `INSERT INTO judge_votes (competition_id, athlete_id, lift_type, attempt_number, weight_kg, judge_id, vote, decision_time_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [competitionId, athleteId, liftType, attemptNumber, weightKg, judgeId, vote ? 1 : 0, decisionTimeMs || 0]
  );
  saveDb();
}

async function recordVoteDecision({ competitionId, athleteId, liftType, attemptNumber, weightKg, judge1Vote, judge2Vote, judge3Vote, finalResult }) {
  await getDb();
  db.run(
    `INSERT INTO vote_decisions (competition_id, athlete_id, lift_type, attempt_number, weight_kg, judge1_vote, judge2_vote, judge3_vote, final_result)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [competitionId, athleteId, liftType, attemptNumber, weightKg, judge1Vote, judge2Vote, judge3Vote, finalResult]
  );
  saveDb();
}

async function getVoteHistory(competitionId, athleteId, liftType) {
  await getDb();
  const res = db.exec(
    `SELECT * FROM judge_votes 
     WHERE competition_id = ? AND athlete_id = ? AND lift_type = ?
     ORDER BY recorded_at DESC`,
    [competitionId, athleteId, liftType]
  );
  return rowsFromResult(res);
}

async function getVoteDecisions(competitionId, athleteId) {
  await getDb();
  const res = db.exec(
    `SELECT * FROM vote_decisions 
     WHERE competition_id = ? AND athlete_id = ?
     ORDER BY recorded_at DESC`,
    [competitionId, athleteId]
  );
  return rowsFromResult(res);
}

async function updateVoteAnalytics(competitionId) {
  await getDb();
  const votesRes = db.exec(
    `SELECT COUNT(*) as total, SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END) as good_votes FROM judge_votes WHERE competition_id = ?`,
    [competitionId]
  );
  const votes = firstRow(votesRes) || { total: 0, good_votes: 0 };
  
  db.run(
    `INSERT OR REPLACE INTO vote_analytics (competition_id, good_count, no_count, agreement_rate)
     VALUES (?, ?, ?, ?)`,
    [competitionId, votes.good_votes || 0, (votes.total - votes.good_votes) || 0, 100]
  );
  saveDb();
}

async function getVoteAnalytics(competitionId) {
  await getDb();
  const res = db.exec(
    `SELECT * FROM vote_analytics WHERE competition_id = ?`,
    [competitionId]
  );
  return firstRow(res) || { good_count: 0, no_count: 0, agreement_rate: 100 };
}

module.exports = {
  listCompetitions,
  createCompetition,
  getCompetitionById,
  updateCompetition,
  deleteCompetition,
  importFromJson,
  recordJudgeVote,
  recordVoteDecision,
  getVoteHistory,
  getVoteDecisions,
  updateVoteAnalytics,
  getVoteAnalytics,
};