const state = {
  cars: [],
  filteredCars: [],
  cart: [],
  displayCount: 24
};

const cartKey = 'hhsCart';

const qs = (sel, scope = document) => scope.querySelector(sel);
const qsa = (sel, scope = document) => [...scope.querySelectorAll(sel)];

function loadCart() {
  try {
    const saved = localStorage.getItem(cartKey);
    state.cart = saved ? JSON.parse(saved) : [];
  } catch {
    state.cart = [];
  }
  updateCartCount();
}

function saveCart() {
  localStorage.setItem(cartKey, JSON.stringify(state.cart));
  updateCartCount();
  renderCartPanel();
}

function updateCartCount() {
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  qsa('[data-cart-count]').forEach((el) => (el.textContent = count));
}

function addToCart(carId) {
  const car = state.cars.find((c) => c.id === carId);
  if (!car) return;
  const existing = state.cart.find((item) => item.id === carId);
  if (existing) {
    existing.qty += 1;
  } else {
    state.cart.push({ id: car.id, name: car.name, price: car.price, qty: 1 });
  }
  saveCart();
}

function updateCartQty(id, delta) {
  const item = state.cart.find((i) => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    state.cart = state.cart.filter((i) => i.id !== id);
  }
  saveCart();
}

function removeFromCart(id) {
  state.cart = state.cart.filter((i) => i.id !== id);
  saveCart();
}

