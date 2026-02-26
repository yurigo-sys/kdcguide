import express from "express";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import cookieParser from "cookie-parser";
import session from "express-session";
import SQLiteStore from "better-sqlite3-session-store";

const SqliteSessionStore = SQLiteStore(session);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isVercel = process.env.VERCEL === "1";
const dbPath = isVercel ? "/tmp/database.sqlite" : path.join(__dirname, "../database.sqlite");
const uploadsDir = isVercel ? "/tmp/uploads" : path.join(__dirname, "../uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const db = new Database(dbPath);

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

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS posts (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, category TEXT, icon TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  CREATE TABLE IF NOT EXISTS training_process (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT NOT NULL, step_order INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, display_order INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS faqs (id INTEGER PRIMARY KEY AUTOINCREMENT, question TEXT NOT NULL, answer TEXT NOT NULL, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
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

const postCount = db.prepare("SELECT COUNT(*) as count FROM posts").get() as { count: number };
if (postCount.count === 0 && initialData?.posts) {
  const insertPost = db.prepare("INSERT INTO posts (title, content, category, icon) VALUES (?, ?, ?, ?)");
  initialData.posts.forEach((p: any) => insertPost.run(p.title, p.content, p.category, p.icon));
}

const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
if (categoryCount.count === 0 && initialData?.categories) {
  const insertCategory = db.prepare("INSERT INTO categories (name, display_order) VALUES (?, ?)");
  initialData.categories.forEach((c: any) => insertCategory.run(c.name, c.display_order));
}

const faqCount = db.prepare("SELECT COUNT(*) as count FROM faqs").get() as { count: number };
if (faqCount.count === 0 && initialData?.faqs) {
  const insertFaq = db.prepare("INSERT INTO faqs (question, answer) VALUES (?, ?)");
  initialData.faqs.forEach((f: any) => insertFaq.run(f.question, f.answer));
}

const processCount = db.prepare("SELECT COUNT(*) as count FROM training_process").get() as { count: number };
if (processCount.count === 0 && initialData?.training_process) {
  const insertStep = db.prepare("INSERT INTO training_process (title, description, step_order) VALUES (?, ?, ?)");
  initialData.training_process.forEach((s: any) => insertStep.run(s.title, s.description, s.step_order));
}

const settingsCount = db.prepare("SELECT COUNT(*) as count FROM settings").get() as { count: number };
if (settingsCount.count === 0 && initialData?.settings) {
  const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  Object.entries(initialData.settings).forEach(([key, value]) => {
    const val = typeof value === "object" ? JSON.stringify(value) : String(value);
    insertSetting.run(key, val);
  });
} else {
  // Always ensure adminPassword is correct
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('adminPassword', 'comento0804')").run();
}

export const app = express();
app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieParser());
app.use(session({
  store: new SqliteSessionStore({ client: db, expired: { clear: true, intervalMs: 900000 } }),
  secret: process.env.SESSION_SECRET || "comento-secret-key-12345",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: true, sameSite: 'none', maxAge: 24 * 60 * 60 * 1000 }
}));

app.use("/uploads", express.static(uploadsDir));

// API Routes
app.post("/api/upload", upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
  res.json({ success: true, url: `/uploads/${req.file.filename}` });
});

app.get("/api/posts", (req, res) => {
  res.json(db.prepare("SELECT * FROM posts ORDER BY updated_at DESC").all());
});

app.get("/api/posts/:id", (req, res) => {
  const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!post) return res.status(404).json({ error: "Post not found" });
  res.json(post);
});

app.post("/api/posts", (req, res) => {
  const { title, content, category, icon } = req.body;
  const info = db.prepare("INSERT INTO posts (title, content, category, icon) VALUES (?, ?, ?, ?)").run(title, content, category, icon);
  res.json({ id: info.lastInsertRowid, success: true });
});

