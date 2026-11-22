// Runbeta Icons — keyboard-first icon library. No dependencies.
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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

// Route colours for the category tickets (cyan / violet / pink light fields, varied per card).
const ROUTE_LIGHT = {
  fashion: ['#ff7ac0', '#af50ff', '#ffb38a'],
  entertainment: ['#5ee1ff', '#3d5bff', '#af50ff'],
  caregivers: ['#d4a0ff', '#fa9e98', '#6c4bd6'],
  beauty: ['#ff5fa8', '#fa9e98', '#af50ff'],
  cleaning: ['#5ee1ff', '#d4a0ff', '#2f7bff'],
  'home-repairs': ['#7b4bff', '#2864d2', '#ff6fb1'],
};

// Departure board rows: key, capability, action.
const FLAPS = [
  { key: '/', word: 'Search', run: () => focusSearch() },
  { key: 'C', word: 'Copy SVG', run: () => run('copy-svg', { ensure: true }) },
  { key: 'P', word: 'Export PNG', run: () => run('download-png', { ensure: true }) },
  { key: 'R', word: 'React code', run: () => run('copy-jsx', { ensure: true }) },
  { key: 'V', word: 'Light / Dark', run: () => setVariant(other(state.variant)) },
  { key: '⇧D', word: 'Take them all', run: () => openDownloadMenu() },
];

const other = (v) => (v === 'light' ? 'dark' : 'light');
const exportVariant = () => (state.panelOpen ? state.panelVariant : state.variant);

// Each inline SVG gets unique ids so clip paths and masks never collide across copies.
let instanceId = 0;
function inst(svg) {
  const n = ++instanceId;
  return svg
    .replace(/\bid="([^"]+)"/g, (_, id) => `id="${id}-${n}"`)
    .replace(/url\(#([^)]+)\)/g, (_, id) => `url(#${id}-${n})`)
    .replace(/href="#([^"]+)"/g, (_, id) => `href="#${id}-${n}"`);
}

// ---------- Boot ----------
const res = await fetch('icons.json');
state.data = await res.json();
state.data.icons.forEach((icon, i) => { icon.index = i + 1; state.bySlug.set(icon.slug, icon); });
for (const el of $$('[data-count]')) el.textContent = state.data.icons.length;
$('#search').placeholder = `Search ${state.data.icons.length} icons`;

renderGrid();
renderRail();
renderBoard();
renderFooter();
renderPassCode();
startNowBoarding();
syncVariantControls();
bindUI();

const fromHash = decodeURIComponent(location.hash.slice(1));
if (state.bySlug.has(fromHash)) {
  select(fromHash, { focus: true });
  openPanel();
}

// ---------- Rendering ----------
function renderGrid() {
  const v = state.variant;
  $('#grid').className = `grid-wrap variant-${v}`;
  $('#grid').innerHTML = state.data.categories.map((c, ci) => {
    const icons = state.data.icons.filter((i) => i.category === c.id);
    return `<section class="section" id="cat-${c.id}" data-cat="${c.id}">
      <header class="section-head"><span class="idx">${String(ci + 1).padStart(2, '0')}</span><h3>${c.label}</h3><span class="n">${icons.length}</span></header>
      <div class="grid">${icons.map((i) => `
        <button class="tile" data-slug="${i.slug}" tabindex="-1" title="${escapeHtml(i.label)}">
          <span class="art">${inst(i.svg[v])}</span>
          <span class="name">${escapeHtml(i.label)}</span>
        </button>`).join('')}
      </div>
    </section>`;
  }).join('');
  applyFilter();
  if (state.current) markCurrent(state.current);
}

function refreshArt() {
  const v = state.variant;
  $('#grid').className = `grid-wrap variant-${v}`;
  for (const tile of $$('.tile')) $('.art', tile).innerHTML = inst(state.bySlug.get(tile.dataset.slug).svg[v]);
}

function renderRail() {
  $('#rail').innerHTML = state.data.categories.map((c, i) => {
    const icons = state.data.icons.filter((x) => x.category === c.id);
    const [a, b, d] = ROUTE_LIGHT[c.id] || ROUTE_LIGHT.cleaning;
    return `<button class="route" data-cat="${c.id}" style="--a:${a};--b:${b};--c:${d}" aria-label="${escapeHtml(c.label)}, ${icons.length} icons">
      <span class="route-label">Route ${String(i + 1).padStart(2, '0')} · ${icons.length} icons</span>
      <span class="route-icons">${icons.slice(0, 4).map((x) => `<span>${inst(x.svg.light)}</span>`).join('')}</span>
      <span class="route-foot">
        <span class="route-num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <span class="route-title">${escapeHtml(c.label)}</span>
        <svg viewBox="0 0 24 22" aria-hidden="true"><path d="M1 11h21m0 0-8-8m8 8-8 8"/></svg>
      </span>
    </button>`;
  }).join('');
}

