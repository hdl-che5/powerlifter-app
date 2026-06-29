// src/components/marshall/MarshallScreen.tsx
// Marshall screen: full athlete table with weight-change popup.
// Uses Redux store directly. Syncs via Socket.io on every change.

import React, { useState } from "react";
import { connect } from "react-redux";
import { GlobalState } from "../../types/stateTypes";
import { Entry, LiftStatus } from "../../types/dataTypes";
import { updateRegistration } from "../../actions/registrationActions";
import { emitStateUpdate } from "../../socket/socketClient";

interface StateProps {
  entries: ReadonlyArray<Entry>;
  competitionMode: string;
}

interface DispatchProps {
  updateRegistration: (entryId: number, changes: Partial<Entry>) => void;
}

type Props = StateProps & DispatchProps;

interface PopupState {
  entry: Entry;
  // Editable kg values (strings for input)
  squatKg: string[];
  benchKg: string[];
  deadliftKg: string[];
}

const STATUS_COLORS: Record<LiftStatus, string> = {
  0: "#f8f9fa",
  1: "#d4edda",
  [-1]: "#f8d7da",
};

const STATUS_LABEL: Record<LiftStatus, string> = {
  0: "—",
  1: "G",
  [-1]: "X",
};

const MarshallScreen: React.FC<Props> = ({ entries, competitionMode, updateRegistration }) => {
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [saved, setSaved] = useState<boolean>(false);

  const isHandicap = competitionMode === "Handicap";

  const openPopup = (entry: Entry) => {
    setPopup({
      entry,
      squatKg: entry.squatKg.map(String),
      benchKg: entry.benchKg.map(String),
      deadliftKg: entry.deadliftKg.map(String),
    });
    setSaved(false);
  };

  const closePopup = () => setPopup(null);

  const handleSave = () => {
    if (!popup) return;
    const parse = (arr: string[]) => arr.map((v) => parseFloat(v) || 0);
    const changes: Partial<Entry> = {
      squatKg: parse(popup.squatKg),
      benchKg: parse(popup.benchKg),
      deadliftKg: parse(popup.deadliftKg),
    };
    updateRegistration(popup.entry.id, changes);
    // Sync to all screens
    emitStateUpdate({ weightChange: { entryId: popup.entry.id, changes } });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      closePopup();
    }, 1200);
  };

  const setKg = (lift: "squatKg" | "benchKg" | "deadliftKg", idx: number, val: string) => {
    if (!popup) return;
    const arr = [...popup[lift]];
    arr[idx] = val;
    setPopup({ ...popup, [lift]: arr });
  };

  const thStyle: React.CSSProperties = {
    padding: "8px 12px",
    background: "#343a40",
    color: "#fff",
    fontSize: "12px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
    textAlign: "center",
  };

  const tdStyle: React.CSSProperties = {
    padding: "7px 10px",
    fontSize: "13px",
    textAlign: "center",
    verticalAlign: "middle",
    borderBottom: "1px solid #dee2e6",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#dfe4e6",
        padding: "24px",
        fontFamily: "'Segoe UI', Arial, sans-serif",
      }}
    >
      <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: "20px" }}>
          <h4 style={{ margin: 0, fontWeight: 700 }}>Marshall</h4>
          <p style={{ color: "#6c757d", fontSize: "13px", margin: "2px 0 0" }}>
            Click any athlete to modify their declared weights
          </p>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto", borderRadius: "6px", boxShadow: "0 1px 4px rgba(0,0,0,0.1)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff" }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={{ ...thStyle, textAlign: "left" }}>Athlete</th>
                <th style={thStyle}>Club</th>
                <th style={thStyle}>BW (kg)</th>
                <th style={thStyle}>Cat.</th>
                {!isHandicap && (
                  <>
                    <th style={{ ...thStyle, background: "#495057" }}>Squat 1</th>
                    <th style={{ ...thStyle, background: "#495057" }}>Squat 2</th>
                    <th style={{ ...thStyle, background: "#495057" }}>Squat 3</th>
                  </>
                )}
                <th style={{ ...thStyle, background: "#1a5276" }}>Bench 1</th>
                <th style={{ ...thStyle, background: "#1a5276" }}>Bench 2</th>
                <th style={{ ...thStyle, background: "#1a5276" }}>Bench 3</th>
                {!isHandicap && (
                  <>
                    <th style={{ ...thStyle, background: "#145a32" }}>Dead 1</th>
                    <th style={{ ...thStyle, background: "#145a32" }}>Dead 2</th>
                    <th style={{ ...thStyle, background: "#145a32" }}>Dead 3</th>
                  </>
                )}
                <th style={thStyle}>Edit</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={20} style={{ ...tdStyle, color: "#adb5bd", padding: "32px" }}>
                    No athletes registered yet.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} style={{ cursor: "pointer" }} onDoubleClick={() => openPopup(entry)}>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{entry.lot || entry.id}</td>
                    <td style={{ ...tdStyle, textAlign: "left", fontWeight: 600 }}>{entry.name}</td>
                    <td style={{ ...tdStyle, color: "#6c757d" }}>{entry.team || "—"}</td>
                    <td style={tdStyle}>{entry.bodyweightKg || "—"}</td>
                    <td style={tdStyle}>{entry.sex || "—"}</td>
                    {!isHandicap && (
                      <>
                        {entry.squatKg.slice(0, 3).map((kg, i) => (
                          <td
                            key={i}
                            style={{ ...tdStyle, background: STATUS_COLORS[entry.squatStatus[i] as LiftStatus] }}
                          >
                            <span style={{ fontWeight: 600 }}>{kg || "—"}</span>
                            <span style={{ fontSize: "10px", color: "#6c757d", marginLeft: "4px" }}>
                              {STATUS_LABEL[entry.squatStatus[i] as LiftStatus]}
                            </span>
                          </td>
                        ))}
                      </>
                    )}
                    {entry.benchKg.slice(0, 3).map((kg, i) => (
                      <td key={i} style={{ ...tdStyle, background: STATUS_COLORS[entry.benchStatus[i] as LiftStatus] }}>
                        <span style={{ fontWeight: 600 }}>{kg || "—"}</span>
                        <span style={{ fontSize: "10px", color: "#6c757d", marginLeft: "4px" }}>
                          {STATUS_LABEL[entry.benchStatus[i] as LiftStatus]}
                        </span>
                      </td>
                    ))}
                    {!isHandicap && (
                      <>
                        {entry.deadliftKg.slice(0, 3).map((kg, i) => (
                          <td
                            key={i}
                            style={{ ...tdStyle, background: STATUS_COLORS[entry.deadliftStatus[i] as LiftStatus] }}
                          >
                            <span style={{ fontWeight: 600 }}>{kg || "—"}</span>
                            <span style={{ fontSize: "10px", color: "#6c757d", marginLeft: "4px" }}>
                              {STATUS_LABEL[entry.deadliftStatus[i] as LiftStatus]}
                            </span>
                          </td>
                        ))}
                      </>
                    )}
                    <td style={tdStyle}>
                      <button
                        onClick={() => openPopup(entry)}
                        className="btn btn-sm btn-outline-primary"
                        style={{ fontSize: "11px", padding: "2px 10px" }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Popup overlay */}
        {popup && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 1000,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) closePopup();
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: "8px",
                width: "560px",
                maxWidth: "95vw",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
              }}
            >
              {/* Popup header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #dee2e6",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: 700, fontSize: "17px" }}>{popup.entry.name}</div>
                  <div style={{ fontSize: "12px", color: "#6c757d" }}>
                    {popup.entry.team && `${popup.entry.team} — `}
                    {popup.entry.bodyweightKg} kg — Lot #{popup.entry.lot || popup.entry.id}
                  </div>
                </div>
                <button
                  onClick={closePopup}
                  style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#6c757d" }}
                >
                  &times;
                </button>
              </div>

              {/* Popup body */}
              <div style={{ padding: "20px" }}>
                {!isHandicap && (
                  <LiftSection
                    label="Squat"
                    color="#495057"
                    kgValues={popup.squatKg}
                    statuses={popup.entry.squatStatus}
                    onChange={(i, v) => setKg("squatKg", i, v)}
                  />
                )}
                <LiftSection
                  label="Bench Press"
                  color="#1a5276"
                  kgValues={popup.benchKg}
                  statuses={popup.entry.benchStatus}
                  onChange={(i, v) => setKg("benchKg", i, v)}
                />
                {!isHandicap && (
                  <LiftSection
                    label="Deadlift"
                    color="#145a32"
                    kgValues={popup.deadliftKg}
                    statuses={popup.entry.deadliftStatus}
                    onChange={(i, v) => setKg("deadliftKg", i, v)}
                  />
                )}
              </div>

              {/* Popup footer */}
              <div
                style={{
                  padding: "12px 20px",
                  borderTop: "1px solid #dee2e6",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                }}
              >
                <button onClick={closePopup} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className={`btn btn-sm ${saved ? "btn-success" : "btn-primary"}`}
                  style={{ minWidth: "120px" }}
                >
                  {saved ? "Saved!" : "Save & Sync"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── LiftSection sub-component ──────────────────────────────────────────────────
interface LiftSectionProps {
  label: string;
  color: string;
  kgValues: string[];
  statuses: Array<LiftStatus>;
  onChange: (i: number, v: string) => void;
}

const LiftSection: React.FC<LiftSectionProps> = ({ label, color, kgValues, statuses, onChange }) => (
  <div style={{ marginBottom: "20px" }}>
    <div
      style={{
        fontSize: "11px",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "1px",
        color: "#fff",
        background: color,
        padding: "4px 10px",
        borderRadius: "3px",
        display: "inline-block",
        marginBottom: "10px",
      }}
    >
      {label}
    </div>
    <div style={{ display: "flex", gap: "12px" }}>
      {[0, 1, 2].map((i) => {
        const status = statuses[i] as LiftStatus;
        const locked = status !== 0; // already attempted — show read-only
        return (
          <div key={i} style={{ flex: 1 }}>
            <div style={{ fontSize: "11px", color: "#6c757d", marginBottom: "4px" }}>
              Attempt {i + 1}
              {status === 1 && <span style={{ color: "#28a745", marginLeft: "6px", fontWeight: 700 }}>Good</span>}
              {status === -1 && <span style={{ color: "#dc3545", marginLeft: "6px", fontWeight: 700 }}>No lift</span>}
            </div>
            <input
              type="number"
              step="0.5"
              min="0"
              value={kgValues[i]}
              onChange={(e) => onChange(i, e.target.value)}
              disabled={locked}
              className="form-control form-control-sm"
              style={{
                textAlign: "center",
                fontWeight: 600,
                background: locked ? STATUS_COLORS[status] : "#fff",
                borderColor: locked ? (status === 1 ? "#28a745" : "#dc3545") : "#ced4da",
              }}
              placeholder="kg"
            />
          </div>
        );
      })}
    </div>
  </div>
);

// ── Redux connect ──────────────────────────────────────────────────────────────
const mapStateToProps = (state: GlobalState): StateProps => ({
  entries: state.registration.entries,
  competitionMode: (state.meet as any).competitionMode || "Standard",
});

const mapDispatchToProps = (dispatch: any): DispatchProps => ({
  updateRegistration: (entryId, changes) => dispatch(updateRegistration(entryId, changes)),
});

export default connect(mapStateToProps, mapDispatchToProps)(MarshallScreen);
