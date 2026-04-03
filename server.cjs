const express = require('express');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
app.use(express.json({ limit: '50mb' }));

const dbPath = process.env.DATABASE_PATH || 'pos.db';
let db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS branches (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, address TEXT, contact TEXT, tax_rate TEXT DEFAULT '', vat_id TEXT DEFAULT '', logo_url TEXT DEFAULT '');
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

try { db.exec("ALTER TABLE branches ADD COLUMN tax_rate TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE branches ADD COLUMN vat_id TEXT DEFAULT ''"); } catch(e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN customer_id INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch(e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN branch_id INTEGER"); } catch(e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN status TEXT DEFAULT 'completed'"); } catch(e) {}
try { db.exec("ALTER TABLE sales ADD COLUMN completed_by TEXT"); } catch(e) {}
try { db.exec("ALTER TABLE stock_adjustments ADD COLUMN timestamp DATETIME DEFAULT CURRENT_TIMESTAMP"); } catch(e) {}
try { db.exec("ALTER TABLE users ADD COLUMN branch_id INTEGER"); } catch(e) {}

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
  const { name, address, contact, tax_rate, vat_id, logo_url } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const info = db.prepare('INSERT INTO branches (name, address, contact, tax_rate, vat_id, logo_url) VALUES (?, ?, ?, ?, ?, ?)').run(name, address || '', contact || '', tax_rate || '', vat_id || '', logo_url || '');
    res.json({ id: info.lastInsertRowid, name, address, contact, tax_rate, vat_id, logo_url });
  } catch (err) {
    res.status(400).json({ error: 'Branch already exists' });
  }
});

app.put('/api/branches/:id', (req, res) => {
  const { id } = req.params;
  const { name, address, contact, tax_rate, vat_id, logo_url } = req.body;
  db.prepare('UPDATE branches SET name = ?, address = ?, contact = ?, tax_rate = ?, vat_id = ?, logo_url = ? WHERE id = ?').run(name, address || '', contact || '', tax_rate || '', vat_id || '', logo_url || '', id);
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

app.delete('/api/categories/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete category' });
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

app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM items WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete item' });
  }
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
    return res.json({ success: true, username: 'admin', role: 'admin', branch_id: null });
  }
  const hash = hashPassword(password);
  const user = db.prepare('SELECT * FROM users WHERE username = ? AND password_hash = ?').get(username, hash);
  if (user) {
    res.json({ success: true, username: user.username, role: user.role, branch_id: user.branch_id });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, role, branch_id } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const hash = hashPassword(password);
  try {
    const info = db.prepare('INSERT INTO users (username, password_hash, role, branch_id) VALUES (?, ?, ?, ?)').run(username, hash, role || 'cashier', branch_id || null);
    try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details) VALUES (?, ?, ?, ?)').run('users', info.lastInsertRowid, 'CREATE', `Created user: ${username} (${role || 'cashier'})`); } catch(e) {}
    res.json({ success: true, id: info.lastInsertRowid, username, role: role || 'cashier' });
  } catch(e) {
    res.status(400).json({ error: 'Username already exists' });
  }
});

app.get('/api/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, role, branch_id FROM users').all();
    res.json(users);
  } catch(e) {
    res.json([]);
  }
});

app.get('/api/users/:id', (req, res) => {
  const { id } = req.params;
  try {
    const user = db.prepare('SELECT id, username, role, branch_id FROM users WHERE id = ?').get(id);
    if (user) res.json(user);
    else res.status(404).json({ error: 'User not found' });
  } catch(e) {
    res.status(500).json({ error: 'Error fetching user' });
  }
});

