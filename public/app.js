/* ══════════════════════════════════════════════════════════════════════
   Middagsplaneraren – frontend
   ══════════════════════════════════════════════════════════════════════ */

// ── State ────────────────────────────────────────────────────────────────
const state = {
  sites:        [],
  recipes:      [],
  plan:         {},
  currentUrl:   '',
  activeSiteId: null,
  pickDay:      null,
};

const DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];

// ── API helpers ──────────────────────────────────────────────────────────
async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── DOM refs ─────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);

const views         = document.querySelectorAll('.view');
const navBtns       = document.querySelectorAll('.nav-btn');
const weekGrid      = $('week-grid');
const recipeChips   = $('recipe-chips');
const noRecipesHint = $('no-recipes-hint');
const sitePills     = $('site-pills');
const addressBar    = $('address-bar');
const browserFrame  = $('browser-frame');
const iframeOverlay = $('iframe-overlay');

// ── Navigation ────────────────────────────────────────────────────────────
function switchView(name) {
  views.forEach(v => v.classList.toggle('active', v.id === `${name}-view`));
  navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === name));
}

navBtns.forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ── Load data ────────────────────────────────────────────────────────────
async function loadAll() {
  [state.sites, state.recipes, state.plan] = await Promise.all([
    api('GET', '/api/sites'),
    api('GET', '/api/recipes'),
    api('GET', '/api/plan'),
  ]);
  renderWeekGrid();
  renderRecipeChips();
  renderSitePills();
}

// ── Week grid ────────────────────────────────────────────────────────────
function todayName() {
  const d = new Date().getDay(); // 0=Sun
  const map = [6, 0, 1, 2, 3, 4, 5]; // JS Sun=0 → Söndag index 6
  return DAYS[map[d]];
}