app.put("/api/posts/:id", (req, res) => {
  const { title, content, category, icon } = req.body;
  const result = db.prepare("UPDATE posts SET title = ?, content = ?, category = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(title, content, category, icon, req.params.id);
  res.json({ success: result.changes > 0 });
});

app.post("/api/posts/delete", (req, res) => {
  const result = db.prepare("DELETE FROM posts WHERE id = ?").run(Number(req.body.id));
  res.json({ success: true, changes: result.changes });
});

app.get("/api/settings", (req, res) => {
  const settings = db.prepare("SELECT * FROM settings").all();
  res.json((settings as any[]).reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {}));
});

app.post("/api/settings", (req, res) => {
  const { siteName, primaryColor, adminPassword, logoUrl, contactInfo, contactLinks } = req.body;
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  if (siteName) upsert.run("siteName", siteName);
  if (primaryColor) upsert.run("primaryColor", primaryColor);
  if (adminPassword) upsert.run("adminPassword", adminPassword);
  if (logoUrl) upsert.run("logoUrl", logoUrl);
  if (contactInfo !== undefined) upsert.run("contactInfo", contactInfo);
  if (contactLinks !== undefined) upsert.run("contactLinks", JSON.stringify(contactLinks));
  res.json({ success: true });
});

app.get("/api/categories", (req, res) => {
  res.json(db.prepare("SELECT * FROM categories ORDER BY display_order ASC").all());
});

app.post("/api/categories", (req, res) => {
  db.prepare("INSERT INTO categories (name, display_order) VALUES (?, ?)").run(req.body.name, req.body.display_order);
  res.json({ success: true });
});

app.delete("/api/categories/:id", (req, res) => {
  db.prepare("DELETE FROM categories WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post("/api/categories/bulk", (req, res) => {
  db.prepare("DELETE FROM categories").run();
  const insert = db.prepare("INSERT INTO categories (name, display_order) VALUES (?, ?)");
  db.transaction((cats) => cats.forEach((c: any) => insert.run(c.name, c.display_order)))(req.body.categories);
  res.json({ success: true });
});

app.get("/api/faqs", (req, res) => {
  res.json(db.prepare("SELECT * FROM faqs ORDER BY updated_at DESC").all());
});

app.get("/api/faqs/:id", (req, res) => {
  const faq = db.prepare("SELECT * FROM faqs WHERE id = ?").get(req.params.id);
  if (!faq) return res.status(404).json({ error: "FAQ not found" });
  res.json(faq);
});

app.post("/api/faqs", (req, res) => {
  const { question, answer } = req.body;
  const info = db.prepare("INSERT INTO faqs (question, answer) VALUES (?, ?)").run(question, answer);
  res.json({ success: true, id: info.lastInsertRowid });
});

app.post("/api/faqs/delete", (req, res) => {
  const result = db.prepare("DELETE FROM faqs WHERE id = ?").run(Number(req.body.id));
  res.json({ success: true, changes: result.changes });
});

app.post("/api/admin/login", (req, res) => {
  const setting = db.prepare("SELECT value FROM settings WHERE key = 'adminPassword'").get() as { value: string };
  if (req.body.password === (setting?.value || "comento0804")) {
    req.session.isAdmin = true;
    req.session.save(() => res.json({ success: true }));
  } else {
    res.status(401).json({ success: false, message: "비밀번호 불일치" });
  }
});

app.get("/api/admin/check", (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  if (req.session.isAdmin) {
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

app.get("/api/training-process", (req, res) => {
  res.json(db.prepare("SELECT * FROM training_process ORDER BY step_order ASC").all());
});

app.post("/api/training-process", (req, res) => {
  db.prepare("DELETE FROM training_process").run();
  const insert = db.prepare("INSERT INTO training_process (title, description, step_order) VALUES (?, ?, ?)");
  db.transaction((steps) => steps.forEach((s: any) => insert.run(s.title, s.description, s.step_order)))(req.body.steps);
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
