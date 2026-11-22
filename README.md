# Icon Set

Hand-drawn Runbeta service icons (46 icons × light & dark), with a keyboard-first website for browsing, copying and downloading them.

Source design: Figma → Gojaye **Runbeta** file → page **special icons** (`node 4821:24454`).
- Light set: section `4821:24455`  ·  Dark set: section `4821:24762`
- Light colours `#062B5C` / `#CDD5DE` · Dark colours `#72A4E5` / `#222B35`

## Run it

```bash
npm run dev        # build + serve at http://localhost:4321
```

No dependencies — plain HTML/CSS/JS. `public/` is a static site and can be deployed as-is (Vercel, Netlify, GitHub Pages).

## Layout

```
icons/light/*.svg     ← the icons (source of truth)
icons/dark/*.svg
icons/meta.json       ← names, categories, Figma node ids
scripts/import-figma.mjs  ← rebuilds icons/ from scripts/figma-export.json
scripts/build.mjs     ← generates public/icons.json, public/icons/, public/downloads/*.zip
scripts/serve.mjs     ← local static server
public/               ← the website
```

### Adding or editing an icon
1. Drop `my-icon.svg` into both `icons/light/` and `icons/dark/` (32×32 viewBox).
2. Add an entry to `icons/meta.json`.
3. `npm run build`.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` or `⌘K` | Search |
| Arrow keys | Move between icons |
| `Enter` | Open details |
| `1`–`6` | Jump to category |
| `C` | Copy SVG |
| `⇧C` | Copy PNG image |
| `D` | Download SVG |
| `P` | Download PNG (size from panel, default 128px) |
| `R` | Copy React component |
| `U` | Copy file URL |
| `T` | Toggle light/dark site |
| `V` | Cycle icon variant (auto → light → dark) |
| `⇧D` | Download all (.zip) |
| `?` | Shortcut list |
| `Esc` | Close / clear search |
