import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import multer from "multer";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(express.json());

const dbPath = process.env.DATABASE_PATH || (process.env.VERCEL ? "/tmp/pos.db" : "pos.db");
let db: Database.Database;
try {
  console.log(`Opening database at ${dbPath}`);
  // Ensure directory exists if it's an absolute path
  if (path.isAbsolute(dbPath)) {
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
  }
  db = new Database(dbPath);
} catch (err) {
  console.warn(`Failed to open database at ${dbPath}, trying /tmp/pos.db`, err);
  db = new Database("/tmp/pos.db");
}

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS branches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    address TEXT,
    contact TEXT,
    vat_id TEXT
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
    quantity INTEGER NOT NULL,
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
    adjustment INTEGER NOT NULL,
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
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// Check if subtotal column exists
const tableInfo = db.prepare("PRAGMA table_info(sales)").all();
const hasSubtotal = tableInfo.some((col: any) => col.name === 'subtotal');
const hasTax = tableInfo.some((col: any) => col.name === 'tax');
const hasDiscount = tableInfo.some((col: any) => col.name === 'discount');

// Check if image_url column exists in items
const itemsTableInfo = db.prepare("PRAGMA table_info(items)").all();
const hasImageUrl = itemsTableInfo.some((col: any) => col.name === 'image_url');
if (!hasImageUrl) {
  db.prepare("ALTER TABLE items ADD COLUMN image_url TEXT").run();
}
const hasLowStockThreshold = itemsTableInfo.some((col: any) => col.name === 'low_stock_threshold');
if (!hasLowStockThreshold) {
  db.prepare("ALTER TABLE items ADD COLUMN low_stock_threshold INTEGER DEFAULT 5").run();
}
const hasCostPrice = itemsTableInfo.some((col: any) => col.name === 'cost_price');
if (!hasCostPrice) {
  db.prepare("ALTER TABLE items ADD COLUMN cost_price REAL DEFAULT 0").run();
}

const saleItemsTableInfo = db.prepare("PRAGMA table_info(sale_items)").all();
const hasCostPriceAtSale = saleItemsTableInfo.some((col: any) => col.name === 'cost_price_at_sale');
if (!hasCostPriceAtSale) {
  db.prepare("ALTER TABLE sale_items ADD COLUMN cost_price_at_sale REAL DEFAULT 0").run();
}

if (!hasSubtotal) {
  try {
    db.prepare("ALTER TABLE sales ADD COLUMN subtotal REAL DEFAULT 0").run();
    db.prepare("UPDATE sales SET subtotal = total / 1.12").run(); // Estimate
  } catch (e) {
    console.error("Migration failed for subtotal:", e);
  }
}

if (!hasDiscount) {
  try {
    db.prepare("ALTER TABLE sales ADD COLUMN discount REAL DEFAULT 0").run();
  } catch (e) {
    console.error("Migration failed for discount:", e);
  }
}

if (!hasTax) {
  try {
    db.prepare("ALTER TABLE sales ADD COLUMN tax REAL DEFAULT 0").run();
    db.prepare("UPDATE sales SET tax = total - subtotal").run(); // Estimate
  } catch (e) {
    console.error("Migration failed for tax:", e);
  }
}

try {
  db.prepare("ALTER TABLE stock_adjustments ADD COLUMN username TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed'").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE sales ADD COLUMN status_reason TEXT").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE sales ADD COLUMN customer_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE users ADD COLUMN branch_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE sales ADD COLUMN branch_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE sales ADD COLUMN preparation_status TEXT DEFAULT 'pending'").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE sales ADD COLUMN completed_by TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE sales ADD COLUMN completed_at_branch_id INTEGER").run();
} catch (e) {}

try {
  db.prepare("ALTER TABLE branches ADD COLUMN vat_id TEXT").run();
} catch (e) {}

// Cleanup any invalid data
db.exec(`
  UPDATE items SET price = 0 WHERE price IS NULL OR price != price;
`);

