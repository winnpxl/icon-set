// Runbeta Icons — keyboard-first icon browser. No dependencies.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const store = {
  get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

const state = {
  data: null,
  bySlug: new Map(),
  query: '',
  variant: store.get('variant', 'auto'), // auto | light | dark  (what the grid shows)
  current: null,                         // focused/selected slug
  panelOpen: false,
  panelVariant: 'light',                 // what the panel exports
  tab: 'svg',
};

const theme = () => document.documentElement.dataset.theme;
const shownVariant = () => (state.variant === 'auto' ? theme() : state.variant);
const exportVariant = () => (state.panelOpen ? state.panelVariant : shownVariant());

// ---------- Boot ----------
const res = await fetch('icons.json');
state.data = await res.json();
for (const icon of state.data.icons) state.bySlug.set(icon.slug, icon);
$('#count').textContent = state.data.icons.length;

renderCategories();
renderGrid();
syncVariantControls();
bindUI();

const fromHash = decodeURIComponent(location.hash.slice(1));
if (state.bySlug.has(fromHash)) { select(fromHash, { focus: true }); openPanel(); }

// ---------- Rendering ----------
function renderCategories() {
  $('#cats').innerHTML = state.data.categories
    .map((c, i) => `<a href="#cat-${c.id}" data-cat="${c.id}">${c.label} <kbd>${i + 1}</kbd></a>`)
    .join('');
}

function renderGrid() {
  const v = shownVariant();
  const bg = v === theme() ? '' : `on-${v}`;
  const html = state.data.categories.map((c) => {
    const icons = state.data.icons.filter((i) => i.category === c.id);
    return `<section class="section" id="cat-${c.id}" data-cat="${c.id}">
      <h2>${c.label} <span>${icons.length}</span></h2>
      <div class="grid">${icons.map((i) => `
        <button class="tile" data-slug="${i.slug}" tabindex="-1" title="${escapeAttr(i.label)}">
          <span class="art ${bg}">${i.svg[v]}</span>
          <span class="name">${escapeHtml(i.label)}</span>
        </button>`).join('')}
      </div>
    </section>`;
  }).join('');
  $('#grid').innerHTML = html;
  applyFilter();
  if (state.current) markCurrent(state.current);
}

function refreshArt() {
  const v = shownVariant();
  const bg = v === theme() ? '' : `on-${v}`;
  for (const tile of $$('.tile')) {
    const art = $('.art', tile);
    art.className = `art ${bg}`;
    art.innerHTML = state.bySlug.get(tile.dataset.slug).svg[v];
  }
}

function applyFilter() {
  const terms = state.query.toLowerCase().split(/\s+/).filter(Boolean);
  const catLabel = Object.fromEntries(state.data.categories.map((c) => [c.id, c.label]));
  let shown = 0;
  for (const tile of $$('.tile')) {
    const icon = state.bySlug.get(tile.dataset.slug);
    const hay = `${icon.label} ${icon.slug} ${catLabel[icon.category]}`.toLowerCase();
    const hit = terms.every((t) => hay.includes(t));
    tile.hidden = !hit;
    if (hit) shown++;
  }
  for (const sec of $$('.section')) {
    const n = $$('.tile:not([hidden])', sec).length;
    sec.hidden = n === 0;
    $('h2 span', sec).textContent = n;
  }
  const empty = $('#empty');
  empty.hidden = shown > 0;
  $('span', empty).textContent = state.query;
  $('#count').textContent = terms.length ? `${shown} of ${state.data.icons.length}` : state.data.icons.length;
  // Keep a valid roving tab stop
  const visible = visibleTiles();
  if (!visible.some((t) => t.dataset.slug === state.current)) {
    for (const t of $$('.tile')) t.tabIndex = -1;
    if (visible[0]) visible[0].tabIndex = 0;
  }
}

const visibleTiles = () => $$('.tile').filter((t) => !t.hidden);
const tileFor = (slug) => $(`.tile[data-slug="${CSS.escape(slug)}"]`);

