---
name: portalbelajar-deploy
description: >-
  Validate static assets, verify localhost:8081 and headless Chrome rendering, rebuild portalbelajar-kaplongan-deploy.zip, and prepare Cloudflare Pages deployment for Portal Belajar. Use after editing files in public/.
---

# Portal Belajar — Local Server & Cloudflare Pages Deploy Workflow

Use this procedure whenever frontend files in `public/` are modified.

## Pre-Deploy Checks

1. Verify JavaScript syntax across all core frontend scripts (requires Node.js):
   ```powershell
   & "C:\Program Files\nodejs\node.exe" --check public\colab-client.js
   & "C:\Program Files\nodejs\node.exe" --check public\migrate.js
   & "C:\Program Files\nodejs\node.exe" --check public\feature-panels.js
   ```
2. Confirm no obsolete Supabase CDN or `window.db` references exist:
   ```powershell
   Get-ChildItem -Recurse "public","src","colab" -File | Select-String -Pattern "window\.db|supabase-js|supabase-client"
   ```
3. Ensure local preview server (`serve.ps1 -Port 8081`) returns HTTP `200` for all pages:
   `/portal-belajar.html`, `/auth.html`, `/dashboard-guru.html`, `/dashboard-murid.html`, `/game-quiz.html`, `/colab-client.js`, `/migrate.js`, `/feature-panels.js`.
4. Verify headless Chrome DOM rendering without fatal load errors using `Start-Process ... -Wait`.

## Auto-Deploy to Cloudflare Pages via GitHub

When the repository is connected to GitHub and Cloudflare Pages (`portalbelajar-kaplongan`, build output directory: `public`):
```powershell
git add -A
git commit -m "Update Portal Belajar"
git push origin main
```

Cloudflare Pages automatically builds and publishes `public/` to `https://portalbelajar-kaplongan.pages.dev`.

## Manual Fallback ZIP Bundle

Only if Direct Upload is used without Git:

Rebuild the Cloudflare Pages bundle from `public/*`:
```powershell
Remove-Item -Force -ErrorAction SilentlyContinue "portalbelajar-kaplongan-deploy.zip"
Compress-Archive -Path "public\*" -DestinationPath "portalbelajar-kaplongan-deploy.zip" -Force
```

Upload `portalbelajar-kaplongan-deploy.zip` to Cloudflare Pages (`portalbelajar-kaplongan.pages.dev`).