function renderCartPanel() {
  const panel = qs('[data-cart-panel]');
  if (!panel) return;
  const list = qs('[data-cart-items]', panel);
  const totalEl = qs('[data-cart-total]', panel);
  list.innerHTML = '';
  let total = 0;
  if (state.cart.length === 0) {
    list.innerHTML = '<p>Your cart is empty.</p>';
  }
  state.cart.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <span>${item.name}</span>
      <div class="cart-actions">
        <button class="btn btn-ghost" data-qty="minus" data-id="${item.id}">-</button>
        <span>x${item.qty}</span>
        <button class="btn btn-ghost" data-qty="plus" data-id="${item.id}">+</button>
        <button class="btn btn-ghost" data-remove="${item.id}">Remove</button>
      </div>
    `;
    list.appendChild(row);
    total += item.price * item.qty;
  });
  totalEl.textContent = total.toLocaleString();
}

async function loadCars() {
  const status = qs('[data-status]');
  const target = qs('[data-cars]') || qs('[data-featured]') || qs('[data-home-cars]') || qs('[data-models]');
  if (!target) return;
  try {
    const res = await fetch('data/cars.xml');
    if (!res.ok) throw new Error('Missing cars.xml');
    const xmlText = await res.text();
    const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
    const cars = [...xml.querySelectorAll('car')].map((node) => ({
      id: node.getAttribute('id'),
      name: node.querySelector('name')?.textContent?.trim() || '',
      brand: node.querySelector('brand')?.textContent?.trim() || '',
      year: node.querySelector('year')?.textContent?.trim() || '',
      price: Number(node.querySelector('price')?.textContent || 0),
      type: node.querySelector('type')?.textContent?.trim() || '',
      hero: node.querySelector('hero')?.textContent?.trim() || '',
      exterior: node.querySelector('exterior')?.textContent?.trim() || '',
      view: node.querySelector('view')?.textContent?.trim() || '',
      interior: node.querySelector('interior')?.textContent?.trim() || '',
      engine: node.querySelector('engine')?.textContent?.trim() || '',
      video: node.querySelector('video')?.textContent?.trim() || '',
      description: node.querySelector('description')?.textContent?.trim() || ''
    }));

    state.cars = cars;
    state.filteredCars = cars;

    renderCars();
    renderHomeCars();
    renderFeatured();
    renderTopDeals();
    populateFilters(cars);
    renderModelDashboard();

    if (status) status.textContent = `Loaded ${cars.length} cars`;
  } catch (err) {
    if (status) status.textContent = 'Failed to load cars. Check data/cars.xml.';
  }
}

function carCardMarkup(car) {
  return `
    <img src="${car.hero}" alt="${car.name}">
    <div class="card-body">
      <span class="tag">${car.type}</span>
      <h3>${car.name}</h3>
      <p>${car.year} • ${car.brand}</p>
      <p class="price">KES ${Number(car.price).toLocaleString()}</p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-detail="${car.id}">View Details</button>
        <button class="btn" data-add="${car.id}">Add to Cart</button>
      </div>
    </div>
  `;
}

function renderGroupedCars(container, limitPerType) {
  const types = [...new Set(state.filteredCars.map((c) => c.type))];
  container.innerHTML = '';
  types.forEach((type) => {
    const section = document.createElement('div');
    section.className = 'section-block';
    const heading = document.createElement('h3');
    heading.textContent = `${type}s`;
    const grid = document.createElement('div');
    grid.className = 'card-grid';
    state.filteredCars
      .filter((c) => c.type === type)
      .slice(0, limitPerType)
      .forEach((car) => {
        const card = document.createElement('div');
        card.className = 'card reveal';
        card.innerHTML = carCardMarkup(car);
        card.setAttribute('data-detail', car.id);
        grid.appendChild(card);
      });
    section.appendChild(heading);
    section.appendChild(grid);
    container.appendChild(section);
  });
  attachCardEvents();
}

function renderCars() {
  const grid = qs('[data-cars]');
  if (!grid) return;
  const grouped = grid.getAttribute('data-grouped') === 'true';
  const limit = Number(grid.getAttribute('data-limit') || 12);
  if (grouped) {
    renderGroupedCars(grid, limit);
    const loadMore = qs('[data-load-more]');
    if (loadMore) loadMore.style.display = 'none';
    return;
  }
  grid.innerHTML = '';
  const slice = state.filteredCars.slice(0, state.displayCount);
  slice.forEach((car) => {
    const card = document.createElement('div');
    card.className = 'card reveal';
    card.innerHTML = carCardMarkup(car);
    card.setAttribute('data-detail', car.id);
    grid.appendChild(card);
  });
  attachCardEvents();
}

function renderHomeCars() {
  const grid = qs('[data-home-cars]');
  if (!grid) return;
  grid.innerHTML = '';
  const grouped = grid.getAttribute('data-grouped') === 'true';
  if (grouped) {
    renderGroupedCars(grid, 10);
    return;
  }
  state.cars.slice(0, 8).forEach((car) => {
    const card = document.createElement('div');
    card.className = 'card reveal';
    card.innerHTML = carCardMarkup(car);
    card.setAttribute('data-detail', car.id);
    grid.appendChild(card);
  });
  attachCardEvents();
}

function renderFeatured() {
  const grid = qs('[data-featured]');
  if (!grid) return;
  grid.innerHTML = '';
  state.cars.slice(0, 8).forEach((car) => {
    const card = document.createElement('div');
    card.className = 'card reveal';
    card.innerHTML = carCardMarkup(car);
    card.setAttribute('data-detail', car.id);
    grid.appendChild(card);
  });
  attachCardEvents();
}

function renderTopDeals() {
  const wrap = qs('[data-top-deals]');
  if (!wrap) return;
  wrap.innerHTML = '';
  state.cars.slice(0, 5).forEach((car) => {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.innerHTML = `
      <img src="${car.hero}" alt="${car.name}">
      <h4>${car.name}</h4>
      <p class="price">KES ${Number(car.price).toLocaleString()}</p>
      <button class="btn btn-primary" data-add="${car.id}">Add to Cart</button>
    `;
    card.setAttribute('data-detail', car.id);
    wrap.appendChild(card);
  });
  attachCardEvents();
}

function renderModelDashboard() {
  const track = qs('[data-models]');
  if (!track) return;
  track.innerHTML = '';
  const models = [...new Set(state.cars.map((c) => c.name))].slice(0, 16);
  models.forEach((model) => {
    const chip = document.createElement('span');
    chip.className = 'dash-chip';
    chip.textContent = model;
    track.appendChild(chip);
  });
}

function populateFilters(cars) {
  const brandSelect = qs('[data-filter-brand]');
  const typeSelect = qs('[data-filter-type]');
  if (brandSelect) {
    const brands = [...new Set(cars.map((c) => c.brand))].sort();
    brandSelect.innerHTML = '<option value="">All Brands</option>';
    brands.forEach((brand) => {
      const opt = document.createElement('option');
      opt.value = brand;
      opt.textContent = brand;
      brandSelect.appendChild(opt);
    });
  }
  if (typeSelect) {
    const types = [...new Set(cars.map((c) => c.type))].sort();
    typeSelect.innerHTML = '<option value="">All Types</option>';
    types.forEach((type) => {
      const opt = document.createElement('option');
      opt.value = type;
      opt.textContent = type;
      typeSelect.appendChild(opt);
    });
  }
}

function applyFilters() {
  const brand = qs('[data-filter-brand]')?.value || '';
  const type = qs('[data-filter-type]')?.value || '';
  const priceMax = Number(qs('[data-filter-price]')?.value || 0);
  const search = qs('[data-filter-search]')?.value?.toLowerCase() || '';

  state.filteredCars = state.cars.filter((car) => {
    const brandOk = !brand || car.brand === brand;
    const typeOk = !type || car.type === type;
    const priceOk = !priceMax || car.price <= priceMax;
    const searchOk = !search || [car.name, car.brand, car.type].join(' ').toLowerCase().includes(search);
    return brandOk && typeOk && priceOk && searchOk;
  });
  renderCars();
}

function attachCardEvents() {
  qsa('[data-add]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      addToCart(btn.getAttribute('data-add'));
    };
  });

  qsa('[data-detail]').forEach((el) => {
    el.onclick = () => openModal(el.getAttribute('data-detail'));
  });
}

function openModal(carId) {
  const modal = qs('[data-modal]');
  const body = qs('[data-modal-content]');
  if (!modal || !body) return;
  const car = state.cars.find((c) => c.id === carId);
  if (!car) return;
  const related = state.cars.filter((c) => c.type === car.type && c.id !== car.id).slice(0, 4);
  body.innerHTML = `
    <div class="modal-header">
      <h2>${car.name}</h2>
      <button class="btn btn-ghost" data-close>Close</button>
    </div>
    <div class="modal-grid">
      <div class="modal-media">
        <img src="${car.hero}" alt="${car.name}">
        ${car.video ? `<video controls><source src="${car.video}" type="video/mp4"></video>` : ''}
      </div>
      <div class="modal-info">
        <p>${car.description}</p>
        <p><strong>Brand:</strong> ${car.brand}</p>
        <p><strong>Year:</strong> ${car.year}</p>
        <p><strong>Type:</strong> ${car.type}</p>
        <p class="price">KES ${Number(car.price).toLocaleString()}</p>
        <button class="btn btn-primary" data-add="${car.id}">Add to Cart</button>
      </div>
    </div>
    <div class="modal-gallery">
      <img src="${car.exterior}" alt="Exterior">
      <img src="${car.view}" alt="Side View">
      <img src="${car.interior}" alt="Interior">
      <img src="${car.engine}" alt="Engine">
    </div>
    ${related.length ? `
      <div class="modal-related">
        <h3>Other ${car.type}s</h3>
        <div class="card-grid">
          ${related.map((item) => `
            <div class="card" data-detail="${item.id}">
              ${carCardMarkup(item)}
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
  modal.classList.add('is-open');
  attachCardEvents();
  const closeBtn = qs('[data-close]', body);
  if (closeBtn) closeBtn.onclick = closeModal;
}

function closeModal() {
  const modal = qs('[data-modal]');
  const body = qs('[data-modal-content]');
  if (modal) modal.classList.remove('is-open');
  if (body) body.innerHTML = '';
}

function setupModalClose() {
  const modal = qs('[data-modal]');
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });
}

