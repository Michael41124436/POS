const productGrid = document.getElementById('product-grid');
const productSearch = document.getElementById('product-search');
const productSelect = document.getElementById('product-select');
const cartItems = document.getElementById('cart-items');
const cartTotal = document.getElementById('cart-total');
const salesList = document.getElementById('sales-list');
const refreshProductsButton = document.getElementById('refresh-products');
const refreshSalesButton = document.getElementById('refresh-sales');
const addToCartButton = document.getElementById('add-to-cart');
const checkoutButton = document.getElementById('checkout');
const quantityInput = document.getElementById('product-quantity');
const customerNameInput = document.getElementById('customer-name');

// Receipt elements
const receiptModal = document.getElementById('receipt-modal');
const closeReceiptButton = document.getElementById('close-receipt');
const receiptContent = document.getElementById('receipt-content');

// Analytics elements
const toggleAnalyticsButton = document.getElementById('toggle-analytics');
const closeAnalyticsButton = document.getElementById('close-analytics');
const analyticsView = document.getElementById('analytics-view');
const totalSalesDisplay = document.getElementById('total-sales');
const totalOrdersDisplay = document.getElementById('total-orders');
const totalItemsDisplay = document.getElementById('total-items');
const avgOrderDisplay = document.getElementById('avg-order');
const topProductsTable = document.getElementById('top-products');
const revenueCanvas = document.getElementById('revenue-chart');
const itemsCanvas = document.getElementById('items-chart');
const lowStockAlert = document.getElementById('low-stock-alert');
const lowStockList = document.getElementById('low-stock-list');
const stockActionButton = document.getElementById('stock-action-button');
const loginView = document.getElementById('login-view');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const loginMessage = document.getElementById('login-message');
const userBadge = document.getElementById('user-badge');
const restockTableBody = document.getElementById('restock-table-body');
const staffUsernameInput = document.getElementById('staff-username');
const staffPasswordInput = document.getElementById('staff-password');
const staffRoleSelect = document.getElementById('staff-role');
const staffAddButton = document.getElementById('staff-add-button');
const staffMessage = document.getElementById('staff-message');
const staffTableBody = document.getElementById('staff-table-body');
let revenueChart = null;
let itemsChart = null;
let currentUser = null;
let lastPrintedSale = null;
let stripe = null;
let stripeCard = null;

// wire analytics toggles
if (closeAnalyticsButton) {
  closeAnalyticsButton.addEventListener('click', () => {
    analyticsView.style.display = 'none';
    document.querySelector('main').style.display = 'block';
  });
}

if (toggleAnalyticsButton) {
  toggleAnalyticsButton.addEventListener('click', async () => {
    if (!currentUser) {
      if (loginMessage) loginMessage.textContent = 'Please sign in to view analytics.';
      return;
    }
    document.querySelector('main').style.display = 'none';
    analyticsView.style.display = 'block';
    await fetchAndRenderAnalytics();
    await fetchAndRenderSeries();
  });
}

