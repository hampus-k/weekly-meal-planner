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
          ? `${escHtml(recipe.name)}<a class="day-recipe-link" href="${recipe.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">↗</a>`
          : '— Inget valt'}
      </span>
      <span class="day-chevron">›</span>
    `;
    card.addEventListener('click', () => openDayPanel(day));
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

// ── Site pills (browse view) ───────────────────────────────────────────────
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

// ── iframe navigation (browse view) ───────────────────────────────────────
async function navigateTo(url) {
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  state.currentUrl = url;
  addressBar.value = url;
  iframeOverlay.classList.add('hidden');
  try {
    const { embeddable } = await api('GET', `/api/check-embed?url=${encodeURIComponent(url)}`);
    if (!embeddable) {
      iframeOverlay.classList.remove('hidden');
      $('overlay-url-input').value = url;
      return;
    }
  } catch { /* ignore, try loading anyway */ }
  browserFrame.src = url;
}

browserFrame.addEventListener('load', () => {
  try {
    const loc = browserFrame.contentWindow.location.href;
    if (loc === 'about:blank') return;
    state.currentUrl = loc;
    addressBar.value = loc;
  } catch {
    // cross-origin: normal
  }
});

browserFrame.addEventListener('error', () => {
  iframeOverlay.classList.remove('hidden');
});

// ── Address bar (browse view) ──────────────────────────────────────────────
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
  if (url) {
    window.open(url, '_blank', 'noopener');
    $('overlay-url-input').value = url;
  }
});

// ── Save recipe (browse view "+" button) – auto-fetches title ─────────────
$('btn-save-recipe').addEventListener('click', async () => {
  const url = addressBar.value.trim() || state.currentUrl;
  if (!url) return;
  const btn = $('btn-save-recipe');
  btn.textContent = '…';
  btn.disabled = true;
  try {
    await saveRecipeFromUrl(url);
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = '+'; btn.disabled = false; }, 1500);
  } catch {
    btn.textContent = '+';
    btn.disabled = false;
  }
});

// Save from overlay URL input (browse view)
$('btn-overlay-save').addEventListener('click', async () => {
  const url = $('overlay-url-input').value.trim();
  if (!url) return;
  const btn = $('btn-overlay-save');
  btn.textContent = '…';
  btn.disabled = true;
  try {
    await saveRecipeFromUrl(url);
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = 'Spara recept'; btn.disabled = false; }, 1500);
  } catch {
    btn.textContent = 'Spara recept';
    btn.disabled = false;
  }
});

// ── Shared recipe save helper ──────────────────────────────────────────────
async function saveRecipeFromUrl(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let name = '';
  try {
    const result = await api('GET', `/api/fetch-title?url=${encodeURIComponent(url)}`);
    name = result.name || '';
  } catch { /* ignore, fall back to hostname */ }
  if (!name) {
    try { name = new URL(url).hostname.replace(/^www\./, ''); } catch { name = url; }
  }
  const recipe = await api('POST', '/api/recipes', { name, url });
  state.recipes.push(recipe);
  renderRecipeChips();
  return recipe;
}

// ── Add site modal ────────────────────────────────────────────────────────
function openAddSiteModal() {
  $('add-site-name').value = '';
  $('add-site-url').value  = '';
  openModal('modal-add-site');
  setTimeout(() => $('add-site-name').focus(), 80);
}

$('btn-add-site').addEventListener('click', openAddSiteModal);
$('btn-cancel-site').addEventListener('click', () => closeModal('modal-add-site'));

$('btn-confirm-site').addEventListener('click', async () => {
  const name = $('add-site-name').value.trim();
  const url  = $('add-site-url').value.trim();
  if (!name || !url) return;
  const site = await api('POST', '/api/sites', { name, url });
  state.sites.push(site);
  renderSitePills();
  renderPanelSitePills();
  closeModal('modal-add-site');
});

// ── Assign / delete recipe ─────────────────────────────────────────────────
async function assignRecipe(day, recipeId) {
  state.plan[day] = recipeId;
  await api('PUT', '/api/plan', state.plan);
  renderWeekGrid();
  closeDayPanel();
}

async function deleteRecipe(id) {
  await api('DELETE', `/api/recipes/${id}`);
  state.recipes = state.recipes.filter(r => r.id !== id);
  DAYS.forEach(day => {
    if (state.plan[day] === id) state.plan[day] = null;
  });
  await api('PUT', '/api/plan', state.plan);
  renderRecipeChips();
  renderWeekGrid();
}

// ── DAY PANEL ──────────────────────────────────────────────────────────────
let panelCurrentUrl   = '';
let panelActiveSiteId = null;

const dayPanel          = $('day-panel');
const dayPanelTitle     = $('day-panel-title');
const panelRecipeList   = $('panel-recipe-list');
const panelFrame        = $('panel-frame');
const panelAddressBar   = $('panel-address-bar');
const panelIframeOverlay = $('panel-iframe-overlay');
const panelSitePillsEl  = $('panel-site-pills');

function openDayPanel(day) {
  state.pickDay = day;
  dayPanelTitle.textContent = day;
  switchPanelTab('saved');
  renderPanelRecipeList();
  dayPanel.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeDayPanel() {
  dayPanel.classList.add('hidden');
  document.body.style.overflow = '';
  state.pickDay = null;
}

function switchPanelTab(tab) {
  document.querySelectorAll('#day-panel-tabs .panel-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.panel-tab-content').forEach(el => {
    el.classList.toggle('active', el.id === `panel-tab-${tab}`);
  });
}

document.querySelectorAll('#day-panel-tabs .panel-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    switchPanelTab(btn.dataset.tab);
    if (btn.dataset.tab === 'browse') renderPanelSitePills();
  });
});

$('btn-close-day-panel').addEventListener('click', closeDayPanel);

$('btn-panel-clear-day').addEventListener('click', async () => {
  if (!state.pickDay) return;
  state.plan[state.pickDay] = null;
  await api('PUT', '/api/plan', state.plan);
  renderWeekGrid();
  closeDayPanel();
});

function renderPanelRecipeList() {
  panelRecipeList.innerHTML = '';
  if (state.recipes.length === 0) {
    panelRecipeList.innerHTML = '<p class="hint">Inga sparade recept ännu.<br>Gå till fliken <strong>Bläddra</strong> för att hitta recept.</p>';
    return;
  }
  state.recipes.forEach(recipe => {
    const item = document.createElement('div');
    item.className = 'pick-item';
    item.innerHTML = `
      <span class="pick-item-name">${escHtml(recipe.name)}</span>
      <span class="pick-item-url">${escHtml(recipe.url)}</span>
    `;
    item.addEventListener('click', () => assignRecipe(state.pickDay, recipe.id));
    panelRecipeList.appendChild(item);
  });
}

// Panel site pills
function renderPanelSitePills() {
  panelSitePillsEl.innerHTML = '';
  state.sites.forEach(site => {
    const pill = document.createElement('button');
    pill.className = `pill${panelActiveSiteId === site.id ? ' active' : ''}`;
    pill.textContent = site.name;
    pill.addEventListener('click', () => panelLoadSite(site));
    panelSitePillsEl.appendChild(pill);
  });
}

function panelLoadSite(site) {
  panelActiveSiteId = site.id;
  panelNavigateTo(site.url);
  renderPanelSitePills();
}

async function panelNavigateTo(url) {
  if (!url) return;
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  panelCurrentUrl = url;
  panelAddressBar.value = url;
  panelIframeOverlay.classList.add('hidden');
  try {
    const { embeddable } = await api('GET', `/api/check-embed?url=${encodeURIComponent(url)}`);
    if (!embeddable) {
      panelIframeOverlay.classList.remove('hidden');
      $('panel-overlay-url').value = url;
      return;
    }
  } catch { /* ignore, try loading anyway */ }
  panelFrame.src = url;
}

panelFrame.addEventListener('load', () => {
  try {
    const loc = panelFrame.contentWindow.location.href;
    if (loc === 'about:blank') return;
    panelCurrentUrl = loc;
    panelAddressBar.value = loc;
  } catch {
    // cross-origin: normal
  }
});

panelFrame.addEventListener('error', () => {
  panelIframeOverlay.classList.remove('hidden');
});

$('btn-panel-go').addEventListener('click', () => panelNavigateTo(panelAddressBar.value.trim()));
panelAddressBar.addEventListener('keydown', e => {
  if (e.key === 'Enter') panelNavigateTo(panelAddressBar.value.trim());
});

$('btn-panel-open-tab').addEventListener('click', () => {
  const url = panelAddressBar.value.trim() || panelCurrentUrl;
  if (url) window.open(url, '_blank', 'noopener');
});

$('btn-panel-fallback-open').addEventListener('click', () => {
  const url = panelCurrentUrl;
  if (url) {
    window.open(url, '_blank', 'noopener');
    $('panel-overlay-url').value = url;
  }
});

// "+" in panel browse tab: auto-fetch title, save, assign to day
$('btn-panel-save').addEventListener('click', async () => {
  const url = panelAddressBar.value.trim() || panelCurrentUrl;
  if (!url) return;
  await panelSaveAndAssign(url);
});

// Save from overlay URL paste (panel)
$('btn-panel-overlay-save').addEventListener('click', async () => {
  const url = $('panel-overlay-url').value.trim();
  if (!url) return;
  await panelSaveAndAssign(url);
});

async function panelSaveAndAssign(url) {
  const btn = $('btn-panel-save');
  btn.textContent = '…';
  btn.disabled = true;
  try {
    const recipe = await saveRecipeFromUrl(url);
    if (state.pickDay) await assignRecipe(state.pickDay, recipe.id);
  } catch (err) {
    console.error(err);
    alert('Kunde inte spara receptet. Försök igen.');
  } finally {
    btn.textContent = '+';
    btn.disabled = false;
  }
}

$('btn-panel-add-site').addEventListener('click', openAddSiteModal);

// ── Modal helpers ─────────────────────────────────────────────────────────
function openModal(id) {
  $(id).classList.remove('hidden');
}
function closeModal(id) {
  $(id).classList.add('hidden');
}

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