app.put('/api/users/:id', (req, res) => {
  const { id } = req.params;
  const { password, branch_id } = req.body;
  try {
    if (password) {
      const hash = hashPassword(password);
      db.prepare('UPDATE users SET password_hash = ?, branch_id = ? WHERE id = ?').run(hash, branch_id || null, id);
    } else if (branch_id !== undefined) {
      db.prepare('UPDATE users SET branch_id = ? WHERE id = ?').run(branch_id, id);
    }
    try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details) VALUES (?, ?, ?, ?)').run('users', id, 'UPDATE', 'Updated user'); } catch(e) {}
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'Error updating user' });
  }
});

app.delete('/api/users/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details) VALUES (?, ?, ?, ?)').run('users', id, 'DELETE', 'Deleted user'); } catch(e) {}
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'Error deleting user' });
  }
});

app.get('/api/payment-methods', (req, res) => {
  try {
    res.json(db.prepare('SELECT * FROM payment_methods').all());
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/payment-methods', (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const info = db.prepare('INSERT INTO payment_methods (name) VALUES (?)').run(name.toLowerCase());
    res.json({ id: info.lastInsertRowid, name: name.toLowerCase(), is_active: 1 });
  } catch (err) {
    res.status(400).json({ error: 'Payment method already exists' });
  }
});

app.put('/api/payment-methods/:id', (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    db.prepare('UPDATE payment_methods SET name = ? WHERE id = ?').run(name.toLowerCase(), id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update' });
  }
});

app.delete('/api/payment-methods/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM payment_methods WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete' });
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

app.get('/api/orders/pending', (req, res) => {
  const { branch_id, date, include_completed } = req.query;
  let query;
  let params = [];
  
  if (include_completed === 'true' && date) {
    query = "SELECT * FROM sales WHERE date(timestamp) = date(?)";
    params.push(date);
    if (branch_id) {
      query += " AND branch_id = ?";
      params.push(branch_id);
    }
  } else {
    query = "SELECT * FROM sales WHERE (status = 'pending' OR status = 'preparing' OR status = 'ready' OR status IS NULL)";
    if (branch_id) {
      query += " AND branch_id = ?";
      params.push(branch_id);
    }
  }
  query += " ORDER BY timestamp DESC";
  try {
    const orders = db.prepare(query).all(...params);
    const ordersWithItems = orders.map(order => {
      const items = db.prepare('SELECT sale_items.*, items.name FROM sale_items JOIN items ON sale_items.item_id = items.id WHERE sale_items.sale_id = ?').all(order.id);
      let customerData = {};
      if (order.customer_id) {
        const customer = db.prepare('SELECT name, phone, address FROM customers WHERE id = ?').get(order.customer_id);
        customerData = { customer_name: customer?.name, customer_phone: customer?.phone, customer_address: customer?.address };
      }
      return { ...order, items, ...customerData };
    });
    res.json(ordersWithItems);
  } catch(e) {
    res.json([]);
  }
});

app.put('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const username = req.headers['x-username'] || 'System';
  try {
    db.prepare('UPDATE sales SET status = ? WHERE id = ?').run(status, id);
    try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details, username) VALUES (?, ?, ?, ?, ?)').run('sales', id, 'UPDATE', `Status changed to ${status}`, username); } catch(e) {}
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

app.post('/api/sales/:id/refund', (req, res) => {
  const { id } = req.params;
  const username = req.headers['x-username'] || 'System';
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    
    // Restore stock
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    for (const item of items) {
      db.prepare('UPDATE items SET stock = stock + ? WHERE id = ?').run(item.quantity, item.item_id);
    }
    
    db.prepare('UPDATE sales SET status = ? WHERE id = ?').run('refunded', id);
    try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details, username) VALUES (?, ?, ?, ?, ?)').run('sales', id, 'REFUND', `Sale #${id} refunded`, username); } catch(e) {}
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'Failed to refund' });
  }
});

