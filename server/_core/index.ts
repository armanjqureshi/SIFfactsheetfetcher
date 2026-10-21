import "dotenv/config";
import express from "express";
import { createServer } from "http";
import path from "node:path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { localStorageRoot, registerLocalStorageRoutes } from "./localMode";
import { passwordRequired, registerPasswordGate } from "./passwordGate";
import { serveStatic, setupVite } from "./vite";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

// RUN_MIGRATIONS=true creates/updates the database tables on start-up (used on Railway).
async function runMigrationsIfRequested() {
  if (process.env.RUN_MIGRATIONS !== "true") return;
  if (!process.env.DATABASE_URL) throw new Error("RUN_MIGRATIONS is set but DATABASE_URL is missing");
  const db = drizzle(process.env.DATABASE_URL);
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  await db.$client.end();
  console.log("[Database] Migrations are up to date");
}

async function startServer() {
  // Local mode signs everyone in automatically. Without a password it must stay on this computer.
  const host = process.env.HOST?.trim() || (ENV.localMode && !passwordRequired() ? "127.0.0.1" : "0.0.0.0");
  if (ENV.localMode && !passwordRequired() && !LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `Refusing to start: LOCAL_MODE without APP_PASSWORD would let anyone on the network in (HOST=${host}). ` +
        "Set APP_PASSWORD, or remove HOST to keep the app on this computer.",
    );
  }

  await runMigrationsIfRequested();

  const app = express();
  const server = createServer(app);
  // Behind Railway's (or any) HTTPS proxy: trust one hop so req.ip and req.secure are correct.
  if (ENV.localMode) app.set("trust proxy", 1);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  if (ENV.localMode) {
    if (passwordRequired()) registerPasswordGate(app);
    registerLocalStorageRoutes(app);
  } else {
    registerOAuthRoutes(app);
  }
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", error => { console.error("Server failed:", error.message); process.exit(1); });
  server.listen(port, host, () => {
    console.log(`Server listening on port ${port}`);
    if (ENV.localMode) {
      if (LOOPBACK_HOSTS.has(host)) console.log(`[Local mode] Open http://localhost:${port} in your browser`);
      console.log(`[Local mode] Password screen: ${passwordRequired() ? "on" : "off"}`);
      console.log(`[Local mode] PDFs are stored in ${localStorageRoot()}`);
    }
  });
}

startServer().catch(error => { console.error(error); process.exit(1); });
