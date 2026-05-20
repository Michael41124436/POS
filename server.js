const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
require('dotenv').config();
const nodemailer = require('nodemailer');
const session = require('express-session');
const bcrypt = require('bcryptjs');
let Stripe;
try { Stripe = require('stripe'); } catch (e) { Stripe = null; }

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'data.json');
const USERS_FILE = path.join(__dirname, 'users.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// sessions for simple staff login
app.use(session({
  secret: process.env.SESSION_SECRET || 'pos-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 }
}));

// ensure users file exists with a default admin
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    const pw = bcrypt.hashSync(process.env.DEFAULT_ADMIN_PW || 'password', 8);
    const defaultUser = [{ id: uuid(), username: 'admin', password: pw, role: 'admin' }];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUser, null, 2));
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  res.status(401).json({ error: 'Authentication required' });
}

function requireAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).json({ error: 'Admin only' });
}

const defaultData = {
  products: [
    { id: uuid(), name: 'Coffee', price: 3.5, quantity: 50 },
    { id: uuid(), name: 'Sandwich', price: 6.0, quantity: 30 },
    { id: uuid(), name: 'Cake Slice', price: 4.5, quantity: 20 }
  ],
  sales: []
};

function readData() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
  }
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  return JSON.parse(raw);
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

app.get('/api/products', (req, res) => {
  const data = readData();
  res.json(data.products);
});

app.post('/api/products', requireAuth, (req, res) => {
  const { name, price, quantity, style, image } = req.body;
  if (!name || price == null || quantity == null || !style) {
    return res.status(400).json({ error: 'name, price, quantity, and style are required' });
  }
  const data = readData();
  const newProduct = { 
    id: uuid(), 
    name, 
    price: Number(price), 
    quantity: Number(quantity),
    style,
    image: image || 'images/placeholder.svg'
  };
  data.products.push(newProduct);
  writeData(data);
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { name, price, quantity, style, image } = req.body;
  const data = readData();
  const product = data.products.find((item) => item.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  if (name != null) product.name = name;
  if (price != null) product.price = Number(price);
  if (quantity != null) product.quantity = Number(quantity);
  if (style != null) product.style = style;
  if (image != null) product.image = image;
  writeData(data);
  res.json(product);
});

app.post('/api/restock/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { amount } = req.body;
  const delta = Number(amount);
  if (isNaN(delta) || delta <= 0) {
    return res.status(400).json({ error: 'A positive restock amount is required' });
  }
  const data = readData();
  const product = data.products.find((item) => item.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  product.quantity = Math.max(0, product.quantity + delta);
  writeData(data);
  res.json(product);
});

app.get('/api/sales', (req, res) => {
  const data = readData();
  res.json(data.sales);
});

app.post('/api/sales', (req, res) => {
  const { items, customer } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Sale items are required' });
  }
  const data = readData();
  const now = new Date();
  let total = 0;
  items.forEach((item) => {
    const product = data.products.find((p) => p.id === item.id);
    if (!product) return;
    total += product.price * item.quantity;
    product.quantity = Math.max(0, product.quantity - item.quantity);
  });
  const sale = {
    id: uuid(),
    customer: customer || 'Walk-in',
    items,
    total,
    date: now.toISOString()
  };
  data.sales.push(sale);
  writeData(data);
  res.status(201).json(sale);
});

// Analytics endpoint: returns simple aggregates and top products
app.get('/api/analytics', (req, res) => {
  const { products, sales } = readData();

  // totals
  const totalSales = sales.reduce((s, sale) => s + (sale.total || 0), 0);
  const totalOrders = sales.length;
  const totalItems = sales.reduce((s, sale) => s + (sale.items || []).reduce((a, i) => a + (i.quantity || 0), 0), 0);
  const avgOrder = totalOrders ? totalSales / totalOrders : 0;

  // top products by quantity sold
  const productMap = {};
  sales.forEach(sale => {
    (sale.items || []).forEach(item => {
      if (!productMap[item.id]) productMap[item.id] = { id: item.id, name: item.name || 'Unknown', sold: 0, revenue: 0 };
      productMap[item.id].sold += item.quantity || 0;
      productMap[item.id].revenue += (item.price || 0) * (item.quantity || 0);
    });
  });

  const topProducts = Object.values(productMap).sort((a, b) => b.sold - a.sold).slice(0, 10);

  // low stock
  const lowStock = products.filter(p => p.quantity <= 5).map(p => ({ id: p.id, name: p.name, quantity: p.quantity }));

  res.json({
    totals: { totalSales, totalOrders, totalItems, avgOrder },
    topProducts,
    lowStock,
  });
});

