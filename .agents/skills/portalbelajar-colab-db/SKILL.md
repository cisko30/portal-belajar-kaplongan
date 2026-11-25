---
name: portalbelajar-colab-db
description: >-
  Run, connect, test, and troubleshoot the Google Colab SQLite + Google Drive backend for Portal Belajar SMA NU Kaplongan. Use when setting up Colab database tunnels, verifying /api/health or /api/migrate, or fixing sync issues between frontend and Colab.
---

# Portal Belajar — Google Colab SQLite Database Workflow

This skill covers managing and verifying the Google Colab SQLite backend used by `portalbelajar-kaplongan.pages.dev` and `http://localhost:8081/`.

## Key Files

- [colab_server.py](../../colab/colab_server.py) — FastAPI + SQLite + Google Drive upload server.
- [portalbelajar_colab_database.ipynb](../../colab/portalbelajar_colab_database.ipynb) — Google Colab notebook mounting `/content/drive` and starting `cloudflared`.
- [colab-client.js](../../public/colab-client.js) — Browser client (`window.colabDb`) supporting `?colab=https://...` auto-configuration.
- [migrate.js](../../public/migrate.js) — Migrates `localStorage` catalog, accounts, submissions, attendance, and topics to Colab.

## Connection & Verification Steps

1. Start Google Colab notebook (`portalbelajar_colab_database.ipynb`) with `colab_server.py` uploaded in `/content/`.
2. Capture the generated `https://<subdomain>.trycloudflare.com` tunnel URL.
3. Verify health, CORS, and teacher auth:
   ```powershell
   $colab = "https://<subdomain>.trycloudflare.com"
   Invoke-RestMethod "$colab/api/health"
   Invoke-RestMethod -Uri "$colab/api/teacher-login" -Method Post -ContentType "application/json" -Body '{"password":"guru-kaplongan"}'
   ```
4. Connect any browser in 1 click using:
   `https://portalbelajar-kaplongan.pages.dev/?colab=https://<subdomain>.trycloudflare.com`
   or locally:
   `http://localhost:8081/?colab=https://<subdomain>.trycloudflare.com`
5. If Colab DB starts empty (`counts.materi == 0`), open Dashboard Guru → **Cloud & Sync / Pengaturan** → click **Migrasi Data Lokal ke Colab**.

## Safety Rules

- Never hardcode or commit secret passphrases; keep `GURU_UPLOAD_PASSPHRASE` and `ADMIN_PASSWORD` configurable via Colab cell parameters.
- Preserve `updatedAt` revision checks on `/api/catalog` so concurrent edits cannot overwrite saved quizzes or games.
