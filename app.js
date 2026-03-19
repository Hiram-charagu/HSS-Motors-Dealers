import { db, storage } from "./firebase.js";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js";

const state = {
  cars: [],
  cart: [],
  filteredCars: [],
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
    const snap = await getDocs(collection(db, 'cars'));
    const cars = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => c.status !== 'sold');

    state.cars = cars;
    state.filteredCars = cars;

    renderCars();
    renderHomeCars();
    renderFeatured();
    renderTopDeals();
    populateFilters(cars);
    renderModelDashboard();

    if (status) status.textContent = cars.length ? Loaded  cars : 'No cars in Firebase yet. Add via Admin.';
  } catch (err) {
    if (status) status.textContent = 'Failed to load cars from Firebase.';
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
    heading.textContent = type + 's';
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

function renderTopDeals() {
  const container = qs('[data-top-deals]');
  if (!container) return;
  container.innerHTML = '';
  state.cars.slice(0, 6).forEach((car) => {
    const card = document.createElement('div');
    card.className = 'deal-card';
    card.setAttribute('data-detail', car.id);
    card.innerHTML = `
      <img src="${car.hero}" alt="${car.name}">
      <h4>${car.name}</h4>
      <p class="price">KES ${Number(car.price).toLocaleString()}</p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-detail="${car.id}">View Details</button>
        <button class="btn" data-add="${car.id}">Add to Cart</button>
      </div>
    `;
    container.appendChild(card);
  });
  qsa('[data-add]', container).forEach((btn) => btn.addEventListener('click', () => addToCart(btn.dataset.add)));
}

function renderModelDashboard() {
  const container = qs('[data-models]');
  if (!container) return;
  const names = [...new Set(state.cars.map((c) => c.name))].slice(0, 15);
  container.innerHTML = '';
  names.forEach((name) => {
    const chip = document.createElement('button');
    chip.className = 'dash-chip';
    chip.type = 'button';
    chip.textContent = name;
    chip.addEventListener('click', () => {
      const search = qs('[data-filter-search]');
      if (search) {
        search.value = name;
        applyFilters();
      } else {
        window.location.href = 'inventory.html';
      }
    });
    container.appendChild(chip);
  });
}

function renderFeatured() {
  const featured = qs('[data-featured]');
  if (!featured) return;
  const items = state.cars.slice(0, 8);
  featured.innerHTML = items
    .map(
      (car) => `
      <div class="card reveal" data-detail="${car.id}">
        <img src="${car.hero}" alt="${car.name}">
        <div class="card-body">
          <span class="tag">${car.type}</span>
          <h4>${car.name}</h4>
          <p class="price">KES ${Number(car.price).toLocaleString()}</p>
          <div class="hero-actions">
            <button class="btn btn-primary" data-detail="${car.id}">View Details</button>
            <button class="btn" data-add="${car.id}">Add to Cart</button>
          </div>
        </div>
      </div>
    `
    )
    .join('');
  attachCardEvents();
}

function populateFilters(cars) {
  const brandSelect = qs('[data-filter-brand]');
  const typeSelect = qs('[data-filter-type]');
  if (!brandSelect || !typeSelect) return;
  const brands = [...new Set(cars.map((c) => c.brand))];
  const types = [...new Set(cars.map((c) => c.type))];
  brandSelect.innerHTML += brands.map((b) => `<option value="${b}">${b}</option>`).join('');
  typeSelect.innerHTML += types.map((t) => `<option value="${t}">${t}</option>`).join('');
}

function applyFilters() {
  const search = qs('[data-filter-search]')?.value.toLowerCase() ?? '';
  const brand = qs('[data-filter-brand]')?.value ?? '';
  const type = qs('[data-filter-type]')?.value ?? '';
  const maxPrice = Number(qs('[data-filter-price]')?.value ?? 0);
  state.filteredCars = state.cars.filter((car) => {
    const matchSearch = car.name.toLowerCase().includes(search) || car.brand.toLowerCase().includes(search);
    const matchBrand = brand ? car.brand === brand : true;
    const matchType = type ? car.type === type : true;
    const matchPrice = maxPrice ? Number(car.price) <= maxPrice : true;
    return matchSearch && matchBrand && matchType && matchPrice;
  });
  state.displayCount = 24;
  renderCars();
}

function attachCardEvents() {
  qsa('[data-detail]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.detail));
  });
  qsa('[data-add]').forEach((btn) => {
    btn.addEventListener('click', () => addToCart(btn.dataset.add));
  });
}

