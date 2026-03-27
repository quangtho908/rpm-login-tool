# Chrome Profile Tool (Electron)

Local desktop app to:
- Create clean Chrome profiles (separate `user-data-dir` per profile)
- Launch/close Chrome per profile
- Manage proxies + check proxy connectivity
- Store TOTP (2FA) secrets **encrypted via Electron `safeStorage`** and generate codes

> Important: This project is intended for legitimate uses (QA/testing, managing your own accounts/systems). Avoid using it to violate third‑party platforms’ Terms of Service.

## Requirements
- Node.js 18+ (recommended 20+)
- Either:
  - Google Chrome / Chromium installed, **or**
  - Use the built-in **Download & Install Chromium** button in Settings (downloads open-source Chromium build)

## Install

```bash
cd chrome-profile-tool
npm install
```

## Dev

```bash
cd chrome-profile-tool
npm run dev
```

If your environment has `ELECTRON_RUN_AS_NODE=1` set globally, Electron will start in “Node mode” and `app` will be undefined.
This project’s `npm run dev` script automatically **removes** that env var before launching.

## Build

```bash
cd chrome-profile-tool
npm run build
```

## Start (run built app)

```bash
cd chrome-profile-tool
npm run start
```

## Data locations
All runtime data is stored under Electron `app.getPath('userData')`:
- `app.sqlite` (SQLite database)
- `profiles/` (Chrome `user-data-dir` folders)

## Notes / Limitations
- The Settings button **Download & Install Chromium** uses `@puppeteer/browsers` to download **Chromium** (not Google Chrome) into the app cache and sets `chromePath` automatically.
- Some media codecs (e.g., proprietary H.264/AAC) may be missing in Chromium builds depending on OS/build.
- Proxy auth (username/password) for Chrome launch via CLI is limited; for now it is fully supported for **Check proxy**, but Chrome launch uses only host:port.
- This is an MVP skeleton; next steps are: template profiles, profile import/export, job queue, Playwright automation, better UI.