// ---------- Selection & navigation ----------
function markCurrent(slug) {
  for (const t of $$('.tile')) {
    const on = t.dataset.slug === slug;
    t.tabIndex = on ? 0 : -1;
    t.toggleAttribute('aria-current', false);
    if (on) t.setAttribute('aria-current', 'true');
  }
}

function select(slug, { focus = true } = {}) {
  state.current = slug;
  markCurrent(slug);
  const tile = tileFor(slug);
  if (focus && tile) { tile.focus({ preventScroll: true }); tile.scrollIntoView({ block: 'nearest' }); }
  if (state.panelOpen) fillPanel();
}

function move(dir) {
  const tiles = visibleTiles();
  if (!tiles.length) return;
  const cur = tiles.find((t) => t.dataset.slug === state.current);
  if (!cur) return select(tiles[0].dataset.slug);
  const idx = tiles.indexOf(cur);
  if (dir === 'left') return idx > 0 && select(tiles[idx - 1].dataset.slug);
  if (dir === 'right') return idx < tiles.length - 1 && select(tiles[idx + 1].dataset.slug);

  const c = center(cur);
  const down = dir === 'down';
  const cands = tiles.filter((t) => (down ? center(t).y > c.y + 4 : center(t).y < c.y - 4));
  if (!cands.length) return;
  const rowY = down ? Math.min(...cands.map((t) => center(t).y)) : Math.max(...cands.map((t) => center(t).y));
  const row = cands.filter((t) => Math.abs(center(t).y - rowY) < 4);
  row.sort((a, b) => Math.abs(center(a).x - c.x) - Math.abs(center(b).x - c.x));
  select(row[0].dataset.slug);
}
function center(el) { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

function jumpToCategory(n) {
  const cat = state.data.categories[n - 1];
  if (!cat) return;
  const first = $(`#cat-${cat.id} .tile:not([hidden])`);
  if (!first) return toast(`No matches in ${cat.label}`);
  $(`#cat-${cat.id}`).scrollIntoView({ block: 'start', behavior: 'smooth' });
  select(first.dataset.slug, { focus: false });
  first.focus({ preventScroll: true });
}

// ---------- Panel ----------
function openPanel() {
  if (!state.current) return;
  state.panelOpen = true;
  state.panelVariant = shownVariant();
  $('#panel').hidden = false;
  $('#scrim').hidden = !matchMedia('(max-width: 900px)').matches;
  fillPanel();
}
function closePanel() {
  state.panelOpen = false;
  $('#panel').hidden = true;
  $('#scrim').hidden = true;
  history.replaceState(null, '', location.pathname + location.search);
  const t = tileFor(state.current);
  if (t) t.focus({ preventScroll: true });
}
function fillPanel() {
  const icon = state.bySlug.get(state.current);
  if (!icon) return;
  const cat = state.data.categories.find((c) => c.id === icon.category);
  $('#p-cat').textContent = cat.label;
  $('#p-name').textContent = icon.label;
  $('#p-slug').textContent = icon.slug;
  $('#pv-light').innerHTML = icon.svg.light;
  $('#pv-dark').innerHTML = icon.svg.dark;
  for (const b of $$('#p-variant button')) b.setAttribute('aria-checked', String(b.dataset.v === state.panelVariant));
  for (const b of $$('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === state.tab));
  $('#p-code').textContent = sourceFor(icon, state.panelVariant, state.tab);
  history.replaceState(null, '', `#${icon.slug}`);
}

// ---------- Source formats ----------
const pascal = (slug) => slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join('').replace(/^(\d)/, 'Icon$1');
const fileUrl = (icon, v) => new URL(`icons/${v}/${icon.slug}.svg`, location.href).href;

function prettySvg(svg) {
  let depth = 0;
  return svg.replace(/></g, '>\n<').split('\n').map((line) => {
    if (/^<\//.test(line)) depth--;
    const out = '  '.repeat(Math.max(depth, 0)) + line;
    if (/^<[^/!][^>]*[^/]>$/.test(line) && !/<\/[^>]+>$/.test(line)) depth++;
    return out;
  }).join('\n');
}

function toJsx(icon, v) {
  let body = icon.svg[v]
    .replace(/\s(xmlns:xlink|xlink:href)=/g, (_, a) => ` ${a === 'xlink:href' ? 'xlinkHref' : 'xmlnsXlink'}=`)
    .replace(/\s([a-z]+(?:-[a-z]+)+)=/g, (_, a) => ' ' + a.replace(/-([a-z])/g, (_, c) => c.toUpperCase()) + '=')
    .replace(/<svg width="32" height="32"/, '<svg width={size} height={size}')
    .replace(/(<svg[^>]*?)>/, '$1 {...props}>');
  body = prettySvg(body).split('\n').map((l) => '    ' + l).join('\n');
  const name = `${pascal(icon.slug)}${v === 'dark' ? 'Dark' : ''}Icon`;
  return `export function ${name}({ size = 32, ...props }) {\n  return (\n${body}\n  );\n}\n`;
}

function sourceFor(icon, v, tab) {
  if (tab === 'jsx') return toJsx(icon, v);
  if (tab === 'html') return `<img src="${fileUrl(icon, v)}" width="32" height="32" alt="${icon.label}" />`;
  return prettySvg(icon.svg[v]);
}

// ---------- Actions ----------
async function svgToPng(svg, size) {
  const sized = svg.replace(/<svg width="32" height="32"/, `<svg width="${size}" height="${size}"`);
  const url = URL.createObjectURL(new Blob([sized], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = Object.assign(document.createElement('canvas'), { width: size, height: size });
    canvas.getContext('2d').drawImage(img, 0, 0, size, size);
    return await new Promise((r) => canvas.toBlob(r, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

function saveBlob(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { toast('Clipboard blocked — use the Source panel'); }
}

const pngSize = () => Number($('#p-size').value);

async function run(action) {
  const icon = state.bySlug.get(state.current);
  if (!icon) return toast('Select an icon first (arrow keys)');
  const v = exportVariant();
  const tag = `${icon.label} · ${v}`;
  flash();
  switch (action) {
    case 'copy-svg': return copyText(icon.svg[v], `Copied SVG — ${tag}`);
    case 'copy-jsx': return copyText(toJsx(icon, v), `Copied React — ${tag}`);
    case 'copy-url': return copyText(fileUrl(icon, v), `Copied URL — ${tag}`);
    case 'download-svg':
      saveBlob(new Blob([icon.svg[v] + '\n'], { type: 'image/svg+xml' }), `${icon.slug}-${v}.svg`);
      return toast(`Downloaded ${icon.slug}-${v}.svg`);
    case 'download-png': {
      const size = pngSize();
      saveBlob(await svgToPng(icon.svg[v], size), `${icon.slug}-${v}-${size}.png`);
      return toast(`Downloaded ${icon.slug}-${v}-${size}.png`);
    }
    case 'copy-png': {
      const size = pngSize();
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': svgToPng(icon.svg[v], size) })]);
        return toast(`Copied ${size}px PNG — ${tag}`);
      } catch { return toast('This browser can’t copy images — use P to download'); }
    }
  }
}

function flash() {
  const t = tileFor(state.current);
  if (!t) return;
  t.classList.remove('flash'); void t.offsetWidth; t.classList.add('flash');
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

// ---------- Theme & variant ----------
function toggleTheme() {
  const next = theme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
  refreshArt();
}
function setVariant(v) {
  state.variant = v;
  store.set('variant', v);
  syncVariantControls();
  refreshArt();
  if (state.panelOpen) { state.panelVariant = shownVariant(); fillPanel(); }
}
function syncVariantControls() {
  for (const b of $$('.seg[aria-label="Icon variant"] button')) b.setAttribute('aria-checked', String(b.dataset.variant === state.variant));
}
const nextVariant = () => ({ auto: 'light', light: 'dark', dark: 'auto' })[state.variant];

// ---------- Events ----------
function bindUI() {
  const search = $('#search');
  search.addEventListener('input', () => { state.query = search.value; applyFilter(); });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const first = visibleTiles()[0];
      if (first) select(first.dataset.slug);
      if (e.key === 'Enter' && first) openPanel();
    }
  });

  $('#grid').addEventListener('click', (e) => {
    const tile = e.target.closest('.tile');
    if (!tile) return;
    select(tile.dataset.slug);
    openPanel();
  });
  $('#grid').addEventListener('focusin', (e) => {
    const tile = e.target.closest('.tile');
    if (tile && tile.dataset.slug !== state.current) select(tile.dataset.slug, { focus: false });
  });

  $('#cats').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-cat]');
    if (!a) return;
    e.preventDefault();
    jumpToCategory(state.data.categories.findIndex((c) => c.id === a.dataset.cat) + 1);
  });

  for (const b of $$('.seg[aria-label="Icon variant"] button')) b.addEventListener('click', () => setVariant(b.dataset.variant));
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#help-btn').addEventListener('click', () => $('#help').showModal());
  $('#help [data-close]').addEventListener('click', () => $('#help').close());
  $('#help').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  const dl = $('#download-all'), menu = $('#download-menu');
  const setMenu = (open) => { menu.hidden = !open; dl.setAttribute('aria-expanded', String(open)); if (open) $('a', menu).focus(); };
  dl.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target)) setMenu(false); });
  menu.addEventListener('keydown', (e) => {
    const items = $$('a', menu), i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === 'Escape') { setMenu(false); dl.focus(); }
  });
  menu.addEventListener('click', () => setTimeout(() => setMenu(false), 0));

  $('#p-close').addEventListener('click', closePanel);
  $('#scrim').addEventListener('click', closePanel);
  for (const b of $$('#p-variant button')) b.addEventListener('click', () => { state.panelVariant = b.dataset.v; fillPanel(); });
  for (const b of $$('.tabs button')) b.addEventListener('click', () => { state.tab = b.dataset.tab; fillPanel(); });
  for (const b of $$('.act')) b.addEventListener('click', () => run(b.dataset.action));

  document.addEventListener('keydown', onKey);
}

