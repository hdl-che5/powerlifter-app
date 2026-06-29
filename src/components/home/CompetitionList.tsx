// src/components/home/CompetitionList.tsx
// Competition management home screen. No emojis — professional layout.

import React, { useEffect, useState, useRef, useCallback } from "react";

const API = process.env.REACT_APP_SERVER_URL || "http://localhost:4000";

interface Competition {
  id: number;
  name: string;
  date: string | null;
  location: string | null;
  mode: string;
  created_at: string;
}

const CompetitionList: React.FC = () => {
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newMode, setNewMode] = useState<"Standard" | "Handicap">("Standard");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchCompetitions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/api/competitions`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCompetitions(await res.json());
      setError(null);
    } catch {
      setError("Could not reach server. Make sure it is running on port 4000.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCompetitions();
  }, [fetchCompetitions]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await fetch(`${API}/api/competitions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, date: newDate, location: newLocation, mode: newMode }),
      });
      setNewName("");
      setNewDate("");
      setNewLocation("");
      setNewMode("Standard");
      setCreating(false);
      fetchCompetitions();
    } catch {
      setError("Failed to create competition.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this competition?")) return;
    await fetch(`${API}/api/competitions/${id}`, { method: "DELETE" });
    fetchCompetitions();
  };

  const handleExport = (id: number) => {
    window.open(`${API}/api/competitions/${id}/export`);
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      await fetch(`${API}/api/competitions/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      fetchCompetitions();
    } catch {
      setError("Failed to import: invalid JSON file.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImportFile(file);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#dfe4e6", padding: "32px" }}>
      <div style={{ maxWidth: "860px", margin: "0 auto" }}>
        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4">
          <div>
            <h2 style={{ margin: 0, fontWeight: 700 }}>Competitions</h2>
            <p className="text-muted mb-0" style={{ fontSize: "14px" }}>
              Manage powerlifting events
            </p>
          </div>
          <div className="d-flex" style={{ gap: "8px" }}>
            <button onClick={() => fileInputRef.current?.click()} className="btn btn-secondary btn-sm">
              Import JSON
            </button>
            <button onClick={() => setCreating(true)} className="btn btn-primary btn-sm">
              + New Competition
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
            }}
          />
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        {/* Create form */}
        {creating && (
          <div className="card mb-3">
            <div className="card-body">
              <h6 className="card-title">New Competition</h6>
              <div className="row">
                <div className="col-md-6 mb-2">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Competition name *"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="col-md-3 mb-2">
                  <input
                    className="form-control form-control-sm"
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                  />
                </div>
                <div className="col-md-3 mb-2">
                  <input
                    className="form-control form-control-sm"
                    placeholder="Location"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                  />
                </div>
                <div className="col-md-4 mb-2">
                  <select
                    className="form-control form-control-sm"
                    value={newMode}
                    onChange={(e) => setNewMode(e.target.value as "Standard" | "Handicap")}
                  >
                    <option value="Standard">Standard (SBD)</option>
                    <option value="Handicap">Handicap (Bench only)</option>
                  </select>
                </div>
              </div>
              <div className="d-flex" style={{ gap: "8px" }}>
                <button onClick={handleCreate} className="btn btn-success btn-sm">
                  Create
                </button>
                <button onClick={() => setCreating(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Drop zone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${dragging ? "#007bff" : "#adb5bd"}`,
            borderRadius: "4px",
            padding: "16px",
            textAlign: "center",
            marginBottom: "20px",
            color: dragging ? "#007bff" : "#adb5bd",
            fontSize: "13px",
            background: dragging ? "rgba(0,123,255,0.04)" : "transparent",
            transition: "all 0.2s",
          }}
        >
          Drop a JSON file here to import
        </div>

        {/* List */}
        {loading ? (
          <div className="text-muted text-center py-5">Loading...</div>
        ) : competitions.length === 0 ? (
          <div className="text-muted text-center py-5">No competitions yet. Create one or import a JSON file.</div>
        ) : (
          competitions.map((comp) => (
            <div key={comp.id} className="card mb-2">
              <div className="card-body py-2 d-flex justify-content-between align-items-center">
                <div>
                  <div style={{ fontWeight: 600 }}>{comp.name}</div>
                  <div className="d-flex" style={{ gap: "12px", fontSize: "12px", color: "#6c757d" }}>
                    {comp.date && <span>{comp.date}</span>}
                    {comp.location && <span>{comp.location}</span>}
                    <span className={`badge badge-${comp.mode === "Handicap" ? "warning" : "primary"}`}>
                      {comp.mode}
                    </span>
                  </div>
                </div>
                <div className="d-flex" style={{ gap: "6px" }}>
                  <a href={`/?load=${comp.id}`} className="btn btn-primary btn-sm">
                    Open
                  </a>
                  <button onClick={() => handleExport(comp.id)} className="btn btn-secondary btn-sm">
                    Export
                  </button>
                  <button onClick={() => handleDelete(comp.id)} className="btn btn-danger btn-sm">
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}

        {/* Screen links */}
        <div className="card mt-4">
          <div className="card-header py-2">
            <span style={{ fontWeight: 600, fontSize: "13px" }}>Connected Screens</span>
          </div>
          <div className="card-body py-3">
            <div className="row">
              {[
                { href: "/judge/1", label: "Judge 1", sub: "localhost:3000/judge/1" },
                { href: "/judge/2", label: "Judge 2", sub: "localhost:3000/judge/2" },
                { href: "/judge/3", label: "Judge 3", sub: "localhost:3000/judge/3" },
                { href: "/tv", label: "TV Screen", sub: "localhost:3000/tv" },
                { href: "/audience", label: "Audience", sub: "localhost:3000/audience" },
                { href: "/chrono", label: "Chronometer", sub: "localhost:3000/chrono" },
                { href: "/marshall", label: "Marshall", sub: "localhost:3000/marshall" },
              ].map((s) => (
                <div key={s.href} className="col-auto mb-2">
                  <a
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-outline-secondary btn-sm"
                    style={{ fontFamily: "monospace" }}
                  >
                    {s.label}
                    <br />
                    <small className="text-muted">{s.sub}</small>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompetitionList;