function fetchAndRenderAnalytics() {
  fetch('/api/analytics')
    .then(r => r.json())
    .then(data => {
      const t = data.totals || {};
      totalSalesDisplay.textContent = '$' + (t.totalSales || 0).toFixed(2);
      totalOrdersDisplay.textContent = (t.totalOrders || 0);
      totalItemsDisplay.textContent = (t.totalItems || 0);
      avgOrderDisplay.textContent = '$' + (t.avgOrder || 0).toFixed(2);

      // top products
      topProductsTable.innerHTML = '';
      (data.topProducts || []).forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${p.name}</td><td>${p.sold}</td><td>$${(p.revenue||0).toFixed(2)}</td>`;
        topProductsTable.appendChild(tr);
      });
    })
    .catch(err => console.error('Analytics load error', err));
}

// load series and render charts
function fetchAndRenderSeries() {
  fetch('/api/analytics/series')
    .then(r => r.json())
    .then(data => {
      const labels = (data.daily || []).map(d => d.date);
      const revenue = (data.daily || []).map(d => d.revenue);
      const items = (data.daily || []).map(d => d.items);

      if (revenueCanvas) {
        if (revenueChart) revenueChart.destroy();
        revenueChart = new Chart(revenueCanvas.getContext('2d'), {
          type: 'line',
          data: { labels, datasets: [{ label: 'Revenue', data: revenue, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.1)' }] },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }

      if (itemsCanvas) {
        if (itemsChart) itemsChart.destroy();
        itemsChart = new Chart(itemsCanvas.getContext('2d'), {
          type: 'bar',
          data: { labels, datasets: [{ label: 'Items Sold', data: items, backgroundColor: '#4f46e5' }] },
          options: { responsive: true, maintainAspectRatio: false }
        });
      }
    })
    .catch(err => console.error('Series load error', err));
}

// Admin panel elements
const toggleAdminButton = document.getElementById('toggle-admin');
const closeAdminButton = document.getElementById('close-admin');
const posView = document.getElementById('pos-view');
const adminView = document.getElementById('admin-view');
const adminProductList = document.getElementById('admin-product-list');
const adminSaveButton = document.getElementById('admin-save');
const adminCancelButton = document.getElementById('admin-cancel');
const adminNameInput = document.getElementById('admin-name');
const adminPriceInput = document.getElementById('admin-price');
const adminQuantityInput = document.getElementById('admin-quantity');
const adminStyleInput = document.getElementById('admin-style');
const adminImageInput = document.getElementById('admin-image');
const productIdInput = document.getElementById('product-id');
const formTitle = document.getElementById('form-title');

if (stockActionButton) {
  stockActionButton.addEventListener('click', () => {
    if (toggleAdminButton) {
      toggleAdminButton.click();
    }
  });
}

let products = [];
let cart = [];
let searchQuery = '';
let editingProductId = null;

async function fetchProducts() {
  const response = await fetch('/api/products');
  products = await response.json();
  renderInventory();
  renderAdminProductList();
  renderRestockDashboard();
  updateLowStockAlert();
  // load staff list for admin dashboard (if authorized)
  try { await fetchStaff(); } catch (e) { /* ignore */ }
}

async function fetchSales() {
  const response = await fetch('/api/sales');
  const sales = await response.json();
  renderSales(sales);
}

function renderInventory() {
  renderProductGrid();
  renderProductSelect();
}

function renderProductGrid() {
  productGrid.innerHTML = '';
  const visibleProducts = products.filter((product) => {
    const query = searchQuery.trim().toLowerCase();
    return query === '' || product.name.toLowerCase().includes(query) || product.style.toLowerCase().includes(query);
  });

  if (visibleProducts.length === 0) {
    productGrid.innerHTML = '<div class="empty-state">No matching shoes found.</div>';
    return;
  }

  visibleProducts.forEach((product) => {
    const card = document.createElement('div');
    card.className = 'product-card';
    const lowStockWarning = product.quantity <= 5 && product.quantity > 0 ? '<div class="low-stock-warning">⚠ Low Stock</div>' : '';
    const outOfStockWarning = product.quantity === 0 ? '<div class="low-stock-warning out-of-stock">Sold out</div>' : '';
    card.innerHTML = `
      <div class="top-line">
        <span class="style-chip">${product.style}</span>
        <span class="price">$${product.price.toFixed(0)}</span>
      </div>
      <img src="${product.image}" alt="${product.name}" class="product-image" />
      <h3>${product.name}</h3>
      <div class="stock ${product.quantity <= 5 ? 'stock-low' : ''}">Stock: ${product.quantity}</div>
      ${product.quantity === 0 ? outOfStockWarning : lowStockWarning}
      <button ${product.quantity === 0 ? 'disabled' : ''} data-product-id="${product.id}">Add</button>
    `;

    const addButton = card.querySelector('button');
    addButton.addEventListener('click', () => addToCart(product.id, 1));
    productGrid.appendChild(card);
  });
}

function renderProductSelect() {
  productSelect.innerHTML = '';
  products.forEach((product) => {
    const option = document.createElement('option');
    option.value = product.id;
    option.textContent = `${product.name} — $${product.price.toFixed(0)}`;
    productSelect.appendChild(option);
  });
}

function renderAdminProductList() {
  adminProductList.innerHTML = '';
  products.forEach((product) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${product.name}</td>
      <td>$${product.price.toFixed(2)}</td>
      <td>${product.quantity}</td>
      <td>${product.style}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit-btn" data-edit="${product.id}">Edit</button>
          <button class="action-btn delete-btn" data-delete="${product.id}">Delete</button>
        </div>
      </td>
    `;
    adminProductList.appendChild(row);
    
    row.querySelector(`[data-edit="${product.id}"]`).addEventListener('click', () => editProduct(product));
    row.querySelector(`[data-delete="${product.id}"]`).addEventListener('click', () => deleteProduct(product.id));
  });
}

