import "dotenv/config";
import express from "express";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "25mb" }));

const isProd = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 4000;

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------
const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "pos.db");

if (path.isAbsolute(dbPath)) {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("synchronous = NORMAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    address TEXT,
    contact TEXT,
    vat_id TEXT,
    logo_url TEXT,
    receipt_logo_url TEXT,
    currency TEXT,
    tax_rate REAL,
    timezone TEXT,
    country TEXT
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'cashier',
    branch_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES branches(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    price REAL NOT NULL,
    cost_price REAL DEFAULT 0,
    category_id INTEGER,
    sku TEXT UNIQUE,
    stock INTEGER DEFAULT 0,
    FOREIGN KEY (category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subtotal REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL,
    discount REAL DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    payment_method TEXT DEFAULT 'cash',
    status TEXT DEFAULT 'completed',
    status_reason TEXT,
    customer_id INTEGER,
    branch_id INTEGER,
    preparation_status TEXT DEFAULT 'pending',
    completed_by TEXT,
    completed_at_branch_id INTEGER
  );

  CREATE TABLE IF NOT EXISTS sale_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_id INTEGER,
    item_id INTEGER,
    quantity REAL NOT NULL,
    price_at_sale REAL NOT NULL,
    cost_price_at_sale REAL DEFAULT 0,
    FOREIGN KEY (item_id) REFERENCES items(id),
    FOREIGN KEY (sale_id) REFERENCES sales(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS stock_adjustments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    adjustment REAL NOT NULL,
    reason TEXT,
    username TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (item_id) REFERENCES items(id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS edit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    row_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    username TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token_hash TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL,
    user_agent TEXT,
    ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// ---- Idempotent column migrations (safe on pre-existing databases) ----
const ensureColumn = (table: string, column: string, ddl: string) => {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!cols.some((c) => c.name === column)) db.exec(ddl);
};
ensureColumn("items", "image_url", "ALTER TABLE items ADD COLUMN image_url TEXT");
ensureColumn("items", "low_stock_threshold", "ALTER TABLE items ADD COLUMN low_stock_threshold INTEGER DEFAULT 5");
ensureColumn("items", "cost_price", "ALTER TABLE items ADD COLUMN cost_price REAL DEFAULT 0");
ensureColumn("sale_items", "cost_price_at_sale", "ALTER TABLE sale_items ADD COLUMN cost_price_at_sale REAL DEFAULT 0");
ensureColumn("sales", "discount", "ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0");
ensureColumn("sales", "status_reason", "ALTER TABLE sales ADD COLUMN status_reason TEXT");
ensureColumn("sales", "customer_id", "ALTER TABLE sales ADD COLUMN customer_id INTEGER");
ensureColumn("sales", "branch_id", "ALTER TABLE sales ADD COLUMN branch_id INTEGER");
ensureColumn("sales", "preparation_status", "ALTER TABLE sales ADD COLUMN preparation_status TEXT DEFAULT 'pending'");
ensureColumn("sales", "completed_by", "ALTER TABLE sales ADD COLUMN completed_by TEXT");
ensureColumn("sales", "completed_at_branch_id", "ALTER TABLE sales ADD COLUMN completed_at_branch_id INTEGER");
ensureColumn("users", "branch_id", "ALTER TABLE users ADD COLUMN branch_id INTEGER");
ensureColumn("users", "created_at", "ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
ensureColumn("branches", "vat_id", "ALTER TABLE branches ADD COLUMN vat_id TEXT");
ensureColumn("branches", "logo_url", "ALTER TABLE branches ADD COLUMN logo_url TEXT");
ensureColumn("branches", "receipt_logo_url", "ALTER TABLE branches ADD COLUMN receipt_logo_url TEXT");
ensureColumn("branches", "currency", "ALTER TABLE branches ADD COLUMN currency TEXT");
ensureColumn("branches", "tax_rate", "ALTER TABLE branches ADD COLUMN tax_rate REAL");
ensureColumn("branches", "timezone", "ALTER TABLE branches ADD COLUMN timezone TEXT");
ensureColumn("branches", "country", "ALTER TABLE branches ADD COLUMN country TEXT");
// Items with a NULL branch_id are shared across every branch; items with a
// branch_id belong to that store's catalogue only.
ensureColumn("items", "branch_id", "ALTER TABLE items ADD COLUMN branch_id INTEGER");
ensureColumn("stock_adjustments", "username", "ALTER TABLE stock_adjustments ADD COLUMN username TEXT");
ensureColumn("stock_adjustments", "timestamp", "ALTER TABLE stock_adjustments ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP");
ensureColumn("customers", "created_at", "ALTER TABLE customers ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP");
ensureColumn("edit_logs", "username", "ALTER TABLE edit_logs ADD COLUMN username TEXT");

// Repair any corrupt prices (NaN from old clients).
db.exec(`UPDATE items SET price = 0 WHERE price IS NULL OR price != price;`);

db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_timestamp ON sales(timestamp);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sale_items_item_id ON sale_items(item_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_stock_adjustments_item_id ON stock_adjustments(item_id);`);

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------
const seedSettings = db.transaction(() => {
  const insert = db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)");
  insert.run("company_name", "MODERN STORE");
  insert.run("tax_rate", "12");
  insert.run("address", "123 Main St, City");
  insert.run("contact", "555-0123");
  insert.run("logo_url", "");
  insert.run("vat_id", "");
  insert.run("currency", "₱");

  const insertMethod = db.prepare("INSERT OR IGNORE INTO payment_methods (name) VALUES (?)");
  insertMethod.run("cash");
  insertMethod.run("card");
  insertMethod.run("gcash");

  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count === 0) {
    const username = process.env.ADMIN_USERNAME || "admin";
    const password = process.env.ADMIN_PASSWORD || "admin";
    db.prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, 'admin')").run(username, hashPassword(password));
    console.log(`Seeded initial admin user '${username}'`);
  }
});
seedSettings();

// ---------------------------------------------------------------------------
// Demo data: two companies in different tax jurisdictions
//
// Enabled with SEED_DEMO=1, or on demand via POST /api/admin/seed-demo.
// Each branch carries its own currency symbol, tax rate and timezone, so a
// user assigned to a branch sees that country's figures everywhere.
// ---------------------------------------------------------------------------
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "Demo@12345";

type DemoBranch = {
  key: string;
  name: string;
  logo_url: string;
  receipt_logo_url: string;
  country: string;
  address: string;
  contact: string;
  vat_id: string;
  currency: string;
  tax_rate: number;
  timezone: string;
  users: Array<{ username: string; role: string }>;
  items: Array<[string, number, number, number, string]>; // name, price, cost, stock, sku
};

const DEMO_BRANCHES: DemoBranch[] = [
  {
    key: "in",
    name: "Saffron Retail LLP",
    logo_url: "/demo/saffron-retail.svg",
    receipt_logo_url: "/demo/saffron-retail-receipt.svg",
    country: "India",
    address: "14 Brigade Road, Bengaluru, Karnataka 560001",
    contact: "+91 80 4123 8890",
    vat_id: "29AAECS1234F1Z5",
    currency: "₹",
    tax_rate: 18, // GST
    timezone: "Asia/Kolkata",
    users: [
      { username: "india_cashier", role: "cashier" },
      { username: "india_kds", role: "kds" },
    ],
    items: [
      ["Masala Chai 200ml", 45, 28, 240, "IN-BEV-001"],
      ["Filter Coffee Powder 500g", 285, 190, 64, "IN-BEV-002"],
      ["Aloo Paratha Frozen (4pc)", 95, 60, 130, "IN-FOD-001"],
      ["Basmati Rice 5kg", 649, 520, 48, "IN-FOD-002"],
      ["Tata Salt 1kg", 28, 20, 300, "IN-HOM-001"],
      ["Turmeric Powder 200g", 62, 40, 96, "IN-HOM-002"],
      ["Neem Soap Pack of 4", 140, 95, 72, "IN-PCA-001"],
      ["Basmati Combo Cooker 1.8L", 1299, 1050, 12, "IN-ELC-001"],
    ],
  },
  {
    key: "ph",
    name: "Manila Mini Mart",
    logo_url: "/demo/manila-mini-mart.svg",
    receipt_logo_url: "/demo/manila-mini-mart-receipt.svg",
    country: "Philippines",
    address: "221 SM North Avenue, Quezon City, 1100",
    contact: "+63 2 8123 4567",
    vat_id: "123-456-789-00001",
    currency: "₱",
    tax_rate: 12, // VAT
    timezone: "Asia/Manila",
    users: [
      { username: "ph_cashier", role: "cashier" },
      { username: "ph_callcenter", role: "callcenter" },
      { username: "ph_kds", role: "kds" },
    ],
    items: [
      ["Canned Sardines 150g", 32, 24, 260, "PH-CAN-001"],
      ["Instant Gyoza 500g", 89, 62, 84, "PH-FRZ-001"],
      ["Pancit Canton Box (6pc)", 118, 88, 96, "PH-FOD-001"],
      ["Bottled Water 1L", 28, 20, 320, "PH-BEV-001"],
      ["Calamansi Juice 1L", 105, 78, 40, "PH-BEV-002"],
      ["All-Purpose Bleach 1L", 78, 58, 74, "PH-HOM-001"],
      ["Dishwashing Liquid 250ml", 52, 38, 120, "PH-HOM-002"],
      ["Jasmine Rice 5kg", 385, 320, 56, "PH-FOD-002"],
      ["Canned Sardines Leche Flakes", 128, 95, 44, "PH-CAN-002"],
    ],
  },
];

const DEMO_CATEGORIES = ["Beverages", "Food", "Household", "Personal Care", "Electronics"];

function seedDemoData(): { branches: number; items: number; users: number; sales: number } {
  const result = { branches: 0, items: 0, users: 0, sales: 0 };
  const insCategory = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  const selCategory = db.prepare("SELECT id FROM categories WHERE name = ?");
  const insBranch = db.prepare(
    "INSERT OR IGNORE INTO branches (name, address, contact, vat_id, currency, tax_rate, timezone, country, logo_url, receipt_logo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const fillBranch = db.prepare(
    "UPDATE branches SET logo_url = ?, receipt_logo_url = ?, currency = COALESCE(currency, ?), tax_rate = COALESCE(tax_rate, ?), timezone = COALESCE(timezone, ?), country = COALESCE(country, ?) WHERE id = ?",
  );
  const selBranch = db.prepare("SELECT * FROM branches WHERE name = ?");
  const insUser = db.prepare("INSERT OR IGNORE INTO users (username, password_hash, role, branch_id) VALUES (?, ?, ?, ?)");
  const insItem = db.prepare(
    "INSERT OR IGNORE INTO items (name, price, cost_price, stock, sku, category_id, branch_id, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const selItem = db.prepare("SELECT * FROM items WHERE sku = ?");
  const insCustomer = db.prepare("INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)");
  const selCustomer = db.prepare("SELECT * FROM customers WHERE phone = ?");
  const insSale = db.prepare(
    "INSERT INTO sales (subtotal, tax, total, discount, timestamp, payment_method, status, customer_id, branch_id, preparation_status) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, 'ready')",
  );
  const insSaleItem = db.prepare(
    "INSERT INTO sale_items (sale_id, item_id, quantity, price_at_sale, cost_price_at_sale) VALUES (?, ?, ?, ?, ?)",
  );
  const decStock = db.prepare("UPDATE items SET stock = MAX(0, stock - ?) WHERE id = ?");

  const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
  const round2 = (n: number) => Math.round(n * 100) / 100;

  db.transaction(() => {
    DEMO_CATEGORIES.forEach((c) => insCategory.run(c));

    for (const b of DEMO_BRANCHES) {
      insBranch.run(b.name, b.address, b.contact, b.vat_id, b.currency, b.tax_rate, b.timezone, b.country, b.logo_url, b.receipt_logo_url);
      const branch = selBranch.get(b.name) as any;
      if (!branch) continue;
      fillBranch.run(b.logo_url, b.receipt_logo_url, b.currency, b.tax_rate, b.timezone, b.country, branch.id);
      result.branches += 1;

      // Staff for this branch.
      for (const u of b.users) {
        const before = db.prepare("SELECT COUNT(*) c FROM users WHERE username = ?").get(u.username) as any;
        insUser.run(u.username, hashPassword(DEMO_PASSWORD), u.role, branch.id);
        if (before.c === 0) result.users += 1;
      }

      // Catalogue, priced in this branch's currency.
      const itemIds: any[] = [];
      for (const [name, price, cost, stock, sku] of b.items) {
        const existing = selItem.get(sku) as any;
        if (existing) {
          itemIds.push(existing);
          continue;
        }
        const categoryName = sku.includes("BEV") ? "Beverages" : sku.includes("FOD") || sku.includes("FRZ") || sku.includes("CAN") ? "Food" : sku.includes("HOM") ? "Household" : sku.includes("PCA") ? "Personal Care" : "Electronics";
        const cat = selCategory.get(categoryName) as any;
        insItem.run(name, price, cost, stock, sku, cat?.id ?? null, branch.id, Math.max(5, Math.round(stock * 0.15)));
        const created = selItem.get(sku) as any;
        if (created) {
          itemIds.push(created);
          result.items += 1;
        }
      }

      // A few customers.
      const phones = [`+63 917 000 0001`, `+63 918 000 0002`, `+63 919 000 0003`];
      const names = ["Maria Santos", "Jose Rivera", "Ana Dela Cruz"];
      const customerIds: number[] = [];
      names.forEach((n, i) => {
        const found = selCustomer.get(phones[i]) as any;
        if (found) {
          customerIds.push(found.id);
        } else {
          const info = insCustomer.run(n, phones[i], `${n.split(" ")[0].toLowerCase()}@example.com`, b.address);
          customerIds.push(Number(info.lastInsertRowid));
        }
      });

      // 14 days of sales so the reports and dashboard have a trend.
      const methods = ["cash", "card", "gcash"];
      for (let day = 13; day >= 0; day--) {
        const salesToday = 3 + Math.floor(Math.random() * 6);
        for (let s = 0; s < salesToday; s++) {
          const lines = 1 + Math.floor(Math.random() * 3);
          let subtotal = 0;
          const chosen: Array<{ id: number; qty: number; price: number; cost: number }> = [];
          for (let l = 0; l < lines; l++) {
            const it = pick(itemIds);
            if (!it || chosen.some((c) => c.id === it.id)) continue;
            const qty = 1 + Math.floor(Math.random() * 3);
            chosen.push({ id: it.id, qty, price: it.price, cost: it.cost_price || 0 });
            subtotal += it.price * qty;
          }
          if (!chosen.length) continue;
          const discount = Math.random() < 0.25 ? round2(subtotal * 0.05) : 0;
          const taxable = round2(subtotal - discount);
          const tax = round2((taxable * b.tax_rate) / 100);
          const total = round2(taxable + tax);
          const when = new Date(Date.now() - day * 86400000);
          when.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60), 0);
          const ts = `${when.toISOString().slice(0, 19).replace("T", " ")}`;
          const info = insSale.run(round2(subtotal), tax, total, discount, ts, pick(methods), pick(customerIds), branch.id);
          const saleId = Number(info.lastInsertRowid);
          for (const c of chosen) {
            insSaleItem.run(saleId, c.id, c.qty, c.price, c.cost);
            decStock.run(c.qty, c.id);
          }
          result.sales += 1;
        }
      }
    }
  })();

  return result;
}


// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------
const SESSION_DAYS = Math.min(Math.max(Number(process.env.SESSION_DAYS) || 7, 1), 90);
const COOKIE_SECURE = (process.env.COOKIE_SECURE || (isProd ? "true" : "false")) === "true";

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `s1$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): { ok: boolean; upgrade?: string } {
  if (!stored) return { ok: false };
  if (!stored.includes("$")) {
    // Legacy SHA-256 hash from the original version.
    const legacyHash = crypto.createHash("sha256").update(password).digest("hex");
    const a = Buffer.from(legacyHash, "utf8");
    const b = Buffer.from(stored, "utf8");
    if (a.length !== b.length) return { ok: false };
    const ok = crypto.timingSafeEqual(a, b);
    return ok ? { ok, upgrade: hashPassword(password) } : { ok: false };
  }
  if (stored.split("$").length !== 3) return { ok: false };
  const [version, salt, hash] = stored.split("$");
  if (version !== "s1") return { ok: false };
  const test = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(test, "utf8");
  const b = Buffer.from(hash, "utf8");
  if (a.length !== b.length) return { ok: false };
  return { ok: crypto.timingSafeEqual(a, b) };
}

function newSessionToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
function tokenHash(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface AuthUser {
  id: number;
  username: string;
  role: string;
  branch_id: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const SESSION_COOKIE = "merp_session";

function setSessionCookie(res: express.Response, token: string) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookie(res: express.Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "strict", secure: COOKIE_SECURE, path: "/" });
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = (req.headers.cookie || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(SESSION_COOKIE + "="));
  const value = token ? token.slice(SESSION_COOKIE.length + 1) : req.headers["x-session-token"] as string | undefined;
  if (!value) return res.status(401).json({ error: "Authentication required" });

  const row = db
    .prepare(
      `SELECT s.token_hash, s.expires_at, s.user_id, u.username, u.role, u.branch_id
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
    )
    .get(tokenHash(value)) as any;
  if (!row) return res.status(401).json({ error: "Invalid session" });
  if (new Date(row.expires_at).getTime() < Date.now()) {
    db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(row.token_hash);
    return res.status(401).json({ error: "Session expired" });
  }

  // Sliding expiry: refresh when less than half the lifetime remains.
  const created = new Date(row.created_at || row.expires_at).getTime();
  const ttl = new Date(row.expires_at).getTime() - created;
  if (new Date(row.expires_at).getTime() - Date.now() < ttl / 2) {
    db.prepare("UPDATE sessions SET expires_at = ? WHERE token_hash = ?").run(
      new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      row.token_hash
    );
  }

  req.user = { id: row.user_id, username: row.username, role: row.role, branch_id: row.branch_id };
  next();
}

function requireRole(...roles: string[]) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Authentication required" });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: "Insufficient permissions" });
    next();
  };
}

type AsyncErr = Error & { code?: string };

// New user sees only their branch unless admin/global.
const scopedBranches = (user: AuthUser): { sql: string; has: boolean } => {
  if (!user || user.role === "admin" || !user.branch_id) return { sql: "1=1", has: false };
  return { sql: "branch_id = ?", has: true };
};

const getSetting = (key: string): string => {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
  return row ? String(row.value) : "";
};

function logEdit(table: string, id: number, action: string, details: string, username = "System") {
  db.prepare("INSERT INTO edit_logs (table_name, row_id, action, details, username) VALUES (?, ?, ?, ?, ?)").run(
    table,
    id,
    action,
    details,
    username
  );
}

// Simple in-process login rate limiter.
const LOGIN_MAX = Number(process.env.LOGIN_MAX) || 10;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
function checkLoginLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || entry.resetAt < now) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return true;
  }
  entry.count += 1;
  if (entry.count > LOGIN_MAX) {
    entry.resetAt = now + 15 * 60 * 1000;
    return false;
  }
  return true;
}

const getClientIp = (req: express.Request) =>
  (req.headers["cf-connecting-ip"] as string) || (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";

// ---------------------------------------------------------------------------
// Time offset for reports (e.g. +8h for PHT)
// ---------------------------------------------------------------------------
function formatHours(h: number): string {
  return String(h);
}
function tzParams() {
  const raw = Number(getSetting("timezone_offset") || process.env.TZ_OFFSET_HOURS || 0);
  const h = isNaN(raw) ? 0 : Math.round(raw * 4) / 4;
  return { offset: h };
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", db: "ok" });
  } catch {
    res.status(500).json({ status: "error", db: "error" });
  }
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
app.post("/api/auth/login", (req, res) => {
  const ip = getClientIp(req);
  if (!checkLoginLimit(ip)) return res.status(429).json({ error: "Too many login attempts, try again in 15 minutes" });

  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password are required" });

  // Legacy backdoor for a brand-new database that has no seeded admin.
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
  if (adminCount.count === 0 && username === "admin" && password === "admin") {
    return res.json({ success: true, username: "admin", role: "admin", branch_id: null, session: "legacy" });
  }

  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as any;
  if (!user) {
    loginAttempts.get(ip)!.count += 1;
    return res.status(401).json({ error: "Invalid credentials" });
  }
  const { ok, upgrade } = verifyPassword(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  if (upgrade) {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(upgrade, user.id);
  }

  const token = newSessionToken();
  db.prepare("INSERT INTO sessions (token_hash, user_id, user_agent, ip, expires_at) VALUES (?, ?, ?, ?, ?)").run(
    tokenHash(token),
    user.id,
    (req.headers["user-agent"] || "").slice(0, 255),
    ip,
    new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString()
  );
  setSessionCookie(res, token);

  logEdit("users", user.id, "LOGIN", `User ${user.username} logged in`, user.username);
  res.json({ success: true, username: user.username, role: user.role, branch_id: user.branch_id });
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ username: req.user!.username, role: req.user!.role, branch_id: req.user!.branch_id, id: req.user!.id });
});

app.post("/api/auth/logout", requireAuth, (req, res) => {
  const token = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(SESSION_COOKIE + "="));
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token.slice(SESSION_COOKIE.length + 1)));
  clearSessionCookie(res);
  res.json({ success: true });
});

app.post("/api/auth/change-password", requireAuth, (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!current_password || !new_password) return res.status(400).json({ error: "Current and new passwords are required" });
  if (String(new_password).length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as any;
  const { ok } = verifyPassword(current_password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

  // Keep the current session alive, revoke every other one.
  const currentToken = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(SESSION_COOKIE + "="));
  const currentHash = currentToken ? tokenHash(currentToken.slice(SESSION_COOKIE.length + 1)) : null;
  if (currentHash) db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").run(user.id, currentHash);
  else db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);

  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(new_password), user.id);
  logEdit("users", user.id, "CHANGE_PASSWORD", "Password changed", user.username);
  res.json({ success: true });
});

// Admin-only: create users. Frontend "Add User" panel calls this while authed as admin.
app.post("/api/auth/register", requireAuth, requireRole("admin"), (req, res) => {
  const { username, password, role, branch_id } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "Username and password are required" });
  if (String(password).length < 4) return res.status(400).json({ error: "Password must be at least 4 characters" });
  const allowedRoles = ["cashier", "callcenter", "kds", "admin"];
  const userRole = allowedRoles.includes(role) ? role : "cashier";

  try {
    const info = db
      .prepare("INSERT INTO users (username, password_hash, role, branch_id) VALUES (?, ?, ?, ?)")
      .run(username, hashPassword(password), userRole, branch_id || null);
    logEdit("users", Number(info.lastInsertRowid), "CREATE", `User ${username} created with role ${userRole}`, req.user!.username);
    res.json({ id: Number(info.lastInsertRowid), username, role: userRole, branch_id: branch_id || null, success: true });
  } catch {
    res.status(400).json({ error: "Username already exists" });
  }
});

// ---------------------------------------------------------------------------
// Users admin
// ---------------------------------------------------------------------------
app.get("/api/users", requireAuth, requireRole("admin"), (_req, res) => {
  res.json(db.prepare("SELECT id, username, role, branch_id, created_at FROM users ORDER BY id").all());
});

app.put("/api/users/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const { password, branch_id, role, username } = req.body || {};
  const target = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as any;
  if (!target) return res.status(404).json({ error: "User not found" });

  if (String(target.id) === String(req.user!.id) && role && role !== "admin") {
    return res.status(400).json({ error: "You cannot remove your own admin role" });
  }

  const allowedRoles = ["cashier", "callcenter", "kds", "admin"];
  const nextRole = allowedRoles.includes(role) ? role : undefined;

  if (password) {
    db.prepare("UPDATE users SET password_hash = ?, branch_id = ?, role = COALESCE(?, role) WHERE id = ?").run(hashPassword(password), branch_id || null, nextRole || null, id);
  } else {
    db.prepare("UPDATE users SET branch_id = COALESCE(?, branch_id), role = COALESCE(?, role), username = COALESCE(?, username) WHERE id = ?").run(
      branch_id ?? null,
      nextRole || null,
      username || null,
      id
    );
  }
  logEdit("users", Number(id), "UPDATE", `User ${target.username} updated by admin`, req.user!.username);
  res.json({ success: true });
});

app.delete("/api/users/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  if (String(id) === String(req.user!.id)) return res.status(400).json({ error: "You cannot delete your own account" });
  const target = db.prepare("SELECT username, role FROM users WHERE id = ?").get(id) as any;
  if (!target) return res.status(404).json({ error: "User not found" });
  if (target.role === "admin") {
    const admins = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get() as { c: number };
    if (admins.c <= 1) return res.status(400).json({ error: "Cannot delete the last admin user" });
  }
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  db.prepare("DELETE FROM users WHERE id = ?").run(id);
  logEdit("users", Number(id), "DELETE", `User ${target.username} deleted`, req.user!.username);
  res.json({ success: true });
});

app.get("/api/sessions", requireAuth, requireRole("admin"), (req, res) => {
  const rows = db
    .prepare(
      `SELECT s.id, u.username, u.role, s.user_agent, s.ip, s.created_at, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC LIMIT 100`
    )
    .all();
  res.json(rows);
});

app.delete("/api/sessions/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Uploads
// ---------------------------------------------------------------------------
export const uploadDir = path.join(path.dirname(dbPath), "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});
function uploadSingle(field = "image") {
  return upload.single(field);
}

app.post("/api/upload", requireAuth, uploadSingle("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

// ---------------------------------------------------------------------------
// Demo data (on demand)
// ---------------------------------------------------------------------------
app.post("/api/admin/seed-demo", requireAuth, requireRole("admin"), (req, res) => {
  try {
    const r = seedDemoData();
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('demo_seeded_at', ?)").run(new Date().toISOString());
    logEdit("settings", 0, "CREATE", `Demo data seeded: ${r.items} items, ${r.sales} sales`, req.user!.username);
    res.json({ success: true, ...r, staff_password: DEMO_PASSWORD });
  } catch (err) {
    res.status(500).json({ error: `Seeding failed: ${(err as Error).message}` });
  }
});

app.get("/api/demo-info", requireAuth, requireRole("admin"), (_req, res) => {
  res.json({
    seeded_at: getSetting("demo_seeded_at") || null,
    staff_password: DEMO_PASSWORD,
    accounts: DEMO_BRANCHES.flatMap((b) =>
      b.users.map((u) => ({ username: u.username, role: u.role, branch: b.name, country: b.country, currency: b.currency, tax_rate: b.tax_rate })),
    ),
  });
});

// ---------------------------------------------------------------------------
// Branches
// ---------------------------------------------------------------------------
app.get("/api/branches", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM branches ORDER BY name").all());
});

app.post("/api/branches", requireAuth, requireRole("admin"), (req, res) => {
  const { name, address, contact, vat_id, currency, tax_rate, timezone, country, receipt_logo_url } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const info = db
      .prepare("INSERT INTO branches (name, address, contact, vat_id, currency, tax_rate, timezone, country, receipt_logo_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(name, address || null, contact || null, vat_id || null, currency || null, tax_rate != null && tax_rate !== "" ? Number(tax_rate) : null, timezone || null, country || null, receipt_logo_url || null);
    logEdit("branches", Number(info.lastInsertRowid), "CREATE", `Branch ${name} added`, req.user!.username);
    res.json(db.prepare("SELECT * FROM branches WHERE id = ?").get(Number(info.lastInsertRowid)));
  } catch {
    res.status(400).json({ error: "Branch already exists" });
  }
});

app.post("/api/branches/:id/logo", requireAuth, requireRole("admin"), uploadSingle("logo"), (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const logoUrl = `/uploads/${req.file.filename}`;
  db.prepare("UPDATE branches SET logo_url = ? WHERE id = ?").run(logoUrl, id);
  logEdit("branches", Number(id), "UPDATE", "Branch logo updated", req.user!.username);
  res.json({ success: true, logo_url: logoUrl });
});

app.put("/api/branches/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const { name, address, contact, vat_id, logo_url, currency, tax_rate, timezone, country, receipt_logo_url } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });
  const old = db.prepare("SELECT * FROM branches WHERE id = ?").get(id) as any;
  if (!old) return res.status(404).json({ error: "Branch not found" });
  db
    .prepare(
      `UPDATE branches SET name = ?, address = ?, contact = ?, vat_id = ?,
       currency = COALESCE(?, currency), tax_rate = COALESCE(?, tax_rate),
       timezone = COALESCE(?, timezone), country = COALESCE(?, country),
       logo_url = COALESCE(?, logo_url), receipt_logo_url = COALESCE(?, receipt_logo_url) WHERE id = ?`,
    )
    .run(
      name,
      address || null,
      contact || null,
      vat_id || null,
      currency || null,
      tax_rate != null && tax_rate !== "" ? Number(tax_rate) : null,
      timezone || null,
      country || null,
      logo_url || null,
      receipt_logo_url || null,
      id,
    );
  logEdit("branches", Number(id), "UPDATE", `Branch ${name} updated`, req.user!.username);
  res.json({ success: true });
});

app.delete("/api/branches/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM branches WHERE id = ?").run(id);
  logEdit("branches", Number(id), "DELETE", `Branch ${id} deleted`, req.user!.username);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------
app.get("/api/categories", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM categories ORDER BY name").all());
});

app.post("/api/categories", requireAuth, requireRole("admin", "cashier"), (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
    logEdit("categories", Number(info.lastInsertRowid), "CREATE", `Category ${name} added`, req.user!.username);
    res.json({ id: Number(info.lastInsertRowid), name });
  } catch {
    res.status(400).json({ error: "Category already exists" });
  }
});

app.delete("/api/categories/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  logEdit("categories", Number(id), "DELETE", `Category ${id} deleted`, req.user!.username);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------
app.get("/api/items", requireAuth, (req, res) => {
  // A branch user sees shared items plus their own store's catalogue.
  const branchId = (req.user as any)?.branch_id ?? null;
  const items = db
    .prepare(`SELECT items.*, categories.name as category_name FROM items LEFT JOIN categories ON items.category_id = categories.id
      WHERE (? IS NULL OR items.branch_id IS NULL OR items.branch_id = ?) ORDER BY items.name`)
    .all(branchId, branchId);
  res.json(items);
});

app.post("/api/items", requireAuth, requireRole("admin", "cashier"), (req, res) => {
  const { name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold, branch_id } = req.body || {};
  const priceNum = Number(price);
  if (!name || !isFinite(priceNum) || priceNum < 0) return res.status(400).json({ error: "Invalid item data. Name and valid price are required." });
  const ownerBranch = branch_id ?? (req.user as any)?.branch_id ?? null;
  try {
    const info = db
      .prepare("INSERT INTO items (name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold, branch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(name, priceNum, Number(cost_price) || 0, category_id || null, sku || null, Number(stock) || 0, image_url || null, Number(low_stock_threshold) || 5, ownerBranch);
    const itemId = Number(info.lastInsertRowid);
    logEdit("items", itemId, "CREATE", `Item ${name} added`, req.user!.username);
    res.json({ id: itemId, name, price: priceNum, cost_price: Number(cost_price) || 0, category_id, sku, stock, image_url, low_stock_threshold, branch_id: ownerBranch });
  } catch {
    res.status(400).json({ error: "SKU must be unique or database error occurred" });
  }
});

app.put("/api/items/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const { name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold } = req.body || {};
  const priceNum = Number(price);
  if (!name || !isFinite(priceNum) || priceNum < 0) return res.status(400).json({ error: "Invalid item data" });
  const oldItem = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as any;
  if (!oldItem) return res.status(404).json({ error: "Item not found" });
  db.prepare("UPDATE items SET name = ?, price = ?, cost_price = ?, category_id = ?, sku = ?, stock = ?, image_url = ?, low_stock_threshold = ? WHERE id = ?").run(
    name,
    priceNum,
    Number(cost_price) || 0,
    category_id || null,
    sku || null,
    Number(stock) || 0,
    image_url || null,
    Number(low_stock_threshold) || 5,
    id
  );
  const changes: string[] = [];
  if (oldItem.name !== name) changes.push(`Name: '${oldItem.name}' -> '${name}'`);
  if (Number(oldItem.price) !== priceNum) changes.push(`Price: ${oldItem.price} -> ${priceNum}`);
  if (Number(oldItem.cost_price) !== Number(cost_price)) changes.push(`Cost: ${oldItem.cost_price} -> ${cost_price}`);
  if (Number(oldItem.stock) !== Number(stock)) changes.push(`Stock: ${oldItem.stock} -> ${stock}`);
  if (oldItem.sku !== sku) changes.push(`SKU changed`);
  logEdit("items", Number(id), "UPDATE", changes.length ? changes.join(", ") : "No changes", req.user!.username);
  res.json({ success: true });
});

app.delete("/api/items/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM items WHERE id = ?").run(id);
  logEdit("items", Number(id), "DELETE", `Item ${id} deleted`, req.user!.username);
  res.json({ success: true });
});

app.post("/api/items/:id/adjust-stock", requireAuth, requireRole("admin", "cashier"), (req, res) => {
  const { id } = req.params;
  const adjustment = Number(req.body?.adjustment);
  const reason = req.body?.reason;
  if (!isFinite(adjustment) || adjustment === 0) return res.status(400).json({ error: "Adjustment must be a non-zero number" });

  const run = db.transaction(() => {
    const item = db.prepare("SELECT name, stock FROM items WHERE id = ?").get(id) as any;
    if (!item) return { error: "Item not found" };
    const newStock = item.stock + adjustment;
    if (newStock < 0) return { error: `Cannot adjust below zero (current stock: ${item.stock})` };
    db.prepare("UPDATE items SET stock = ? WHERE id = ?").run(newStock, id);
    db.prepare("INSERT INTO stock_adjustments (item_id, adjustment, reason, username) VALUES (?, ?, ?, ?)").run(id, adjustment, reason || null, req.user!.username);
    logEdit("items", Number(id), "ADJUST_STOCK", `Stock for ${item.name} adjusted by ${adjustment} (${item.stock} -> ${newStock}). Reason: ${reason || "None"}`, req.user!.username);
    return { ok: true };
  });

  const result = run();
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

app.get("/api/items/:id/stock-history", requireAuth, (req, res) => {
  const { id } = req.params;
  res.json(db.prepare("SELECT * FROM stock_adjustments WHERE item_id = ? ORDER BY timestamp DESC LIMIT 200").all(id));
});

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
app.get("/api/settings", requireAuth, (_req, res) => {
  const rows = db.prepare("SELECT * FROM settings").all() as any[];
  res.json(rows.reduce((acc: any, curr: any) => { acc[curr.key] = curr.value; return acc; }, {}));
});

app.post("/api/settings", requireAuth, requireRole("admin"), (req, res) => {
  const allowed = ["company_name", "tax_rate", "address", "contact", "logo_url", "app_logo_url", "vat_id", "currency", "timezone", "timezone_offset", "thermal_paper_size", "thermal_font_style", "thermal_print_density", "receipt_footer", "low_stock_alert"];
  const tx = db.transaction(() => {
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)").run(key, String(req.body[key]));
      }
    }
    logEdit("settings", 0, "UPDATE", "Settings updated", req.user!.username);
  });
  tx();
  res.json({ success: true });
});

app.get("/api/edit-logs", requireAuth, requireRole("admin"), (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
  res.json(db.prepare("SELECT * FROM edit_logs ORDER BY timestamp DESC, id DESC LIMIT ?").all(limit));
});

// ---------------------------------------------------------------------------
// Payment methods
// ---------------------------------------------------------------------------
app.get("/api/payment-methods", requireAuth, (_req, res) => {
  res.json(db.prepare("SELECT * FROM payment_methods WHERE is_active = 1 ORDER BY id").all());
});

app.post("/api/payment-methods", requireAuth, requireRole("admin"), (req, res) => {
  const name = String(req.body?.name || "").toLowerCase().trim();
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const info = db.prepare("INSERT INTO payment_methods (name) VALUES (?)").run(name);
    logEdit("payment_methods", Number(info.lastInsertRowid), "CREATE", `Payment method ${name} added`, req.user!.username);
    res.json({ id: Number(info.lastInsertRowid), name, is_active: 1 });
  } catch {
    res.status(400).json({ error: "Payment method already exists" });
  }
});

app.put("/api/payment-methods/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const name = String(req.body?.name || "").toLowerCase().trim();
  if (!name) return res.status(400).json({ error: "Name is required" });
  db.prepare("UPDATE payment_methods SET name = ? WHERE id = ?").run(name, id);
  res.json({ success: true });
});

app.delete("/api/payment-methods/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  const pm = db.prepare("SELECT name FROM payment_methods WHERE id = ?").get(id) as any;
  db.prepare("DELETE FROM payment_methods WHERE id = ?").run(id);
  logEdit("payment_methods", Number(id), "DELETE", `Payment method ${pm?.name || id} deleted`, req.user!.username);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

app.post("/api/sales", requireAuth, (req, res) => {
  const { items: saleItems, subtotal, tax, total, discount, payment_method, customer_id, branch_id, timestamp, status } = req.body || {};
  if (!Array.isArray(saleItems) || saleItems.length === 0) return res.status(400).json({ error: "Cart is empty" });
  if (saleItems.length > 500) return res.status(400).json({ error: "Too many items" });

  const allowedStatuses = ["completed", "pending", "preparing", "ready"];
  const saleStatus = allowedStatuses.includes(status) ? status : "completed";
  const method = String(payment_method || "cash").toLowerCase().trim() || "cash";

  for (const item of saleItems) {
    const qty = Number(item.quantity);
    const price = Number(item.price);
    if (!item.id || !isFinite(qty) || qty <= 0) return res.status(400).json({ error: `Invalid item data for item: ${item.name || "Unknown"}` });
    if (!isFinite(price) || price < 0) return res.status(400).json({ error: `Invalid price for item: ${item.name || "Unknown"}` });
  }

const serverSubtotal = round2(saleItems.reduce((sum, it) => sum + Number(it.quantity) * Number(it.price), 0));
  // Guard against client tampering: only ever record subtotals that actually match the line items.
  if (Math.abs(Number(subtotal) - serverSubtotal) > 0.01) {
    return res.status(400).json({ error: "Sale total does not match line items" });
  }

  const safeDiscount = Math.max(0, Number(discount) || 0);
  const recTax = Math.max(0, Number(tax) || 0);
  if (safeDiscount > serverSubtotal + recTax) return res.status(400).json({ error: "Discount exceeds sale total" });

  const saleTimestamp = timestamp && !isNaN(Date.parse(timestamp)) ? timestamp : null;
  const balance = round2(serverSubtotal + recTax - safeDiscount);

  const run = db.transaction(() => {
    for (const item of saleItems) {
      const current = db.prepare("SELECT name, stock FROM items WHERE id = ?").get(item.id) as any;
      if (!current) throw new Error(`Item #${item.id} no longer exists`);
      const qty = Number(item.quantity);
      if (current.stock - qty < 0) throw new Error(`Insufficient stock for ${current.name} (only ${current.stock} left)`);
    }

    const saleInfo = saleTimestamp
      ? db.prepare("INSERT INTO sales (subtotal, tax, total, payment_method, discount, timestamp, customer_id, branch_id, status, completed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
          serverSubtotal, recTax, balance, method, safeDiscount, saleTimestamp, customer_id || null, branch_id || null, saleStatus, req.user!.username
        )
      : db.prepare("INSERT INTO sales (subtotal, tax, total, payment_method, discount, customer_id, branch_id, status, completed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
          serverSubtotal, recTax, balance, method, safeDiscount, customer_id || null, branch_id || null, saleStatus, req.user!.username
        );
    const saleId = Number(saleInfo.lastInsertRowid);

    for (const item of saleItems) {
      const current = db.prepare("SELECT cost_price FROM items WHERE id = ?").get(item.id) as any;
      const qty = Number(item.quantity);
      const price = Number(item.price);
      db.prepare("INSERT INTO sale_items (sale_id, item_id, quantity, price_at_sale, cost_price_at_sale) VALUES (?, ?, ?, ?, ?)").run(saleId, item.id, qty, price, current?.cost_price || 0);
      db.prepare("UPDATE items SET stock = stock - ? WHERE id = ?").run(qty, item.id);
    }
    logEdit("sales", saleId, "CREATE", `Sale ${saleId} created with total ${balance} and status ${saleStatus}`, req.user!.username);
    return saleId;
  });

  try {
    const saleId = run();
    res.json({ id: saleId, success: true });
  } catch (err) {
    const e = err as AsyncErr;
    return res.status(e.message?.startsWith("Insufficient") ? 409 : 500).json({ error: e.message || "Transaction failed" });
  }
});

app.get("/api/sales/:id/items", requireAuth, (req, res) => {
  const { id } = req.params;
  const items = db
    .prepare(`SELECT sale_items.*, items.name as name, items.sku as sku FROM sale_items JOIN items ON sale_items.item_id = items.id WHERE sale_id = ?`)
    .all(id);
  res.json(items);
});

const voidOrRefund = (req: express.Request, res: express.Response, to: "voided" | "refunded") => {
  const { id } = req.params;
  const reason = req.body?.reason;
  const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id) as any;
  if (!sale) return res.status(404).json({ error: "Sale not found" });
  if (sale.status === to) return res.status(400).json({ error: `Sale already ${to}` });
  if (sale.status === "voided" && to === "refunded") return res.status(400).json({ error: "Cannot refund a voided sale" });
  if (sale.status === "refunded" && to === "voided") return res.status(400).json({ error: "Cannot void a refunded sale" });

  const tx = db.transaction(() => {
    db.prepare("UPDATE sales SET status = ?, status_reason = ? WHERE id = ?").run(to, reason || null, id);
    const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id) as any[];
    for (const item of items) {
      db.prepare("UPDATE items SET stock = stock + ? WHERE id = ?").run(item.quantity, item.item_id);
      db.prepare("INSERT INTO stock_adjustments (item_id, adjustment, reason, username) VALUES (?, ?, ?, ?)").run(item.item_id, item.quantity, `${to === "voided" ? "Voided" : "Refunded"} Sale #${id}: ${reason || "No reason"}`, req.user!.username);
    }
    logEdit("sales", Number(id), "UPDATE", `Sale ${id} ${to}: ${reason}`, req.user!.username);
  });
  try {
    tx();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
};

app.post("/api/sales/:id/void", requireAuth, requireRole("admin", "cashier", "callcenter"), (req, res) => voidOrRefund(req, res, "voided"));
app.post("/api/sales/:id/refund", requireAuth, requireRole("admin", "cashier", "callcenter"), (req, res) => voidOrRefund(req, res, "refunded"));

// ---------------------------------------------------------------------------
// Orders / KDS
// ---------------------------------------------------------------------------
app.get("/api/orders/pending", requireAuth, (req, res) => {
  const { branch_id, date, include_completed } = req.query;
  const branch = req.user!.role === "admin" ? (branch_id as string) : String(req.user!.branch_id || "");

  if (include_completed === "true" && date) {
    const rows = db.prepare(`SELECT * FROM sales WHERE date(timestamp) = date(?) ${branch ? "AND branch_id = ?" : ""} ORDER BY timestamp ASC`).all(...(branch ? [date, branch] : [date])) as any[];
    const out = rows.map((o) => decorateOrder(o));
    return res.json(out);
  }

  const rows = db.prepare(`SELECT * FROM sales WHERE (status = 'pending' OR status = 'preparing' OR status = 'ready') ${branch ? "AND branch_id = ?" : ""} ORDER BY timestamp ASC`).all(...(branch ? [branch] : [])) as any[];
  res.json(rows.map((o) => decorateOrder(o)));
});

const decorateOrder = (order: any) => {
  const items = db.prepare("SELECT si.*, i.name, i.sku FROM sale_items si JOIN items i ON i.id = si.item_id WHERE si.sale_id = ?").all(order.id);
  const customer = order.customer_id ? db.prepare("SELECT name, phone, address FROM customers WHERE id = ?").get(order.customer_id) : null;
  return {
    ...order,
    items,
    customer_name: customer?.name || null,
    customer_phone: customer?.phone || null,
    customer_address: customer?.address || null,
  };
};

app.put("/api/orders/:id/status", requireAuth, (req, res) => {
  const { id } = req.params;
  const { status, preparation_status, branch_id } = req.body || {};
  if (!status && !preparation_status) return res.status(400).json({ error: "status or preparation_status required" });
  const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id) as any;
  if (!sale) return res.status(404).json({ error: "Order not found" });

  const allowedStatuses = ["pending", "preparing", "ready", "completed", "voided", "refunded"];
  const allowedPrep = ["pending", "preparing", "ready", "delivered"];
  if (status && !allowedStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });
  if (preparation_status && !allowedPrep.includes(preparation_status)) return res.status(400).json({ error: "Invalid preparation status" });

  if (status) {
    db.prepare("UPDATE sales SET status = ?, completed_by = COALESCE(completed_by, ?), completed_at_branch_id = COALESCE(completed_at_branch_id, ?) WHERE id = ?").run(status, req.user!.username, branch_id || req.user!.branch_id || null, id);
  }
  if (preparation_status) {
    db.prepare("UPDATE sales SET preparation_status = ? WHERE id = ?").run(preparation_status, id);
  }
  const branchName = branch_id ? (db.prepare("SELECT name FROM branches WHERE id = ?").get(branch_id) as any)?.name : null;
  const logMsg = status ? `Sale ${id} status -> ${status} by ${req.user!.username}${branchName ? " at " + branchName : ""}` : `Sale ${id} prep -> ${preparation_status} by ${req.user!.username}`;
  logEdit("sales", Number(id), "UPDATE_STATUS", logMsg, req.user!.username);
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
app.get("/api/customers", requireAuth, (req, res) => {
  const { search } = req.query;
  if (search) {
    const term = String(search).replace(/[%_]/g, "\\$&");
    const rows = db.prepare(`SELECT * FROM customers WHERE name LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' ORDER BY name LIMIT 20`).all(`%${term}%`, `%${term}%`);
    return res.json(rows);
  }
  const rows = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM sales s WHERE s.customer_id = c.id) as total_orders, (SELECT COALESCE(SUM(s.total),0) FROM sales s WHERE s.customer_id = c.id) as total_spent FROM customers c ORDER BY total_spent DESC LIMIT 200`).all();
  res.json(rows);
});

app.post("/api/customers", requireAuth, requireRole("admin", "cashier"), (req, res) => {
  const { name, phone, email, address } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });
  try {
    const info = db.prepare("INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)").run(name, phone || null, email || null, address || null);
    logEdit("customers", Number(info.lastInsertRowid), "CREATE", `Customer ${name} added`, req.user!.username || "System");
    res.json({ id: Number(info.lastInsertRowid), name, phone, email, address });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.put("/api/customers/:id", requireAuth, requireRole("admin", "cashier"), (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address } = req.body || {};
  if (!name) return res.status(400).json({ error: "Name is required" });
  db.prepare("UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?").run(name, phone || null, email || null, address || null, id);
  logEdit("customers", Number(id), "UPDATE", `Customer ${name} updated`, req.user!.username);
  res.json({ success: true });
});

app.delete("/api/customers/:id", requireAuth, requireRole("admin"), (req, res) => {
  const { id } = req.params;
  db.prepare("DELETE FROM customers WHERE id = ?").run(id);
  logEdit("customers", Number(id), "DELETE", `Customer ${id} deleted`, req.user!.username);
  res.json({ success: true });
});

app.get("/api/customers/:id/stats", requireAuth, (req, res) => {
  const { id } = req.params;
  const stats = db.prepare("SELECT COUNT(*) as total_orders, COALESCE(SUM(total),0) as total_spent, COUNT(DISTINCT branch_id) as branch_count FROM sales WHERE customer_id = ?").get(id);
  res.json(stats || { total_orders: 0, total_spent: 0, branch_count: 0 });
});

app.get("/api/customers/:id/sales", requireAuth, (req, res) => {
  const { id } = req.params;
  const sales = db.prepare("SELECT s.*, b.name as branch_name FROM sales s LEFT JOIN branches b ON s.branch_id = b.id WHERE s.customer_id = ? ORDER BY s.timestamp DESC LIMIT 200").all(id) as any[];
  res.json(sales.map((s) => decorateOrder(s)));
});

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
function reportTime(paramsTarget: string, type: string) {
  const { offset } = tzParams();
  const expr = offset === 0 ? paramsTarget : `datetime(${paramsTarget}, ?)`;
  if (type === "month") return { filter: `strftime('%Y-%m', ${expr}) = strftime('%Y-%m', date(?))`, extra: offset === 0 ? [] : [`${formatHours(offset)} hours`] };
  if (type === "year") return { filter: `strftime('%Y', ${expr}) = strftime('%Y', date(?))`, extra: offset === 0 ? [] : [`${formatHours(offset)} hours`] };
  return { filter: `date(${expr}) = date(?)`, extra: offset === 0 ? [] : [`${formatHours(offset)} hours`] };
}

app.get("/api/reports/sales", requireAuth, (req, res) => {
  const { type, date, branch_id } = req.query;
  const targetDate = (date as string) || new Date().toISOString().split("T")[0];
  const { filter, extra } = reportTime("s.timestamp", (type as string) || "day");

  const { sql, has } = scopedBranches(req.user!);
  let where = `${filter} ${has ? "AND " + sql : ""}`;
  const params: any[] = [...extra, targetDate];
  if (has) params.push(req.user!.branch_id);
  else if (branch_id) {
    where += " AND s.branch_id = ?";
    params.push(branch_id);
  }

  const sales = db.prepare(`
    SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
           b.name as branch_name, cb.name as completed_at_branch_name
    FROM sales s
    LEFT JOIN customers c ON s.customer_id = c.id
    LEFT JOIN branches b ON s.branch_id = b.id
    LEFT JOIN branches cb ON s.completed_at_branch_id = cb.id
    WHERE ${where}
    ORDER BY s.timestamp DESC
  `).all(...params);
  res.json(sales);
});

app.get("/api/reports/inventory", requireAuth, (req, res) => {
  const items = db.prepare(`SELECT items.*, categories.name as category_name FROM items LEFT JOIN categories ON items.category_id = categories.id ORDER BY items.name`).all() as any[];
  const itemsWithValuation = items.map((item) => {
    const qty = Number(item.stock) || 0;
    const cost = Number(item.cost_price) || 0;
    const price = Number(item.price) || 0;
    const valuation = round2(qty * cost);
    const potential_profit = round2(qty * (price - cost));
    const status = qty <= 0 ? "out" : qty <= (Number(item.low_stock_threshold) || 5) ? "low" : "normal";
    return { ...item, valuation, potential_profit, status };
  });
  const summary = {
    total_items: items.length,
    total_stock: items.reduce((s, i) => s + (Number(i.stock) || 0), 0),
    total_valuation: round2(itemsWithValuation.reduce((s, i) => s + i.valuation, 0)),
    total_potential_profit: round2(itemsWithValuation.reduce((s, i) => s + i.potential_profit, 0)),
    low_stock_count: itemsWithValuation.filter((i) => i.status === "low").length,
    out_of_stock_count: itemsWithValuation.filter((i) => i.status === "out").length,
  };
  res.json({ items: itemsWithValuation, summary });
});

app.get("/api/reports/summary", requireAuth, (req, res) => {
  const { type, date, branch_id } = req.query;
  const targetDate = (date as string) || new Date().toISOString().split("T")[0];
  const { filter, extra } = reportTime("sales.timestamp", (type as string) || "day");
  const { sql, has } = scopedBranches(req.user!);

  const buildWhere = () => {
    const parts = [filter];
    const params: any[] = [...extra, targetDate];
    if (has) {
      parts.push(sql);
      params.push(req.user!.branch_id);
    } else if (branch_id) {
      parts.push("sales.branch_id = ?");
      params.push(branch_id);
    }
    return { where: parts.join(" AND "), params };
  };

  const summary = (() => {
    const { where, params } = buildWhere();
    return db.prepare(`
      SELECT
        payment_method,
        COUNT(*) as transaction_count,
        COALESCE(SUM(CASE WHEN status = 'completed' OR status IS NULL THEN total ELSE 0 END), 0) as total_sales,
        COALESCE(SUM(CASE WHEN status = 'completed' OR status IS NULL THEN total ELSE 0 END), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN status = 'completed' OR status IS NULL THEN tax ELSE 0 END), 0) as total_tax,
        COALESCE(SUM(CASE WHEN status = 'completed' OR status IS NULL THEN discount ELSE 0 END), 0) as total_discount,
        COALESCE(SUM(CASE WHEN status = 'refunded' THEN total ELSE 0 END), 0) as total_refunds,
        COALESCE(SUM(CASE WHEN status = 'voided' THEN 1 ELSE 0 END), 0) as total_voids
      FROM sales WHERE ${where} GROUP BY payment_method
    `).all(...params);
  })();

  const itemWhere = buildWhere();
  const items = db.prepare(`
    SELECT items.name, items.id as item_id,
      COALESCE(SUM(sale_items.quantity), 0) as total_quantity,
      COALESCE(SUM(sale_items.quantity * sale_items.price_at_sale), 0) as total_revenue,
      COALESCE(SUM(sale_items.quantity * sale_items.cost_price_at_sale), 0) as total_cogs,
      COALESCE(SUM(sale_items.quantity * (sale_items.price_at_sale - sale_items.cost_price_at_sale)), 0) as total_profit
    FROM sale_items
    JOIN sales ON sale_items.sale_id = sales.id
    JOIN items ON sale_items.item_id = items.id
    WHERE ${itemWhere.where} AND (sales.status = 'completed' OR sales.status IS NULL)
    GROUP BY items.id ORDER BY total_revenue DESC
  `).all(...itemWhere.params);

  const catWhere = buildWhere();
  const categories = db.prepare(`
    SELECT COALESCE(categories.name, 'Uncategorized') as name,
      COALESCE(SUM(sale_items.quantity * sale_items.price_at_sale), 0) as total_revenue,
      COALESCE(SUM(sale_items.quantity * sale_items.cost_price_at_sale), 0) as total_cogs,
      COALESCE(SUM(sale_items.quantity * (sale_items.price_at_sale - sale_items.cost_price_at_sale)), 0) as total_profit
    FROM sale_items
    JOIN sales ON sale_items.sale_id = sales.id
    JOIN items ON sale_items.item_id = items.id
    LEFT JOIN categories ON items.category_id = categories.id
    WHERE ${catWhere.where} AND (sales.status = 'completed' OR sales.status IS NULL)
    GROUP BY categories.id ORDER BY total_revenue DESC
  `).all(...catWhere.params);

  res.json({ summary, items, categories });
});

// Dashboard KPI feature
app.get("/api/dashboard", requireAuth, (req, res) => {
  const targetDate = new Date().toISOString().split("T")[0];
  const { filter, extra } = reportTime("timestamp", "day");
  const { sql, has } = scopedBranches(req.user!);
  const params: any[] = [...extra, targetDate];
  const dayWhere = `${filter} ${has ? "AND " + sql : ""}`;
  if (has) params.push(req.user!.branch_id);

  const day = db.prepare(`SELECT COALESCE(SUM(CASE WHEN status = 'completed' OR status IS NULL THEN total ELSE 0 END),0) as revenue, COUNT(*) as transactions FROM sales WHERE ${dayWhere}`).get(...params) as any;

  const lowStock = db.prepare(`SELECT COUNT(*) as c FROM items WHERE stock <= low_stock_threshold`).get() as { c: number };
  const outStock = db.prepare(`SELECT COUNT(*) as c FROM items WHERE stock <= 0`).get() as { c: number };

  res.json({
    today_revenue: round2(day.revenue || 0),
    today_transactions: day.transactions || 0,
    low_stock_count: lowStock.c,
    out_of_stock_count: outStock.c,
  });
});

// ---------------------------------------------------------------------------
// Database export / import / backup
// ---------------------------------------------------------------------------
const BACKUP_TABLES = ["branches", "users", "categories", "items", "sales", "sale_items", "settings", "payment_methods", "customers", "stock_adjustments", "edit_logs"];

app.get("/api/db/export", requireAuth, requireRole("admin"), (_req, res) => {
  const data: Record<string, any[]> = {};
  for (const table of BACKUP_TABLES) {
    try {
      data[table] = db.prepare(`SELECT * FROM ${table}`).all();
    } catch {
      data[table] = [];
    }
  }
  res.setHeader("Content-Disposition", `attachment; filename=modernerp_backup_${new Date().toISOString().split("T")[0]}.json`);
  res.json(data);
});

app.post("/api/db/import", requireAuth, requireRole("admin"), (req, res) => {
  const { data, mode } = req.body || {};
  if (!data || typeof data !== "object") return res.status(400).json({ error: "No data provided" });
  if (!Array.isArray(data.branches) && !Array.isArray(data.items) && !Array.isArray(data.sales)) {
    return res.status(400).json({ error: "Backup file does not look like a ModernERP export" });
  }

  const tx = db.transaction(() => {
    if (mode === "replace") {
      // Delete child rows first so foreign keys stay satisfied. `PRAGMA foreign_keys`
      // cannot be toggled inside a transaction, so rely on ordering instead.
      db.exec("DELETE FROM sale_items; DELETE FROM sales; DELETE FROM items; DELETE FROM categories; DELETE FROM customers; DELETE FROM stock_adjustments; DELETE FROM edit_logs; DELETE FROM payment_methods; DELETE FROM settings; DELETE FROM users; DELETE FROM branches; DELETE FROM sessions;");
    }
    const count = (t: any[], cols: any[]) => {
      let n = 0;
      for (const r of t) {
        try {
          db.prepare(`INSERT OR IGNORE INTO ${cols[0]} (${cols[1]}) VALUES (${cols[2]})`).run(...cols[3].map((c: any) => r[c]));
          n++;
        } catch {}
      }
      return n;
    };
    const rel: Record<string, { cols: string[]; cols2: string; ph: string }[]> = {};
    const insertAll = (table: string, columns: string[], rows: any[]) => {
      if (!Array.isArray(rows)) return 0;
      let n = 0;
      for (const r of rows) {
        try {
          db.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`).run(...columns.map((c) => r[c] ?? null));
          n++;
        } catch {}
      }
      return n;
    };

    insertAll("branches", ["id", "name", "address", "contact", "vat_id"], data.branches || []);
    insertAll("users", ["id", "username", "password_hash", "role", "branch_id", "created_at"], data.users || []);
    insertAll("categories", ["id", "name"], data.categories || []);
    insertAll("items", ["id", "name", "price", "cost_price", "category_id", "sku", "stock", "image_url", "low_stock_threshold"], data.items || []);
    insertAll("customers", ["id", "name", "phone", "email", "address", "created_at"], data.customers || []);
    insertAll("payment_methods", ["id", "name", "is_active"], data.payment_methods || []);
    insertAll("settings", ["key", "value"], data.settings || []);
    insertAll("sales", ["id", "subtotal", "tax", "total", "discount", "timestamp", "payment_method", "status", "status_reason", "customer_id", "branch_id", "preparation_status", "completed_by", "completed_at_branch_id"], data.sales || []);
    insertAll("sale_items", ["id", "sale_id", "item_id", "quantity", "price_at_sale", "cost_price_at_sale"], data.sale_items || []);
    insertAll("stock_adjustments", ["id", "item_id", "adjustment", "reason", "username", "timestamp"], data.stock_adjustments || []);
    insertAll("edit_logs", ["id", "table_name", "row_id", "action", "details", "username", "timestamp"], data.edit_logs || []);
  });

  try {
    tx();
    logEdit("settings", 0, "IMPORT", `Database ${mode === "replace" ? "replaced" : "merged"} from backup`, req.user!.username);
    res.json({ success: true, message: "Database imported successfully" });
  } catch (err) {
    res.status(500).json({ error: `Import failed: ${(err as Error).message}` });
  }
});

