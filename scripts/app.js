import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getDatabase, ref, get, set } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD7LY3WyVii2o_OwjYspWW5hFW8vRfs_uA",
  authDomain: "hss-motor-dealers.firebaseapp.com",
  databaseURL: "https://hss-motor-dealers-default-rtdb.firebaseio.com",
  projectId: "hss-motor-dealers",
  storageBucket: "hss-motor-dealers.firebasestorage.app",
  messagingSenderId: "485609737841",
  appId: "1:485609737841:web:e9d218a924949e75c215d0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const state = {
  cars: [],
  filteredCars: [],
  cart: [],
  displayCount: 24
};

const cartKey = 'hhsCart';
const roleKey = 'hhsRole';
const promoKey = 'hhsPromo';
const priceKey = 'hhsPriceOverrides';
const heroAudioKey = 'hhsHeroAudioPlayed';
const adminCode = 'HSS-ADMIN-2026';

const qs = (sel, scope = document) => scope.querySelector(sel);
const qsa = (sel, scope = document) => [...scope.querySelectorAll(sel)];
const formatPrice = (price) => `KES ${Number(price).toLocaleString()}`;

function getCardImage(car) {
  return car.hero || car.view || car.exterior;
}

function loadCart() {
  try {
    const saved = localStorage.getItem(cartKey);
    state.cart = saved ? JSON.parse(saved) : [];
  } catch {
    state.cart = [];
  }
  updateCartCount();
  renderCartPanel();
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
    existing.price = car.price;
    existing.image = getCardImage(car);
    existing.brand = car.brand;
    existing.year = car.year;
  } else {
    state.cart.push({
      id: car.id,
      name: car.name,
      price: car.price,
      qty: 1,
      image: getCardImage(car),
      brand: car.brand,
      year: car.year
    });
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
    const car = state.cars.find((entry) => entry.id === item.id);
    const image = car ? getCardImage(car) : item.image;
    const brand = car?.brand || item.brand || '';
    const year = car?.year || item.year || '';
    const price = car?.price ?? item.price;
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <div class="cart-copy">
        <img class="cart-thumb" src="${image}" alt="${item.name}">
        <div class="cart-meta">
          <h4>${item.name}</h4>
          <p>${year}${brand ? ` • ${brand}` : ''}</p>
          <p class="price">${formatPrice(price)}</p>
        </div>
      </div>
      <div class="cart-actions">
        <button class="btn btn-ghost" data-qty="minus" data-id="${item.id}">-</button>
        <span>x${item.qty}</span>
        <button class="btn btn-ghost" data-qty="plus" data-id="${item.id}">+</button>
        <button class="btn btn-ghost" data-detail="${item.id}">View Details</button>
        <button class="btn btn-ghost" data-remove="${item.id}">Remove</button>
      </div>
    `;
    list.appendChild(row);
    total += Number(price) * item.qty;
  });
  totalEl.textContent = total.toLocaleString();
}

async function loadCars() {
  const status = qs('[data-status]');
  const target = qs('[data-cars]') || qs('[data-featured]') || qs('[data-home-cars]') || qs('[data-models]');
  if (!target) return;
  try {
    let cars = [];

    try {
      const dbRef = ref(db, 'cars');
      const snapshot = await get(dbRef);
      if (snapshot.exists()) {
        cars = snapshot.val();
      }
    } catch {
      cars = [];
    }

    if (!cars.length) {
      const res = await fetch('data/cars.xml');
      if (!res.ok) throw new Error('Missing cars.xml');
      const xmlText = await res.text();
      const xml = new DOMParser().parseFromString(xmlText, 'text/xml');
      cars = [...xml.querySelectorAll('car')].map((node) => ({
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
        video: node.querySelector('video')?.textContent?.trim() || '',
        description: node.querySelector('description')?.textContent?.trim() || ''
      }));
      try {
        const dbRef = ref(db, 'cars');
        await set(dbRef, cars);
      } catch {
        // XML fallback remains the source if Firebase write is unavailable.
      }
    }

    const overrides = loadPriceOverrides();
    state.cars = cars.map((car) => ({
      ...car,
      price: overrides[car.id] ? Number(overrides[car.id]) : car.price
    }));
    state.cart = state.cart.map((item) => {
      const car = state.cars.find((entry) => entry.id === item.id);
      if (!car) return item;
      return {
        ...item,
        name: car.name,
        price: car.price,
        image: getCardImage(car),
        brand: car.brand,
        year: car.year
      };
    });
    state.filteredCars = state.cars;

    renderCars();
    renderHomeCars();
    renderFeatured();
    renderTopDeals();
    renderCartPanel();
    populateFilters(cars);
    renderModelDashboard();
    renderPromoBanner();
    populateAdminPriceSelect();

    if (status) status.textContent = `Loaded ${cars.length} cars`;
  } catch (err) {
    if (status) status.textContent = 'Failed to load cars. Check data/cars.xml.';
  }
}

function carCardMarkup(car) {
  return `
    <img src="${getCardImage(car)}" alt="${car.name}">
    <div class="card-body">
      <span class="tag">${car.type}</span>
      <h3>${car.name}</h3>
      <p>${car.year} • ${car.brand}</p>
      <p class="price">${formatPrice(car.price)}</p>
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
  state.filteredCars.slice(0, 8).forEach((car) => {
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
  state.filteredCars.slice(0, 8).forEach((car) => {
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
  state.filteredCars.slice(0, 5).forEach((car) => {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.innerHTML = `
      <img src="${getCardImage(car)}" alt="${car.name}">
      <h4>${car.name}</h4>
      <p>${car.year} • ${car.brand}</p>
      <p class="price">${formatPrice(car.price)}</p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-detail="${car.id}">View Details</button>
        <button class="btn" data-add="${car.id}">Add to Cart</button>
      </div>
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
  renderHomeCars();
  renderFeatured();
  renderTopDeals();
}

function attachCardEvents() {
  // Event delegation handled in setupCardDelegates.
}

function openModal(carId) {
  const modal = qs('[data-modal]');
  const body = qs('[data-modal-content]');
  if (!modal || !body) return;
  const car = state.cars.find((c) => c.id === carId);
  if (!car) return;
  const related = state.cars.filter((c) => c.type === car.type && c.id !== car.id).slice(0, 4);
  body.innerHTML = `
    <div class="modal-shell">
      <div class="modal-header">
        <h2>${car.name}</h2>
        <button class="btn btn-ghost" data-close>Close</button>
      </div>

      <div class="modal-grid">
        <div class="modal-media">
          <div class="modal-media-frame">
            <img src="${getCardImage(car)}" alt="${car.name}">
            <span class="modal-media-badge">${car.year} ${car.brand}</span>
          </div>
          <div class="modal-secondary-media">
            <figure>
              <img src="${car.interior}" alt="${car.name} interior">
              <figcaption>Interior</figcaption>
            </figure>
            ${car.video ? `
              <figure>
                <video controls>
                  <source src="${car.video}" type="video/mp4">
                </video>
                <figcaption>Short Video</figcaption>
              </figure>
            ` : ''}
          </div>
        </div>
        <div class="modal-info">
          <p class="modal-eyebrow">${car.type} spotlight</p>
          <p class="modal-description">${car.description}</p>
          <div class="modal-specs">
            <p><strong>Brand:</strong> ${car.brand}</p>
            <p><strong>Year:</strong> ${car.year}</p>
            <p><strong>Type:</strong> ${car.type}</p>
          </div>
          <p class="price">${formatPrice(car.price)}</p>
          <button class="btn btn-primary" data-add="${car.id}">Add to Cart</button>
        </div>
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
      </div>
    </div>
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

function setupCardDelegates() {
  document.addEventListener('click', (e) => {
    const target = e.target instanceof HTMLElement ? e.target : null;
    if (!target) return;
    const addBtn = target.closest('[data-add]');
    if (addBtn) {
      e.stopPropagation();
      addToCart(addBtn.getAttribute('data-add'));
      return;
    }
    const detailEl = target.closest('[data-detail]');
    if (detailEl) {
      openModal(detailEl.getAttribute('data-detail'));
    }
  });
}

function setupFilters() {
  qsa('[data-filter]').forEach((el) => {
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });

  qsa('.search-bar').forEach((bar) => {
    const input = qs('[data-filter-search]', bar);
    const button = qs('button', bar);
    if (button) {
      button.addEventListener('click', applyFilters);
    }
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          applyFilters();
        }
      });
    }
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
      const adminCodeInput = qs('[data-admin-code]', form);
      if (adminCodeInput) {
        const adminError = adminCodeInput.nextElementSibling;
        const code = adminCodeInput.value.trim();
        const message = code === adminCode ? '' : 'Admin code is invalid.';
        if (adminError && adminError.classList.contains('error-text')) {
          adminError.textContent = message;
        }
        if (message) valid = false;
      }
      const success = qs('[data-success]', form);
      if (success) {
        success.textContent = valid ? 'Submitted successfully. We will contact you soon.' : '';
      }
      if (valid && form.hasAttribute('data-admin-login')) {
        localStorage.setItem(roleKey, 'admin');
        window.location.href = 'admin.html';
        return;
      }
      if (valid && form.hasAttribute('data-signin')) {
        localStorage.setItem(roleKey, 'buyer');
        window.location.href = 'index.html';
        return;
      }
      if (valid && form.dataset.clearCart === 'true') {
        state.cart = [];
        saveCart();
      }
      if (valid) form.reset();
    });
  });
}

function setupAuth() {
  const role = localStorage.getItem(roleKey) || 'guest';
  qsa('[data-admin-link]').forEach((el) => {
    el.style.display = role === 'admin' ? 'inline-flex' : 'none';
  });
  const isAdminPage = document.body?.dataset?.page === 'admin';
  if (isAdminPage && role !== 'admin') {
    window.location.href = 'admin-login.html';
  }
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

function setupCreateAccount() {
  const btn = qs('[data-create-account]');
  if (!btn) return;
  btn.addEventListener('click', () => {
    window.location.href = 'contact.html#account';
  });
}

function setupHeaderToggles() {
  qsa('.header').forEach((header) => {
    const navToggle = qs('[data-nav-toggle]', header);
    const searchToggle = qs('[data-search-toggle]', header);

    if (navToggle) {
      navToggle.addEventListener('click', () => {
        const isOpen = header.classList.toggle('mobile-nav-open');
        navToggle.setAttribute('aria-expanded', String(isOpen));
      });
    }

    if (searchToggle) {
      searchToggle.addEventListener('click', () => {
        const isOpen = header.classList.toggle('mobile-search-open');
        searchToggle.setAttribute('aria-expanded', String(isOpen));
      });
    }
  });
}

function setupHeroAudio() {
  const audio = qs('[data-hero-audio]');
  if (!(audio instanceof HTMLAudioElement)) return;
  if (sessionStorage.getItem(heroAudioKey) === 'true') return;

  const markPlayed = () => sessionStorage.setItem(heroAudioKey, 'true');
  audio.addEventListener('ended', markPlayed, { once: true });

  const interactionEvents = ['pointerdown', 'keydown', 'touchstart'];
  let interactionBound = false;
  let playbackStarted = false;

  const removeInteractionHandlers = () => {
    if (!interactionBound) return;
    interactionBound = false;
    interactionEvents.forEach((eventName) => {
      document.removeEventListener(eventName, onFirstInteraction, true);
    });
  };

  const onFirstInteraction = () => {
    tryPlay();
  };

  const bindInteractionHandlers = () => {
    if (interactionBound || playbackStarted) return;
    interactionBound = true;
    interactionEvents.forEach((eventName) => {
      document.addEventListener(eventName, onFirstInteraction, true);
    });
  };

  const tryPlay = () => {
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          playbackStarted = true;
          removeInteractionHandlers();
        })
        .catch(() => {
          // Autoplay can be blocked until user interaction.
          bindInteractionHandlers();
        });
      return;
    }

    playbackStarted = !audio.paused;
    if (playbackStarted) {
      removeInteractionHandlers();
    } else {
      bindInteractionHandlers();
    }
  };

  tryPlay();
}

