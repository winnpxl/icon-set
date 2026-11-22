// One-time (re-runnable) import: turns the raw Figma export into clean, named SVG files.
// Inputs:  scripts/manifest.json      [category-id, category-label, figma-number, label, lightNodeId, darkNodeId]
//          scripts/figma-export.json  { nodeId: "<svg…>" } exported from Figma
// Output:  icons/light/<slug>.svg, icons/dark/<slug>.svg, icons/meta.json
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts/manifest.json'), 'utf8'));
const exported = JSON.parse(fs.readFileSync(path.join(root, 'scripts/figma-export.json'), 'utf8'));

const LIGHT = { stroke: '#062B5C', fill: '#CDD5DE' };
const DARK = { stroke: '#72A4E5', fill: '#222B35' };

const slugify = (s) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[\/]+/g, ' ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// Make internal ids (clip paths, masks) unique per file so many icons can be inlined on one page.
const scopeIds = (svg, scope) => svg.replace(/_4821_\d+/g, `_${scope}`);
const toDark = (svg) => svg.replaceAll(LIGHT.stroke, DARK.stroke).replaceAll(LIGHT.fill, DARK.fill);

for (const mode of ['light', 'dark']) fs.mkdirSync(path.join(root, 'icons', mode), { recursive: true });

const used = new Map();
const meta = [];
for (const [category, categoryLabel, number, rawLabel, lightId, darkId] of manifest) {
  const label = rawLabel.trim();
  let slug = slugify(label);
  // Figma has two icons labelled "Home Cleaning" (#23 broom, #29 house). Keep both, disambiguate the slug.
  if (used.has(slug)) slug = `${slug}-${number}`;
  used.set(slug, true);

  const light = exported[lightId];
  if (!light) throw new Error(`Missing light export for ${label} (${lightId})`);
  const dark = exported[darkId] ?? toDark(light); // dark export only kept where it differs from a colour swap

  fs.writeFileSync(path.join(root, 'icons/light', `${slug}.svg`), scopeIds(light, `${slug}-light`) + '\n');
  fs.writeFileSync(path.join(root, 'icons/dark', `${slug}.svg`), scopeIds(dark, `${slug}-dark`) + '\n');
  meta.push({ slug, label, category, categoryLabel, figma: { number, light: lightId, dark: darkId } });
}

fs.writeFileSync(path.join(root, 'icons/meta.json'), JSON.stringify({ colors: { light: LIGHT, dark: DARK }, icons: meta }, null, 2) + '\n');
console.log(`Imported ${meta.length} icons × 2 modes`);
