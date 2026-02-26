import express from "express";
import pg from "pg";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import cookieParser from "cookie-parser";
import session from "express-session";
import connectPg from "connect-pg-simple";

const pgSession = connectPg(session);
const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === "1";
const uploadsDir = isVercel ? "/tmp/uploads" : path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Helper for queries
const query = (text: string, params?: any[]) => pool.query(text, params);

// Initialize database
const initDb = async () => {
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
      await query("INSERT INTO posts (title, content, category, icon) VALUES ($1, $2, $3, $4)", [p.title, p.content, p.category, p.icon]);
    }
  }

  const categoryCountRes = await query("SELECT COUNT(*) as count FROM categories");
  const categoryCount = parseInt(categoryCountRes.rows[0].count);
  if (categoryCount === 0 && initialData?.categories) {
    for (const c of initialData.categories) {
      await query("INSERT INTO categories (name, display_order) VALUES ($1, $2)", [c.name, c.display_order]);
    }
  }

  const faqCountRes = await query("SELECT COUNT(*) as count FROM faqs");
  const faqCount = parseInt(faqCountRes.rows[0].count);
  if (faqCount === 0 && initialData?.faqs) {
    for (const f of initialData.faqs) {
      await query("INSERT INTO faqs (question, answer) VALUES ($1, $2)", [f.question, f.answer]);
    }
  }

  const processCountRes = await query("SELECT COUNT(*) as count FROM training_process");
  const processCount = parseInt(processCountRes.rows[0].count);
  if (processCount === 0 && initialData?.training_process) {
    for (const s of initialData.training_process) {
      await query("INSERT INTO training_process (title, description, step_order) VALUES ($1, $2, $3)", [s.title, s.description, s.step_order]);
    }
  }

  const settingsCountRes = await query("SELECT COUNT(*) as count FROM settings");
  const settingsCount = parseInt(settingsCountRes.rows[0].count);
  if (settingsCount === 0 && initialData?.settings) {
    for (const [key, value] of Object.entries(initialData.settings)) {
      const val = typeof value === "object" ? JSON.stringify(value) : String(value);
      await query("INSERT INTO settings (key, value) VALUES ($1, $2)", [key, val]);
    }
  } else {
    await query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", ['adminPassword', 'comento0804']);
  }
};

initDb().catch(console.error);

export const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(session({
  store: new pgSession({
    pool: pool,
    tableName: 'session'
  }),
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
  const result = await query("SELECT * FROM posts WHERE id = $1", [req.params.id]);
  const post = result.rows[0];
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

app.post("/api/posts", async (req, res) => {
  const { title, content, category, icon } = req.body;
  const result = await query("INSERT INTO posts (title, content, category, icon) VALUES ($1, $2, $3, $4) RETURNING id", [title, content, category, icon]);
  res.json({ id: result.rows[0].id, success: true });
});

app.put("/api/posts/:id", async (req, res) => {
  const { title, content, category, icon } = req.body;
  const result = await query("UPDATE posts SET title = $1, content = $2, category = $3, icon = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5", [title, content, category, icon, req.params.id]);
  res.json({ success: result.rowCount ? result.rowCount > 0 : false });
});

app.post("/api/posts/delete", async (req, res) => {
  const result = await query("DELETE FROM posts WHERE id = $1", [Number(req.body.id)]);
  res.json({ success: true, changes: result.rowCount });
});

app.get("/api/settings", async (req, res) => {
  const result = await query("SELECT * FROM settings");
  res.json(result.rows.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
});

app.post("/api/settings", async (req, res) => {
  const { siteName, primaryColor, adminPassword, logoUrl, contactInfo, contactLinks } = req.body;
  const upsert = async (key: string, value: string) => {
    await query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2", [key, value]);
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
  await query("INSERT INTO categories (name, display_order) VALUES ($1, $2)", [req.body.name, req.body.display_order]);
  res.json({ success: true });
});

app.delete("/api/categories/:id", async (req, res) => {
  await query("DELETE FROM categories WHERE id = $1", [req.params.id]);
  res.json({ success: true });
});

app.post("/api/categories/bulk", async (req, res) => {
  await query("DELETE FROM categories");
  for (const c of req.body.categories) {
    await query("INSERT INTO categories (name, display_order) VALUES ($1, $2)", [c.name, c.display_order]);
  }
  res.json({ success: true });
});

app.get("/api/faqs", async (req, res) => {
  const result = await query("SELECT * FROM faqs ORDER BY updated_at DESC");
  res.json(result.rows);
});

app.get("/api/faqs/:id", async (req, res) => {
  const result = await query("SELECT * FROM faqs WHERE id = $1", [req.params.id]);
  const faq = result.rows[0];
  if (!faq) return res.status(404).json({ error: "FAQ not found" });
  res.json(faq);
});

app.post("/api/faqs", async (req, res) => {
  const { question, answer } = req.body;
  const result = await query("INSERT INTO faqs (question, answer) VALUES ($1, $2) RETURNING id", [question, answer]);
  res.json({ success: true, id: result.rows[0].id });
});

app.post("/api/faqs/delete", async (req, res) => {
  const result = await query("DELETE FROM faqs WHERE id = $1", [Number(req.body.id)]);
  res.json({ success: true, changes: result.rowCount });
});

app.post("/api/admin/login", async (req, res) => {
  const result = await query("SELECT value FROM settings WHERE key = 'adminPassword'");
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
    await query("INSERT INTO training_process (title, description, step_order) VALUES ($1, $2, $3)", [s.title, s.description, s.step_order]);
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
