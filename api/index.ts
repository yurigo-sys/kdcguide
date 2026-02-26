import express from "express";
import pg from "pg";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPg from "connect-pg-simple";
import SQLiteStore from "better-sqlite3-session-store";

const pgSession = connectPg(session);
const SqliteSessionStore = SQLiteStore(session);
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === "1";
const dbPath = isVercel ? "/tmp/database.sqlite" : path.join(__dirname, "../database.sqlite");
const uploadsDir = isVercel ? "/tmp/uploads" : path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Database Configuration
const rawDbUrl = process.env.DATABASE_URL || "";
let usePostgres = rawDbUrl.startsWith("postgres") && rawDbUrl.includes("@");
let pool: pg.Pool | null = null;
let sqliteDb: any = null;

const initDatabase = () => {
  console.log(`[DB] Environment: ${isVercel ? "Vercel" : "Local"}`);
  
  if (usePostgres) {
    try {
      const maskedUrl = rawDbUrl.replace(/\/\/[^:]+:[^@]+@/, "//****:****@");
      console.log(`[DB] Attempting Postgres connection...`);
      
      pool = new Pool({
        connectionString: rawDbUrl,
        ssl: { rejectUnauthorized: false }
      });
      
      pool.on('error', (err) => {
        console.error('[DB] Unexpected error on idle client', err);
        // If it's a connection error, we might want to fallback, but session store is already bound
      });
    } catch (e) {
      console.error("[DB] Failed to initialize Postgres pool, falling back to SQLite", e);
      usePostgres = false;
    }
  }

  if (!usePostgres) {
    console.log(`[DB] Using SQLite. Path: ${dbPath}`);
    sqliteDb = new Database(dbPath);
  }
};

initDatabase();

// Helper for queries
const query = async (text: string, params?: any[]) => {
  try {
    if (usePostgres && pool) {
      // Convert SQLite syntax to PostgreSQL if necessary (e.g., ? to $1)
      let pgText = text;
      let pgParams = params || [];
      
      // Handle INSERT OR REPLACE -> INSERT ... ON CONFLICT for settings table specifically
      if (pgText.includes("INSERT OR REPLACE INTO settings")) {
        pgText = "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value";
      } else {
        // Simple regex to replace ? with $1, $2, etc.
        let index = 1;
        pgText = pgText.replace(/\?/g, () => `$${index++}`);
        
        pgText = pgText.replace(/DATETIME DEFAULT CURRENT_TIMESTAMP/g, "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");
        pgText = pgText.replace(/AUTOINCREMENT/g, "SERIAL");
        pgText = pgText.replace(/INSERT OR REPLACE/g, "INSERT");
      }
      
      return await pool.query(pgText, pgParams);
    } else {
      // For SQLite, ensure we don't have $1, $2 etc.
      let sqliteText = text.replace(/\$\d+/g, "?");
      const stmt = sqliteDb.prepare(sqliteText);
      if (sqliteText.trim().toUpperCase().startsWith("SELECT")) {
        return { rows: stmt.all(params || []) };
      } else {
        const result = stmt.run(params || []);
        return { rowCount: result.changes, rows: [{ id: result.lastInsertRowid }] };
      }
    }
  } catch (error: any) {
    console.error(`[DB] Query Error: ${text.substring(0, 100)}...`, error);
    if (usePostgres && (error.code === 'ERR_INVALID_URL' || error.code === 'ECONNREFUSED')) {
      console.error("[DB] Postgres connection failed, please check DATABASE_URL");
    }
    throw error;
  }
};

