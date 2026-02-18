const express = require('express');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http  = require('http');

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

// ── Fetch page title (server-side, bypasses X-Frame-Options) ───────────────
app.get('/api/fetch-title', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const html = await fetchPageHtml(url);
    const ogMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"'<]+)/i)
                 || html.match(/<meta[^>]+content=["']([^"'<]+)["'][^>]+property=["']og:title["']/i);
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const raw = (ogMatch ? ogMatch[1] : titleMatch ? titleMatch[1] : '');
    const name = raw.replace(/&amp;/g, '&').replace(/&#(\d+);/g, (_, c) => String.fromCharCode(c)).trim();
    res.json({ name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function fetchPageHtml(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) return reject(new Error('Too many redirects'));
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
      },
      timeout: 8000,
    }, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        const nextUrl = new URL(response.headers.location, url).href;
        response.resume();
        return fetchPageHtml(nextUrl, redirectCount + 1).then(resolve).catch(reject);
      }
      let data = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        data += chunk;
        if (data.length > 150000) req.destroy();
      });
      response.on('end', () => resolve(data));
      response.on('close', () => resolve(data));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Meal planner → http://localhost:${PORT}`);
});
