import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";
import session from "express-session";
import flash from "connect-flash";
import env from "dotenv";

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 10;
env.config();

const NAME_ADJECTIVES = ["Silent", "Clever", "Lucky", "Wandering", "Sleepy", "Brave", "Curious", "Cozy", "Nimble", "Mysterious"];
const NAME_ANIMALS = ["Fox", "Owl", "Panda", "Raccoon", "Deer", "Badger", "Otter", "Wolf", "Rabbit", "Turtle"];

function generateDisplayName() {
  const adj = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
  const animal = NAME_ANIMALS[Math.floor(Math.random() * NAME_ANIMALS.length)];
  const number = Math.floor(100 + Math.random() * 900);
  return `${adj}${animal}${number}`;
}

function timeAgo(dateValue) {
  const seconds = Math.floor((Date.now() - new Date(dateValue).getTime()) / 1000);
  if (seconds < 60) return "posted moments ago";
  const intervals = [
    { label: "year", seconds: 31536000 },
    { label: "month", seconds: 2592000 },
    { label: "week", seconds: 604800 },
    { label: "day", seconds: 86400 },
    { label: "hour", seconds: 3600 },
    { label: "minute", seconds: 60 },
  ];
  for (const { label, seconds: secs } of intervals) {
    const count = Math.floor(seconds / secs);
    if (count >= 1) {
      return count === 1 ? `posted 1 ${label} ago` : `posted ${count} ${label}s ago`;
    }
  }
  return "posted moments ago";
}

app.set("trust proxy", 1);
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
    },
  })
);
app.use(bodyParser.urlencoded({ extended: true }));
app.use(flash());
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

// Uses DATABASE_URL (e.g. Neon/Render) when present, otherwise falls back to PG_* vars for local dev.
// A Pool (rather than a single Client) auto-reconnects if the connection drops when Neon's compute sleeps.
let db;
if (process.env.DATABASE_URL) {
  db = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
} else {
  db = new pg.Pool({
    user: process.env.PG_USER,
    host: process.env.PG_HOST,
    database: process.env.PG_DATABASE,
    password: process.env.PG_PASSWORD,
    port: process.env.PG_PORT,
  });
}
db.on("error", (err) => {
  console.error("Unexpected database error:", err);
});

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs", { error: req.flash("error") });
});

app.get("/register", (req, res) => {
  res.render("register.ejs", { error: req.flash("error") });
});

app.get("/logout", (req, res) => {
  req.logout(function (err) {
    if (err) {
      console.error("Error logging out:", err);
    }
    res.redirect("/");
  });
});

app.get("/secrets", async (req, res) => {
  if (req.isAuthenticated()) {
    try {
      const [mySecretResult, communityResult] = await Promise.all([
        db.query("SELECT secret FROM users WHERE email = $1", [req.user.email]),
        db.query(
          "SELECT display_name, secret, created_at FROM users WHERE secret IS NOT NULL AND secret <> '' ORDER BY created_at DESC"
        ),
      ]);
      const communitySecrets = communityResult.rows.map((row) => ({
        ...row,
        time: timeAgo(row.created_at),
      }));
      res.render("secrets.ejs", {
        secret:
          mySecretResult.rows[0]?.secret ||
          "No secret found or You have not submitted one yet.",
        displayName: req.user.display_name || "Anonymous",
        communitySecrets,
      });
    } catch (err) {
      console.error("Error fetching secrets:", err);
      res.status(500).render("secrets.ejs", {
        secret: "Something went wrong loading your secret.",
        displayName: "Anonymous",
        communitySecrets: [],
      });
    }
  } else {
    res.redirect("/login");
  }
}); 

//TODO: Add a get route for the submit button
//Think about how the logic should work with authentication.

app.get("/submit", function (req, res) {
  if (req.isAuthenticated()) {
    res.render("submit.ejs", { error: req.flash("error") });
  } else {
    res.redirect("/login");
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/secrets",
    failureRedirect: "/login",
    failureFlash: true,
  })
);

app.post("/register", async (req, res) => {
  const email = req.body.username.trim();
  const password = req.body.password.trim();

  if (!email || !password) {
    req.flash("error", "Email and password are required.");
    return res.redirect("/register");
  }

  try {
    const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [
      email,
    ]);

    if (checkResult.rows.length > 0) {
      req.flash("error", "An account with this email already exists. Please log in.");
      return res.redirect("/login");
    }

    const hash = await bcrypt.hash(password, saltRounds);
    const result = await db.query(
      "INSERT INTO users (email, password, display_name) VALUES ($1, $2, $3) RETURNING *",
      [email, hash, generateDisplayName()]
    );
    const user = result.rows[0];
    req.login(user, (err) => {
      if (err) {
        console.error("Error logging in after register:", err);
        return res.redirect("/login");
      }
      res.redirect("/secrets");
    });
  } catch (err) {
    console.error("Error registering user:", err);
    res.status(500).send("Something went wrong. Please try again.");
  }
});

//TODO: Create the post route for submit.
//Handle the submitted data and add it to the database

app.post("/submit", async (req, res) => {
  const secret = req.body.secret.trim();

  if (!secret) {
    req.flash("error", "Your secret can't be empty.");
    return res.redirect("/submit");
  }

  try {
    await db.query("UPDATE users SET secret = $1 WHERE email = $2", [secret, req.user.email]);
    res.redirect("/secrets");
  } catch (err) {
    console.error("Error saving secret:", err);
    res.redirect("/submit");
  }
});

passport.use(
  "local",
  new Strategy(async function verify(username, password, cb) {
    try {
      const email = username.trim();
      const result = await db.query("SELECT * FROM users WHERE email = $1 ", [
        email,
      ]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password.trim(), storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else if (valid) {
            return cb(null, user);
          } else {
            return cb(null, false, { message: "Invalid email or password." });
          }
        });
      } else {
        return cb(null, false, { message: "Invalid email or password." });
      }
    } catch (err) {
      console.error("Error in local strategy:", err);
      return cb(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        const result = await db.query("SELECT * FROM users WHERE email = $1", [
          profile.email,
        ]);
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO users (email, password, display_name) VALUES ($1, $2, $3)",
            [profile.email, profile.id, generateDisplayName()]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);
passport.serializeUser((user, cb) => {
  cb(null, user.email);
});

passport.deserializeUser(async (email, cb) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0) {
      return cb(null, false);
    }
    cb(null, result.rows[0]);
  } catch (err) {
    cb(err);
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