function renderWeekGrid() {
  const today = todayName();
  weekGrid.innerHTML = '';
  DAYS.forEach(day => {
    const recipeId = state.plan[day];
    const recipe   = recipeId ? state.recipes.find(r => r.id === recipeId) : null;

    const card = document.createElement('div');
    card.className = `day-card${day === today ? ' today' : ''}`;
    card.innerHTML = `
      <span class="day-label">${day.slice(0, 3)}</span>
      <span class="day-recipe${recipe ? '' : ' empty'}">
        ${recipe
          ? `${recipe.name}<a class="day-recipe-link" href="${recipe.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a>`
          : '— Inget valt'}
      </span>
      <span class="day-chevron">›</span>
    `;
    card.addEventListener('click', () => openPickModal(day));
    weekGrid.appendChild(card);
  });
}

// ── Recipe chips ──────────────────────────────────────────────────────────
function renderRecipeChips() {
  recipeChips.innerHTML = '';
  if (state.recipes.length === 0) {
    noRecipesHint.classList.remove('hidden');
    return;
  }
  noRecipesHint.classList.add('hidden');

  state.recipes.forEach(recipe => {
    const chip = document.createElement('div');
    chip.className = 'recipe-chip';
    chip.innerHTML = `
      <a href="${recipe.url}" target="_blank" rel="noopener" title="Öppna recept">
        ${escHtml(recipe.name)}
      </a>
      <button class="chip-delete" data-id="${recipe.id}" title="Ta bort">×</button>
    `;
    chip.querySelector('.chip-delete').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteRecipe(recipe.id);
    });
    recipeChips.appendChild(chip);
  });
}

// ── Site pills ────────────────────────────────────────────────────────────
function renderSitePills() {
  sitePills.innerHTML = '';
  state.sites.forEach(site => {
    const pill = document.createElement('button');
    pill.className = `pill${state.activeSiteId === site.id ? ' active' : ''}`;
    pill.textContent = site.name;
    pill.addEventListener('click', () => loadSite(site));
    sitePills.appendChild(pill);
  });
}

function loadSite(site) {
  state.activeSiteId = site.id;
  navigateTo(site.url);
  renderSitePills();
}

// ── iframe navigation ─────────────────────────────────────────────────────
function navigateTo(url) {
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  state.currentUrl = url;
  addressBar.value = url;
  iframeOverlay.classList.add('hidden');
  browserFrame.src = url;
}

// Detect iframe load failure (X-Frame-Options etc.)
browserFrame.addEventListener('load', () => {
  try {
    // If same-origin, this succeeds
    const loc = browserFrame.contentWindow.location.href;
    if (loc === 'about:blank') return; // initial state
    state.currentUrl = loc;
    addressBar.value = loc;
  } catch {
    // cross-origin: perfectly normal, frame loaded something
  }
});

// Try to detect blocked frames (CSP/X-Frame-Options shows empty body)
browserFrame.addEventListener('error', () => {
  iframeOverlay.classList.remove('hidden');
});

// ── Address bar ───────────────────────────────────────────────────────────
$('btn-go').addEventListener('click', () => navigateTo(addressBar.value.trim()));
addressBar.addEventListener('keydown', e => {
  if (e.key === 'Enter') navigateTo(addressBar.value.trim());
});

$('btn-open-tab').addEventListener('click', () => {
  const url = addressBar.value.trim() || state.currentUrl;
  if (url) window.open(url, '_blank', 'noopener');
});

$('btn-fallback-open').addEventListener('click', () => {
  const url = state.currentUrl;
  if (url) window.open(url, '_blank', 'noopener');
});

// ── Save recipe modal ─────────────────────────────────────────────────────
$('btn-save-recipe').addEventListener('click', () => {
  $('save-recipe-url').value  = addressBar.value || state.currentUrl;
  $('save-recipe-name').value = '';
  openModal('modal-save-recipe');
  setTimeout(() => $('save-recipe-name').focus(), 80);
});

$('btn-cancel-save').addEventListener('click', () => closeModal('modal-save-recipe'));

$('btn-confirm-save').addEventListener('click', async () => {
  const name = $('save-recipe-name').value.trim();
  const url  = $('save-recipe-url').value.trim();
  if (!name || !url) return;
  const recipe = await api('POST', '/api/recipes', { name, url });
  state.recipes.push(recipe);
  renderRecipeChips();
  closeModal('modal-save-recipe');
});

// ── Add site modal ────────────────────────────────────────────────────────
$('btn-add-site').addEventListener('click', () => {
  $('add-site-name').value = '';
  $('add-site-url').value  = '';
  openModal('modal-add-site');
  setTimeout(() => $('add-site-name').focus(), 80);
});

$('btn-cancel-site').addEventListener('click', () => closeModal('modal-add-site'));

$('btn-confirm-site').addEventListener('click', async () => {
  const name = $('add-site-name').value.trim();
  const url  = $('add-site-url').value.trim();
  if (!name || !url) return;
  const site = await api('POST', '/api/sites', { name, url });
  state.sites.push(site);
  renderSitePills();
  closeModal('modal-add-site');
});

// ── Pick recipe for day modal ─────────────────────────────────────────────
function openPickModal(day) {
  state.pickDay = day;
  $('pick-modal-title').textContent = day;
  const list = $('pick-recipe-list');
  list.innerHTML = '';

  if (state.recipes.length === 0) {
    list.innerHTML = '<p class="hint">Inga sparade recept ännu. Bläddra och spara recept först.</p>';
  } else {
    state.recipes.forEach(recipe => {
      const item = document.createElement('div');
      item.className = 'pick-item';
      item.innerHTML = `
        <span class="pick-item-name">${escHtml(recipe.name)}</span>
        <span class="pick-item-url">${escHtml(recipe.url)}</span>
      `;
      item.addEventListener('click', () => assignRecipe(day, recipe.id));
      list.appendChild(item);
    });
  }

  openModal('modal-pick-recipe');
}

async function assignRecipe(day, recipeId) {
  state.plan[day] = recipeId;
  await api('PUT', '/api/plan', state.plan);
  renderWeekGrid();
  closeModal('modal-pick-recipe');
}

$('btn-clear-day').addEventListener('click', async () => {
  if (!state.pickDay) return;
  state.plan[state.pickDay] = null;
  await api('PUT', '/api/plan', state.plan);
  renderWeekGrid();
  closeModal('modal-pick-recipe');
});

$('btn-cancel-pick').addEventListener('click', () => closeModal('modal-pick-recipe'));

// ── Delete recipe ─────────────────────────────────────────────────────────
async function deleteRecipe(id) {
  await api('DELETE', `/api/recipes/${id}`);
  state.recipes = state.recipes.filter(r => r.id !== id);
  // Clear from plan if assigned
  DAYS.forEach(day => {
    if (state.plan[day] === id) state.plan[day] = null;
  });
  await api('PUT', '/api/plan', state.plan);
  renderRecipeChips();
  renderWeekGrid();
}

// ── Modal helpers ─────────────────────────────────────────────────────────
function openModal(id) {
  $(id).classList.remove('hidden');
}
function closeModal(id) {
  $(id).classList.add('hidden');
}

// Close modal on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

// ── Utilities ─────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────
loadAll();
