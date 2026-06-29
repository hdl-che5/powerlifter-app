# 🏋️ Powerlifting Competition Manager

A full-featured powerlifting meet management system built on top of **OpenLifter**, extended with real-time multi-screen support via Socket.io, SQLite persistence, and a judge voting system.

---

## What's New (vs. base OpenLifter)

| Feature | Description |
|---|---|
| **4 Screen Views** | Referee laptop, Judge phones (`/judge/1-3`), TV screen (`/tv`), Audience (`/audience`) |
| **Real-time sync** | All screens stay in sync via Socket.io |
| **Countdown Timer** | 60s chrono synced to all screens, referee controls |
| **Judge Voting** | 3 judges vote on phones → result shown on all screens |
| **SQLite persistence** | Competitions saved server-side, import/export JSON |
| **Competition List** | New home page at `/competitions` to manage events |
| **Handicap Mode** | Bench-only mode — hides Squat & Deadlift everywhere |
| **Referee Dashboard** | Chrono + judge indicators + mode badge on lifting page |

---

## Quick Start

### 1. Install frontend dependencies
```bash
yarn install
```

### 2. Install and start the server
```bash
cd server
npm install
npm start
# Server runs on http://localhost:4000
```

### 3. Start the React frontend (new terminal)
```bash
yarn start
# App runs on http://localhost:3000
```

---

## Screen URLs

| URL | Device | Purpose |
|---|---|---|
| `http://localhost:3000/` | Referee laptop | Full app + dashboard |
| `http://localhost:3000/competitions` | Any | Competition management |
| `http://localhost:3000/judge/1` | Phone | Judge 1 vote screen |
| `http://localhost:3000/judge/2` | Phone | Judge 2 vote screen |
| `http://localhost:3000/judge/3` | Phone | Judge 3 vote screen |
| `http://localhost:3000/tv` | TV/projector | Fullscreen display |
| `http://localhost:3000/audience` | Any | Same as TV, read-only |

---

## Handicap Mode
In Meet Setup → Competition Rules → **Competition Mode = Handicap**.
Squat and Deadlift columns hidden everywhere. Badge shown on all screens.

---

## REST API  (http://localhost:4000)
```
GET/POST   /api/competitions
GET/PUT/DELETE /api/competitions/:id
POST       /api/competitions/import
GET        /api/competitions/:id/export
```

---

## Socket.io Events
`state_update` · `start_timer` · `stop_timer` · `reset_timer` · `timer_tick`  
`judge_vote` · `judge_vote_received` · `final_result` · `reset_votes`  
`load_competition` · `sync_redux_state`

---

## New Files
```
server/index.js                    Express + Socket.io server
server/db.js                       SQLite schema + queries  
server/routes/competitions.js      REST API
src/socket/socketClient.ts         Socket.io client wrapper
src/components/lifting/Chrono.tsx  Synced countdown timer
src/components/lifting/RefereeDashboard.tsx  Live control panel
src/components/judge/JudgeView.tsx Mobile judge screen
src/components/tv/TVScreen.tsx     Fullscreen TV display
src/components/home/CompetitionList.tsx  Competition manager
```
