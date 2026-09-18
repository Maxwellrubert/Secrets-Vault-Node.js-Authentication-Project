# CHANGES

A record of everything we changed from the original course project (Angela Yu's
"Secrets" Level 6 project) to what the app is today. Written so you understand
*what* changed, *why*, and *where* in the code.

---

## 0. Original course project (baseline)

This was the "Level 6 (OAuth 2.0)" version of the Secrets project: Express +
EJS + PostgreSQL + Passport (local + Google), with bcrypt password hashing and
`express-session`. Every user had exactly one secret stored in a `users` table,
and `/secrets` only showed the logged-in user's own secret.

---

## 1. Bug fixes

| What was wrong | What we did | Where |
| -------------- | ----------- | ----- |
| `req.redirect("/login")` is not a valid method (re-registering an existing email crashed). | Changed to `res.redirect("/login")`. | `index.js` → register route |
| `register.ejs` included `header` twice instead of a footer (broken HTML). | Changed it to include `footer`. | `views/register.ejs` |
| `next` was referenced in the logout route but never defined (would crash on logout error). | Removed `next`, log and redirect instead. | `index.js` → logout route |

## 2. Security & code-quality fixes

| Change | Why | Where |
| ------ | --- | ----- |
| Removed `console.log(req.user)` calls. | They printed the user row (including the bcrypt password hash) to the server logs. | `index.js` → `/secrets`, `/submit` |
| `console.log("success")` debug line removed. | Cleanup. | `index.js` → register |
| Fixed "hanging" error paths (no response sent on error, so the browser spins forever). | Every `catch` now renders/sends a response. | `index.js` → `/secrets`, `/register`, submit, local strategy |
| Fixed `cb("User not found")` in the local strategy. | Passing a string as an error is wrong; now `cb(null, false, { message })` so Passport/flash handle it. | `index.js` → local strategy |
| Removed commented-out `console.log` in Google strategy. | Cleanup. | `index.js` → Google strategy |
| `saveUninitialized: false`. | Stops writing an empty session cookie for every visitor. | `index.js` → session config |
| `serializeUser` now stores only the user's **email**; `deserializeUser` re-queries the DB. | Before, the whole user object (with password hash) lived in the session cookie. Now the session is small and always fresh. | `index.js` → Passport serialization |

## 3. Deployment readiness

| Change | Why | Where |
| ------ | --- | ----- |
| `const port = process.env.PORT \|\| 3000;` | Hosting platforms (Render, etc.) inject the port via an env var. Hardcoding 3000 would break the deploy. | `index.js` → top |
| Google callback URL now reads `GOOGLE_CALLBACK_URL` env var (localhost fallback). | Deployed apps need the public URL as the OAuth redirect, not `localhost:3000`. | `index.js` → Google strategy |
| DB supports `DATABASE_URL` connection string (with SSL), falls back to `PG_*` vars. | Neon/Render hand you one connection string; this avoids splitting it into five env vars. | `index.js` → DB setup |
| `db.connect()` now logs and `exit(1)` on failure instead of failure silently. | Fail fast if the DB is unreachable. | `index.js` → DB setup |
| `app.set("trust proxy", 1)` + `secure` cookies in production. | Correct session behavior behind Render's proxy/HTTPS. | `index.js` → session config |
| Created `.env.example`. | Documents every required env var (`.env` is gitignored, so the example is committed instead). | `.env.example` |
| Added `.DS_Store` to `.gitignore`. | Keep macOS junk out of Git. | `.gitignore` |
| Replaced the README's "Known Issues" with "Known Limitations" + added a Deployment section. | The bugs got fixed; docs kept up to date. | `README.md` |

## 4. Community secrets feature

The app originally only showed *your own* secret. We wanted everyone's secrets
displayed anonymously. This required a few pieces:

| Piece | What it does | Where |
| ----- | ------------ | ----- |
| `generateDisplayName()` | Makes a fun alias like `SleepyFox417` so emails stay private. | `index.js` → helper function |
| `display_name` column on `users` | Stores that alias. Assigned at registration *and* Google signup. | Schema (`CREATE TABLE`), register route, Google strategy |
| `created_at TIMESTAMP DEFAULT NOW()` column | Lets us order newest-first and show "posted X ago". | Schema, community query |
| `timeAgo()` helper | Turns a timestamp into "posted 4 hours ago" without a dependency. | `index.js` → helper function |
| Community query | `SELECT display_name, secret, created_at ... WHERE secret IS NOT NULL ... ORDER BY created_at DESC` (excluding empty secrets, newest first). | `index.js` → `/secrets` route |

> **Plan change:** the feature first lived on its own page (`/community` +
> `views/community.ejs`). The user asked to merge it into the `/secrets` page
> instead — so the community list now renders **below** the user's own secret.
> The separate route and template were removed.

## 5. UX polish

| Change | Why | Where |
| ------ | --- | ----- |
| **Flash messages** via `connect-flash` | Failed login, duplicate-email registration, or empty secret now show a friendly error instead of failing silently. | `index.js` (middleware + routes), `login.ejs`, `register.ejs`, `submit.ejs` |
| **Show your anonymous name** on `/secrets` ("You are SleepyFox417") | Makes the alias tangible. | `/secrets` route, `secrets.ejs` |
| **Form polish** (`required`, `maxlength`, server-side `trim()` + empty checks) | Keeps bad input out and gives clear feedback. | All forms + register/submit/login routes |
| **Secret form validates empty** and flashes "Your secret can't be empty." | Consistent with flash messaging. | `index.js` → `/submit` |
| **Restructured `/secrets` page** | Top section = your secret ("My Secret"), bottom = "Community Secrets". Replaced the "You've Discovered My Secret!" headline. | `secrets.ejs` |
| **Timestamps on community cards** | "From SilentWolf213 · posted 4 hours ago". | `secrets.ejs`, community query |

---

## How to read this project now

- `index.js` — the whole server (routes + auth + DB). Could be split into
  modules later, but staying in one file keeps it beginner-friendly.
- `views/` — EJS templates. `partials/` has the shared header/footer.
- `.env` — local secrets (gitignored). `.env.example` is the committed template.
- `README.md` — how to run + deploy. `CHANGES.md` — this file.

A natural next step: split routes into their own file, add a validation library
like `zod`, or write automated tests. Start small — one improvement at a time.