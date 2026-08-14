# Local installation guide — Windows development machine

This walks through getting the Calendar & Scheduling project running on your Windows PC for development and testing, matching the setup described in the original spec: build and test everything locally first, then deploy `apps/api` + `apps/web` to Hostnin Pro and point production at Supabase Cloud. Desktop/mobile builds are covered at the end.

Run the commands below in **PowerShell** (Start menu → search "PowerShell"). Anywhere you see `npm run ...`, run it from the project's root folder unless told otherwise.

---

## Step 1 — Install prerequisites

Install these once. Skip anything you already have.

1. **Node.js LTS (20.x recommended)** — download from [nodejs.org](https://nodejs.org) and run the installer, or via winget:
   ```powershell
   winget install OpenJS.NodeJS.LTS
   ```
   Verify: `node -v` should print `v20.x.x` (anything 18–22 works per the spec).

2. **Git** — [git-scm.com](https://git-scm.com/download/win) or:
   ```powershell
   winget install Git.Git
   ```

3. **VS Code** — [code.visualstudio.com](https://code.visualstudio.com) or:
   ```powershell
   winget install Microsoft.VisualStudioCode
   ```

4. **Docker Desktop** — required only so the Supabase CLI can run a local Postgres/Auth/Storage stack for development. [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) or:
   ```powershell
   winget install Docker.DockerDesktop
   ```
   After installing, **launch Docker Desktop once** and let it finish starting (whale icon steady in the system tray) before continuing to Step 3.

5. **Supabase CLI**:
   ```powershell
   winget install Supabase.CLI
   ```
   Verify: `supabase --version`. (If winget doesn't have it on your machine, install via `scoop install supabase` or download the `.exe` from the [Supabase CLI releases page](https://github.com/supabase/cli/releases) and add it to your PATH.)

You do **not** need to install Postgres, Redis, or Docker separately for anything other than the Supabase CLI's local stack — everything else runs through plain `npm` scripts.

---

## Step 2 — Get the project onto your machine

If you're starting from the zip I sent you:

```powershell
cd $HOME\Documents
Expand-Archive -Path "$HOME\Downloads\calendar-scheduling-app.zip" -DestinationPath .
cd calendar-app
```

Then put it on GitHub so you have the history and can deploy from it later (matches the spec's local → GitHub → Hostnin workflow):

```powershell
git remote add origin https://github.com/<your-username>/calendar-scheduling-app.git
git branch -M main
git push -u origin main
```

(The repo already has an initial commit and a `.gitignore` that excludes `node_modules` and every `.env` file, so nothing sensitive gets pushed.)

If you'll be pulling fresh from GitHub instead: `git clone https://github.com/<your-username>/calendar-scheduling-app.git`, then `cd calendar-scheduling-app`.

Open the folder in VS Code: `code .`

---

## Step 3 — Install JavaScript dependencies

From the project root (the folder containing the top-level `package.json`):

```powershell
npm install
```

This installs dependencies for every workspace (`apps/api`, `apps/web`, `packages/shared`, `apps/desktop`) in one go. It can take a few minutes the first time.

> **Mobile app note**: `apps/mobile` (Expo/React Native) is *not* installed by the root `npm install` — its dependencies are large and only needed if you're actively working on the mobile app. See Step 9.

---

## Step 4 — Start local Supabase

With Docker Desktop running:

```powershell
supabase start
```

First run downloads several Docker images (a few minutes). When it finishes, it prints something like:

```
API URL: http://127.0.0.1:54321
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
anon key: eyJhbGciOi...
service_role key: eyJhbGciOi...
```

**Keep this output visible** — you'll copy the `API URL`, `anon key`, and `service_role key` into your `.env` files in the next step. This also automatically runs every migration in `supabase/migrations/`, so your local database already has the full schema, RLS policies, and functions.

If you ever need to re-run migrations from scratch (e.g. after editing a migration file): `supabase db reset`.

Open **Supabase Studio** at `http://127.0.0.1:54323` in your browser — this is your local admin UI for the database, useful for inspecting tables and creating your first user (Step 6).

---

## Step 5 — Configure environment variables

Copy each `.env.example` to `.env` and fill in the values from Step 4's output.

```powershell
Copy-Item apps\api\.env.example apps\api\.env
Copy-Item apps\web\.env.example apps\web\.env
```

Edit **`apps\api\.env`** in VS Code:

```
NODE_ENV=development
PORT=4000
APP_URL=http://localhost:5173
API_URL=http://localhost:4000

SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=<paste the anon key from `supabase start` output>
SUPABASE_SERVICE_ROLE_KEY=<paste the service_role key from `supabase start` output>

# Leave EMAIL_* and TELEGRAM_BOT_TOKEN blank for now — the app degrades
# gracefully (it logs a warning instead of sending) until you configure them.

CRON_SECRET=<any long random string, e.g. run: -join ((48..57)+(97..122)|Get-Random -Count 40|%{[char]$_})>
CORS_ORIGINS=http://localhost:5173
```

Edit **`apps\web\.env`**:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<same anon key as above>
VITE_API_URL=http://localhost:4000
```

To generate a random `CRON_SECRET` in PowerShell:
```powershell
-join ((48..57)+(97..122) | Get-Random -Count 40 | ForEach-Object {[char]$_})
```

---

## Step 6 — Create your first administrator account

1. Open Supabase Studio → `http://127.0.0.1:54323` → **Authentication** → **Add user** → **Create new user**. Enter your email and a password, and check "Auto Confirm User".
2. Go to **SQL Editor** and run:
   ```sql
   update public.profiles set role = 'ADMIN' where email = 'you@example.com';
   update public.user_access set license_status = 'ACTIVE', activated_at = now()
     where user_id = (select id from public.profiles where email = 'you@example.com');
   ```
   (The second statement matters because that profile was created *before* being promoted to admin, so its trial defaults still apply — this makes sure your admin account has full, permanent access.)

---

## Step 7 — Run the app

Open **two** PowerShell terminals in the project root (VS Code's integrated terminal supports multiple tabs — the `+` icon).

**Terminal 1 — API:**
```powershell
npm run dev:api
```
Should print `API listening on port 4000 (development)`.

**Terminal 2 — Web app:**
```powershell
npm run dev:web
```
Should print a local URL, typically `http://localhost:5173`.

Open `http://localhost:5173` in your browser and sign in with the admin account from Step 6.

---

## Step 8 — Verify it's working

Quick checks, in order:

1. `http://localhost:4000/health` in a browser → `{"status":"ok",...}`.
2. Sign in at `http://localhost:5173` with your admin credentials.
3. Admin Dashboard → Users & Clients → **Create User** → make a test client. Check Terminal 1's logs — since email isn't configured yet, you'll see a warning logged instead of an actual send (that's expected and fine for local testing).
4. Calendar page → create an event, drag it around, switch views.
5. See `docs/testing.md` in the repo for the full manual smoke-test checklist (meetings, tasks, reminders, admin lock/unlock, etc.).

If something doesn't load, check both terminal windows for errors first — almost every issue at this stage traces back to a missing/mismatched value in one of the two `.env` files from Step 5.

---

## Step 9 — Optional: desktop and mobile

You don't need these to build/test the core app — add them only when you're ready to work on those clients specifically.

**Desktop (Tauri, Windows installer):**
```powershell
winget install Rustlang.Rustup
rustup-init.exe   # accept defaults if prompted
```
Also install the **"Desktop development with C++"** workload via [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Tauri needs a C++ toolchain to compile on Windows). Then:
```powershell
npm run dev:desktop
```
This opens the same web app in a native window. See `apps/desktop/README.md` for producing an installable `.msi`/`.exe`.

**Mobile (Expo, Android/iOS):**
```powershell
cd apps\mobile
Copy-Item .env.example .env    # then fill in EXPO_PUBLIC_* the same way as Step 5
npm install
npm run start
```
Scan the QR code with the **Expo Go** app on your phone. Since your phone isn't `localhost`, set `EXPO_PUBLIC_API_URL` in `apps\mobile\.env` to your PC's LAN IP instead (find it with `ipconfig`, e.g. `http://192.168.1.20:4000`), and make sure your phone is on the same Wi-Fi network. See `apps/mobile/README.md` for details.

---

## Step 10 — When you're ready for production

Local development uses local Supabase + `localhost` URLs everywhere, exactly as set up above. When you're ready to go live, follow `docs/deployment.md` in the repo — it walks through creating a **separate** Supabase Cloud project (production data never touches your local Supabase) and deploying `apps/api`/`apps/web` to Hostnin Pro, including how to wire up the scheduled notification jobs. Nothing about this local setup needs to change to get there — you're just pointing a production build at different environment variables.

---

### Quick reference — everyday commands once set up

```powershell
supabase start         # start local Supabase (after a PC restart, Docker Desktop must be running first)
npm run dev:api          # start the API on :4000
npm run dev:web           # start the web app on :5173
supabase stop             # stop local Supabase when you're done for the day
```