function updateCartView() {
  cartItems.innerHTML = '';
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  cartTotal.textContent = total.toFixed(2);

  if (cart.length === 0) {
    cartItems.innerHTML = '<tr><td colspan="4">Your cart is empty.</td></tr>';
    return;
  }

  cart.forEach((item) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>$${(item.price * item.quantity).toFixed(2)}</td>
      <td><button class="remove-button">×</button></td>
    `;
    row.querySelector('button').addEventListener('click', () => removeFromCart(item.id));
    cartItems.appendChild(row);
  });
}

function addToCart(productId, quantity = Number(quantityInput.value)) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;
  if (quantity <= 0) return;
  if (quantity > product.quantity) {
    alert(`Only ${product.quantity} units available for ${product.name}.`);
    return;
  }

  const existing = cart.find((item) => item.id === product.id);
  if (existing) {
    if (existing.quantity + quantity > product.quantity) {
      alert(`Only ${product.quantity} units available for ${product.name}.`);
      return;
    }
    existing.quantity += quantity;
  } else {
    cart.push({ id: product.id, name: product.name, price: product.price, quantity });
  }

  updateCartView();
}

function removeFromCart(productId) {
  cart = cart.filter((item) => item.id !== productId);
  updateCartView();
}

async function completeSale() {
  if (cart.length === 0) {
    alert('Add at least one shoe to the cart before checkout.');
    return;
  }

  const salePayload = {
    customer: customerNameInput.value.trim() || 'Walk-in',
    items: cart.map((item) => ({ id: item.id, quantity: item.quantity }))
  };

  const response = await fetch('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(salePayload)
  });

  if (!response.ok) {
    const body = await response.json();
    alert(body.error || 'Sale failed.');
    return;
  }

  alert('Sale completed successfully.');
  cart = [];
  customerNameInput.value = '';
  quantityInput.value = 1;
  await fetchProducts();
  await fetchSales();
  updateCartView();
  showLowStockWarningToast();
}

function updateLowStockAlert() {
  if (!lowStockAlert || !lowStockList) return;

  const lowItems = products.filter(p => p.quantity > 0 && p.quantity <= 5);
  if (lowItems.length === 0) {
    lowStockAlert.classList.add('hidden');
    return;
  }

  const itemText = lowItems.map(p => `${p.name} (${p.quantity})`).join(', ');
  lowStockList.textContent = `${itemText}. Restock soon.`;
  lowStockAlert.classList.remove('hidden');
}

function renderRestockDashboard() {
  if (!restockTableBody) return;

  const lowStockProducts = products.filter(p => p.quantity > 0 && p.quantity <= 5);
  if (lowStockProducts.length === 0) {
    restockTableBody.innerHTML = '<tr><td colspan="3" class="empty-state">No low-stock items at the moment.</td></tr>';
    return;
  }

  restockTableBody.innerHTML = lowStockProducts.map((product) => `
    <tr>
      <td>${product.name}</td>
      <td>${product.quantity}</td>
      <td><button class="restock-button" data-id="${product.id}">Restock</button></td>
    </tr>
  `).join('');

  restockTableBody.querySelectorAll('.restock-button').forEach((button) => {
    button.addEventListener('click', () => restockProduct(button.dataset.id));
  });
}

async function restockProduct(productId) {
  const product = products.find((p) => p.id === productId);
  if (!product) return;

  const amount = Number(prompt(`Restock quantity for ${product.name} (current ${product.quantity}):`, '10'));
  if (isNaN(amount) || amount <= 0) {
    alert('Enter a positive restock amount.');
    return;
  }

  const response = await fetch(`/api/restock/${productId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  });

  if (!response.ok) {
    const body = await response.json();
    alert(body.error || 'Failed to restock the item.');
    return;
  }

  alert(`${product.name} restocked by ${amount} units.`);
  await fetchProducts();
}

