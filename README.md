# CWAL.gg Player Tracker — Source & Reproducible Build

This archive contains the **source code** used to build the Firefox add-on published on AMO.

## 1) Build environment

- OS: macOS 13+/14+, Ubuntu 22.04+, or Windows 10/11
- Node.js: **20.x LTS** (18.x LTS also works)
- npm: **10+**
- Tools:
  - macOS/Linux: `zip`
  - Windows: PowerShell 5+ (`Compress-Archive`)
- No network keys or secrets required. All tools are open source.

## 2) Tooling

- **Vite** (Rollup + esbuild) — bundling & minification
- **TypeScript** — TS → JS transpilation
- (If present) **PostCSS/Tailwind** — CSS processing
- **webextension-polyfill** — browser API wrapper

## 3) Reproducible build steps

> The commands below produce `dist/` and then package an uploadable `extension.zip` where `manifest.json` is at the **zip root**.

### macOS / Linux

```bash
# From the project root (this folder)
node -v   # should show 18/20 LTS
npm -v

# Clean previous outputs (optional)
rm -rf dist extension.zip

# Install exact dependency versions from the lockfile
npm ci

# Build
# If package.json already defines "build", use it:
npm run build

# If not, run the two Vite builds explicitly:
# npx vite build --config vite.content.config.ts
# npx vite build --config vite.popup.config.ts

# Package: zip the **contents** of dist (manifest.json at zip root)
( cd dist && zip -r ../extension.zip . )

# The file to upload as the add-on package:
#   extension.zip
```
