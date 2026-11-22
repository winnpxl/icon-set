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
  variant: ['light', 'dark'].includes(store.get('variant')) ? store.get('variant') : 'dark',
  current: null,
  panelOpen: false,
  panelVariant: 'dark',
  tab: 'svg',
};

const other = (v) => (v === 'light' ? 'dark' : 'light');
const exportVariant = () => (state.panelOpen ? state.panelVariant : state.variant);

// Each inline SVG gets unique ids so clip paths and masks never collide across copies on the page.
let instanceId = 0;
function inst(svg) {
  const n = ++instanceId;
  return svg
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${id}-${n}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${id}-${n})`)
    .replace(/href="#([^"]+)"/g, (_, id) => `href="#${id}-${n}"`);
}

// ---------- Rendering ----------
function renderCategories() {
  $('#cats').innerHTML = state.data.categories
    .map((c, i) => `<a href="#cat-${c.id}" data-n="${i + 1}">${c.label} <kbd>${i + 1}</kbd></a>`)
    .join('');
}

function renderGrid() {
  const v = state.variant;
  $('#grid').className = `grid-wrap variant-${v}`;
  $('#grid').innerHTML = state.data.categories.map((c) => {
    const icons = state.data.icons.filter((i) => i.category === c.id);
    return `<section class="section" id="cat-${c.id}">
      <header class="section-head"><h3>${c.label}</h3><span class="n">${icons.length}</span></header>
      <div class="grid">${icons.map((i) => `
        <button class="tile" data-slug="${i.slug}" tabindex="-1" title="${escapeHtml(i.label)}">
          <span class="art">${inst(i.svg[v])}</span>
          <span class="name">${escapeHtml(i.label)}</span>
        </button>`).join('')}
      </div>
    </section>`;
  }).join('');
  applyFilter();
}

function refreshArt() {
  const v = state.variant;
  $('#grid').className = `grid-wrap variant-${v}`;
  for (const tile of $$('.tile')) $('.art', tile).innerHTML = inst(state.bySlug.get(tile.dataset.slug).svg[v]);
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
    $('.n', sec).textContent = n;
  }
  $('#empty').hidden = shown > 0;
  $('#empty span').textContent = state.query;
  $('#count').textContent = terms.length ? `${shown}/${state.data.icons.length}` : '';
  const visible = visibleTiles();
  if (!visible.some((t) => t.dataset.slug === state.current)) {
    for (const t of $$('.tile')) t.tabIndex = -1;
    if (visible[0]) visible[0].tabIndex = 0;
  }
}

const visibleTiles = () => $$('.tile').filter((t) => !t.hidden);
const tileFor = (slug) => $(`.tile[data-slug="${CSS.escape(slug)}"]`);

// ---------- Selection & navigation ----------
function select(slug, { focus = true } = {}) {
  state.current = slug;
  for (const t of $$('.tile')) {
    const on = t.dataset.slug === slug;
    t.tabIndex = on ? 0 : -1;
    if (on) t.setAttribute('aria-current', 'true');
    else t.removeAttribute('aria-current');
  }
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
  let first = $(`#cat-${cat.id} .tile:not([hidden])`);
  if (!first && state.query) { clearSearch(); first = $(`#cat-${cat.id} .tile`); }
  if (!first) return;
  $(`#cat-${cat.id}`).scrollIntoView({ block: 'start' });
  for (const a of $$('#cats a')) a.classList.toggle('active', Number(a.dataset.n) === n);
  select(first.dataset.slug, { focus: false });
  first.focus({ preventScroll: true });
}

