# CWAL.gg Player Tracker

A Firefox browser extension for consistently tracking CWAL.gg players across account changes and deletions.

## Project Status

**Discontinued: functionality integrated into the main website.**

This browser extension was developed to provide CWAL.gg users with a consistent way to track players across account changes and deletions. It provided a simple, responsive interface for managing player alias lists, with aliases seamlessly integrated into the existing website UI.

Additional functionality included:

- Hiding match results for selected players
- Sharing custom player lists with other users
- A default list for tracking well-known players ("pros")

The functionality developed as part of this project has since been integrated directly into CWAL.gg by the website's developer. Development of the standalone extension has therefore been discontinued.

This repository is preserved as an archive of the extension's source code and as a record of the development work behind the project.

---

This archive contains the **source code** used to build the Firefox add-on published on AMO.

## 1) Build Environment

- OS: macOS 13+/14+, Ubuntu 22.04+, or Windows 10/11
- Node.js: **20.x LTS** (18.x LTS also works)
- npm: **10+**
- Tools:

  - macOS/Linux: `zip`
  - Windows: PowerShell 5+ (`Compress-Archive`)

- No network keys or secrets are required. All tools are open source.

## 2) Tooling

- **Vite** (Rollup + esbuild) — bundling and minification
- **TypeScript** — source development and compilation
- **PostCSS/Tailwind** — CSS processing, where applicable
- **webextension-polyfill** — cross-browser WebExtension API wrapper

## 3) Reproducible Build

> The commands below produce `dist/` and then package an uploadable `extension.zip` with `manifest.json` at the ZIP root.
