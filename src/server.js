const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DEFAULT_SITES = [
  { id: '1', name: 'Linas Matkasse', url: 'https://www.linasmatkasse.se/recept/' },
  { id: '2', name: 'ICA Recept', url: 'https://www.ica.se/recept/' },
  { id: '3', name: 'Arla', url: 'https://www.arla.se/recept/' },
];

const DAYS = ['Måndag', 'Tisdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lördag', 'Söndag'];
const DEFAULT_PLAN = Object.fromEntries(DAYS.map(d => [d, null]));

function readJson(filename, defaultValue) {
  const filePath = path.join(DATA_DIR, filename);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return typeof defaultValue === 'function' ? defaultValue() : defaultValue;
  }
}

function writeJson(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2));
}

// ── Sites ──────────────────────────────────────────────────────────────────
app.get('/api/sites', (req, res) => {
  res.json(readJson('sites.json', DEFAULT_SITES));
});

app.post('/api/sites', (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url required' });
  const sites = readJson('sites.json', DEFAULT_SITES);
  const site = { id: Date.now().toString(), name, url };
  sites.push(site);
  writeJson('sites.json', sites);
  res.status(201).json(site);
});

app.delete('/api/sites/:id', (req, res) => {
  const sites = readJson('sites.json', DEFAULT_SITES).filter(s => s.id !== req.params.id);
  writeJson('sites.json', sites);
  res.json({ ok: true });
});

// ── Recipes ────────────────────────────────────────────────────────────────
app.get('/api/recipes', (req, res) => {
  res.json(readJson('recipes.json', []));
});

app.post('/api/recipes', (req, res) => {
  const { name, url } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name and url required' });
  const recipes = readJson('recipes.json', []);
  const recipe = { id: Date.now().toString(), name, url, savedAt: new Date().toISOString() };
  recipes.push(recipe);
  writeJson('recipes.json', recipes);
  res.status(201).json(recipe);
});

app.delete('/api/recipes/:id', (req, res) => {
  const recipes = readJson('recipes.json', []).filter(r => r.id !== req.params.id);
  writeJson('recipes.json', recipes);
  res.json({ ok: true });
});

// ── Weekly Plan ────────────────────────────────────────────────────────────
app.get('/api/plan', (req, res) => {
  res.json(readJson('plan.json', DEFAULT_PLAN));
});

app.put('/api/plan', (req, res) => {
  writeJson('plan.json', req.body);
  res.json(req.body);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Meal planner → http://localhost:${PORT}`);
});
