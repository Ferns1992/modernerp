const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
app.use(express.json());

const dbPath = process.env.DATABASE_PATH || 'pos.db';
let db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS branches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, address TEXT, contact TEXT, tax_rate TEXT DEFAULT '');
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT, role TEXT);
  CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
  CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL, cost_price REAL DEFAULT 0, category_id INTEGER, sku TEXT, stock INTEGER DEFAULT 0, image_url TEXT, low_stock_threshold INTEGER DEFAULT 5);
  CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, subtotal REAL, tax REAL, total REAL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, payment_method TEXT, status TEXT DEFAULT 'completed');
  CREATE TABLE IF NOT EXISTS sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER, item_id INTEGER, quantity INTEGER, price_at_sale REAL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, is_active BOOLEAN DEFAULT 1);
  CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, email TEXT, address TEXT);
  CREATE TABLE IF NOT EXISTS stock_adjustments (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, adjustment INTEGER, reason TEXT, username TEXT);
  CREATE TABLE IF NOT EXISTS edit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT, row_id INTEGER, action TEXT, details TEXT, username TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP);
`);

try { db.exec("ALTER TABLE sales ADD COLUMN customer_id INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch(e) {}

const seed = db.transaction(() => {
  const insert = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  insert.run('company_name', 'MODERN ERP');
  insert.run('tax_rate', '12');
  insert.run('currency', '₱');
  insert.run('address', '123 Main St');
  insert.run('contact', '555-0123');
  
  const insertMethod = db.prepare('INSERT OR IGNORE INTO payment_methods (name) VALUES (?)');
  insertMethod.run('cash');
  insertMethod.run('card');
  insertMethod.run('gcash');
  
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
  if (adminCount.count === 0) {
    const hash = crypto.createHash('sha256').update('admin').digest('hex');
    db.prepare("INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)").run('admin', hash, 'admin');
  }
});
seed();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

app.get('/api/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  const obj = settings.reduce((acc, s) => { acc[s.key] = s.value; return acc; }, {});
  res.json(obj);
});

app.post('/api/settings', (req, res) => {
  const { company_name, tax_rate, address, contact, logo_url, app_logo_url, currency } = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
  if (company_name !== undefined) stmt.run('company_name', company_name);
  if (tax_rate !== undefined) stmt.run('tax_rate', tax_rate);
  if (address !== undefined) stmt.run('address', address);
  if (contact !== undefined) stmt.run('contact', contact);
  if (logo_url !== undefined) stmt.run('logo_url', logo_url);
  if (app_logo_url !== undefined) stmt.run('app_logo_url', app_logo_url);
  if (currency !== undefined) stmt.run('currency', currency);
  res.json({ success: true });
});

app.get('/api/branches', (req, res) => {
  try { res.json(db.prepare('SELECT * FROM branches').all()); } catch(e) { res.json([]); }
});

app.post('/api/branches', (req, res) => {
  const { name, address, contact, tax_rate } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const info = db.prepare('INSERT INTO branches (name, address, contact, tax_rate) VALUES (?, ?, ?, ?)').run(name, address || '', contact || '', tax_rate || '');
    res.json({ id: info.lastInsertRowid, name, address, contact, tax_rate });
  } catch (err) {
    res.status(400).json({ error: 'Branch already exists' });
  }
});

app.put('/api/branches/:id', (req, res) => {
  const { id } = req.params;
  const { name, address, contact, tax_rate } = req.body;
  db.prepare('UPDATE branches SET name = ?, address = ?, contact = ?, tax_rate = ? WHERE id = ?').run(name, address || '', contact || '', tax_rate || '', id);
  res.json({ success: true });
});

app.delete('/api/branches/:id', (req, res) => {
  const { id } = req.params;
  try { db.prepare('DELETE FROM branches WHERE id = ?').run(id); res.json({ success: true }); } catch(e) { res.status(500).json({ error: 'Failed to delete' }); }
});

app.get('/api/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories').all());
});

app.post('/api/categories', (req, res) => {
  const { name } = req.body;
  try {
    const info = db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);
    res.json({ id: info.lastInsertRowid, name });
  } catch (err) {
    res.status(400).json({ error: 'Category already exists' });
  }
});

app.get('/api/items', (req, res) => {
  const items = db.prepare(`SELECT items.*, categories.name as category_name FROM items LEFT JOIN categories ON items.category_id = categories.id`).all();
  res.json(items);
});

app.post('/api/items', (req, res) => {
  const { name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
  try {
    const info = db.prepare('INSERT INTO items (name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(name, price, cost_price || 0, category_id, sku, stock || 0, image_url || null, low_stock_threshold || 5);
    db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details) VALUES (?, ?, ?, ?)').run('items', info.lastInsertRowid, 'CREATE', `Created item: ${name}`);
    res.json({ id: info.lastInsertRowid, name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold });
  } catch (err) {
    res.status(400).json({ error: 'SKU must be unique or error' });
  }
});

app.put('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold } = req.body;
  db.prepare('UPDATE items SET name = ?, price = ?, cost_price = ?, category_id = ?, sku = ?, stock = ?, image_url = ?, low_stock_threshold = ? WHERE id = ?').run(name, price, cost_price || 0, category_id, sku, stock, image_url || null, low_stock_threshold || 5, id);
  try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details) VALUES (?, ?, ?, ?)').run('items', id, 'UPDATE', `Updated item: ${name}`); } catch(e) {}
  res.json({ success: true });
});

app.post('/api/items/:id/adjust-stock', (req, res) => {
  const { id } = req.params;
  const { adjustment, reason } = req.body;
  db.prepare('UPDATE items SET stock = stock + ? WHERE id = ?').run(adjustment, id);
  db.prepare('INSERT INTO stock_adjustments (item_id, adjustment, reason) VALUES (?, ?, ?)').run(id, adjustment, reason || null);
  db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details) VALUES (?, ?, ?, ?)').run('items', id, 'ADJUST_STOCK', `Stock adjusted by ${adjustment}. Reason: ${reason || 'None'}`);
  res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const adminCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get();
  if (adminCount.count === 0 && password === 'admin' && username === 'admin') {
    return res.json({ success: true, username: 'admin', role: 'admin' });
  }
  const hash = hashPassword(password);
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?').get(username, hash);
  if (user) {
    res.json({ success: true, username: user.username, role: user.role });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.get('/api/payment-methods', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM payment_methods').all());
  } catch (e) {
    res.json([]);
  }
});

const uploadDir = '/tmp/uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1E9) + path.extname(file.originalname))
});
const upload = multer({ storage });

app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  res.json({ url: `/uploads/${req.file.filename}` });
});

app.get('/api/customers', (req, res) => {
  res.json(db.prepare('SELECT * FROM customers LIMIT 100').all());
});

app.post('/api/customers', (req, res) => {
  const { name, phone, email, address } = req.body;
  const info = db.prepare('INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)').run(name, phone, email, address);
  try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details) VALUES (?, ?, ?, ?)').run('customers', info.lastInsertRowid, 'CREATE', `Created customer: ${name}`); } catch(e) {}
  res.json({ id: info.lastInsertRowid, name, phone, email, address });
});

app.get('/api/customers/:id/sales', (req, res) => {
  const { id } = req.params;
  try {
    const sales = db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY timestamp DESC').all(id);
    res.json(sales);
  } catch(e) {
    res.json([]);
  }
});

app.get('/api/items/:id/stock-history', (req, res) => {
  const { id } = req.params;
  try {
    const history = db.prepare('SELECT * FROM stock_adjustments WHERE item_id = ? ORDER BY timestamp DESC').all(id);
    res.json(history);
  } catch(e) {
    res.json([]);
  }
});

app.post('/api/sales', (req, res) => {
  const { items, subtotal, tax, total, payment_method, customer_id } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  
  const transaction = db.transaction(() => {
    const saleInfo = db.prepare('INSERT INTO sales (subtotal, tax, total, payment_method, customer_id) VALUES (?, ?, ?, ?, ?)').run(subtotal, tax, total, payment_method, customer_id || null);
    const saleId = saleInfo.lastInsertRowid;
    
    for (const item of items) {
      db.prepare('INSERT INTO sale_items (sale_id, item_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)').run(saleId, item.id, item.quantity, item.price);
      db.prepare('UPDATE items SET stock = stock - ? WHERE id = ?').run(item.quantity, item.id);
    }
    
    try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details) VALUES (?, ?, ?, ?)').run('sales', saleId, 'CREATE', `Sale #${saleId} - Total: ${total}`); } catch(e) {}
    
    return saleId;
  });
  
  const saleId = transaction();
  res.json({ id: saleId, success: true });
});

