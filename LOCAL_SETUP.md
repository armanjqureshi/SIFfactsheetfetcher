# Run the SIF factsheet reader on your computer

This runs the app in local mode: no Manus account, no sign-in screen, and PDFs are saved in a folder on your computer. Factsheets are fetched straight from the fund house websites over your own internet connection.

Works on Windows and Mac. Commands go in a terminal: **PowerShell** on Windows, **Terminal** on Mac.

## 1. Install the tools (one time)

1. **Node.js 22 LTS**: download from https://nodejs.org and install with the default options.
2. **pnpm**: in a new terminal, run:
   ```
   npm install -g pnpm@10.18.0
   ```
   On Windows, if PowerShell says running scripts is disabled, run this once and try again:
   ```
   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
   ```
3. **A MySQL database**: pick one.
   - **Option A, Docker Desktop**: install from https://www.docker.com/products/docker-desktop and open it once so it's running.
   - **Option B, MySQL Server**: install MySQL Community Server 8.4 from https://dev.mysql.com/downloads/mysql/ (on Windows, use the MySQL Installer). Remember the root password you set.

## 2. Get the code

With Git:
```
git clone https://github.com/armanjqureshi/SIFfactsheetfetcher.git
cd SIFfactsheetfetcher
```
Without Git: on the GitHub page, click **Code → Download ZIP**, unzip it, then open a terminal in that folder.

## 3. Create the database (one time)

**Option A, Docker:**
```
docker compose up -d
```
Wait about 20 seconds the first time while MySQL starts.

**Option B, MySQL Server:** open **MySQL Command Line Client** (or MySQL Workbench), sign in as root and run:
```sql
CREATE DATABASE sif CHARACTER SET utf8mb4;
CREATE USER 'sif'@'localhost' IDENTIFIED BY 'sif';
CREATE USER 'sif'@'127.0.0.1' IDENTIFIED BY 'sif';
GRANT ALL PRIVILEGES ON sif.* TO 'sif'@'localhost';
GRANT ALL PRIVILEGES ON sif.* TO 'sif'@'127.0.0.1';
FLUSH PRIVILEGES;
```

## 4. Set up the app (one time)

Copy the settings file:
- Windows: `copy .env.example .env`
- Mac: `cp .env.example .env`

Then install and create the tables:
```
pnpm install
pnpm db:migrate
```

## 5. Start it

```
pnpm dev
```
When you see `Server listening on port 3000`, open **http://localhost:3000** in your browser. Leave the terminal open while you use the app; press `Ctrl + C` in it to stop.

## Every time after that

1. Make sure MySQL is running. With Docker, open Docker Desktop and run `docker compose up -d`. An installed MySQL Server usually starts on its own.
2. In the project folder, run `pnpm dev` and open http://localhost:3000.

To get updates from GitHub later: `git pull`, then `pnpm install` and `pnpm db:migrate`.

## Good to know

- Local mode signs you in automatically, so it only accepts connections from your own computer. Don't turn on `LOCAL_MODE` on a server other people can reach.
- PDFs are stored in the `data/storage` folder inside the project. Back it up together with the database if you want to keep your document history.
- The name in the top-right corner comes from `LOCAL_USER_NAME` in `.env`.

## If something goes wrong

| Message | What to do |
|---|---|
| `ECONNREFUSED 127.0.0.1:3306` | MySQL isn't running. Start Docker Desktop and run `docker compose up -d`, or start the MySQL service. |
| `Access denied for user 'sif'` | The user or password in `DATABASE_URL` in `.env` doesn't match your MySQL. Re-run the SQL in step 3, or put your own user and password in `.env`. |
| `port is already allocated` (Docker) | Another MySQL is already using port 3306. Use option B with that MySQL instead, or stop it. |
| `EADDRINUSE :::3000` or port 3000 in use | Something else is using port 3000. Set `PORT=3001` in `.env` and open http://localhost:3001. |
| `'pnpm' is not recognized` | Close and reopen the terminal after installing pnpm. |
| A factsheet fetch fails | The fund house website may be down or have changed its page. Use **Use PDF fallback** and upload the PDF you downloaded. |