app.post('/api/sales/:id/void', (req, res) => {
  const { id } = req.params;
  const username = req.headers['x-username'] || 'System';
  try {
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(id);
    if (!sale) return res.status(404).json({ error: 'Sale not found' });
    
    // Restore stock
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(id);
    for (const item of items) {
      db.prepare('UPDATE items SET stock = stock + ? WHERE id = ?').run(item.quantity, item.item_id);
    }
    
    db.prepare('UPDATE sales SET status = ? WHERE id = ?').run('voided', id);
    try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details, username) VALUES (?, ?, ?, ?, ?)').run('sales', id, 'VOID', `Sale #${id} voided`, username); } catch(e) {}
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: 'Failed to void' });
  }
});

app.get('/api/customers', (req, res) => {
  try {
    const customers = db.prepare(`
      SELECT c.*, 
        COALESCE(COUNT(s.id), 0) as total_orders, 
        COALESCE(SUM(s.total), 0) as total_spent 
      FROM customers c 
      LEFT JOIN sales s ON c.id = s.customer_id 
      GROUP BY c.id 
      ORDER BY total_spent DESC
    `).all();
    res.json(customers);
  } catch (e) {
    res.json(db.prepare('SELECT * FROM customers LIMIT 100').all());
  }
});

app.post('/api/customers', (req, res) => {
  const { name, phone, email, address } = req.body;
  const info = db.prepare('INSERT INTO customers (name, phone, email, address) VALUES (?, ?, ?, ?)').run(name, phone, email, address);
  try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details) VALUES (?, ?, ?, ?)').run('customers', info.lastInsertRowid, 'CREATE', `Created customer: ${name}`); } catch(e) {}
  res.json({ id: info.lastInsertRowid, name, phone, email, address });
});

app.put('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  const { name, phone, email, address } = req.body;
  try {
    db.prepare('UPDATE customers SET name = ?, phone = ?, email = ?, address = ? WHERE id = ?').run(name, phone, email, address, id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to update customer' });
  }
});

app.delete('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM customers WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Failed to delete customer' });
  }
});

app.get('/api/customers/:id/sales', (req, res) => {
  const { id } = req.params;
  try {
    const sales = db.prepare('SELECT * FROM sales WHERE customer_id = ? ORDER BY timestamp DESC').all(id);
    const salesWithItems = sales.map(sale => {
      const items = db.prepare('SELECT sale_items.*, items.name FROM sale_items JOIN items ON sale_items.item_id = items.id WHERE sale_items.sale_id = ?').all(sale.id);
      const customer = db.prepare('SELECT name, phone, address FROM customers WHERE id = ?').get(sale.customer_id);
      return { ...sale, items, customer_name: customer?.name, customer_phone: customer?.phone, customer_address: customer?.address };
    });
    res.json(salesWithItems);
  } catch(e) {
    console.error('Error fetching customer sales:', e);
    res.json([]);
  }
});