function renderBoard() {
  $('#flaps').innerHTML = FLAPS.map((f, i) => `
    <li class="flap">
      <button class="flap-btn" data-flap="${i}" aria-label="${f.key} — ${f.word}">
        <span class="flap-key">${f.key}</span>
        <span class="flap-word" aria-hidden="true"><span class="half top">${f.word}</span><span class="half bot">${f.word}</span></span>
        <svg class="flap-arrow" viewBox="0 0 40 34" aria-hidden="true"><path d="M2 17h34m0 0L22 3m14 14L22 31"/></svg>
      </button>
    </li>`).join('');

  if (reduceMotion || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      const i = Number($('.flap-btn', e.target).dataset.flap);
      setTimeout(() => flipRow(e.target, FLAPS[i].word), i * 120);
    }
  }, { threshold: 0.6 });
  for (const row of $$('.flap')) io.observe(row);
}

// Split-flap settle: each character cycles through glyphs, then locks in left to right.
function flipRow(row, word) {
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/';
  const halves = $$('.half', row);
  const target = word.toUpperCase();
  let frame = 0;
  const tick = () => {
    let done = true;
    const out = [...target].map((ch, i) => {
      if (ch === ' ' || frame >= 4 + i * 2) return ch;
      done = false;
      return glyphs[(Math.random() * glyphs.length) | 0];
    }).join('');
    for (const h of halves) h.textContent = out;
    frame++;
    if (!done) setTimeout(tick, 45);
    else for (const h of halves) h.textContent = word;
  };
  tick();
}

function renderFooter() {
  $('#footer-cats').innerHTML = state.data.categories
    .map((c, i) => `<li><a href="#cat-${c.id}" data-jump="${i + 1}">${c.label}</a></li>`).join('');
}

// Decorative code strip on the hero pass, derived from the icon names (no random noise).
function renderPassCode() {
  const seed = state.data.icons.map((i) => i.slug).join('');
  const bars = [];
  for (let i = 0; i < 64; i++) {
    const c = seed.charCodeAt((i * 7) % seed.length);
    bars.push(`<i style="height:${1 + (c % 4)}px;${c % 5 === 0 ? 'width:60%' : ''}"></i>`);
  }
  $('#pass-code').innerHTML = bars.join('');
}

function renderTicketCode(slug) {
  const bars = [];
  for (let i = 0; i < 46; i++) {
    const c = slug.charCodeAt(i % slug.length) + i;
    bars.push(`<i style="width:${1 + (c % 3)}px;margin-right:${c % 2 ? 2 : 3}px"></i>`);
  }
  $('#p-barcode').innerHTML = bars.join('');
}

let nowSlug = null;
function startNowBoarding() {
  const icons = state.data.icons;
  let i = 0;
  const show = () => {
    const icon = icons[i % icons.length];
    nowSlug = icon.slug;
    $('#now-boarding .now-art').innerHTML = inst(icon.svg.dark);
    $('#now-boarding .now-name').textContent = icon.label;
    i += 7; // step through the set so consecutive icons come from different routes
  };
  show();
  if (!reduceMotion) setInterval(() => { if (!document.hidden) show(); }, 2800);
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
  const total = state.data.icons.length;
  $('#count').textContent = terms.length ? `${shown}/${total}` : `${total}`;
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
    if (on) t.setAttribute('aria-current', 'true');
    else t.removeAttribute('aria-current');
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
  if (!cur) { $('#browser').scrollIntoView({ block: 'start' }); return select(tiles[0].dataset.slug); }
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
  select(first.dataset.slug, { focus: false });
  first.focus({ preventScroll: true });
}

function ensureSelection() {
  if (state.current && tileFor(state.current) && !tileFor(state.current).hidden) return true;
  const first = visibleTiles()[0];
  if (!first) return false;
  select(first.dataset.slug, { focus: false });
  return true;
}

// ---------- Boarding pass panel ----------
function openPanel() {
  if (!state.current) return;
  state.panelOpen = true;
  state.panelVariant = state.variant;
  $('#panel').hidden = false;
  $('#scrim').hidden = !matchMedia('(max-width: 767px)').matches;
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
  $('#p-cat').textContent = `Route ${String(state.data.categories.indexOf(cat) + 1).padStart(2, '0')} · ${cat.label}`;
  $('#p-name').textContent = icon.label;
  $('#p-index').textContent = `${String(icon.index).padStart(2, '0')} / ${state.data.icons.length}`;
  $('#p-slug').textContent = `${icon.slug}.svg`;
  $('#p-figma').textContent = `#${icon.figma ?? '—'}`;
  $('#pv-light').innerHTML = inst(icon.svg.light);
  $('#pv-dark').innerHTML = inst(icon.svg.dark);
  for (const b of $$('#p-variant button')) b.setAttribute('aria-checked', String(b.dataset.v === state.panelVariant));
  for (const b of $$('.tabs button')) b.setAttribute('aria-selected', String(b.dataset.tab === state.tab));
  $('#p-code').textContent = sourceFor(icon, state.panelVariant, state.tab);
  renderTicketCode(icon.slug);
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
  catch { toast('Clipboard blocked — open Source in the pass'); }
}

