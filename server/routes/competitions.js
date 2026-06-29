// server/routes/competitions.js

const express = require("express");
const router = express.Router();
const db = require("../db");

// GET  /api/competitions
router.get("/", async (req, res) => {
  try {
    res.json(await db.listCompetitions());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/competitions
router.post("/", async (req, res) => {
  try {
    const comp = await db.createCompetition(req.body);
    res.status(201).json(comp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/competitions/import
router.post("/import", async (req, res) => {
  try {
    const comp = await db.importFromJson(req.body);
    res.status(201).json(comp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET  /api/competitions/:id
router.get("/:id", async (req, res) => {
  try {
    const comp = await db.getCompetitionById(req.params.id);
    if (!comp) return res.status(404).json({ error: "Not found" });
    if (comp.state_json) {
      try { comp.state = JSON.parse(comp.state_json); } catch {}
    }
    res.json(comp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT  /api/competitions/:id
router.put("/:id", async (req, res) => {
  try {
    const comp = await db.updateCompetition(req.params.id, req.body);
    res.json(comp);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/competitions/:id
router.delete("/:id", async (req, res) => {
  try {
    await db.deleteCompetition(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/competitions/:id/export
router.get("/:id/export", async (req, res) => {
  try {
    const comp = await db.getCompetitionById(req.params.id);
    if (!comp) return res.status(404).json({ error: "Not found" });
    let exportData = comp;
    if (comp.state_json) {
      try { exportData = JSON.parse(comp.state_json); } catch {}
    }
    res.setHeader("Content-Disposition", `attachment; filename="competition-${comp.id}.json"`);
    res.json(exportData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Analytics & Vote History ──────────────────────────────────────────────────

// GET /api/competitions/:id/votes/:athleteId/:liftType
router.get("/:id/votes/:athleteId/:liftType", async (req, res) => {
  try {
    const history = await db.getVoteHistory(req.params.id, req.params.athleteId, req.params.liftType);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/competitions/:id/decisions/:athleteId
router.get("/:id/decisions/:athleteId", async (req, res) => {
  try {
    const decisions = await db.getVoteDecisions(req.params.id, req.params.athleteId);
    res.json(decisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/competitions/:id/analytics
router.get("/:id/analytics", async (req, res) => {
  try {
    const analytics = await db.getVoteAnalytics(req.params.id);
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;