app.get('/api/customers/:id/stats', (req, res) => {
  const { id } = req.params;
  try {
    const stats = db.prepare('SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_spent FROM sales WHERE customer_id = ?').get(id);
    res.json(stats);
  } catch(e) {
    res.json({ total_orders: 0, total_spent: 0 });
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
  const { items, subtotal, tax, total, payment_method, customer_id, branch_id, timestamp, status } = req.body;
  const username = req.headers['x-username'] || 'System';
  console.log('Sale created:', { subtotal, tax, total, payment_method, customer_id, branch_id, timestamp, status });
  if (!items || items.length === 0) return res.status(400).json({ error: 'Cart is empty' });
  
  const saleTimestamp = timestamp || new Date().toISOString();
  
  const transaction = db.transaction(() => {
    const saleInfo = db.prepare('INSERT INTO sales (subtotal, tax, total, payment_method, customer_id, branch_id, timestamp, status, completed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(subtotal, tax, total, payment_method, customer_id || null, branch_id || null, saleTimestamp, status || 'completed', username);
    const saleId = saleInfo.lastInsertRowid;
    
    for (const item of items) {
      db.prepare('INSERT INTO sale_items (sale_id, item_id, quantity, price_at_sale) VALUES (?, ?, ?, ?)').run(saleId, item.id, item.quantity, item.price);
      db.prepare('UPDATE items SET stock = stock - ? WHERE id = ?').run(item.quantity, item.id);
    }
    
    try { db.prepare('INSERT INTO edit_logs (table_name, row_id, action, details, username) VALUES (?, ?, ?, ?, ?)').run('sales', saleId, 'CREATE', `Sale #${saleId} - Total: ${total}`, username); } catch(e) {}
    
    return saleId;
  });
  
  const saleId = transaction();
  res.json({ id: saleId, success: true });
});

app.get('/api/reports/sales', (req, res) => {
  const { branch_id, type, date } = req.query;
  
  let startDate, endDate;
  const now = new Date();
  
  if (type === 'month') {
    const [year, month] = (date || now.toISOString().slice(0, 7)).split('-');
    startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month) - 1, 0).getDate();
    endDate = `${year}-${month}-${lastDay}`;
  } else if (type === 'year') {
    const year = date || now.getFullYear().toString();
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else {
    startDate = date || now.toISOString().split('T')[0];
    endDate = startDate;
  }
  
  let query = "SELECT * FROM sales WHERE date(timestamp) >= date(?) AND date(timestamp) <= date(?)";
  let params = [startDate, endDate];
  console.log('Sales Report - query:', query, 'params:', params);
  if (branch_id) {
    query += " AND branch_id = ?";
    params.push(branch_id);
  }
  query += " ORDER BY timestamp DESC";
  const sales = db.prepare(query).all(...params);
  console.log('Sales Report - found:', sales.length);
  
  // Add customer and branch names
  const salesWithDetails = sales.map(sale => {
    let customerData = {};
    if (sale.customer_id) {
      const customer = db.prepare('SELECT name, phone, address FROM customers WHERE id = ?').get(sale.customer_id);
      customerData = { customer_name: customer?.name, customer_phone: customer?.phone, customer_address: customer?.address };
    }
    let branchData = {};
    if (sale.branch_id) {
      const branch = db.prepare('SELECT name FROM branches WHERE id = ?').get(sale.branch_id);
      branchData = { branch_name: branch?.name };
    }
    return { ...sale, ...customerData, ...branchData };
  });
  
  res.json(salesWithDetails);
});

app.get('/api/reports/summary', (req, res) => {
  const { branch_id, type, date } = req.query;
  
  let startDate, endDate;
  const now = new Date();
  
  if (type === 'month') {
    const [year, month] = (date || now.toISOString().slice(0, 7)).split('-');
    startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month) - 1, 0).getDate();
    endDate = `${year}-${month}-${lastDay}`;
  } else if (type === 'year') {
    const year = date || now.getFullYear().toString();
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else {
    startDate = date || now.toISOString().split('T')[0];
    endDate = startDate;
  }
  
  console.log('Summary - startDate:', startDate, 'endDate:', endDate, 'branch_id:', branch_id);
  
  let whereClause = "WHERE date(sales.timestamp) >= date(?) AND date(sales.timestamp) <= date(?) AND (sales.status IS NULL OR sales.status = 'completed' OR sales.status = 'pending' OR sales.status = 'preparing' OR sales.status = 'ready')";
  let params = [startDate, endDate];
  if (branch_id) {
    whereClause += " AND sales.branch_id = ?";
    params.push(branch_id);
  }
  console.log('Summary params:', params);
  const summary = db.prepare(`SELECT COUNT(*) as transaction_count, COALESCE(SUM(total), 0) as total_sales, payment_method FROM sales ${whereClause} GROUP BY payment_method`).all(...params);
  const items = db.prepare(`SELECT items.name, SUM(sale_items.quantity) as total_quantity, SUM(sale_items.quantity * sale_items.price_at_sale) as total_revenue FROM sale_items JOIN items ON sale_items.item_id = items.id JOIN sales ON sale_items.sale_id = sales.id ${whereClause} GROUP BY items.id ORDER BY total_revenue DESC`).all(...params);
  
  // Get refund/void stats
  let statsClause = "WHERE date(sales.timestamp) >= date(?) AND date(sales.timestamp) <= date(?)";
  let statsParams = [startDate, endDate];
  if (branch_id) {
    statsClause += " AND branch_id = ?";
    statsParams.push(branch_id);
  }
  const refundTotal = db.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM sales ${statsClause} AND status = 'refunded'`).get(...statsParams);
  const voidTotal = db.prepare(`SELECT COALESCE(SUM(total), 0) as total FROM sales ${statsClause} AND status = 'voided'`).get(...statsParams);
  
  console.log('Summary result:', summary.length, 'items:', items.length, 'refunded:', refundTotal?.total, 'voided:', voidTotal?.total);
  res.json({ summary, items, refunded_total: refundTotal?.total || 0, voided_total: voidTotal?.total || 0 });
});

app.get('/api/reports/sales', (req, res) => {
  const { branch_id, type, date } = req.query;
  
  let startDate, endDate;
  const now = new Date();
  
  if (type === 'month') {
    const [year, month] = (date || now.toISOString().slice(0, 7)).split('-');
    startDate = `${year}-${month}-01`;
    const lastDay = new Date(parseInt(year), parseInt(month) - 1, 0).getDate();
    endDate = `${year}-${month}-${lastDay}`;
  } else if (type === 'year') {
    const year = date || now.getFullYear().toString();
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  } else {
    startDate = date || now.toISOString().split('T')[0];
    endDate = startDate;
  }
  
  console.log('Reports Sales - startDate:', startDate, 'endDate:', endDate, 'branch_id:', branch_id, 'type:', type, 'date:', date);
  
  let query = "SELECT * FROM sales WHERE date(timestamp) >= date(?) AND date(timestamp) <= date(?)";
  let params = [startDate, endDate];
  console.log('Query params:', params);
  if (branch_id) {
    query += " AND branch_id = ?";
    params.push(branch_id);
  }
  query += " ORDER BY timestamp DESC";
  const sales = db.prepare(query).all(...params);
  console.log('Found sales:', sales.length, sales.slice(0, 2));
  
  // Calculate totals excluding refund/void
  const validSales = sales.filter(s => !s.status || s.status === 'completed' || s.status === 'pending' || s.status === 'preparing' || s.status === 'ready');
  const refundedTotal = sales.filter(s => s.status === 'refunded').reduce((sum, s) => sum + (s.total || 0), 0);
  const voidedTotal = sales.filter(s => s.status === 'voided').reduce((sum, s) => sum + (s.total || 0), 0);
  
  res.json({ sales, valid_sales: validSales, refunded_total: refundedTotal, voided_total: voidedTotal });
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

app.get('/api/db/export', (req, res) => {
  try {
    const tables = ['branches', 'users', 'categories', 'items', 'sales', 'sale_items', 'settings', 'payment_methods', 'customers', 'stock_adjustments', 'edit_logs'];
    const data = {};
    for (const table of tables) {
      try {
        data[table] = db.prepare(`SELECT * FROM ${table}`).all();
      } catch(e) {
        data[table] = [];
      }
    }
    res.setHeader('Content-Disposition', `attachment; filename=modernerp_backup_${new Date().toISOString().split('T')[0]}.json`);
    res.setHeader('Content-Type', 'application/json');
    res.json(data);
  } catch(e) {
    res.status(500).json({ error: 'Export failed' });
  }
});

app.post('/api/db/import', (req, res) => {
  console.log('Import request received');
  const { data, mode } = req.body;
  console.log('Data received:', typeof data, data ? Object.keys(data) : 'none');
  if (!data) return res.status(400).json({ error: 'No data provided' });
  
  try {
    const transaction = db.transaction(() => {
      if (mode === 'replace') {
        db.exec('DELETE FROM sale_items; DELETE FROM sales; DELETE FROM items; DELETE FROM categories; DELETE FROM customers; DELETE FROM stock_adjustments; DELETE FROM edit_logs; DELETE FROM payment_methods; DELETE FROM settings; DELETE FROM users; DELETE FROM branches;');
      }
      
      if (data.branches) for (const r of data.branches) {
        try { db.prepare('INSERT OR REPLACE INTO branches (id, name, address, contact, tax_rate, vat_id) VALUES (?, ?, ?, ?, ?, ?)').run(r.id, r.name, r.address, r.contact, r.tax_rate, r.vat_id); } catch(e) {}
      }
      if (data.users) for (const r of data.users) {
        try { db.prepare('INSERT OR REPLACE INTO users (id, username, password_hash, role, branch_id) VALUES (?, ?, ?, ?, ?)').run(r.id, r.username, r.password_hash, r.role, r.branch_id); } catch(e) {}
      }
      if (data.categories) for (const r of data.categories) {
        try { db.prepare('INSERT OR REPLACE INTO categories (id, name) VALUES (?, ?)').run(r.id, r.name); } catch(e) {}
      }
      if (data.items) for (const r of data.items) {
        try { db.prepare('INSERT OR REPLACE INTO items (id, name, price, cost_price, category_id, sku, stock, image_url, low_stock_threshold) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(r.id, r.name, r.price, r.cost_price, r.category_id, r.sku, r.stock, r.image_url, r.low_stock_threshold); } catch(e) {}
      }
      if (data.sales) for (const r of data.sales) {
        try { db.prepare('INSERT OR REPLACE INTO sales (id, subtotal, tax, total, timestamp, payment_method, customer_id, branch_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(r.id, r.subtotal, r.tax, r.total, r.timestamp, r.payment_method, r.customer_id, r.branch_id, r.status); } catch(e) {}
      }
      if (data.sale_items) for (const r of data.sale_items) {
        try { db.prepare('INSERT OR REPLACE INTO sale_items (id, sale_id, item_id, quantity, price_at_sale) VALUES (?, ?, ?, ?, ?)').run(r.id, r.sale_id, r.item_id, r.quantity, r.price_at_sale); } catch(e) {}
      }
      if (data.customers) for (const r of data.customers) {
        try { db.prepare('INSERT OR REPLACE INTO customers (id, name, phone, email, address) VALUES (?, ?, ?, ?, ?)').run(r.id, r.name, r.phone, r.email, r.address); } catch(e) {}
      }
      if (data.payment_methods) for (const r of data.payment_methods) {
        try { db.prepare('INSERT OR REPLACE INTO payment_methods (id, name, is_active) VALUES (?, ?, ?)').run(r.id, r.name, r.is_active); } catch(e) {}
      }
      if (data.settings) for (const r of data.settings) {
        try { db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(r.key, r.value); } catch(e) {}
      }
      if (data.stock_adjustments) for (const r of data.stock_adjustments) {
        try { db.prepare('INSERT OR REPLACE INTO stock_adjustments (id, item_id, adjustment, reason, username, timestamp) VALUES (?, ?, ?, ?, ?, ?)').run(r.id, r.item_id, r.adjustment, r.reason, r.username, r.timestamp); } catch(e) {}
      }
      if (data.edit_logs) for (const r of data.edit_logs) {
        try { db.prepare('INSERT OR REPLACE INTO edit_logs (id, table_name, row_id, action, details, username, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)').run(r.id, r.table_name, r.row_id, r.action, r.details, r.username, r.timestamp); } catch(e) {}
      }
    });
    transaction();
    res.json({ success: true, message: 'Database imported successfully' });
  } catch(e) {
    console.error('Import error:', e);
    res.status(500).json({ error: 'Import failed: ' + e.message });
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