const pngSize = () => Number($('#p-size').value);

async function run(action, { ensure = false } = {}) {
  if (ensure && !state.current && ensureSelection()) toast(`Selected ${state.bySlug.get(state.current).label}`);
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
  toastTimer = setTimeout(() => el.classList.remove('show'), 1900);
}

// ---------- Variant ----------
function setVariant(v) {
  state.variant = v;
  store.set('variant', v);
  syncVariantControls();
  refreshArt();
  if (state.panelOpen) { state.panelVariant = v; fillPanel(); }
  toast(`${v === 'light' ? 'Light' : 'Dark'} icons`);
}
function syncVariantControls() {
  for (const b of $$('.toolbar .selector button')) b.setAttribute('aria-checked', String(b.dataset.variant === state.variant));
}

function focusSearch() {
  const s = $('#search');
  $('#browser').scrollIntoView({ block: 'start' });
  s.focus({ preventScroll: true });
  s.select();
}
function clearSearch() { $('#search').value = ''; state.query = ''; applyFilter(); }

// ---------- Events ----------
let setMenu;
function openDownloadMenu() { setMenu(true); }

function bindUI() {
  const search = $('#search');
  search.addEventListener('input', () => { state.query = search.value; applyFilter(); });
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

  // Category tickets + footer route links
  $('#rail').addEventListener('click', (e) => {
    const card = e.target.closest('.route');
    if (card) jumpToCategory(state.data.categories.findIndex((c) => c.id === card.dataset.cat) + 1);
  });
  for (const b of $$('.rail-btn')) b.addEventListener('click', () => $('#rail').scrollBy({ left: Number(b.dataset.dir) * 447, behavior: reduceMotion ? 'auto' : 'smooth' }));
  $('#footer-cats').addEventListener('click', (e) => {
    const a = e.target.closest('a[data-jump]');
    if (!a) return;
    e.preventDefault();
    jumpToCategory(Number(a.dataset.jump));
  });

  // Departure board rows
  $('#flaps').addEventListener('click', (e) => {
    const b = e.target.closest('.flap-btn');
    if (b) FLAPS[Number(b.dataset.flap)].run();
  });

  // Hero
  $('#ring-search').addEventListener('click', focusSearch);
  $('#nav-search').addEventListener('click', focusSearch);
  $('#now-boarding').addEventListener('click', () => {
    if (!nowSlug) return;
    if (state.query) clearSearch();
    $('#browser').scrollIntoView({ block: 'start' });
    select(nowSlug);
    openPanel();
  });

  for (const b of $$('.toolbar .selector button')) b.addEventListener('click', () => setVariant(b.dataset.variant));
  $('#footer-help').addEventListener('click', () => $('#help').showModal());
  $('#help [data-close]').addEventListener('click', () => $('#help').close());
  $('#help').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  const dl = $('#download-all'), menu = $('#download-menu');
  setMenu = (open) => { menu.hidden = !open; dl.setAttribute('aria-expanded', String(open)); if (open) $('a', menu).focus(); };
  dl.addEventListener('click', (e) => { e.stopPropagation(); setMenu(menu.hidden); });
  document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target) && e.target !== dl) setMenu(false); });
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

  // Nav gains a solid backing once the cloud stage has scrolled away
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('solid', scrollY > innerHeight * 0.6);
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

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
  const map = {
    ArrowLeft: () => move('left'), ArrowRight: () => move('right'),
    ArrowUp: () => move('up'), ArrowDown: () => move('down'),
    '/': focusSearch,
    '?': () => help.showModal(),
    t: () => setVariant(other(state.variant)), T: () => setVariant(other(state.variant)),
    v: () => setVariant(other(state.variant)), V: () => setVariant(other(state.variant)),
    c: () => run('copy-svg'), C: () => run('copy-png'),
    d: () => run('download-svg'), D: () => openDownloadMenu(),
    p: () => run('download-png'), P: () => run('download-png'),
    r: () => run('copy-jsx'), R: () => run('copy-jsx'),
    u: () => run('copy-url'), U: () => run('copy-url'),
    Enter: () => { if (!state.current) return false; openPanel(); },
  };
  const fn = map[key];
  if (!fn) return;
  // Let Enter/Space on focused buttons and links do their normal thing
  if (key === 'Enter' && e.target.closest('button, a')) return;
  // Arrow keys only drive the grid once you're in it (a focused tile or an open pass); elsewhere they scroll the page.
  if (key.startsWith('Arrow') && !e.target.closest('.tile') && !state.panelOpen) return;
  if (fn() !== false) e.preventDefault();
}

function escapeHtml(s) { return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]); }
