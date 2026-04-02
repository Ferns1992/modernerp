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
  CREATE TABLE IF NOT EXISTS branches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, address TEXT, contact TEXT);
  CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password_hash TEXT, role TEXT);
  CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
  CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, price REAL, cost_price REAL DEFAULT 0, category_id INTEGER, sku TEXT, stock INTEGER DEFAULT 0);
  CREATE TABLE IF NOT EXISTS sales (id INTEGER PRIMARY KEY AUTOINCREMENT, subtotal REAL, tax REAL, total REAL, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP, payment_method TEXT);
  CREATE TABLE IF NOT EXISTS sale_items (id INTEGER PRIMARY KEY AUTOINCREMENT, sale_id INTEGER, item_id INTEGER, quantity INTEGER, price_at_sale REAL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
  CREATE TABLE IF NOT EXISTS payment_methods (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE);
  CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, phone TEXT, email TEXT, address TEXT);
  CREATE TABLE IF NOT EXISTS stock_adjustments (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER, adjustment INTEGER, reason TEXT, username TEXT);
  CREATE TABLE IF NOT EXISTS edit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT, row_id INTEGER, action TEXT, details TEXT);
`);

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
  const { name, price, cost_price, category_id, sku, stock } = req.body;
  if (!name || !price) return res.status(400).json({ error: 'Name and price required' });
  try {
    const info = db.prepare('INSERT INTO items (name, price, cost_price, category_id, sku, stock) VALUES (?, ?, ?, ?, ?, ?)').run(name, price, cost_price || 0, category_id, sku, stock || 0);
    res.json({ id: info.lastInsertRowid, name, price, cost_price, category_id, sku, stock });
  } catch (err) {
    res.status(400).json({ error: 'SKU must be unique or error' });
  }
});

app.put('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, cost_price, category_id, sku, stock } = req.body;
  db.prepare('UPDATE items SET name = ?, price = ?, cost_price = ?, category_id = ?, sku = ?, stock = ? WHERE id = ?').run(name, price, cost_price || 0, category_id, sku, stock, id);
  res.json({ success: true });
});

app.post('/api/items/:id/adjust-stock', (req, res) => {
  const { id } = req.params;
  const { adjustment, reason } = req.body;
  db.prepare('UPDATE items SET stock = stock + ? WHERE id = ?').run(adjustment, id);
  db.prepare('INSERT INTO stock_adjustments (item_id, adjustment, reason) VALUES (?, ?, ?)').run(id, adjustment, reason || null);
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
  res.json(db.prepare('SELECT * FROM payment_methods WHERE is_active = 1').all());
});

app.get('/api/customers', (req, res) => {
  res.json(db.prepare('SELECT * FROM customers LIMIT 100').all());
});

app.post('/api/customers', (req, res) => {
  const { name, phone, email, address } = req.body;
  const info = db.prepare('INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)').run(name, phone, email, address);
  res.json({ id: info.lastInsertRowid, name, phone, email, address });
});

app.post('/api/sales', (req, res) => {
  const { items, subtotal, tax, total, payment_method } = req.body;
  if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  
  const transaction = db.transaction(() => {
    const saleInfo = db.prepare('INSERT INTO sales (subtotal, tax, total, payment_method) VALUES (?, ?, ?, ?)').run(subtotal, tax, total, payment_method);
    const saleId = saleInfo.lastInsertRowid;
    
    for (const item of items) {
      db.prepare('INSERT INTO sale_items (sale_id, item_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)').run(saleId, item.id, item.quantity, item.price);
      db.prepare('UPDATE items SET stock = stock - ? WHERE id = ?').run(item.quantity, item.id);
    }
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

app.use(express.static(path.join(__dirname, 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
