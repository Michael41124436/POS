const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

app.post('/api/products', (req, res) => {
  const { name, price, quantity } = req.body;
  if (!name || price == null || quantity == null) {
    return res.status(400).json({ error: 'name, price, and quantity are required' });
  }
  const data = readData();
  const newProduct = { id: uuid(), name, price: Number(price), quantity: Number(quantity) };
  data.products.push(newProduct);
  writeData(data);
  res.status(201).json(newProduct);
});

app.put('/api/products/:id', (req, res) => {
  const { id } = req.params;
  const { name, price, quantity } = req.body;
  const data = readData();
  const product = data.products.find((item) => item.id === id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  if (name != null) product.name = name;
  if (price != null) product.price = Number(price);
  if (quantity != null) product.quantity = Number(quantity);
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

app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Online POS server running on http://localhost:${PORT}`);
});