function openModal(id) {
  const car = state.cars.find((c) => c.id === id);
  if (!car) return;
  const modal = qs('[data-modal]');
  const content = qs('[data-modal-content]');
  const similar = state.cars.filter((c) => c.id !== id && c.brand === car.brand && c.type === car.type).slice(0, 3);
  const videoBlock = car.video
    ? `<video controls class="modal-video"><source src="${car.video}" type="video/mp4"></video>`
    : '';
  content.innerHTML = `
    <div class="modal-gallery">
      <img src="${car.exterior}" alt="${car.name} exterior">
      <img src="${car.view}" alt="${car.name} side view">
      <img src="${car.interior}" alt="${car.name} interior">
      <img src="${car.engine}" alt="${car.name} engine">
      ${videoBlock}
    </div>
    <div>
      <button class="close-btn" data-close>Close</button>
      <h2>${car.name}</h2>
      <p>${car.year} • ${car.brand} • ${car.type}</p>
      <p class="price">KES ${Number(car.price).toLocaleString()}</p>
      <p>${car.description}</p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-add="${car.id}">Add to Cart</button>
      </div>
      <h4>Similar Cars</h4>
      <div class="similar-row">
        ${similar
          .map(
            (s) => `
          <div class="card">
            <img src="${s.hero}" alt="${s.name}">
            <div class="card-body">
              <p>${s.name}</p>
              <button class="btn btn-secondary" data-detail="${s.id}">View</button>
            </div>
          </div>`
          )
          .join('')}
      </div>
    </div>
  `;
  modal.classList.add('open');
  qs('[data-close]', content).addEventListener('click', () => modal.classList.remove('open'));
  qsa('[data-detail]', content).forEach((btn) => btn.addEventListener('click', () => openModal(btn.dataset.detail)));
  qsa('[data-add]', content).forEach((btn) => btn.addEventListener('click', () => addToCart(btn.dataset.add)));
}

function setupModalClose() {
  const modal = qs('[data-modal]');
  if (!modal) return;
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('open');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modal.classList.remove('open');
    }
  });
}

function setupCartActions() {
  qsa('[data-cart-panel]').forEach((panel) => {
    panel.addEventListener('click', (e) => {
      const target = e.target;
      if (target.matches('[data-qty]')) {
        const id = target.getAttribute('data-id');
        const delta = target.getAttribute('data-qty') === 'plus' ? 1 : -1;
        updateCartQty(id, delta);
      }
      if (target.matches('[data-remove]')) {
        removeFromCart(target.getAttribute('data-remove'));
      }
    });
  });
}