function loadPriceOverrides() {
  try {
    return JSON.parse(localStorage.getItem(priceKey)) || {};
  } catch {
    return {};
  }
}

function loadPromo() {
  try {
    const raw = localStorage.getItem(promoKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'string') {
      return { title: parsed, subtitle: '', image: '' };
    }
    return parsed;
  } catch {
    const fallback = localStorage.getItem(promoKey);
    return fallback ? { title: fallback, subtitle: '', image: '' } : null;
  }
}

function savePromo(data) {
  localStorage.setItem(promoKey, JSON.stringify(data));
  renderPromoBanner();
}

function savePriceOverrides(overrides) {
  localStorage.setItem(priceKey, JSON.stringify(overrides));
}

function renderPromoBanner() {
  const banner = qs('[data-promo-banner]');
  if (!banner) return;
  const data = loadPromo();
  if (!data) {
    banner.hidden = true;
    return;
  }
  banner.hidden = false;
  banner.style.display = '';
  const title = qs('[data-promo-title]', banner);
  const subtitle = qs('[data-promo-subtitle]', banner);
  const image = qs('[data-promo-image]', banner);
  if (title) title.textContent = data.title || 'Special Offer';
  if (subtitle) subtitle.textContent = data.subtitle || '';
  if (image && data.image) {
    image.src = data.image;
    image.style.display = 'block';
  } else if (image) {
    image.style.display = 'none';
  }
}

