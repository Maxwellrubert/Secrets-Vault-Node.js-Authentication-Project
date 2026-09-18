# Secrets

An anonymous secret-sharing web app built with Node.js, Express, and PostgreSQL. Users create an account (email + password or Google OAuth 2.0), then view and submit their own secret.

This is the **Level 6 (OAuth 2.0 / Google Authentication)** version of the classic Secrets project from Angela Yu's Complete Web Development Bootcamp.

## Features

- User registration and login with email + password (passwords hashed with **bcrypt**, 10 salt rounds)
- Google OAuth 2.0 sign-in via **Passport.js** (with find-or-create account linking by email)
- Session-based authentication handled by `express-session` + Passport
- Authenticated routes for viewing and submitting a secret
- SQL injection protection via parameterized queries

## Tech Stack

| Layer        | Technology                          |
| ------------- | ----------------------------------- |
| Runtime      | Node.js (ES Modules)                |
| Web framework| Express 4                           |
| Templating   | EJS (with partials)                 |
| Database     | PostgreSQL (`pg`)                   |
| Authentication | Passport.js (local + Google OAuth2) |
| Sessions     | `express-session`                   |
| Password hashing | `bcrypt`                        |
| Frontend     | Bootstrap 4 + Font Awesome (CDN)    |

## Getting Started

### Prerequisites

- Node.js
- PostgreSQL running locally

### Installation

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file in the project root with the following keys:

   ```
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   SESSION_SECRET=some_random_secret
   PG_USER=your_pg_user
   PG_HOST=localhost
   PG_DATABASE=world-db
   PG_PASSWORD=your_pg_password
   PG_PORT=5432
   ```

3. Create the database table (the `users` table must exist before the app will work):

   ```sql
   CREATE TABLE users (
     email VARCHAR(100) PRIMARY KEY,
     password VARCHAR(100) NOT NULL,
     secret TEXT
   );
   ```

### Running the App

```bash
node index.js
```

Open http://localhost:3000.

## Project Structure

```
.
├── index.js                 # Entire server: app config, routes, auth, DB queries
├── public/
│   └── css/styles.css       # Served stylesheet
└── views/
    ├── home.ejs             # Landing page (Register / Login buttons)
    ├── login.ejs            # Login form + "Sign in with Google"
    ├── register.ejs         # Registration form + "Sign up with Google"
    ├── secrets.ejs          # Displays the user's secret
    ├── submit.ejs           # Form to submit a secret
    └── partials/
        ├── header.ejs       # HTML head + Bootstrap/FontAwesome CDNs
        └── footer.ejs       # Closing tags
```

## Routes

| Method | Path                  | Description                                        | Auth required |
| ------ | --------------------- | -------------------------------------------------- | ------------- |
| GET    | `/`                   | Landing page                                       | No            |
| GET    | `/login`              | Login page                                         | No            |
| GET    | `/register`           | Registration page                                  | No            |
| POST   | `/login`              | Local strategy login                               | No            |
| POST   | `/register`           | Register, hash password, auto-login                | No            |
| GET    | `/auth/google`        | Start Google OAuth                                 | No            |
| GET    | `/auth/google/secrets`| Google OAuth callback                              | No            |
| GET    | `/secrets`            | View your secret                                   | Yes           |
| GET    | `/submit`             | Show the submit-secret form                        | Yes           |
| POST   | `/submit`             | Save your secret                                   | Yes           |
| GET    | `/logout`             | End the session                                    | No            |

## Known Limitations & Notes

- **Google accounts use `profile.id` as the password** — the Google strategy writes the OAuth `profile.id` into the `password` column to satisfy a `NOT NULL` constraint. It's a course simplification; those accounts simply can't log in with a password, which is fine since Google handles their auth.
- **Passport serializes the whole user object** into the session (`serializeUser` stores `user` rather than just an ID). It works, but the session goes stale if the database row changes, and it's not the textbook approach. Storing just the user `email`/`id` and re-querying in `deserializeUser` would be cleaner.
- **No error responses**: some `catch` blocks only `console.log` the error and never send a response, so a failed request can hang. This doesn't happen in happy-path usage.
- **Debug `console.log(req.user)` calls** remain in the `/secrets` and `/submit` routes — they print the user object (including the password hash) to the server logs.

## Deployment

The app is ready to be deployed anywhere that runs Node.js and can reach a PostgreSQL database (Render, Railway, Fly.io, a VPS, etc.).

Environment variables required at deploy time:

| Variable               | Description                                                 |
| ---------------------- | ----------------------------------------------------------- |
| `PG_USER` / `PG_HOST`  | Postgres connection details from your hosting provider      |
| `PG_DATABASE` / `PG_PASSWORD` / `PG_PORT` |                                 |
| `SESSION_SECRET`       | A long random string for signing session cookies            |
| `GOOGLE_CLIENT_ID`     | OAuth client ID (see Google Cloud Console)                  |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret                                         |
| `GOOGLE_CALLBACK_URL`  | Must be the app's public URL + `/auth/google/secrets` (e.g. `https://your-app.onrender.com/auth/google/secrets`) |
| `PORT`                 | Provided automatically by the hosting platform              |

Remember to add the correct **Authorized redirect URI** to your OAuth client in the [Google Cloud Console](https://console.cloud.google.com/), otherwise Google sign-in will fail after deploying.

## Dependencies

- express
- ejs
- pg
- passport, passport-local, passport-google-oauth2
- express-session
- bcrypt
- body-parser
- dotenv