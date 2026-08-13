# Desktop App (Windows / macOS) — Tauri

This is a thin native shell (built with [Tauri](https://v2.tauri.app)) around the exact same React web app in `apps/web`. There is no separate desktop UI codebase to maintain — Tauri just opens `apps/web` in a native, secure webview and packages it as an installable `.exe`/`.msi` (Windows) or `.dmg`/`.app` (macOS). This satisfies the architecture requirement that web, desktop, and mobile share the same business logic and API client (`packages/shared`).

The desktop app talks to the same backend API (`apps/api`) as the web app — set `VITE_API_URL` / `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` in `apps/web/.env` (or `.env.production` when building for release) exactly as you would for the web deployment. **The desktop app is built and distributed to end users' machines — it is never deployed to Hostnin.** Only `apps/api` and the static `apps/web` build run on Hostnin.

## Prerequisites (local Windows/macOS dev machine only)

1. Rust (via [rustup](https://rustup.rs)) — Tauri compiles a small native binary.
2. Platform build tools:
   - Windows: "Desktop development with C++" workload from Visual Studio Build Tools, plus WebView2 (pre-installed on Windows 10/11).
   - macOS: Xcode Command Line Tools (`xcode-select --install`).
3. Node.js 18/20/22 (already required for the rest of the monorepo).

None of this is required on the Hostnin server — it is strictly a local packaging step to produce installers you hand out to users.

## Develop

```bash
npm install
npm run dev:desktop
```

This runs `apps/web`'s Vite dev server and opens it inside a native window with hot reload.

## Build installers

```bash
npm run tauri:build --workspace=apps/desktop
```

Produces installers under `apps/desktop/src-tauri/target/release/bundle/` (`nsis`/`msi` for Windows, `dmg`/`app` for macOS — cross-compiling macOS installers requires building on a Mac).

## Icons

Placeholder icons are already generated under `src-tauri/icons/`. To replace them with your own brand, run:

```bash
npx tauri icon path/to/your-logo-1024x1024.png
```

from `apps/desktop`, then rebuild.

## Layout reference (for future UI polish)

Per the product spec, larger desktop screens should favor a persistent left sidebar (Calendar, Meetings, Tasks, Team, Notes, Notifications, Settings) with a top bar for Search / Create / Notifications / Profile — this is exactly what `apps/web`'s `AppLayout` already renders, so no extra desktop-specific layout work is required; it simply has more room to breathe at desktop widths.