// ---------- Detail panel ----------
function openPanel() {
  if (!state.current) return;
  state.panelOpen = true;
  state.panelVariant = state.variant;
  $('#panel').hidden = false;
  $('#scrim').hidden = !matchMedia('(max-width: 860px)').matches;
  fillPanel();
}
function closePanel() {
  state.panelOpen = false;
  $('#panel').hidden = true;
  $('#scrim').hidden = true;
  history.replaceState(null, '', location.pathname + location.search);
  const t = tileFor(state.current);
  if (t && !t.hidden) t.focus({ preventScroll: true });
}
function fillPanel() {
  const icon = state.bySlug.get(state.current);
  if (!icon) return;
  const cat = state.data.categories.find((c) => c.id === icon.category);
  $('#p-cat').textContent = cat.label;
  $('#p-name').textContent = icon.label;
  $('#p-index').textContent = `${String(icon.index).padStart(2, '0')} / ${state.data.icons.length}`;
  $('#p-slug').textContent = `${icon.slug}.svg`;
  $('#p-figma').textContent = `#${icon.figma ?? '—'}`;
  $('#pv-light').innerHTML = inst(icon.svg.light);
  $('#pv-dark').innerHTML = inst(icon.svg.dark);
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
  catch { toast('Clipboard blocked — open Source in the panel'); }
}

const pngSize = () => Number($('#p-size').value);

async function run(action) {
  const icon = state.bySlug.get(state.current);
  if (!icon) return toast('Pick an icon first — arrow keys or click');
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
      } catch { return toast('This browser can’t copy images — press P to download'); }
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

// ---------- Variant & search ----------
function setVariant(v) {
  state.variant = v;
  store.set('variant', v);
  syncVariantControls();
  refreshArt();
  if (state.panelOpen) { state.panelVariant = v; fillPanel(); }
}
// ---------- Theme transition ----------
// The new theme is revealed as a circle of light growing from the switch. As the circle's edge passes
// each icon, that icon re-inks itself (a small pop and settle), timed to the exact moment the edge reaches it.
const THEME_MS = 760;
const THEME_EASE = [0.65, 0, 0.35, 1]; // cubic-bezier for the reveal
const themeEase = `cubic-bezier(${THEME_EASE.join(',')})`;
let themeTransition = null;

// Time fraction at which the eased circle reaches a given progress (inverse of the cubic-bezier).
const easeTable = (() => {
  const [x1, y1, x2, y2] = THEME_EASE, rows = [];
  const bez = (a, b, s) => 3 * a * s * (1 - s) ** 2 + 3 * b * s * s * (1 - s) + s ** 3;
  for (let i = 0; i <= 200; i++) { const s = i / 200; rows.push([bez(x1, x2, s), bez(y1, y2, s)]); }
  return rows;
})();
const timeForProgress = (p) => (easeTable.find(([, y]) => y >= p) || easeTable[easeTable.length - 1])[0];

function switchTheme(v, originEl) {
  if (v === state.variant) return;
  const r = (originEl || $(`.bar .selector [data-variant="${v}"]`)).getBoundingClientRect();
  const x = r.left + r.width / 2, y = r.top + r.height / 2;
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;

  const update = () => { setVariant(v); if (!reduce) inkIcons(x, y, radius); };

  if (reduce || !document.startViewTransition) return update();

  themeTransition?.skipTransition();
  root.classList.add('theming');
  themeTransition = document.startViewTransition(update);
  themeTransition.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: THEME_MS, easing: themeEase, pseudoElement: '::view-transition-new(root)' },
    );
  }).catch(() => {});
  themeTransition.finished.finally(() => { root.classList.remove('theming'); themeTransition = null; });
}

// Stagger each visible icon's re-ink by when the reveal edge reaches it.
function inkIcons(x, y, radius) {
  for (const art of $$('.tile:not([hidden]) .art')) {
    const b = art.getBoundingClientRect();
    if (b.bottom < 0 || b.top > innerHeight) continue; // offscreen icons just swap
    const d = Math.hypot(b.left + b.width / 2 - x, b.top + b.height / 2 - y);
    art.style.setProperty('--ink-delay', `${Math.round(timeForProgress(Math.min(d / radius, 1)) * THEME_MS)}ms`);
    art.classList.remove('ink'); void art.offsetWidth; art.classList.add('ink');
  }
  clearTimeout(inkIcons.t);
  inkIcons.t = setTimeout(() => { for (const a of $$('.art.ink')) a.classList.remove('ink'); }, THEME_MS + 700);
}

