# Host the SIF factsheet reader on Railway

This gives the app a public link with a password screen. Railway builds it from this GitHub repo using the `Dockerfile`, runs a MySQL database next to it, and keeps PDFs on a volume.

## What Railway needs

| Piece | Setting |
|---|---|
| App service | Deploy from the GitHub repo `armanjqureshi/SIFfactsheetfetcher`, branch `main`. Railway finds the `Dockerfile` itself. |
| Database | Add a **MySQL** database to the same project. |
| Volume | Attach a volume to the app service, mounted at `/data`. Without it, stored PDFs are lost on every redeploy. |
| Health check | Path `/api/health` (optional but recommended). |
| Public link | App service → Settings → Networking → **Generate domain**. |

## App service variables

| Variable | Value |
|---|---|
| `LOCAL_MODE` | `true` |
| `APP_PASSWORD` | A strong shared password (12+ characters). Everyone who uses the link needs it. |
| `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (Railway fills in the database's private address) |
| `RUN_MIGRATIONS` | `true` (creates and updates the database tables on each start) |
| `LOCAL_STORAGE_DIR` | `/data/storage` |
| `LOCAL_USER_NAME` | The name shown in the app's top-right corner. Only the first word shows, so use one word, e.g. `Team` |

Railway sets `PORT` itself. Don't set `HOST`.

## How sign-in works

- Opening the link shows a password screen. The right password keeps that browser signed in for 30 days.
- After 10 wrong attempts from the same address, sign-in is paused for 15 minutes.
- Changing `APP_PASSWORD` signs everyone out.
- Stored PDFs also need a signed-in browser.

## Updating

Every push to `main` on GitHub redeploys automatically. Database changes are applied on start because of `RUN_MIGRATIONS=true`.