// Initialize database
const initDb = async () => {
  if (usePostgres) {
    await query(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS posts (id SERIAL PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, category TEXT, icon TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS training_process (id SERIAL PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, step_order INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS categories (id SERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, display_order INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS faqs (id SERIAL PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);
      
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      ) WITH (OIDS=FALSE);
      
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN
          ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
        END IF;
      END $$;
      
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
      CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, category TEXT, icon TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE IF NOT EXISTS training_process (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL, step_order INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, display_order INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS faqs (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT NOT NULL, answer TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    `);
  }

  // Seed initial data
  const initialDataPath = path.join(__dirname, "../initial-data.json");
  let initialData: any = null;
  if (fs.existsSync(initialDataPath)) {
    try {
      initialData = JSON.parse(fs.readFileSync(initialDataPath, "utf-8"));
    } catch (e) {
      console.error("Error reading initial-data.json:", e);
    }
  }

  const postCountRes = await query("SELECT COUNT(*) as count FROM posts");
  const postCount = parseInt(postCountRes.rows[0].count);
  if (postCount === 0 && initialData?.posts) {
    for (const p of initialData.posts) {
      await query("INSERT INTO posts (title, content, category, icon) VALUES (?, ?, ?, ?)", [p.title, p.content, p.category, p.icon]);
    }
  }

  const categoryCountRes = await query("SELECT COUNT(*) as count FROM categories");
  const categoryCount = parseInt(categoryCountRes.rows[0].count);
  if (categoryCount === 0 && initialData?.categories) {
    for (const c of initialData.categories) {
      await query("INSERT INTO categories (name, display_order) VALUES (?, ?)", [c.name, c.display_order]);
    }
  }

  const faqCountRes = await query("SELECT COUNT(*) as count FROM faqs");
  const faqCount = parseInt(faqCountRes.rows[0].count);
  if (faqCount === 0 && initialData?.faqs) {
    for (const f of initialData.faqs) {
      await query("INSERT INTO faqs (question, answer) VALUES (?, ?)", [f.question, f.answer]);
    }
  }

  const processCountRes = await query("SELECT COUNT(*) as count FROM training_process");
  const processCount = parseInt(processCountRes.rows[0].count);
  if (processCount === 0 && initialData?.training_process) {
    for (const s of initialData.training_process) {
      await query("INSERT INTO training_process (title, description, step_order) VALUES (?, ?, ?)", [s.title, s.description, s.step_order]);
    }
  }

  const settingsCountRes = await query("SELECT COUNT(*) as count FROM settings");
  const settingsCount = parseInt(settingsCountRes.rows[0].count);
  if (settingsCount === 0 && initialData?.settings) {
    for (const [key, value] of Object.entries(initialData.settings)) {
      const val = typeof value === "object" ? JSON.stringify(value) : String(value);
      await query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, val]);
    }
  } else {
    await query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ['adminPassword', 'comento0804']);
  }
};

initDb().catch(console.error);

export const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(session({
  store: usePostgres ? new pgSession({ pool: pool!, tableName: 'session' }) : new SqliteSessionStore({ client: sqliteDb, expired: { clear: true, intervalMs: 900000 } }),
  secret: process.env.SESSION_SECRET || "comento-secret-key-12345",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use("/uploads", express.static(uploadsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// API Routes
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
  res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

app.get("/api/posts", async (req, res) => {
  const result = await query("SELECT * FROM posts ORDER BY updated_at DESC");
  res.json(result.rows);
});

app.get("/api/posts/:id", async (req, res) => {
  const result = await query("SELECT * FROM posts WHERE id = ?", [req.params.id]);
  const post = result.rows[0];
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

app.post("/api/posts", async (req, res) => {
  const { title, content, category, icon } = req.body;
  const result = await query("INSERT INTO posts (title, content, category, icon) VALUES (?, ?, ?, ?)", [title, content, category, icon]);
  res.json({ id: result.rows[0].id, success: true });
});

app.put("/api/posts/:id", async (req, res) => {
  const { title, content, category, icon } = req.body;
  const result = await query("UPDATE posts SET title = ?, content = ?, category = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", [title, content, category, icon, req.params.id]);
  res.json({ success: result.rowCount ? result.rowCount > 0 : false });
});

app.post("/api/posts/delete", async (req, res) => {
  const result = await query("DELETE FROM posts WHERE id = ?", [Number(req.body.id)]);
  res.json({ success: true, changes: result.rowCount });
});

app.get("/api/settings", async (req, res) => {
  const result = await query("SELECT * FROM settings");
  res.json(result.rows.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
});

app.post("/api/settings", async (req, res) => {
  const { siteName, primaryColor, adminPassword, logoUrl, contactInfo, contactLinks } = req.body;
  const upsert = async (key: string, value: string) => {
    await query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", [key, value]);
  };
  if (siteName) await upsert("siteName", siteName);
  if (primaryColor) await upsert("primaryColor", primaryColor);
  if (adminPassword) await upsert("adminPassword", adminPassword);
  if (logoUrl) await upsert("logoUrl", logoUrl);
  if (contactInfo !== undefined) await upsert("contactInfo", contactInfo);
  if (contactLinks !== undefined) await upsert("contactLinks", JSON.stringify(contactLinks));
  res.json({ success: true });
});

app.get("/api/categories", async (req, res) => {
  const result = await query("SELECT * FROM categories ORDER BY display_order ASC");
  res.json(result.rows);
});

app.post("/api/categories", async (req, res) => {
  await query("INSERT INTO categories (name, display_order) VALUES (?, ?)", [req.body.name, req.body.display_order]);
  res.json({ success: true });
});

app.delete("/api/categories/:id", async (req, res) => {
  await query("DELETE FROM categories WHERE id = ?", [req.params.id]);
  res.json({ success: true });
});

app.post("/api/categories/bulk", async (req, res) => {
  await query("DELETE FROM categories");
  for (const c of req.body.categories) {
    await query("INSERT INTO categories (name, display_order) VALUES (?, ?)", [c.name, c.display_order]);
  }
  res.json({ success: true });
});

app.get("/api/faqs", async (req, res) => {
  const result = await query("SELECT * FROM faqs ORDER BY updated_at DESC");
  res.json(result.rows);
});

app.get("/api/faqs/:id", async (req, res) => {
  const result = await query("SELECT * FROM faqs WHERE id = ?", [req.params.id]);
  const faq = result.rows[0];
  if (!faq) return res.status(404).json({ error: "FAQ not found" });
  res.json(faq);
});

app.post("/api/faqs", async (req, res) => {
  const { question, answer } = req.body;
  const result = await query("INSERT INTO faqs (question, answer) VALUES (?, ?)", [question, answer]);
  res.json({ success: true, id: result.rows[0].id });
});

app.post("/api/faqs/delete", async (req, res) => {
  const result = await query("DELETE FROM faqs WHERE id = ?", [Number(req.body.id)]);
  res.json({ success: true, changes: result.rowCount });
});

app.post("/api/admin/login", async (req, res) => {
  const result = await query("SELECT value FROM settings WHERE key = ?", ['adminPassword']);
  const setting = result.rows[0];
  if (req.body.password === (setting?.value || "comento0804")) {
    (req.session as any).isAdmin = true;
    req.session.save(() => res.json({ success: true }));
  } else {
    res.status(401).json({ success: false, message: "비밀번호 불일치" });
  }
});

app.get("/api/admin/check", (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if ((req.session as any).isAdmin) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false });
  }
});

app.post("/api/admin/logout", (req, res) => {
  req.session.destroy((err) => {
    res.clearCookie('connect.sid', { path: '/' });
    res.json({ success: true });
  });
});

app.get("/api/training-process", async (req, res) => {
  const result = await query("SELECT * FROM training_process ORDER BY step_order ASC");
  res.json(result.rows);
});

app.post("/api/training-process", async (req, res) => {
  await query("DELETE FROM training_process");
  for (const s of req.body.steps) {
    await query("INSERT INTO training_process (title, description, step_order) VALUES (?, ?, ?)", [s.title, s.description, s.step_order]);
  }
  res.json({ success: true });
});

if (!isVercel) {
  const PORT = 3000;
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
  app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
}

export default app;
