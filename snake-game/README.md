# Snake — Full-Stack Snake Game

A production-style, full-stack tribute to the classic Snake game.
The whole UI is rendered inside an on-screen handset — physical D-pad,
softkeys, and a 1-9/*/# keypad included — with a green LCD screen (plus Dark,
Neon, and Blue LCD themes).

**Stack:** Flask (Blueprints, MVC-style) · MongoDB Atlas via PyMongo · vanilla
HTML5/CSS3/JS · HTML5 Canvas · Web Audio (synthesized sound, no audio files
required).

## Features

- **4 modes** — Classic (walls kill), Wrap (edges teleport), Endless (no wall
  death, no obstacles), Maze (fixed obstacle layout).
- **3 difficulties** with an additional speed ramp every 5 food items eaten.
- **3 food types** — Normal (+10), Golden ⭐ (+50, despawns after 5s), Poison
  ☠ (-10, shrinks snake to length 3).
- **6 power-ups** — Shield 🛡, Speed Boost ⚡, Slow Motion 🐢, Magnet 🧲,
  Double Score 💎, Ghost Mode 👻 — each with an icon, timer and sound.
- **Dynamic obstacles** once score ≥ 100 (never overlap the snake/food).
- Accounts (register/login/logout, bcrypt password hashing), global/weekly/
  monthly/personal leaderboards, a statistics dashboard, and an achievements
  system.
- Bonus features: daily challenges, combo multiplier, save & resume (a
  "Continue" menu item), a simple greedy AI auto-play demo (press `*` on the
  Home screen), replay of the last game (press `#`), screenshot capture
  (press `9` during play), a live FPS counter toggle, a theme switcher, and a
  Konami-code easter egg.
- Fully responsive with keyboard (arrows/WASD), on-screen D-pad/keypad, and
  touch-swipe controls.

## Project structure

```text
snake-game/
├── app.py                  # Flask app factory / entrypoint
├── config.py                # Environment-driven configuration
├── requirements.txt
├── .env.example
├── routes/                  # Flask Blueprints (one per resource)
│   ├── auth_routes.py
│   ├── game_routes.py
│   ├── leaderboard_routes.py
│   ├── achievement_routes.py
│   ├── settings_routes.py
│   └── daily_routes.py
├── models/                  # Thin MongoDB collection wrappers
│   ├── user.py
│   ├── score.py
│   ├── achievement.py
│   └── settings.py
├── services/                 # Business logic between routes and models
│   ├── auth_service.py
│   ├── game_service.py
│   └── leaderboard_service.py
├── database/
│   └── db.py                 # MongoDB Atlas connection (+ mongomock fallback)
├── utils/
│   ├── decorators.py
│   └── validators.py
├── static/
│   ├── css/style.css
│   ├── js/{api,auth,sound,game,ui}.js
│   ├── images/ audio/ fonts/  # placeholders (game uses synthesized audio)
└── templates/
    └── index.html
```

## Getting started

```bash
cd snake-game
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` and set `SECRET_KEY`. For `MONGO_URI`:

- **No Atlas account yet / just want to try it out:** leave the placeholder
  value as-is. The app detects the placeholder and automatically falls back
  to `mongomock`, an in-memory MongoDB-compatible database — everything
  (accounts, scores, leaderboards, achievements) works immediately, it just
  isn't persisted between restarts.
- **Real persistence:** create a free cluster at
  [mongodb.com/atlas](https://www.mongodb.com/atlas), add a database user,
  allow your IP (or `0.0.0.0/0` for quick testing), and paste the connection
  string into `MONGO_URI`.

Run it:

```bash
python app.py
```

Then open **http://localhost:5000**.

## REST API

| Method | Endpoint                        | Auth | Description                     |
|--------|----------------------------------|------|----------------------------------|
| POST   | `/api/register`                  | –    | Create an account                |
| POST   | `/api/login`                     | –    | Log in (session cookie)          |
| POST   | `/api/logout`                    | –    | Log out                          |
| GET    | `/api/me`                        | –    | Current session user             |
| POST   | `/api/save-score`                | ✔    | Save a completed game             |
| GET    | `/api/high-score`                | ✔    | Personal high score               |
| GET    | `/api/statistics`                | ✔    | Aggregate stats dashboard data    |
| GET    | `/api/leaderboard?period=`       | –    | `global`\|`weekly`\|`monthly`\|`personal` |
| POST   | `/api/unlock-achievement`        | ✔    | Unlock an achievement by key      |
| GET    | `/api/achievements`              | ✔    | Full catalog + unlock state       |
| GET    | `/api/settings`                  | ✔    | Get saved settings                |
| PUT    | `/api/settings`                  | ✔    | Update settings                   |
| GET    | `/api/daily-challenge`           | ✔    | Today's challenge + completion    |
| POST   | `/api/daily-challenge/complete`  | ✔    | Mark today's challenge done       |

`✔` endpoints require a logged-in session (cookie-based).

## Deployment

Run with a production WSGI server:

```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

Then put it behind Nginx/Caddy (or deploy directly to Render, Railway,
Fly.io, Heroku, or a VM). Set the same environment variables from `.env` in
your host's config/secret manager — never commit a real `.env` file. Point
`MONGO_URI` at your Atlas cluster and make sure the host's outbound IP is
allow-listed in Atlas's Network Access settings.

## Notes on code quality

- Flask Blueprints separate auth/game/leaderboard/achievements/settings/daily
  concerns; `models/` + `services/` keep persistence and business logic out
  of route handlers (a light MVC split).
- All secrets/config are environment-driven (`config.py` + `.env`).
- `database/db.py` centralizes the MongoDB connection and index creation.
- Passwords are hashed with bcrypt; sessions are Flask's signed cookies.
