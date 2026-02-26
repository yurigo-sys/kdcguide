import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import cookieParser from "cookie-parser";
import session from "express-session";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("database.sqlite");

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

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
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    category TEXT,
    icon TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS training_process (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    step_order INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    display_order INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS faqs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial data if empty
const postCount = db.prepare("SELECT COUNT(*) as count FROM posts").get() as { count: number };
if (postCount.count === 0) {
  const insertPost = db.prepare("INSERT INTO posts (title, content, category, icon) VALUES (?, ?, ?, ?)");
  insertPost.run(
    "내일배움카드 신청 방법",
    "# 내일배움카드 신청 가이드\n\n**내일배움카드**는 고용노동부에서 지원하는 카드입니다.\n\n![신청방법](https://picsum.photos/seed/card/800/400)\n\n1. [HRD-Net 접속](https://www.hrd.go.kr)\n2. 공인인증서 로그인\n3. 발급 신청서 작성\n4. 고용센터 심사 대기",
    "준비단계",
    "CreditCard"
  );
  insertPost.run(
    "코멘토 학습 시스템 로그인 가이드",
    "# 학습 시스템 이용 안내\n\n1. **코멘토 홈페이지** 접속\n2. '나의 강의실' 클릭\n3. 수강 중인 과정 선택",
    "학습안내",
    "LogIn"
  );
}

const processCount = db.prepare("SELECT COUNT(*) as count FROM training_process").get() as { count: number };
if (processCount.count === 0) {
  const insertStep = db.prepare("INSERT INTO training_process (title, description, step_order) VALUES (?, ?, ?)");
  insertStep.run("훈련 첫날 안내", "슬랙 채널에 입장하고 오리엔테이션 영상을 시청하세요.", 1);
  insertStep.run("매일 학습 루틴", "강의를 수강하고 일일 회고를 작성합니다.", 2);
  insertStep.run("과제 제출", "매주 정해진 기한 내에 실무 과제를 제출하세요.", 3);
}

const settingsCount = db.prepare("SELECT COUNT(*) as count FROM settings").get() as { count: number };
if (settingsCount.count === 0) {
  const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)");
  insertSetting.run("siteName", "'K-디지털 기초역량훈련' 학습 가이드");
  insertSetting.run("primaryColor", "#307FE2");
  insertSetting.run("adminPassword", "comento0804"); // New default password
  insertSetting.run("logoUrl", "https://ais-dev-ysg7qkjpfxol2zs3cfwsoo-76360252009.asia-northeast1.run.app/logo.png");
  insertSetting.run("contactInfo", "궁금한 점이 있다면 언제든 슬랙 채널 코멘토 매니저에게 문의해 주세요.");
  insertSetting.run("contactLinks", JSON.stringify([{ label: "문의하기", url: "#", icon: "MessageCircle" }]));
} else {
  // Ensure adminPassword key exists, but don't overwrite if it already does
  const existing = db.prepare("SELECT * FROM settings WHERE key = 'adminPassword'").get();
  if (!existing) {
    db.prepare("INSERT INTO settings (key, value) VALUES ('adminPassword', 'comento0804')").run();
  }
}

const categoryCount = db.prepare("SELECT COUNT(*) as count FROM categories").get() as { count: number };
if (categoryCount.count === 0) {
  const insertCategory = db.prepare("INSERT INTO categories (name, display_order) VALUES (?, ?)");
  const defaultCategories = ["수강준비", "수강시작", "수강 중", "미션", "수료"];
  defaultCategories.forEach((name, index) => {
    insertCategory.run(name, index + 1);
  });
}