// Enhanced analytics series (daily totals for last 30 days)
app.get('/api/analytics/series', (req, res) => {
  const { sales } = readData();
  const now = new Date();
  const days = 30;
  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const start = new Date(day);
    start.setHours(0,0,0,0);
    const end = new Date(day);
    end.setHours(23,59,59,999);
    const daySales = sales.filter(s => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });
    const revenue = daySales.reduce((a,b) => a + (b.total || 0), 0);
    const items = daySales.reduce((a,b) => a + (b.items||[]).reduce((x,y)=> x + (y.quantity||0),0), 0);
    daily.push({ date: start.toISOString().slice(0,10), revenue, items });
  }
  // weekly totals (last 12 weeks)
  const weeks = [];
  for (let w = 0; w < 12; w++) {
    const start = new Date();
    start.setDate(start.getDate() - (w * 7));
    start.setHours(0,0,0,0);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23,59,59,999);
    const weekSales = sales.filter(s => {
      const d = new Date(s.date);
      return d >= start && d <= end;
    });
    const revenue = weekSales.reduce((a,b) => a + (b.total || 0), 0);
    weeks.unshift({ start: start.toISOString().slice(0,10), revenue });
  }

  res.json({ daily, weeks });
});

// Auth routes
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
  req.session.user = { id: user.id, username: user.username, role: user.role };
  res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/api/users', requireAdmin, (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const users = readUsers();
  if (users.find(u => u.username === username)) return res.status(400).json({ error: 'username exists' });
  const hashed = bcrypt.hashSync(password, 8);
  const u = { id: uuid(), username, password: hashed, role: role || 'staff' };
  users.push(u);
  writeUsers(users);
  res.status(201).json({ id: u.id, username: u.username, role: u.role });
});

// list users (admin only)
app.get('/api/users', requireAdmin, (req, res) => {
  const users = readUsers();
  // do not send passwords
  res.json(users.map(u => ({ id: u.id, username: u.username, role: u.role })));
});

// delete a user (admin only)
app.delete('/api/users/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  const users = readUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  const removed = users.splice(idx, 1);
  writeUsers(users);
  res.json({ success: true, user: { id: removed[0].id, username: removed[0].username, role: removed[0].role } });
});

// Email receipt endpoint
app.post('/api/email-receipt', requireAuth, async (req, res) => {
  const { saleId, to } = req.body;
  if (!saleId || !to) return res.status(400).json({ error: 'saleId and to required' });
  const data = readData();
  const sale = data.sales.find(s => s.id === saleId);
  if (!sale) return res.status(404).json({ error: 'Sale not found' });

  if (!process.env.SMTP_HOST) return res.status(500).json({ error: 'SMTP not configured' });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined
  });

  const itemsHtml = (sale.items || []).map(i => `<li>${i.name} x${i.quantity} — $${((i.price||0)*i.quantity).toFixed(2)}</li>`).join('');
  const html = `<h3>Receipt — ${sale.id}</h3><p>Customer: ${sale.customer}</p><ul>${itemsHtml}</ul><p>Total: $${(sale.total||0).toFixed(2)}</p>`;

  try {
    await transporter.sendMail({ from: process.env.FROM_EMAIL || process.env.SMTP_USER, to, subject: 'Your Receipt', html });
    res.json({ success: true });
  } catch (err) {
    console.error('Mail error', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// expose minimal runtime config to the frontend (publishable keys, smtp)
app.get('/api/config', (req, res) => {
  res.json({
    stripeKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    smtpConfigured: Boolean(process.env.SMTP_HOST)
  });
});

// Stripe payment intent (stub)
app.post('/api/create-payment-intent', async (req, res) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || !Stripe) return res.status(501).json({ error: 'Stripe not configured' });
  const stripe = Stripe(key);
  const { amount, currency } = req.body;
  try {
    const intent = await stripe.paymentIntents.create({ amount: Math.round(amount * 100), currency: currency || 'usd' });
    res.json({ clientSecret: intent.client_secret });
  } catch (err) {
    console.error('Stripe error', err);
    res.status(500).json({ error: 'Stripe error' });
  }
});

app.delete('/api/products/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const data = readData();
  const index = data.products.findIndex((item) => item.id === id);
  if (index === -1) {
    return res.status(404).json({ error: 'Product not found' });
  }
  const deleted = data.products.splice(index, 1);
  writeData(data);
  res.json(deleted[0]);
});

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Online POS server running on http://localhost:${PORT}`);
});