async function setupAdmin() {
  const form = qs('[data-admin-form]');
  const list = qs('[data-admin-list]');
  if (!form || !list) return;

  const renderAdminList = async () => {
    const snap = await getDocs(collection(db, 'cars'));
    list.innerHTML = '';
    snap.docs.forEach((d) => {
      const car = { id: d.id, ...d.data() };
      const card = document.createElement('div');
      card.className = 'card admin-card';
      card.innerHTML = `
        <img src="${car.hero}" alt="${car.name}">
        <div class="card-body">
          <h3>${car.name}</h3>
          <p>${car.brand} • ${car.year} • ${car.type}</p>
          <p class="price">KES ${Number(car.price).toLocaleString()}</p>
          <div class="admin-actions">
            <button class="btn btn-primary" data-remove="${car.id}">Mark Sold</button>
          </div>
        </div>
      `;
      list.appendChild(card);
    });
  };

  await renderAdminList();
  const importBtn = form.querySelector('[data-import-xml]');
  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      importBtn.textContent = 'Importing...';
      const res = await fetch('data/cars.xml');
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const cars = [...xml.querySelectorAll('car')].map((node) => ({
        name: node.querySelector('name')?.textContent ?? '',
        brand: node.querySelector('brand')?.textContent ?? '',
        year: Number(node.querySelector('year')?.textContent ?? 0),
        price: Number(node.querySelector('price')?.textContent ?? 0),
        type: node.querySelector('type')?.textContent ?? '',
        hero: node.querySelector('hero')?.textContent ?? '',
        exterior: node.querySelector('exterior')?.textContent ?? '',
        view: node.querySelector('view')?.textContent ?? '',
        interior: node.querySelector('interior')?.textContent ?? '',
        engine: node.querySelector('engine')?.textContent ?? '',
        video: node.querySelector('video')?.textContent ?? '',
        description: node.querySelector('description')?.textContent ?? '',
        status: 'available',
        createdAt: serverTimestamp()
      }));
      for (const car of cars) {
        await addDoc(collection(db, 'cars'), car);
      }
      importBtn.textContent = 'Import XML';
      importBtn.disabled = false;
      await renderAdminList();
      await loadCars();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const inputs = [...form.querySelectorAll('input, select, textarea')];
    const values = inputs.map((i) => i.value.trim());
    if (values.slice(0, 9).some((v) => !v)) return;
    const [name, brand, year, price, type, hero, exterior, interior, engine, video, description] = values;
    await addDoc(collection(db, 'cars'), {
      name,
      brand,
      year,
      price: Number(price),
      type,
      hero,
      exterior,
      view: exterior,
      interior,
      engine,
      video,
      description,
      status: 'available',
      createdAt: serverTimestamp()
    });
    const success = form.querySelector('[data-admin-success]');
    if (success) {
      success.textContent = 'Car added successfully.';
      success.classList.add('show');
    }
    form.reset();
    await renderAdminList();
  const importBtn = form.querySelector('[data-import-xml]');
  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      importBtn.textContent = 'Importing...';
      const res = await fetch('data/cars.xml');
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const cars = [...xml.querySelectorAll('car')].map((node) => ({
        name: node.querySelector('name')?.textContent ?? '',
        brand: node.querySelector('brand')?.textContent ?? '',
        year: Number(node.querySelector('year')?.textContent ?? 0),
        price: Number(node.querySelector('price')?.textContent ?? 0),
        type: node.querySelector('type')?.textContent ?? '',
        hero: node.querySelector('hero')?.textContent ?? '',
        exterior: node.querySelector('exterior')?.textContent ?? '',
        view: node.querySelector('view')?.textContent ?? '',
        interior: node.querySelector('interior')?.textContent ?? '',
        engine: node.querySelector('engine')?.textContent ?? '',
        video: node.querySelector('video')?.textContent ?? '',
        description: node.querySelector('description')?.textContent ?? '',
        status: 'available',
        createdAt: serverTimestamp()
      }));
      for (const car of cars) {
        await addDoc(collection(db, 'cars'), car);
      }
      importBtn.textContent = 'Import XML';
      importBtn.disabled = false;
      await renderAdminList();
      await loadCars();
    });
  }
    await loadCars();
  });

  list.addEventListener('click', async (e) => {
    const target = e.target;
    if (target.matches('[data-remove]')) {
      const id = target.getAttribute('data-remove');
      await updateDoc(doc(db, 'cars', id), { status: 'sold' });
      await renderAdminList();
  const importBtn = form.querySelector('[data-import-xml]');
  if (importBtn) {
    importBtn.addEventListener('click', async () => {
      importBtn.disabled = true;
      importBtn.textContent = 'Importing...';
      const res = await fetch('data/cars.xml');
      const text = await res.text();
      const xml = new DOMParser().parseFromString(text, 'text/xml');
      const cars = [...xml.querySelectorAll('car')].map((node) => ({
        name: node.querySelector('name')?.textContent ?? '',
        brand: node.querySelector('brand')?.textContent ?? '',
        year: Number(node.querySelector('year')?.textContent ?? 0),
        price: Number(node.querySelector('price')?.textContent ?? 0),
        type: node.querySelector('type')?.textContent ?? '',
        hero: node.querySelector('hero')?.textContent ?? '',
        exterior: node.querySelector('exterior')?.textContent ?? '',
        view: node.querySelector('view')?.textContent ?? '',
        interior: node.querySelector('interior')?.textContent ?? '',
        engine: node.querySelector('engine')?.textContent ?? '',
        video: node.querySelector('video')?.textContent ?? '',
        description: node.querySelector('description')?.textContent ?? '',
        status: 'available',
        createdAt: serverTimestamp()
      }));
      for (const car of cars) {
        await addDoc(collection(db, 'cars'), car);
      }
      importBtn.textContent = 'Import XML';
      importBtn.disabled = false;
      await renderAdminList();
      await loadCars();
    });
  }
      await loadCars();
    }
  });
}