function setupCartActions() {
  document.addEventListener('click', (e) => {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const qty = target.getAttribute('data-qty');
    const id = target.getAttribute('data-id');
    if (qty && id) {
      updateCartQty(id, qty === 'plus' ? 1 : -1);
    }
    const remove = target.getAttribute('data-remove');
    if (remove) removeFromCart(remove);
  });
}

function setupFilters() {
  qsa('[data-filter]').forEach((el) => {
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });
}

function setupValidation() {
  qsa('.js-validate').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const fields = qsa('[data-required]', form);
      let valid = true;
      fields.forEach((field) => {
        const error = field.nextElementSibling;
        const value = field.value.trim();
        let message = '';
        if (!value) message = 'This field is required.';
        if (field.dataset.type === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          message = 'Enter a valid email.';
        }
        if (field.dataset.type === 'phone' && value && value.length < 9) {
          message = 'Enter a valid phone number.';
        }
        if (error && error.classList.contains('error-text')) {
          error.textContent = message;
        }
        if (message) valid = false;
      });
      const success = qs('[data-success]', form);
      if (success) {
        success.textContent = valid ? 'Submitted successfully. We will contact you soon.' : '';
      }
      if (valid && form.dataset.clearCart === 'true') {
        state.cart = [];
        saveCart();
      }
      if (valid) form.reset();
    });
  });
}

function setupFlashTimer() {
  const el = qs('#flash-timer');
  if (!el) return;
  let seconds = 2 * 60 * 60;
  setInterval(() => {
    seconds = Math.max(0, seconds - 1);
    const h = String(Math.floor(seconds / 3600)).padStart(2, '0');
    const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
    const s = String(seconds % 60).padStart(2, '0');
    el.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  setupCartActions();
  setupFilters();
  setupValidation();
  setupModalClose();
  setupFlashTimer();
  loadCars();
});
