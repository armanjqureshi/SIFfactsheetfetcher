// Local mode lets the app run on your own computer without Manus services.
// - Login: every request is treated as one local user (no sign-in screen).
// - Storage: PDFs are saved under LOCAL_STORAGE_DIR and served at /manus-storage/.
// Only enable it on a machine you control. The server binds to 127.0.0.1 in this
// mode so other devices on your network cannot reach the auto-signed-in app.
import express, { type Express } from "express";
import path from "node:path";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";

const LOCAL_OPEN_ID = "local-user";
let cachedUser: User | null = null;

export async function getLocalUser(): Promise<User | null> {
  if (cachedUser) return cachedUser;
  await db.upsertUser({
    openId: LOCAL_OPEN_ID,
    name: ENV.localUserName,
    email: null,
    loginMethod: "local",
    role: "admin",
    lastSignedIn: new Date(),
  });
  cachedUser = (await db.getUserByOpenId(LOCAL_OPEN_ID)) ?? null;
  return cachedUser;
}

export function localStorageRoot(): string {
  return path.resolve(process.cwd(), ENV.localStorageDir);
}

export function resolveLocalStoragePath(key: string): string {
  const root = localStorageRoot();
  const target = path.resolve(root, key);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Storage key resolves outside the local storage folder");
  }
  return target;
}

export function registerLocalStorageRoutes(app: Express) {
  app.use(
    "/manus-storage",
    express.static(localStorageRoot(), { fallthrough: false, index: false, dotfiles: "deny" }),
  );
}
