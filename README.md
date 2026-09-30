# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Hero V2 (editorial experiment)

`src/sections/HeroV2.tsx` sits beside the original `Hero.tsx`. In dev (or any build opened with `?hero=v1|v2`) a small switch at the bottom of the page toggles between them; the choice is remembered per browser.

The portrait plates in `src/assets/hero-v2/` are generated from `public/artist.png` by `scripts/process-artist.py` (cutout + neutral monochrome, run offline in a Python env with `rembg[cpu]`):

```bash
python scripts/process-artist.py public/artist.png src/assets/hero-v2
```

- `artist-print.webp`: the rest plate: soft, lower local contrast, still deep blacks
- `artist-develop.webp`: the reveal plate, shown inside the cursor loupe (sharper, clarity, micro-detail). It renders above the type planes, so the loupe cuts through the printed letters too. Replace it with the real tattoo layer (same size and registration) when it exists; no code changes needed.
