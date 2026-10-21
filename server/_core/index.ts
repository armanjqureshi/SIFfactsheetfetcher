import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { localStorageRoot, registerLocalStorageRoutes } from "./localMode";
import { serveStatic, setupVite } from "./vite";

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  if (ENV.localMode) {
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
  // Local mode signs everyone in automatically, so by default only this computer can reach it.
  const host = process.env.HOST?.trim() || (ENV.localMode ? "127.0.0.1" : "0.0.0.0");
  server.listen(port, host, () => {
    console.log(`Server listening on port ${port}`);
    if (ENV.localMode) {
      console.log(`[Local mode] Open http://localhost:${port} in your browser`);
      console.log(`[Local mode] PDFs are stored in ${localStorageRoot()}`);
    }
  });
}

startServer().catch(error => { console.error(error); process.exit(1); });