function setupSellerUpload() {
  const form = qs('[data-seller-form]');
  if (!form) return;
  const imageInput = form.querySelector('[data-image-upload]');
  const videoInput = form.querySelector('[data-video-upload]');
  const imagePreview = form.querySelector('[data-image-preview]');
  const videoPreview = form.querySelector('[data-video-preview]');

  if (imageInput) {
    imageInput.addEventListener('change', () => {
      imagePreview.innerHTML = '';
      [...imageInput.files].forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          const img = document.createElement('img');
          img.src = reader.result;
          imagePreview.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  if (videoInput) {
    videoInput.addEventListener('change', () => {
      videoPreview.innerHTML = '';
      const file = videoInput.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);
      const video = document.createElement('video');
      video.controls = true;
      video.src = url;
      videoPreview.appendChild(video);
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const success = form.querySelector('[data-success]');
    if (success) {
      success.textContent = 'Uploading...';
      success.classList.add('show');
    }

    const data = {
      name: form.querySelector('input[placeholder="Car Make & Model"]').value.trim(),
      email: form.querySelector('input[placeholder="Email"]').value.trim(),
      phone: form.querySelector('input[placeholder="Phone"]').value.trim(),
      description: form.querySelector('textarea').value.trim(),
      createdAt: serverTimestamp()
    };

    const imageUrls = [];
    if (imageInput && imageInput.files.length) {
      for (const file of imageInput.files) {
        const fileRef = ref(storage, `seller_images/${Date.now()}_${file.name}`);
        await uploadBytes(fileRef, file);
        imageUrls.push(await getDownloadURL(fileRef));
      }
    }

    let videoUrl = '';
    if (videoInput && videoInput.files.length) {
      const file = videoInput.files[0];
      const fileRef = ref(storage, `seller_videos/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      videoUrl = await getDownloadURL(fileRef);
    }

    await addDoc(collection(db, 'seller_submissions'), {
      ...data,
      imageUrls,
      videoUrl
    });

    if (success) {
      success.textContent = 'Submission sent. We will contact you shortly.';
    }
    form.reset();
    imagePreview.innerHTML = '';
    videoPreview.innerHTML = '';
  });
}

function setupFilters() {
  qsa('[data-filter]').forEach((el) => {
    el.addEventListener('input', applyFilters);
    el.addEventListener('change', applyFilters);
  });
}

function init() {
  loadCart();
  updateCartCount();
  loadCars();
  setupFilters();
  renderCartPanel();
  setupModalClose();
  setupCartActions();
  setupAdmin();
  setupSellerUpload();
}

document.addEventListener('DOMContentLoaded', init);


