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

let products = [];
let cart = [];
let searchQuery = '';

async function fetchProducts() {
  const response = await fetch('/api/products');
  products = await response.json();
  renderInventory();
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
    card.innerHTML = `
      <div class="top-line">
        <span class="style-chip">${product.style}</span>
        <span class="price">$${product.price.toFixed(0)}</span>
      </div>
      <img src="${product.image}" alt="${product.name}" class="product-image" />
      <h3>${product.name}</h3>
      <div class="stock">Stock: ${product.quantity}</div>
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
    `;
    salesList.appendChild(saleCard);
  });
}

refreshProductsButton.addEventListener('click', fetchProducts);
refreshSalesButton.addEventListener('click', fetchSales);
addToCartButton.addEventListener('click', () => addToCart(productSelect.value));
checkoutButton.addEventListener('click', completeSale);
productSearch.addEventListener('input', (event) => {
  searchQuery = event.target.value;
  renderInventory();
});

window.addEventListener('DOMContentLoaded', async () => {
  await fetchProducts();
  await fetchSales();
  updateCartView();
});