function onKey(e) {
  const typing = e.target.matches('input, textarea, select');
  const help = $('#help');

  // ⌘K / Ctrl+K search from anywhere
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); focusSearch(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (help.open) return; // dialog handles Esc itself

  if (e.key === 'Escape') {
    if (typing && e.target.id === 'search') {
      if (e.target.value) { e.target.value = ''; state.query = ''; applyFilter(); }
      else e.target.blur();
      return;
    }
    if (state.panelOpen) return closePanel();
    if (state.query) { $('#search').value = ''; state.query = ''; applyFilter(); }
    return;
  }
  if (typing) return;
  if (!$('#download-menu').hidden) return;

  const key = e.key;
  const map = {
    ArrowLeft: () => move('left'), ArrowRight: () => move('right'),
    ArrowUp: () => move('up'), ArrowDown: () => move('down'),
    '/': focusSearch,
    '?': () => help.showModal(),
    t: toggleTheme, T: toggleTheme,
    v: () => setVariant(nextVariant()), V: () => setVariant(nextVariant()),
    c: () => run('copy-svg'), C: () => run('copy-png'),
    d: () => run('download-svg'), D: () => $('#download-all').click(),
    p: () => run('download-png'), P: () => run('download-png'),
    r: () => run('copy-jsx'), R: () => run('copy-jsx'),
    u: () => run('copy-url'), U: () => run('copy-url'),
    Enter: () => { if (e.target.closest('.tile') || !state.current) return false; openPanel(); },
  };
  if (/^[1-9]$/.test(key)) { e.preventDefault(); return jumpToCategory(Number(key)); }
  const fn = map[key];
  if (!fn) return;
  // Let Enter/Space on focused buttons do their normal thing
  if (key === 'Enter' && e.target.closest('button, a')) return;
  if (fn() !== false) e.preventDefault();
}

function focusSearch() { const s = $('#search'); s.focus(); s.select(); }

function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
function escapeAttr(s) { return escapeHtml(s); }