function syncVariantControls() {
  for (const b of $$('.bar .selector button')) b.setAttribute('aria-checked', String(b.dataset.variant === state.variant));
  // The whole app follows the icon variant: light icons on a light UI, dark icons on a dark UI.
  document.documentElement.dataset.theme = state.variant;
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = state.variant === 'light' ? '#f4f6f9' : '#090909';
}
function focusSearch() { const s = $('#search'); s.focus(); s.select(); }
function clearSearch() { $('#search').value = ''; state.query = ''; applyFilter(); }

// ---------- Events ----------
let setMenu;

function bindUI() {
  const search = $('#search');
  search.addEventListener('input', () => { state.query = search.value; applyFilter(); window.scrollTo({ top: 0 }); });
  search.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      const first = visibleTiles()[0];
      if (!first) return;
      select(first.dataset.slug);
      if (e.key === 'Enter') openPanel();
    }
  });
  $('#clear-search').addEventListener('click', () => { clearSearch(); search.focus(); });

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
    const a = e.target.closest('a[data-n]');
    if (!a) return;
    e.preventDefault();
    jumpToCategory(Number(a.dataset.n));
  });

  for (const b of $$('.bar .selector button')) b.addEventListener('click', () => switchTheme(b.dataset.variant, b));
  $('#help-btn').addEventListener('click', () => $('#help').showModal());
  $('#help [data-close]').addEventListener('click', () => $('#help').close());
  $('#help').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  const dl = $('#download-all'), menu = $('#download-menu');
  setMenu = (open) => { menu.hidden = !open; dl.setAttribute('aria-expanded', String(open)); if (open) $('a', menu).focus(); };
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
  for (const b of $$('#panel .act')) b.addEventListener('click', () => run(b.dataset.action));

  document.addEventListener('keydown', onKey);
}

function onKey(e) {
  const typing = e.target.matches('input, textarea, select');
  const help = $('#help');

  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); focusSearch(); return; }
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (help.open) return; // the dialog handles Esc itself

  if (e.key === 'Escape') {
    if (typing && e.target.id === 'search') {
      if (e.target.value) clearSearch();
      else e.target.blur();
      return;
    }
    if (state.panelOpen) return closePanel();
    if (state.query) clearSearch();
    return;
  }
  if (typing) return;
  if (!$('#download-menu').hidden) return;

  const key = e.key;
  if (/^[1-9]$/.test(key)) { e.preventDefault(); return jumpToCategory(Number(key)); }
  const toggle = () => switchTheme(other(state.variant));
  const map = {
    ArrowLeft: () => move('left'), ArrowRight: () => move('right'),
    ArrowUp: () => move('up'), ArrowDown: () => move('down'),
    '/': focusSearch,
    '?': () => help.showModal(),
    t: toggle, T: toggle, v: toggle, V: toggle,
    c: () => run('copy-svg'), C: () => run('copy-png'),
    d: () => run('download-svg'), D: () => setMenu(true),
    p: () => run('download-png'), P: () => run('download-png'),
    r: () => run('copy-jsx'), R: () => run('copy-jsx'),
    u: () => run('copy-url'), U: () => run('copy-url'),
    Enter: () => { if (!state.current) return false; openPanel(); },
  };
  const fn = map[key];
  if (!fn) return;
  // Let Enter on focused buttons and links do their normal thing
  if (key === 'Enter' && e.target.closest('button, a')) return;
  if (fn() !== false) e.preventDefault();
}

function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }

// ---------- Boot (last, so every helper above is initialised) ----------
const res = await fetch('icons.json');
state.data = await res.json();
state.data.icons.forEach((icon, i) => { icon.index = i + 1; state.bySlug.set(icon.slug, icon); });
$('#search').placeholder = `Search ${state.data.icons.length} icons`;

renderCategories();
renderGrid();
syncVariantControls();
bindUI();

const fromHash = decodeURIComponent(location.hash.slice(1));
if (state.bySlug.has(fromHash)) { select(fromHash); openPanel(); }