app.get('/api/reports/sales', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const sales = db.prepare("SELECT * FROM sales WHERE date(timestamp) = date(?)").all(today);
  res.json(sales);
});

app.get('/api/reports/summary', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const summary = db.prepare("SELECT COUNT(*) as transaction_count, COALESCE(SUM(total), 0) as total_sales, payment_method FROM sales WHERE date(timestamp) = date(?) GROUP BY payment_method").all(today);
  const items = db.prepare("SELECT items.name, SUM(sale_items.quantity) as total_quantity, SUM(sale_items.quantity * sale_items.price_at_sale) as total_revenue FROM sale_items JOIN items ON sale_items.item_id = items.id JOIN sales ON sale_items.sale_id = sales.id WHERE date(sales.timestamp) = date(?) GROUP BY items.id ORDER BY total_revenue DESC").all(today);
  res.json({ summary, items });
});

app.get('/api/reports/inventory', (req, res) => {
  const items = db.prepare(`SELECT items.*, categories.name as category_name FROM items LEFT JOIN categories ON items.category_id = categories.id`).all();
  const itemsWithValuation = items.map(item => {
    const valuation = (item.stock || 0) * (item.cost_price || 0);
    const potential_profit = (item.stock || 0) * ((item.price || 0) - (item.cost_price || 0));
    let status = 'normal';
    if (item.stock <= 0) status = 'out';
    else if (item.stock <= (item.low_stock_threshold || 5)) status = 'low';
    return { ...item, valuation, potential_profit, status };
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
});

app.get('/api/edit-logs', (req, res) => {
  try {
    const logs = db.prepare('SELECT * FROM edit_logs ORDER BY timestamp DESC LIMIT 100').all();
    res.json(logs);
  } catch (err) {
    console.error('Error fetching edit logs:', err);
    res.json([]);
  }
});

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
