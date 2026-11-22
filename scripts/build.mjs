// Builds the static site data from icons/: public/icons.json, public/icons/{light,dark}/*.svg, public/downloads/*.zip
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const pub = path.join(root, 'public');
const { colors, icons } = JSON.parse(fs.readFileSync(path.join(root, 'icons/meta.json'), 'utf8'));

fs.rmSync(path.join(pub, 'icons'), { recursive: true, force: true });
fs.rmSync(path.join(pub, 'downloads'), { recursive: true, force: true });
fs.mkdirSync(path.join(pub, 'downloads'), { recursive: true });

const data = { name: 'Runbeta Icons', version: new Date().toISOString().slice(0, 10), colors, categories: [], icons: [] };
const seen = new Set();
for (const icon of icons) {
  if (!seen.has(icon.category)) {
    seen.add(icon.category);
    data.categories.push({ id: icon.category, label: icon.categoryLabel });
  }
  const svg = {};
  for (const mode of ['light', 'dark']) {
    const src = path.join(root, 'icons', mode, `${icon.slug}.svg`);
    svg[mode] = fs.readFileSync(src, 'utf8').trim();
    fs.mkdirSync(path.join(pub, 'icons', mode), { recursive: true });
    fs.copyFileSync(src, path.join(pub, 'icons', mode, `${icon.slug}.svg`));
  }
  data.icons.push({ slug: icon.slug, label: icon.label, category: icon.category, figma: icon.figma.number, svg });
}
fs.writeFileSync(path.join(pub, 'icons.json'), JSON.stringify(data));

// Download-all bundles
const zip = (name, ...dirs) => execFileSync('zip', ['-qr', path.join(pub, 'downloads', name), ...dirs], { cwd: path.join(pub, 'icons') });
zip('runbeta-icons.zip', 'light', 'dark');
zip('runbeta-icons-light.zip', 'light');
zip('runbeta-icons-dark.zip', 'dark');

console.log(`Built ${data.icons.length} icons in ${data.categories.length} categories`);