// Staff management: list and remove
async function fetchStaff() {
  if (!staffTableBody) return;
  try {
    const res = await fetch('/api/users');
    if (!res.ok) {
      staffTableBody.innerHTML = '<tr><td colspan="3">Unable to load staff.</td></tr>';
      return;
    }
    const users = await res.json();
    renderStaffList(users);
  } catch (e) {
    console.error('Failed to fetch staff', e);
  }
}

function renderStaffList(users) {
  if (!staffTableBody) return;
  if (!users || users.length === 0) {
    staffTableBody.innerHTML = '<tr><td colspan="3">No staff accounts yet.</td></tr>';
    return;
  }
  staffTableBody.innerHTML = users.map(u => `
    <tr>
      <td>${u.username}</td>
      <td>${u.role}</td>
      <td>${u.role !== 'admin' ? `<button class="restock-button" data-id="${u.id}" data-action="delete-user">Remove</button>` : ''}</td>
    </tr>
  `).join('');
  staffTableBody.querySelectorAll('[data-action="delete-user"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this staff account?')) return;
      const id = btn.dataset.id;
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) { alert('Failed to remove user'); return; }
      await fetchStaff();
    });
  });
}

// Stripe (frontend) helper
async function ensureStripe() {
  if (stripe) return stripe;
  try {
    const cfg = await (await fetch('/api/config')).json();
    if (!cfg.stripeKey) return null;
    stripe = Stripe(cfg.stripeKey);
    return stripe;
  } catch (e) {
    console.error('Stripe init error', e);
    return null;
  }
}