const faqCount = db.prepare("SELECT COUNT(*) as count FROM faqs").get() as { count: number };
if (faqCount.count === 0) {
  const insertFaq = db.prepare("INSERT INTO faqs (question, answer) VALUES (?, ?)");
  insertFaq.run("수강 신청은 어떻게 하나요?", "HRD-Net을 통해 신청 가능합니다.");
  insertFaq.run("수료 기준이 궁금해요.", "진도율 80% 이상, 최종 과제 제출 시 수료 가능합니다.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use((req, res, next) => {
    console.log(`[SERVER] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());
  app.use(cookieParser());
  app.use(session({
    secret: process.env.SESSION_SECRET || "comento-secret-key-12345",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production" || true, // AI Studio needs secure for iframes
      sameSite: 'none', // Required for AI Studio iframes
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  app.use("/uploads", express.static(uploadsDir));

  // API Routes
  app.post("/api/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ success: true, url: fileUrl });
  });

  app.get("/api/posts", (req, res) => {
    const posts = db.prepare("SELECT * FROM posts ORDER BY updated_at DESC").all();
    res.json(posts);
  });

  app.get("/api/posts/:id", (req, res) => {
    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
    res.json(post);
  });

  app.post("/api/posts", (req, res) => {
    const { title, content, category, icon } = req.body;
    const info = db.prepare("INSERT INTO posts (title, content, category, icon) VALUES (?, ?, ?, ?)").run(title, content, category, icon);
    res.json({ id: info.lastInsertRowid });
  });

  app.put("/api/posts/:id", (req, res) => {
    const { title, content, category, icon } = req.body;
    db.prepare("UPDATE posts SET title = ?, content = ?, category = ?, icon = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(title, content, category, icon, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/posts/delete", (req, res) => {
    const { id } = req.body;
    console.log(`[SERVER] DELETE POST REQUEST - ID:`, id);
    try {
      if (!id) {
        console.log(`[SERVER] DELETE POST FAILED - No ID provided`);
        return res.status(400).json({ success: false, message: "ID is required" });
      }
      const result = db.prepare("DELETE FROM posts WHERE id = ?").run(Number(id));
      console.log(`[SERVER] DELETE POST SUCCESS - Changes:`, result.changes);
      res.json({ success: true, changes: result.changes });
    } catch (error: any) {
      console.error(`[SERVER] DELETE POST ERROR:`, error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all();
    const settingsMap = (settings as {key: string, value: string}[]).reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {});
    res.json(settingsMap);
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
    const categories = db.prepare("SELECT * FROM categories ORDER BY display_order ASC").all();
    res.json(categories);
  });

  app.post("/api/categories", (req, res) => {
    const { name, display_order } = req.body;
    db.prepare("INSERT INTO categories (name, display_order) VALUES (?, ?)").run(name, display_order);
    res.json({ success: true });
  });

  app.delete("/api/categories/:id", (req, res) => {
    const { id } = req.params;
    console.log(`[SERVER] Deleting category ID: ${id}`);
    try {
      const result = db.prepare("DELETE FROM categories WHERE id = ?").run(Number(id));
      res.json({ success: true, changes: result.changes });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/categories/bulk", (req, res) => {
    const { categories } = req.body; // Array of { name, display_order }
    console.log(`[SERVER] Bulk updating categories`);
    try {
      db.prepare("DELETE FROM categories").run();
      const insert = db.prepare("INSERT INTO categories (name, display_order) VALUES (?, ?)");
      const transaction = db.transaction((cats) => {
        for (const cat of cats) {
          insert.run(cat.name, cat.display_order);
        }
      });
      transaction(categories);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`[SERVER] Bulk update error:`, error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.get("/api/faqs", (req, res) => {
    const faqs = db.prepare("SELECT * FROM faqs ORDER BY updated_at DESC").all();
    res.json(faqs);
  });

  app.get("/api/faqs/:id", (req, res) => {
    const faq = db.prepare("SELECT * FROM faqs WHERE id = ?").get(req.params.id);
    res.json(faq);
  });

  app.post("/api/faqs", (req, res) => {
    const { question, answer } = req.body;
    db.prepare("INSERT INTO faqs (question, answer) VALUES (?, ?)").run(question, answer);
    res.json({ success: true });
  });

  app.put("/api/faqs/:id", (req, res) => {
    const { question, answer } = req.body;
    db.prepare("UPDATE faqs SET question = ?, answer = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(question, answer, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/faqs/delete", (req, res) => {
    const { id } = req.body;
    console.log(`[SERVER] DELETE FAQ REQUEST - ID:`, id);
    try {
      if (!id) {
        return res.status(400).json({ success: false, message: "ID is required" });
      }
      const result = db.prepare("DELETE FROM faqs WHERE id = ?").run(Number(id));
      console.log(`[SERVER] DELETE FAQ SUCCESS - Changes:`, result.changes);
      res.json({ success: true, changes: result.changes });
    } catch (error: any) {
      console.error(`[SERVER] DELETE FAQ ERROR:`, error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;
    let setting = db.prepare("SELECT value FROM settings WHERE key = 'adminPassword'").get() as { value: string };
    
    // Fallback if not found in DB
    const expectedPassword = setting ? setting.value : "comento0804";
    
    console.log(`[SERVER] Login attempt - Provided: "${password}", Expected: "${expectedPassword}"`);
    if (password === expectedPassword) {
      console.log(`[SERVER] Login successful`);
      req.session.isAdmin = true;
      res.json({ success: true });
    } else {
      console.log(`[SERVER] Login failed`);
      res.status(401).json({ success: false, message: "비밀번호가 올바르지 않습니다." });
    }
  });

  app.get("/api/admin/check", (req, res) => {
    if (req.session.isAdmin) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false });
    }
  });

  app.post("/api/admin/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ success: true });
    });
  });

  app.get("/api/training-process", (req, res) => {
    const steps = db.prepare("SELECT * FROM training_process ORDER BY step_order ASC").all();
    res.json(steps);
  });

  app.post("/api/training-process", (req, res) => {
    const { steps } = req.body; // Array of { title, description, step_order }
    db.prepare("DELETE FROM training_process").run();
    const insert = db.prepare("INSERT INTO training_process (title, description, step_order) VALUES (?, ?, ?)");
    const transaction = db.transaction((steps) => {
      for (const step of steps) {
        insert.run(step.title, step.description, step.step_order);
      }
    });
    transaction(steps);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  const currentPassword = db.prepare("SELECT value FROM settings WHERE key = 'adminPassword'").get() as { value: string };
  console.log(`[SERVER] Current Admin Password in DB: "${currentPassword?.value}"`);

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

declare module 'express-session' {
  interface SessionData {
    isAdmin: boolean;
  }
}

startServer();