// Binary SQLite snapshot download (admin only).
app.get("/api/db/backup", requireAuth, requireRole("admin"), (_req, res) => {
  const tmp = path.join(path.dirname(dbPath), `backup-${Date.now()}.db`);
  try {
    db.prepare("VACUUM INTO ?").run(tmp);
    res.setHeader("Content-Type", "application/vnd.sqlite3");
    res.setHeader("Content-Disposition", `attachment; filename=modernerp_backup_${new Date().toISOString().split("T")[0]}.db`);
    const stream = fs.createReadStream(tmp);
    stream.pipe(res);
    stream.on("close", () => fs.promises.unlink(tmp).catch(() => {}));
  } catch (err) {
    res.status(500).json({ error: `Backup failed: ${(err as Error).message}` });
  }
});

// ---------------------------------------------------------------------------
// Static frontend
// ---------------------------------------------------------------------------
app.use("/uploads", express.static(uploadDir));
if (isProd) {
  // The bundle lives in dist-server/, so __dirname is not the project root in
  // production. Resolve the client build: env override, then next to the
  // bundle, then the working directory (tsx dev / Docker /app).
  const distCandidates = [
    process.env.STATIC_DIR,
    path.join(__dirname, "dist"),
    path.join(process.cwd(), "dist"),
  ].filter((p): p is string => !!p);
  const distDir = distCandidates.find((p) => fs.existsSync(path.join(p, "index.html")));
  if (!distDir) {
    console.error(`[modernerp] Could not find built frontend. Looked in: ${distCandidates.join(", ")}`);
  } else {
    console.log(`[modernerp] Serving frontend from ${distDir}`);
    app.use(express.static(distDir));
    app.get("*", (req, res) => {
      if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
      res.sendFile(path.join(distDir, "index.html"));
    });
  }
} else {
  // Development: Vite middleware with an SPA fallback that never shadows /api.
  import("vite").then(({ createServer: createViteServer }) => {
    createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      logLevel: "error",
    }).then((vite) => {
      app.use((req, res, next) => {
        if (req.path.startsWith("/api/")) return next();
        vite.middlewares(req, res, next);
      });
      app.listen(PORT, "0.0.0.0", () => console.log(`Dev server on http://localhost:${PORT}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
// Applied here, not next to the other seeders: seeding needs hashPassword and
// getSetting, which are declared further down the file. Guarded by a marker
// setting so restarting the container never duplicates the data.
if ((process.env.SEED_DEMO || "0") === "1" && !getSetting("demo_seeded_at")) {
  const r = seedDemoData();
  db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('demo_seeded_at', ?)").run(new Date().toISOString());
  console.log(
    `[modernerp] Demo data seeded: ${r.branches} branches, ${r.items} items, ${r.users} users, ${r.sales} sales (staff password: ${DEMO_PASSWORD})`,
  );
}

let server: ReturnType<typeof app.listen> | null = null;
if (isProd) {
  server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`ModernERP server listening on http://0.0.0.0:${PORT} (db: ${dbPath})`);
  });
}

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down...`);
  try {
    if (server) server.close();
    db.pragma("wal_checkpoint(TRUNCATE)");
    db.close();
  } catch (err) {
    console.error("Shutdown error:", err);
  }
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => console.error("Uncaught exception:", err));
process.on("unhandledRejection", (err) => console.error("Unhandled rejection:", err));