async function payWithCard() {
  const s = await ensureStripe();
  if (!s) { alert('Stripe not configured.'); return; }
  const total = Number(cart.reduce((s, i) => s + i.price * i.quantity, 0));
  if (total <= 0) { alert('Cart is empty.'); return; }
  const intentRes = await fetch('/api/create-payment-intent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: total }) });
  if (!intentRes.ok) { alert('Payment initialization failed.'); return; }
  const body = await intentRes.json();
  const clientSecret = body.clientSecret;
  if (!stripeCard) {
    const elements = s.elements();
    stripeCard = elements.create('card');
    let el = document.getElementById('card-element');
    if (!el) {
      const modal = document.createElement('div');
      modal.className = 'receipt-modal';
      modal.id = 'payment-modal';
      modal.innerHTML = `<div class="receipt-container"><button class="modal-close" id="close-pay">×</button><div id="card-element" style="padding:12px;background:#fff;border-radius:8px;"></div><div style="margin-top:12px;"><button id="confirm-pay" class="restock-button">Pay $${total.toFixed(2)}</button></div></div>`;
      document.body.appendChild(modal);
      el = document.getElementById('card-element');
      document.getElementById('close-pay').addEventListener('click', () => modal.remove());
    }
    stripeCard.mount('#card-element');
  }
  const confirmBtn = document.getElementById('confirm-pay');
  confirmBtn.disabled = false;
  confirmBtn.onclick = async () => {
    confirmBtn.disabled = true;
    const res = await s.confirmCardPayment(clientSecret, { payment_method: { card: stripeCard } });
    if (res.error) {
      alert(res.error.message || 'Payment failed');
      confirmBtn.disabled = false;
      return;
    }
    if (res.paymentIntent && res.paymentIntent.status === 'succeeded') {
      await completeSale();
      alert('Payment successful and sale recorded.');
      const modal = document.getElementById('payment-modal'); if (modal) modal.remove();
    }
  };
}

function showLowStockWarningToast() {
  const lowItems = products.filter(p => p.quantity > 0 && p.quantity <= 5);
  if (lowItems.length === 0) return;

  const itemText = lowItems.map(p => `${p.name} (${p.quantity})`).join(', ');
  alert(`Low stock reminder: ${itemText}. Update inventory in the Admin Panel.`);
}

function renderSales(sales) {
  salesList.innerHTML = '';
  if (sales.length === 0) {
    salesList.textContent = 'No sales recorded yet.';
    return;
  }

  sales.slice().reverse().forEach((sale) => {
    const saleCard = document.createElement('div');
    saleCard.className = 'sale-item';
    saleCard.innerHTML = `
      <div class="sale-title">
        <strong>${sale.customer}</strong>
        <span>${new Date(sale.date).toLocaleString()}</span>
        <span>Total: $${sale.total.toFixed(2)}</span>
      </div>
      <div class="sale-items">
        ${sale.items.map((line) => {
          const product = products.find((p) => p.id === line.id);
          return `<div>${line.quantity} × ${product ? product.name : 'Shoe item'}</div>`;
        }).join('')}
      </div>
      <button class="print-btn" data-sale-id="${sale.id}">Print Receipt</button>
    `;
    salesList.appendChild(saleCard);
    
    saleCard.querySelector('button').addEventListener('click', () => printReceipt(sale));
  });
}

function printReceipt(sale) {
  const receiptHTML = `
    <div class="receipt-header">
      <div class="receipt-title">Shoe Store POS</div>
      <div class="receipt-time">${new Date(sale.date).toLocaleString()}</div>
    </div>
    
    <div class="receipt-items">
      <div class="receipt-item">
        <div class="receipt-item-name">Item</div>
        <div class="receipt-item-qty">Qty</div>
        <div class="receipt-item-total">Total</div>
      </div>
      ${sale.items.map((line) => {
        const product = products.find((p) => p.id === line.id);
        const itemTotal = product ? product.price * line.quantity : 0;
        return `
          <div class="receipt-item">
            <div class="receipt-item-name">${product ? product.name : 'Item'}</div>
            <div class="receipt-item-qty">${line.quantity}</div>
            <div class="receipt-item-total">$${itemTotal.toFixed(2)}</div>
          </div>
        `;
      }).join('')}
    </div>
    
    <div class="receipt-total">
      <span>Total:</span>
      <span>$${sale.total.toFixed(2)}</span>
    </div>
  `;
  
  receiptContent.innerHTML = receiptHTML;
  receiptModal.style.display = 'flex';
  lastPrintedSale = sale;
  const emailBtn = document.getElementById('email-receipt');
  if (emailBtn) {
    emailBtn.onclick = async () => {
      const to = prompt('Enter customer email to send receipt:', '');
      if (!to) return;
      const res = await fetch('/api/email-receipt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ saleId: sale.id, to }) });
      if (res.ok) alert('Receipt emailed successfully.'); else { const body = await res.json(); alert(body.error || 'Failed to send receipt.'); }
    };
  }
}


// Admin functions
function renderLoginState() {
  const isLoggedIn = Boolean(currentUser);
  if (loginView) {
    loginView.classList.toggle('hidden', isLoggedIn);
  }
  if (loginButton) {
    loginButton.classList.toggle('hidden', isLoggedIn);
  }
  if (logoutButton) {
    logoutButton.classList.toggle('hidden', !isLoggedIn);
  }
  if (userBadge) {
    if (isLoggedIn) {
      userBadge.textContent = `Signed in as ${currentUser.username} (${currentUser.role})`;
      userBadge.classList.remove('hidden');
    } else {
      userBadge.classList.add('hidden');
      userBadge.textContent = '';
    }
  }
  if (toggleAdminButton) {
    toggleAdminButton.classList.toggle('hidden', !isLoggedIn);
  }
  if (toggleAnalyticsButton) {
    toggleAnalyticsButton.classList.toggle('hidden', !isLoggedIn);
  }
}

async function refreshSession() {
  try {
    const response = await fetch('/api/me');
    if (!response.ok) {
      currentUser = null;
    } else {
      const data = await response.json();
      currentUser = data.user || null;
    }
  } catch (err) {
    currentUser = null;
  }
  renderLoginState();
}

async function inviteStaff() {
  if (!staffUsernameInput || !staffPasswordInput || !staffRoleSelect) return;
  const username = staffUsernameInput.value.trim();
  const password = staffPasswordInput.value;
  const role = staffRoleSelect.value;
  if (!username || !password) {
    if (staffMessage) staffMessage.textContent = 'Username and password are required.';
    return;
  }

  const response = await fetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, role })
  });

  if (!response.ok) {
    const body = await response.json();
    if (staffMessage) staffMessage.textContent = body.error || 'Could not create staff account.';
    return;
  }

  if (staffMessage) staffMessage.textContent = `Staff account ${username} created.`;
  staffUsernameInput.value = '';
  staffPasswordInput.value = '';
}