// Seed default settings if not exist
const seedSettings = db.transaction(() => {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insert.run('company_name', 'MODERN STORE');
  insert.run('tax_rate', '12'); // Stored as percentage (e.g., 12 for 12%)
  insert.run('address', '123 Main St, City');
  insert.run('contact', '555-0123');
  insert.run('logo_url', '');
  insert.run('vat_id', '');
  insert.run('currency', '₱');

  const insertMethod = db.prepare('INSERT OR IGNORE INTO payment_methods (name) VALUES (?)');
  insertMethod.run('cash');
  insertMethod.run('card');
  insertMethod.run('gcash');

  // Seed default admin if no admin users exist
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
  if (adminCount.count === 0) {
    const hashedPassword = hashPassword('admin');
    db.prepare("INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)").run('admin', hashedPassword, 'admin');
    console.log("Seeded default admin user: admin/admin");
  }
});
seedSettings();

// better-sqlite3 specific NaN check/cleanup
const invalidItems = db.prepare("SELECT id, price FROM items").all();
for (const item of invalidItems as any[]) {
  if (typeof item.price !== 'number' || isNaN(item.price)) {
    db.prepare("UPDATE items SET price = 0 WHERE id = ?").run(item.id);
  }
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 4000;

  // Add username to edit_logs if it doesn't exist
  try {
    db.prepare("ALTER TABLE edit_logs ADD COLUMN username TEXT").run();
  } catch (e) {
    // Column might already exist
  }

  // Multer setup for image uploads
  const uploadDir = process.env.VERCEL ? '/tmp/uploads' : (process.env.DATABASE_PATH ? path.join(path.dirname(process.env.DATABASE_PATH), 'uploads') : path.join(process.cwd(), 'uploads'));
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
      cb(null, uniqueSuffix + path.extname(file.originalname))
    }
  });
  const upload = multer({ storage: storage });

  app.use('/uploads', express.static(uploadDir));

  app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  const getUsername = (req: express.Request) => (req.headers['x-username'] as string) || 'System';

  const logEdit = (table: string, id: number, action: string, details: string, username: string = 'System') => {
    db.prepare("INSERT INTO edit_logs (table_name, row_id, action, details, username) VALUES (?, ?, ?, ?, ?)")
      .run(table, id, action, details, username);
  };

  // API Routes

  // Auth
  app.post("/api/auth/register", (req, res) => {
    const { username, password, role, branch_id } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    try {
      const passwordHash = hashPassword(password);
      const userRole = role || 'cashier';
      const info = db.prepare("INSERT INTO users (username, password_hash, role, branch_id) VALUES (?, ?, ?, ?)").run(username, passwordHash, userRole, branch_id || null);
      logEdit('users', Number(info.lastInsertRowid), 'CREATE', `User ${username} created with role ${userRole}`, getUsername(req));
      res.json({ id: Number(info.lastInsertRowid), username, role: userRole, branch_id, success: true });
    } catch (err) {
      res.status(400).json({ error: "Username already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password are required" });
    }

    // Backdoor for legacy/default access if no admin users exist
    const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get() as { count: number };
    if (adminCount.count === 0 && password === 'admin' && username === 'admin') {
       return res.json({ success: true, username: 'admin', role: 'admin' });
    }

    const passwordHash = hashPassword(password);
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password_hash = ?").get(username, passwordHash) as any;

    if (user) {
      res.json({ success: true, username: user.username, role: user.role, branch_id: user.branch_id });
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });
  
  // Branches
  app.get("/api/branches", (req, res) => {
    try {
      const branches = db.prepare("SELECT * FROM branches").all();
      res.json(branches);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch branches" });
    }
  });

  app.post("/api/branches", (req, res) => {
    const { name, address, contact, vat_id } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    try {
      const info = db.prepare("INSERT INTO branches (name, address, contact, vat_id) VALUES (?, ?, ?, ?)").run(name, address || null, contact || null, vat_id || null);
      logEdit('branches', Number(info.lastInsertRowid), 'CREATE', `Branch ${name} added`, getUsername(req));
      res.json({ id: Number(info.lastInsertRowid), name, address, contact, vat_id });
    } catch (err) {
      res.status(400).json({ error: "Branch already exists" });
    }
  });

  app.put("/api/branches/:id", (req, res) => {
    const { id } = req.params;
    const { name, address, contact, vat_id } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    try {
      db.prepare("UPDATE branches SET name = ?, address = ?, contact = ?, vat_id = ? WHERE id = ?").run(name, address || null, contact || null, vat_id || null, id);
      logEdit('branches', Number(id), 'UPDATE', `Branch ${name} updated`, getUsername(req));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update branch" });
    }
  });

  app.delete("/api/branches/:id", (req, res) => {
    const { id } = req.params;
    try {
      db.prepare("DELETE FROM branches WHERE id = ?").run(id);
      logEdit('branches', Number(id), 'DELETE', `Branch ${id} deleted`, getUsername(req));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete branch" });
    }
  });

  // Users
  app.get("/api/users", (req, res) => {
    try {
      const users = db.prepare("SELECT id, username, role, branch_id, created_at FROM users").all();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { password, branch_id } = req.body;
    
    try {
      const user = db.prepare("SELECT username FROM users WHERE id = ?").get(id) as any;
      if (password) {
        const passwordHash = hashPassword(password);
        db.prepare("UPDATE users SET password_hash = ?, branch_id = ? WHERE id = ?").run(passwordHash, branch_id || null, id);
      } else {
        db.prepare("UPDATE users SET branch_id = ? WHERE id = ?").run(branch_id || null, id);
      }
      logEdit('users', Number(id), 'UPDATE', `User ${user?.username || id} updated`, getUsername(req));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", (req, res) => {
    const { id } = req.params;
    console.log(`Attempting to delete user ${id}`);
    try {
      // Prevent deleting the last admin or self if needed, but for now simple delete
      const user = db.prepare("SELECT username FROM users WHERE id = ?").get(id) as any;
      const info = db.prepare("DELETE FROM users WHERE id = ?").run(id);
      console.log(`Deleted user ${id}, changes: ${info.changes}`);
      if (info.changes === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      logEdit('users', Number(id), 'DELETE', `User ${user?.username || id} deleted`, getUsername(req));
      res.json({ success: true });
    } catch (err) {
      console.error("Delete user error:", err);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Categories
  app.get("/api/categories", (req, res) => {
    const categories = db.prepare("SELECT * FROM categories").all();
    res.json(categories);
  });

  app.post("/api/categories", (req, res) => {
    const { name } = req.body;
    try {
      const info = db.prepare("INSERT INTO categories (name) VALUES (?)").run(name);
      logEdit('categories', Number(info.lastInsertRowid), 'CREATE', `Category ${name} added`, getUsername(req));
      res.json({ id: Number(info.lastInsertRowid), name });
    } catch (err) {
      res.status(400).json({ error: "Category already exists" });
    }
  });

  // Items
  app.get("/api/items", (req, res) => {
    const items = db.prepare(`
      SELECT items.*, categories.name as category_name 
      FROM items 
      LEFT JOIN categories ON items.category_id = categories.id
    `).all();
    res.json(items);
  });

  app.get("/api/edit-logs", (req, res) => {
    try {
      const logs = db.prepare("SELECT * FROM edit_logs ORDER BY timestamp DESC").all();
      res.json(logs);
    } catch (err) {
      console.error("Error fetching logs:", err);
      res.status(500).json({ error: "Failed to fetch logs" });
    }
  });

  app.post("/api/items", (req, res) => {
    const { name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold } = req.body;
    
    if (!name || typeof price !== 'number' || isNaN(price)) {
      return res.status(400).json({ error: "Invalid item data. Name and valid price are required." });
    }

    try {
      const info = db.prepare("INSERT INTO items (name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(name, price, cost_price || 0, category_id, sku, stock, image_url || null, low_stock_threshold || 5);
      const itemId = Number(info.lastInsertRowid);
      logEdit('items', itemId, 'CREATE', `Item ${name} added`, getUsername(req));
      res.json({ id: itemId, name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold });
    } catch (err) {
      console.error("Error adding item:", err);
      res.status(400).json({ error: "SKU must be unique or database error occurred" });
    }
  });

  app.put("/api/items/:id", (req, res) => {
    const { name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold } = req.body;
    const { id } = req.params;

    if (!name || typeof price !== 'number' || isNaN(price)) {
      return res.status(400).json({ error: "Invalid item data" });
    }

    try {
      const oldItem = db.prepare("SELECT * FROM items WHERE id = ?").get(id) as any;
      if (!oldItem) return res.status(404).json({ error: "Item not found" });

      db.prepare("UPDATE items SET name = ?, price = ?, cost_price = ?, category_id = ?, sku = ?, stock = ?, image_url = ?, low_stock_threshold = ? WHERE id = ?")
        .run(name, price, cost_price || 0, category_id, sku, stock, image_url || null, low_stock_threshold, id);
      
      const changes: string[] = [];
      if (oldItem.name !== name) changes.push(`Name: '${oldItem.name}' -> '${name}'`);
      if (oldItem.price !== price) changes.push(`Price: ${oldItem.price} -> ${price}`);
      if (oldItem.cost_price !== cost_price) changes.push(`Cost Price: ${oldItem.cost_price} -> ${cost_price}`);
      if (oldItem.category_id !== category_id) changes.push(`Category: ${oldItem.category_id} -> ${category_id}`);
      if (oldItem.sku !== sku) changes.push(`SKU: '${oldItem.sku}' -> '${sku}'`);
      if (oldItem.stock !== stock) changes.push(`Stock: ${oldItem.stock} -> ${stock}`);
      if (oldItem.image_url !== image_url) changes.push(`Image updated`);
      if (oldItem.low_stock_threshold !== low_stock_threshold) changes.push(`Threshold: ${oldItem.low_stock_threshold} -> ${low_stock_threshold}`);
      
      const details = changes.length > 0 ? changes.join(', ') : 'No changes';
      logEdit('items', Number(id), 'UPDATE', details, getUsername(req));
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating item:", err);
      res.status(400).json({ error: "Update failed" });
    }
  });

  app.post("/api/items/:id/adjust-stock", (req, res) => {
    const { id } = req.params;
    const { adjustment, reason } = req.body;
    
    if (typeof adjustment !== 'number') {
      return res.status(400).json({ error: "Adjustment must be a number" });
    }

    try {
      const transaction = db.transaction(() => {
        const itemBefore = db.prepare("SELECT name, stock FROM items WHERE id = ?").get(id) as any;
        db.prepare("UPDATE items SET stock = stock + ? WHERE id = ?")
          .run(adjustment, id);
        db.prepare("INSERT INTO stock_adjustments (item_id, adjustment, reason, username) VALUES (?, ?, ?, ?)")
          .run(id, adjustment, reason || null, getUsername(req));
        
        const newStock = itemBefore.stock + adjustment;
        logEdit('items', Number(id), 'ADJUST_STOCK', `Stock for ${itemBefore?.name || 'Item ' + id} adjusted by ${adjustment} (${itemBefore.stock} -> ${newStock}). Reason: ${reason || 'None'}`, getUsername(req));
      });
      transaction();
      res.json({ success: true });
    } catch (err) {
      console.error("Error adjusting stock:", err);
      res.status(500).json({ error: "Failed to adjust stock" });
    }
  });

  app.get("/api/items/:id/stock-history", (req, res) => {
    const { id } = req.params;
    try {
      const history = db.prepare(`
        SELECT * FROM stock_adjustments 
        WHERE item_id = ? 
        ORDER BY timestamp DESC
      `).all(id);
      res.json(history);
    } catch (err) {
      console.error("Error fetching stock history:", err);
      res.status(500).json({ error: "Failed to fetch stock history" });
    }
  });

  // Sales
  app.post("/api/sales", (req, res) => {
    const { items: saleItems, subtotal, tax, total, payment_method, discount, timestamp, customer_id, branch_id, status } = req.body;
    
    if (!saleItems || !Array.isArray(saleItems) || saleItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty" });
    }

    if (isNaN(subtotal) || isNaN(tax) || isNaN(total)) {
      return res.status(400).json({ error: "Invalid calculation values (NaN detected)" });
    }
    
    const transaction = db.transaction(() => {
      let saleInfo;
      const saleStatus = status || 'completed';
      if (timestamp) {
        saleInfo = db.prepare("INSERT INTO sales (subtotal, tax, total, payment_method, discount, timestamp, customer_id, branch_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .run(subtotal, tax, total, payment_method, discount || 0, timestamp, customer_id || null, branch_id || null, saleStatus);
      } else {
        saleInfo = db.prepare("INSERT INTO sales (subtotal, tax, total, payment_method, discount, customer_id, branch_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .run(subtotal, tax, total, payment_method, discount || 0, customer_id || null, branch_id || null, saleStatus);
      }
      const saleId = Number(saleInfo.lastInsertRowid);
      logEdit('sales', saleId, 'CREATE', `Sale ${saleId} created with total ${total} and status ${saleStatus}`, getUsername(req));

      for (const item of saleItems) {
        if (!item.id || isNaN(item.quantity) || isNaN(item.price)) {
          throw new Error(`Invalid item data in cart for item: ${item.name || 'Unknown'}`);
        }
        
        // Fetch current cost price
        const currentItem = db.prepare("SELECT cost_price FROM items WHERE id = ?").get(item.id) as any;
        const costPriceAtSale = currentItem?.cost_price || 0;

        db.prepare("INSERT INTO sale_items (sale_id, item_id, quantity, price_at_sale, cost_price_at_sale) VALUES (?, ?, ?, ?, ?)")
          .run(saleId, item.id, item.quantity, item.price, costPriceAtSale);
        
        // Update stock
        db.prepare("UPDATE items SET stock = stock - ? WHERE id = ?")
          .run(item.quantity, item.id);
      }
      return saleId;
    });

    try {
      const saleId = transaction();
      res.json({ id: saleId, success: true });
    } catch (err) {
      console.error("Transaction failed error details:", err);
      res.status(500).json({ 
        error: "Transaction failed", 
        details: err instanceof Error ? err.message : String(err) 
      });
    }
  });

  app.get("/api/sales/:id/items", (req, res) => {
    const { id } = req.params;
    try {
      const items = db.prepare(`
        SELECT sale_items.*, items.name as name, items.sku as sku
        FROM sale_items
        JOIN items ON sale_items.item_id = items.id
        WHERE sale_id = ?
      `).all(id);
      res.json(items);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch sale items" });
    }
  });

  app.post("/api/sales/:id/void", (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const username = getUsername(req);

    try {
      const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id) as any;
      if (!sale) return res.status(404).json({ error: "Sale not found" });
      if (sale.status === 'voided') return res.status(400).json({ error: "Sale already voided" });

      const transaction = db.transaction(() => {
        // Update sale status
        db.prepare("UPDATE sales SET status = 'voided', status_reason = ? WHERE id = ?").run(reason, id);
        
        // Restock items
        const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id) as any[];
        for (const item of items) {
          db.prepare("UPDATE items SET stock = stock + ? WHERE id = ?").run(item.quantity, item.item_id);
          // Log stock adjustment
          db.prepare("INSERT INTO stock_adjustments (item_id, adjustment, reason, username) VALUES (?, ?, ?, ?)")
            .run(item.item_id, item.quantity, `Voided Sale #${id}: ${reason || 'No reason'}`, username);
        }
        
        logEdit('sales', Number(id), 'UPDATE', `Sale ${id} voided: ${reason}`, username);
      });

      transaction();
      res.json({ success: true });
    } catch (err) {
      console.error("Void sale error:", err);
      res.status(500).json({ error: "Failed to void sale" });
    }
  });

  app.post("/api/sales/:id/refund", (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const username = getUsername(req);

    try {
      const sale = db.prepare("SELECT * FROM sales WHERE id = ?").get(id) as any;
      if (!sale) return res.status(404).json({ error: "Sale not found" });
      if (sale.status === 'refunded') return res.status(400).json({ error: "Sale already refunded" });
      if (sale.status === 'voided') return res.status(400).json({ error: "Cannot refund a voided sale" });

      const transaction = db.transaction(() => {
        // Update sale status
        db.prepare("UPDATE sales SET status = 'refunded', status_reason = ? WHERE id = ?").run(reason, id);
        
        // Restock items
        const items = db.prepare("SELECT * FROM sale_items WHERE sale_id = ?").all(id) as any[];
        for (const item of items) {
          db.prepare("UPDATE items SET stock = stock + ? WHERE id = ?").run(item.quantity, item.item_id);
          // Log stock adjustment
          db.prepare("INSERT INTO stock_adjustments (item_id, adjustment, reason, username) VALUES (?, ?, ?, ?)")
            .run(item.item_id, item.quantity, `Refunded Sale #${id}: ${reason || 'No reason'}`, username);
        }
        
        logEdit('sales', Number(id), 'UPDATE', `Sale ${id} refunded: ${reason}`, username);
      });

      transaction();
      res.json({ success: true });
    } catch (err) {
      console.error("Refund sale error:", err);
      res.status(500).json({ error: "Failed to refund sale" });
    }
  });

  // Pending Orders
  app.get("/api/orders/pending", (req, res) => {
    const branchId = req.query.branch_id;
    try {
      let query = "SELECT s.*, c.name as customer_name, c.address as customer_address FROM sales s LEFT JOIN customers c ON s.customer_id = c.id WHERE s.status = 'pending'";
      const params: any[] = [];
      
      if (branchId) {
        query += " AND s.branch_id = ?";
        params.push(branchId);
      }
      
      query += " ORDER BY s.timestamp ASC";
      
      const pendingSales = db.prepare(query).all(...params) as any[];
      
      // Fetch items for each sale
      for (const sale of pendingSales) {
        sale.items = db.prepare(`
          SELECT si.*, i.name 
          FROM sale_items si 
          JOIN items i ON si.item_id = i.id 
          WHERE si.sale_id = ?
        `).all(sale.id);
      }
      
      res.json(pendingSales);
    } catch (err) {
      console.error("Error fetching pending orders:", err);
      res.status(500).json({ error: "Failed to fetch pending orders" });
    }
  });

  app.put("/api/orders/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, preparation_status, completed_by, branch_id } = req.body;
    
    if (!status && !preparation_status) return res.status(400).json({ error: "Status or preparation_status is required" });
    
    try {
      if (status) {
        if (completed_by) {
          db.prepare("UPDATE sales SET status = ?, completed_by = ?, completed_at_branch_id = ? WHERE id = ?").run(status, completed_by, branch_id || null, id);
        } else {
          db.prepare("UPDATE sales SET status = ? WHERE id = ?").run(status, id);
        }
      }
      
      if (preparation_status) {
        db.prepare("UPDATE sales SET preparation_status = ? WHERE id = ?").run(preparation_status, id);
      }
      
      let branchName = "Unknown Branch";
      if (branch_id) {
        const branch = db.prepare("SELECT name FROM branches WHERE id = ?").get(branch_id) as any;
        if (branch) branchName = branch.name;
      }

      const logMsg = status 
        ? `Sale ${id} status updated to ${status} by ${completed_by || getUsername(req)} at ${branchName}`
        : `Sale ${id} preparation status updated to ${preparation_status} by ${getUsername(req)}`;

      logEdit('sales', Number(id), 'UPDATE_STATUS', logMsg, getUsername(req));
      res.json({ success: true });
    } catch (err) {
      console.error("Error updating order status:", err);
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  // Reports
  app.get("/api/reports/inventory", (req, res) => {
    try {
      const items = db.prepare(`
        SELECT items.*, categories.name as category_name 
        FROM items 
        LEFT JOIN categories ON items.category_id = categories.id
      `).all() as any[];

      const itemsWithValuation = items.map(item => {
        const valuation = (item.stock || 0) * (item.cost_price || 0);
        const potential_profit = (item.stock || 0) * ((item.price || 0) - (item.cost_price || 0));
        let status = 'normal';
        if (item.stock <= 0) status = 'out';
        else if (item.stock <= (item.low_stock_threshold || 5)) status = 'low';

        return {
          ...item,
          valuation,
          potential_profit,
          status
        };
      });

      const summary = {
        total_items: items.length,
        total_stock: items.reduce((sum, item) => sum + (item.stock || 0), 0),
        total_valuation: itemsWithValuation.reduce((sum, item) => sum + item.valuation, 0),
        total_potential_profit: itemsWithValuation.reduce((sum, item) => sum + item.potential_profit, 0),
        low_stock_count: itemsWithValuation.filter(item => item.status === 'low').length,
        out_of_stock_count: itemsWithValuation.filter(item => item.status === 'out').length,
      };

      res.json({ items: itemsWithValuation, summary });
    } catch (err) {
      console.error("Error fetching inventory report:", err);
      res.status(500).json({ error: "Failed to fetch inventory report" });
    }
  });

  app.get("/api/reports/sales", (req, res) => {
    const { type, date, branch_id } = req.query;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];

    let timeFilter;
    if (type === 'month') {
      timeFilter = "strftime('%Y-%m', timestamp) = strftime('%Y-%m', ?)";
    } else if (type === 'year') {
      timeFilter = "strftime('%Y', timestamp) = strftime('%Y', ?)";
    } else {
      timeFilter = "date(timestamp) = date(?)";
    }

    let branchFilter = "";
    const params: any[] = [targetDate];
    if (branch_id) {
      branchFilter = " AND s.branch_id = ?";
      params.push(branch_id);
    }

    try {
      const sales = db.prepare(`
        SELECT s.*, c.name as customer_name, c.phone as customer_phone, c.address as customer_address,
               b.name as branch_name, cb.name as completed_at_branch_name
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN branches b ON s.branch_id = b.id
        LEFT JOIN branches cb ON s.completed_at_branch_id = cb.id
        WHERE ${timeFilter}${branchFilter}
        ORDER BY s.timestamp DESC
      `).all(...params);
      res.json(sales);
    } catch (err) {
      console.error("Error fetching sales report:", err);
      res.status(500).json({ error: "Failed to fetch sales report" });
    }
  });

  app.get("/api/reports/summary", (req, res) => {
    const { type, date, branch_id } = req.query;
    const targetDate = (date as string) || new Date().toISOString().split('T')[0];
    
    let timeFilter;
    if (type === 'month') {
      timeFilter = "strftime('%Y-%m', timestamp) = strftime('%Y-%m', ?)";
    } else if (type === 'year') {
      timeFilter = "strftime('%Y', timestamp) = strftime('%Y', ?)";
    } else {
      timeFilter = "date(timestamp) = date(?)";
    }

    let branchFilter = "";
    const params: any[] = [targetDate];
    if (branch_id) {
      branchFilter = " AND sales.branch_id = ?";
      params.push(branch_id);
    }

    try {
      const summary = db.prepare(`
        SELECT 
          COUNT(*) as transaction_count,
          COALESCE(SUM(CASE WHEN status = 'completed' THEN total ELSE 0 END), 0) as total_sales,
          payment_method
        FROM sales 
        WHERE ${timeFilter.replace(/timestamp/g, 'timestamp')}${branchFilter.replace(/sales\./g, '')}
        GROUP BY payment_method
      `).all(...params);
      
      const items = db.prepare(`
        SELECT 
          items.name,
          COALESCE(SUM(sale_items.quantity), 0) as total_quantity,
          COALESCE(SUM(sale_items.quantity * sale_items.price_at_sale), 0) as total_revenue,
          COALESCE(SUM(sale_items.quantity * sale_items.cost_price_at_sale), 0) as total_cogs,
          COALESCE(SUM(sale_items.quantity * (sale_items.price_at_sale - sale_items.cost_price_at_sale)), 0) as total_profit
        FROM sale_items
        JOIN sales ON sale_items.sale_id = sales.id
        JOIN items ON sale_items.item_id = items.id
        WHERE ${timeFilter.replace(/timestamp/g, 'sales.timestamp')} AND sales.status = 'completed'${branchFilter}
        GROUP BY items.id
        ORDER BY total_revenue DESC
      `).all(...params);

      const categories = db.prepare(`
        SELECT 
          categories.name,
          COALESCE(SUM(sale_items.quantity * sale_items.price_at_sale), 0) as total_revenue,
          COALESCE(SUM(sale_items.quantity * sale_items.cost_price_at_sale), 0) as total_cogs,
          COALESCE(SUM(sale_items.quantity * (sale_items.price_at_sale - sale_items.cost_price_at_sale)), 0) as total_profit
        FROM sale_items
        JOIN sales ON sale_items.sale_id = sales.id
        JOIN items ON sale_items.item_id = items.id
        LEFT JOIN categories ON items.category_id = categories.id
        WHERE ${timeFilter.replace(/timestamp/g, 'sales.timestamp')} AND sales.status = 'completed'${branchFilter}
        GROUP BY categories.id
        ORDER BY total_revenue DESC
      `).all(...params);

      res.json({ summary, items, categories });
    } catch (err) {
      console.error("Error fetching report summary:", err);
      res.status(500).json({ error: "Failed to fetch report summary" });
    }
  });

  // Payment Methods
  app.get("/api/payment-methods", (req, res) => {
    try {
      const methods = db.prepare("SELECT * FROM payment_methods WHERE is_active = 1").all();
      res.json(methods);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch payment methods" });
    }
  });

  app.post("/api/payment-methods", (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    
    try {
      const info = db.prepare("INSERT INTO payment_methods (name) VALUES (?)").run(name.toLowerCase());
      logEdit('payment_methods', Number(info.lastInsertRowid), 'CREATE', `Payment method ${name.toLowerCase()} added`, getUsername(req));
      res.json({ id: Number(info.lastInsertRowid), name: name.toLowerCase(), is_active: 1 });
    } catch (err) {
      res.status(400).json({ error: "Payment method already exists" });
    }
  });

  app.delete("/api/payment-methods/:id", (req, res) => {
    const { id } = req.params;
    try {
      // Soft delete or hard delete? Let's do hard delete but check if used first?
      // Actually, for simplicity, let's just delete. Historical sales will keep the string value.
      // But maybe safer to just mark inactive if we wanted to keep history clean, 
      // but since sales table stores the string value, deleting the definition is fine.
      const pm = db.prepare("SELECT name FROM payment_methods WHERE id = ?").get(id) as any;
      db.prepare("DELETE FROM payment_methods WHERE id = ?").run(id);
      logEdit('payment_methods', Number(id), 'DELETE', `Payment method ${pm?.name || id} deleted`, getUsername(req));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete payment method" });
    }
  });

  // Customers
  app.get("/api/customers", (req, res) => {
    const { search } = req.query;
    try {
      let customers;
      if (search) {
        customers = db.prepare(`
          SELECT * FROM customers 
          WHERE name LIKE ? OR phone LIKE ? 
          LIMIT 20
        `).all(`%${search}%`, `%${search}%`);
      } else {
        customers = db.prepare("SELECT * FROM customers LIMIT 100").all();
      }
      res.json(customers);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", (req, res) => {
    const { name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    try {
      const info = db.prepare(`
        INSERT INTO customers (name, phone, email, address) 
        VALUES (?, ?, ?, ?)
      `).run(name, phone, email, address);
      logEdit('customers', Number(info.lastInsertRowid), 'CREATE', `Customer ${name} added`, getUsername(req));
      res.json({ id: Number(info.lastInsertRowid), name, phone, email, address });
    } catch (err) {
      res.status(500).json({ error: "Failed to create customer" });
    }
  });

  app.put("/api/customers/:id", (req, res) => {
    const { id } = req.params;
    const { name, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });
    try {
      db.prepare(`
        UPDATE customers SET name = ?, phone = ?, email = ?, address = ? 
        WHERE id = ?
      `).run(name, phone, email, address, id);
      logEdit('customers', Number(id), 'UPDATE', `Customer ${name} updated`, getUsername(req));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update customer" });
    }
  });

  app.get("/api/customers/:id/stats", (req, res) => {
    const { id } = req.params;
    try {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_orders,
          SUM(total) as total_spent,
          COUNT(DISTINCT branch_id) as branch_count
        FROM sales 
        WHERE customer_id = ?
      `).get(id);
      res.json(stats || { total_orders: 0, total_spent: 0, branch_count: 0 });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch customer stats" });
    }
  });

  app.get("/api/customers/:id/sales", (req, res) => {
    const { id } = req.params;
    try {
      const sales = db.prepare(`
        SELECT s.*, b.name as branch_name 
        FROM sales s
        LEFT JOIN branches b ON s.branch_id = b.id
        WHERE s.customer_id = ?
        ORDER BY s.timestamp DESC
      `).all(id);
      res.json(sales);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch customer sales" });
    }
  });

  // Settings
  app.get("/api/settings", (req, res) => {
    try {
      const settings = db.prepare("SELECT * FROM settings").all();
      const settingsObj = settings.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});
      res.json(settingsObj);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", (req, res) => {
    const { company_name, tax_rate, address, contact, logo_url, app_logo_url, vat_id, currency, timezone } = req.body;
    try {
      const oldSettingsRows = db.prepare("SELECT * FROM settings").all() as any[];
      const oldSettings = oldSettingsRows.reduce((acc: any, curr: any) => {
        acc[curr.key] = curr.value;
        return acc;
      }, {});

      const update = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
      const updateSettings = db.transaction(() => {
        const changes: string[] = [];
        const checkChange = (key: string, newValue: any) => {
          if (newValue !== undefined && oldSettings[key] !== newValue.toString()) {
            changes.push(`${key}: '${oldSettings[key] || ''}' -> '${newValue}'`);
            update.run(key, newValue.toString());
          }
        };

        checkChange("company_name", company_name);
        checkChange("tax_rate", tax_rate);
        checkChange("address", address);
        checkChange("contact", contact);
        checkChange("logo_url", logo_url);
        checkChange("app_logo_url", app_logo_url);
        checkChange("vat_id", vat_id);
        checkChange("currency", currency);
        checkChange("timezone", timezone);
        
        if (changes.length > 0) {
          logEdit('settings', 0, 'UPDATE', `Settings updated: ${changes.join(', ')}`, getUsername(req));
        }
      });
  updateSettings();
  res.json({ success: true });
} catch (error) {
  console.error("Error updating settings:", error);
  res.status(500).json({ error: "Failed to update settings" });
}
});

// Vite middleware for development
if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
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

if (!process.env.VERCEL) {
  const PORT = Number(process.env.PORT) || 4000;
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
