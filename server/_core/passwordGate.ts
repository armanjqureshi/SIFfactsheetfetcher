// Password screen for running the app (in LOCAL_MODE) on a server other people can reach.
// Set APP_PASSWORD to turn it on. One shared password; a signed cookie keeps you
// signed in for 30 days. Changing APP_PASSWORD (or SESSION_SECRET) signs everyone out.
import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import { createHash, timingSafeEqual } from "node:crypto";
import type { CookieOptions, Express, NextFunction, Request, Response } from "express";
import { SignJWT, jwtVerify } from "jose";

const SESSION_DAYS = 30;
const MAX_FAILURES = 10;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const failures = new Map<string, { count: number; resetAt: number }>();

export function appPassword(): string {
  return process.env.APP_PASSWORD ?? "";
}

export function passwordRequired(): boolean {
  return appPassword().length > 0;
}

function sessionKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET?.trim() || `app-password:${appPassword()}`;
  return createHash("sha256").update(`sif-session-v1:${secret}`).digest();
}

export function passwordMatches(candidate: string, expected = appPassword()): boolean {
  if (!expected) return false;
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function createPasswordSession(): Promise<string> {
  return new SignJWT({ scope: "app-password" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(sessionKey());
}

export async function verifyPasswordSession(token: string | undefined | null): Promise<boolean> {
  if (!token || !passwordRequired()) return false;
  try {
    const { payload } = await jwtVerify(token, sessionKey(), { algorithms: ["HS256"] });
    return payload.scope === "app-password";
  } catch {
    return false;
  }
}

export async function requestHasPasswordSession(req: Request): Promise<boolean> {
  const token = parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME];
  return verifyPasswordSession(token);
}

function cookieOptions(req: Request): CookieOptions {
  const https = req.secure || req.headers["x-forwarded-proto"] === "https";
  return { httpOnly: true, path: "/", sameSite: "lax", secure: https, maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 };
}

function tooManyFailures(ip: string): boolean {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const entry = failures.get(ip);
  if (!entry || now > entry.resetAt) failures.set(ip, { count: 1, resetAt: now + FAILURE_WINDOW_MS });
  else entry.count += 1;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

function loginPage(message?: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Sign in · SIF factsheet reader</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Fira+Sans:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
         background: #f7f6f9; color: #1d1b22; font-family: "Fira Sans", system-ui, sans-serif; }
  main { width: 100%; max-width: 380px; background: #fff; border: 1px solid #e6e2ee; border-radius: 14px; padding: 28px; }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 22px; }
  .mark { width: 34px; height: 34px; border-radius: 9px; background: #5b2bbf; }
  .brand strong { display: block; font-size: 15px; }
  .brand small { color: #6b6676; font-size: 12px; }
  h1 { font-size: 20px; font-weight: 500; margin: 0 0 6px; }
  p { color: #6b6676; font-size: 14px; margin: 0 0 18px; line-height: 1.5; }
  label { display: block; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
  input { width: 100%; font: inherit; font-size: 15px; padding: 10px 12px; border: 1px solid #d6d0e2; border-radius: 9px; }
  input:focus { outline: 2px solid #5b2bbf33; border-color: #5b2bbf; }
  button { width: 100%; margin-top: 14px; font: inherit; font-weight: 500; font-size: 15px; color: #fff;
           background: #5b2bbf; border: 0; border-radius: 9px; padding: 11px; cursor: pointer; }
  button:hover { background: #4a22a0; }
  .error { color: #b42318; background: #fef3f2; border: 1px solid #fecdca; border-radius: 9px; padding: 9px 11px; font-size: 13px; margin-bottom: 14px; }
</style>
</head>
<body>
<main>
  <div class="brand"><span class="mark"></span><span><strong>1 Finance</strong><small>SIF factsheet reader</small></span></div>
  <h1>Sign in</h1>
  <p>Enter the password to open the reader.</p>
  ${message ? `<div class="error" role="alert">${escapeHtml(message)}</div>` : ""}
  <form method="post" action="/login">
    <label for="password">Password</label>
    <input id="password" name="password" type="password" autocomplete="current-password" required autofocus />
    <button type="submit">Open the reader</button>
  </form>
</main>
</body>
</html>`;
}

const PUBLIC_PATHS = ["/login", "/logout", "/api/", "/manus-storage/"];

export function registerPasswordGate(app: Express) {
  app.get("/login", (_req, res) => {
    res.set("Cache-Control", "no-store").type("html").send(loginPage());
  });

  app.post("/login", async (req: Request, res: Response) => {
    const ip = req.ip ?? "unknown";
    if (tooManyFailures(ip)) {
      res.status(429).type("html").send(loginPage("Too many wrong attempts. Try again in 15 minutes."));
      return;
    }
    const candidate = typeof req.body?.password === "string" ? req.body.password : "";
    if (!passwordMatches(candidate)) {
      recordFailure(ip);
      await new Promise((resolve) => setTimeout(resolve, 400));
      res.status(401).type("html").send(loginPage("That password isn't right."));
      return;
    }
    failures.delete(ip);
    res.cookie(COOKIE_NAME, await createPasswordSession(), cookieOptions(req));
    res.redirect(303, "/");
  });

  app.get("/logout", (req, res) => {
    const { maxAge: _maxAge, ...options } = cookieOptions(req);
    res.clearCookie(COOKIE_NAME, options);
    res.redirect(303, "/login");
  });

  // Stored PDFs need a session too.
  app.use("/manus-storage", async (req: Request, res: Response, next: NextFunction) => {
    if (await requestHasPasswordSession(req)) return next();
    res.status(401).send("Sign in to view this file");
  });

  // Send page loads to the sign-in screen until the password is entered.
  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const isPageLoad = req.method === "GET" && (req.headers.accept ?? "").includes("text/html");
    if (!isPageLoad || PUBLIC_PATHS.some((prefix) => req.path === prefix.replace(/\/$/, "") || req.path.startsWith(prefix))) {
      return next();
    }
    if (await requestHasPasswordSession(req)) return next();
    res.redirect(302, "/login");
  });
}