async function loginUser() {
  if (!loginUsernameInput || !loginPasswordInput) return;
  const username = loginUsernameInput.value.trim();
  const password = loginPasswordInput.value;
  if (!username || !password) {
    loginMessage.textContent = 'Enter both username and password.';
    return;
  }

  const response = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    const body = await response.json();
    loginMessage.textContent = body.error || 'Login failed.';
    return;
  }

  const body = await response.json();
  currentUser = body.user;
  loginMessage.textContent = '';
  renderLoginState();
}

async function logoutUser() {
  await fetch('/api/logout', { method: 'POST' });
  currentUser = null;
  renderLoginState();
  if (adminView.style.display === 'grid') {
    toggleAdminPanel();
  }
}

function toggleAdminPanel() {
  if (!currentUser) {
    if (loginMessage) {
      loginMessage.textContent = 'Please sign in to open the Admin Dashboard.';
    }
    return;
  }

  const isAdminVisible = adminView.style.display !== 'none';
  posView.style.display = isAdminVisible ? 'grid' : 'none';
  adminView.style.display = isAdminVisible ? 'none' : 'grid';
}

function resetAdminForm() {
  adminNameInput.value = '';
  adminPriceInput.value = '';
  adminQuantityInput.value = '';
  adminStyleInput.value = '';
  adminImageInput.value = '';
  productIdInput.value = '';
  editingProductId = null;
  formTitle.textContent = 'Add New Shoe';
}

function editProduct(product) {
  adminNameInput.value = product.name;
  adminPriceInput.value = product.price;
  adminQuantityInput.value = product.quantity;
  adminStyleInput.value = product.style;
  adminImageInput.value = product.image || '';
  productIdInput.value = product.id;
  editingProductId = product.id;
  formTitle.textContent = 'Edit Shoe';
  window.scrollTo(0, 0);
}

async function saveProduct() {
  const name = adminNameInput.value.trim();
  const price = Number(adminPriceInput.value);
  const quantity = Number(adminQuantityInput.value);
  const style = adminStyleInput.value.trim();
  const image = adminImageInput.value.trim();

  if (!name || !price || !quantity || !style) {
    alert('All fields are required.');
    return;
  }

  if (editingProductId) {
    // Update existing product
    const response = await fetch(`/api/products/${editingProductId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price, quantity, style, image })
    });

    if (!response.ok) {
      alert('Failed to update product.');
      return;
    }

    alert('Product updated successfully.');
  } else {
    // Create new product
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, price, quantity, style, image })
    });

    if (!response.ok) {
      alert('Failed to add product.');
      return;
    }

    alert('Product added successfully.');
  }

  resetAdminForm();
  await fetchProducts();
}

async function deleteProduct(productId) {
  if (!confirm('Are you sure you want to delete this shoe?')) {
    return;
  }

  const response = await fetch(`/api/products/${productId}`, {
    method: 'DELETE'
  });

  if (!response.ok) {
    alert('Failed to delete product.');
    return;
  }

  alert('Product deleted successfully.');
  await fetchProducts();
}

// Event listeners
refreshProductsButton.addEventListener('click', fetchProducts);
refreshSalesButton.addEventListener('click', fetchSales);
addToCartButton.addEventListener('click', () => addToCart(productSelect.value));
checkoutButton.addEventListener('click', completeSale);
productSearch.addEventListener('input', (event) => {
  searchQuery = event.target.value;
  renderInventory();
});

if (loginButton) {
  loginButton.addEventListener('click', loginUser);
}
if (logoutButton) {
  logoutButton.addEventListener('click', logoutUser);
}
if (staffAddButton) {
  staffAddButton.addEventListener('click', inviteStaff);
}

const payButton = document.getElementById('pay-button');
if (payButton) payButton.addEventListener('click', payWithCard);

toggleAdminButton.addEventListener('click', toggleAdminPanel);
closeAdminButton.addEventListener('click', toggleAdminPanel);
adminSaveButton.addEventListener('click', saveProduct);
adminCancelButton.addEventListener('click', () => resetAdminForm());
closeReceiptButton.addEventListener('click', () => {
  receiptModal.style.display = 'none';
});

window.addEventListener('DOMContentLoaded', async () => {
  await refreshSession();
  await fetchProducts();
  await fetchSales();
  updateCartView();
});