function populateAdminPriceSelect() {
  const select = qs('[data-price-car]');
  if (!select) return;
  select.innerHTML = '<option value="">Select a car</option>';
  state.cars.forEach((car) => {
    const opt = document.createElement('option');
    opt.value = car.id;
    opt.textContent = `${car.name} (${car.year})`;
    select.appendChild(opt);
  });
}

function setupAdminTools() {
  const promoForm = qs('[data-promo-form]');
  if (promoForm) {
    promoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const inputs = qsa('input', promoForm);
      const title = inputs[0]?.value.trim() || '';
      const subtitle = inputs[1]?.value.trim() || '';
      const image = inputs[2]?.value.trim() || '';
      if (!title || !subtitle) return;
      savePromo({ title, subtitle, image });
      const success = qs('[data-promo-success]', promoForm);
      if (success) success.textContent = 'Promo saved.';
      promoForm.reset();
    });
  }

  const priceForm = qs('[data-price-form]');
  if (priceForm) {
    priceForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const select = qs('[data-price-car]', priceForm);
      const priceInput = qsa('input', priceForm)[0];
      if (!select || !priceInput) return;
      const carId = select.value;
      const newPrice = Number(priceInput.value || 0);
      if (!carId || !newPrice) return;
      const overrides = loadPriceOverrides();
      overrides[carId] = newPrice;
      savePriceOverrides(overrides);
      state.cars = state.cars.map((car) => (car.id === carId ? { ...car, price: newPrice } : car));
      renderCars();
      renderHomeCars();
      renderFeatured();
      renderTopDeals();
      const success = qs('[data-price-success]', priceForm);
      if (success) success.textContent = 'Price updated.';
      priceForm.reset();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadCart();
  loadCars();
  setupCartActions();
  setupCardDelegates();
  setupModalClose();
  setupFilters();
  setupValidation();
  setupAuth();
  setupFlashTimer();
  setupAdminTools();
  setupCreateAccount();
  setupHeaderToggles();
  setupHeroAudio();
});
